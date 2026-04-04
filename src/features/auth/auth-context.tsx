import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthState {
  session: Session | null
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session)

      // Capture Google OAuth tokens on sign-in — these are only available
      // at this moment and Supabase does not persist them
      if (event === 'SIGNED_IN' && session?.provider_token) {
        await storeCalendarTokens(session)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/calendar.readonly',
        redirectTo: window.location.origin,
      },
    })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

/**
 * Store Google OAuth tokens in connected_calendars on first sign-in.
 * provider_token and provider_refresh_token are only available during
 * the SIGNED_IN event — they must be captured immediately.
 */
async function storeCalendarTokens(session: Session) {
  const userId = session.user.id
  const providerToken = session.provider_token
  const providerRefreshToken = session.provider_refresh_token

  if (!providerToken) return

  // Look up the user's family_member record
  const { data: member } = await supabase
    .from('family_members')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  if (!member) return

  // Store OAuth tokens in google_tokens (one row per family member)
  // Cast to any — google_tokens isn't in the generated DB types yet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('google_tokens') as any).upsert(
    {
      family_member_id: member.id,
      access_token: providerToken,
      refresh_token: providerRefreshToken ?? null,
      token_expires_at: session.expires_at
        ? new Date(session.expires_at * 1000).toISOString()
        : null,
    },
    { onConflict: 'family_member_id' }
  )
}

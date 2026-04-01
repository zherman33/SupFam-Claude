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
  error: string | null
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/calendar.readonly',
        redirectTo: window.location.origin,
      },
    })
    if (error) {
      if (error.message.includes('provider')) {
        setError(
          'Google sign-in is not enabled yet. Please enable the Google provider in your Supabase project settings (Authentication → Providers → Google).'
        )
      } else {
        setError(error.message)
      }
    }
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
        error,
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
    .single()

  if (!member) return

  // Upsert the Google calendar connection
  await supabase.from('connected_calendars').upsert(
    {
      family_member_id: member.id,
      provider: 'google',
      access_token: providerToken,
      refresh_token: providerRefreshToken ?? null,
      token_expires_at: session.expires_at
        ? new Date(session.expires_at * 1000).toISOString()
        : null,
      calendar_id: 'primary',
      calendar_name: 'Google Calendar',
    },
    { onConflict: 'family_member_id,provider' }
  )
}

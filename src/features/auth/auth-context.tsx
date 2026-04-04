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
        scopes: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/tasks',
        redirectTo: window.location.origin,
        queryParams: {
          // Force Google to show the consent screen so new scopes are always granted
          access_type: 'offline',
          prompt: 'consent',
        },
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
 * In-memory token cache: if a user signs in before their family_member
 * row exists (new user joining a family), we hold the token here and
 * flush it once the member row is created (called from FamilySetup.onComplete).
 */
const pendingTokens = new Map<string, { access: string; refresh: string | null; expiresAt: string | null }>()

/**
 * Store Google OAuth tokens in google_tokens on sign-in.
 * provider_token is only available at the SIGNED_IN moment — capture it
 * immediately, then retry once the family_member row exists.
 */
async function storeCalendarTokens(session: Session) {
  const userId = session.user.id
  const providerToken = session.provider_token
  const providerRefreshToken = session.provider_refresh_token

  if (!providerToken) return

  // Cache the token regardless — we may need it after family setup
  pendingTokens.set(userId, {
    access: providerToken,
    refresh: providerRefreshToken ?? null,
    expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
  })

  // Try to write immediately (works for returning users who already have a member row)
  await flushPendingToken(userId)
}

/**
 * Called after family setup completes so we can flush the cached token
 * now that the family_member row exists.
 */
export async function flushPendingToken(userId: string) {
  const { data: member } = await supabase
    .from('family_members')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  if (!member) return // still no row — caller should retry later

  const tok = pendingTokens.get(userId)
  if (!tok) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('google_tokens') as any).upsert(
    {
      family_member_id: member.id,
      access_token: tok.access,
      refresh_token: tok.refresh,
      token_expires_at: tok.expiresAt,
    },
    { onConflict: 'family_member_id' }
  )

  pendingTokens.delete(userId)
}

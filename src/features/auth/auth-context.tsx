import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'

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
    if (!Capacitor.isNativePlatform()) return

    const sub = App.addListener('appUrlOpen', async (event: { url: string }) => {
      if (event.url.startsWith('com.supfam.app://')) {
        try {
          await Browser.close()
        } catch {
          // ignore if browser already closed
        }

        const url = new URL(event.url)
        if (url.hash && url.hash.includes('access_token=')) {
          const params = new URLSearchParams(url.hash.substring(1))
          const access_token = params.get('access_token')
          const refresh_token = params.get('refresh_token')
          const provider_token = params.get('provider_token')
          const provider_refresh_token = params.get('provider_refresh_token')
          const expires_in = params.get('expires_in')

          if (access_token && refresh_token) {
            const { data: { session } } = await supabase.auth.setSession({ access_token, refresh_token })
            if (session && provider_token) {
              const expiresAt = expires_in ? new Date(Date.now() + parseInt(expires_in) * 1000).toISOString() : null
              setPendingToken(session.user.id, {
                access: provider_token,
                refresh: provider_refresh_token ?? null,
                expiresAt,
              })
              await flushPendingToken(session.user.id)
            }
          }
        } else if (url.searchParams.get('code')) {
          const code = url.searchParams.get('code')!
          await supabase.auth.exchangeCodeForSession(code)
        }
      }
    })

    return () => {
      sub.then((listener: { remove: () => void }) => listener.remove())
    }
  }, [])

  useEffect(() => {
    // If running inside Chrome/external browser right after mobile OAuth redirect, attempt JS redirect
    if (
      !Capacitor.isNativePlatform() &&
      window.location.search.includes('native=true') &&
      (window.location.hash.includes('access_token=') || window.location.search.includes('code='))
    ) {
      window.location.href = 'com.supfam.app://auth' + window.location.search + window.location.hash
    }

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
    if (Capacitor.isNativePlatform()) {
      const { data } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/tasks',
          redirectTo: 'com.supfam.app://auth',
          skipBrowserRedirect: true,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })
      if (data?.url) {
        await Browser.open({ url: data.url })
      }
    } else {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/tasks',
          redirectTo: window.location.origin,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  // If Chrome browser blocks automatic redirect when returning via web URL, provide a direct click button
  if (
    !Capacitor.isNativePlatform() &&
    typeof window !== 'undefined' &&
    window.location.search.includes('native=true') &&
    (window.location.hash.includes('access_token=') || window.location.search.includes('code='))
  ) {
    const deepLinkUrl = 'com.supfam.app://auth' + window.location.search + window.location.hash
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-6 text-center text-white">
        <div className="max-w-md space-y-4 rounded-xl bg-zinc-900 p-6 shadow-lg border border-zinc-800">
          <h2 className="text-xl font-bold">Login Complete!</h2>
          <p className="text-sm text-zinc-400">Tap below to return to the Sup Fam tablet app.</p>
          <a
            href={deepLinkUrl}
            className="inline-block w-full rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white shadow transition hover:bg-emerald-500"
          >
            Return to App
          </a>
        </div>
      </div>
    )
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
 * LocalStorage-backed token cache: if a user signs in before their family_member
 * row exists (new user joining a family), we hold the token in localStorage and
 * flush it once the member row is created (called from FamilySetup.onComplete).
 * This ensures the token survives page reloads, Service Worker updates, and tab closures.
 */
const PENDING_TOKENS_KEY = 'supfam_pending_tokens'

interface CachedToken {
  access: string
  refresh: string | null
  expiresAt: string | null
}

function getPendingTokens(): Record<string, CachedToken> {
  try {
    const data = localStorage.getItem(PENDING_TOKENS_KEY)
    return data ? JSON.parse(data) : {}
  } catch (e) {
    console.error('Failed to parse pending tokens from localStorage:', e)
    return {}
  }
}

function setPendingToken(userId: string, token: CachedToken) {
  try {
    const tokens = getPendingTokens()
    tokens[userId] = token
    localStorage.setItem(PENDING_TOKENS_KEY, JSON.stringify(tokens))
  } catch (e) {
    console.error('Failed to save pending token to localStorage:', e)
  }
}

function getPendingToken(userId: string): CachedToken | null {
  const tokens = getPendingTokens()
  return tokens[userId] ?? null
}

function deletePendingToken(userId: string) {
  try {
    const tokens = getPendingTokens()
    delete tokens[userId]
    localStorage.setItem(PENDING_TOKENS_KEY, JSON.stringify(tokens))
  } catch (e) {
    console.error('Failed to delete pending token from localStorage:', e)
  }
}

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
  setPendingToken(userId, {
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

  const tok = getPendingToken(userId)
  if (!tok) return

  // ONLY update refresh_token if we actually received a new one from OAuth.
  // This prevents overwriting a valid refresh_token in the database with NULL.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {
    family_member_id: member.id,
    access_token: tok.access,
    token_expires_at: tok.expiresAt,
  }
  if (tok.refresh) {
    payload.refresh_token = tok.refresh
  }

  await (supabase.from('google_tokens') as any).upsert(
    payload,
    { onConflict: 'family_member_id' }
  )

  deletePendingToken(userId)
}

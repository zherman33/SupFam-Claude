import { useState } from 'react'
import { useAuth } from '@/features/auth/auth-context'
import { openBillingPortal } from './checkout'

/**
 * Shown when a family's subscription has ended (canceled / unpaid / expired).
 * Never a broken app — a clear, warm explanation plus a path back.
 */
export function Paywall() {
  const { signOut } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleUpdate = async () => {
    setBusy(true)
    setError('')
    try {
      await openBillingPortal()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hmm, that didn't work — try again?")
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-cream-100 px-6 text-center">
      <h1 className="font-handwritten text-5xl text-terracotta-500">Paused for now</h1>
      <p className="mt-4 max-w-sm font-display text-base text-brown-700/70">
        Your Sup Fam subscription has ended, so the family dashboard is on hold.
        Your calendars, tasks, and lists are all saved — nothing was deleted.
      </p>
      <div className="mt-8 w-full max-w-xs space-y-3">
        <button
          onClick={handleUpdate}
          disabled={busy}
          className="w-full rounded-2xl bg-brown-800 py-4 text-base font-semibold text-cream-50 transition-colors hover:bg-brown-900 disabled:opacity-40"
          style={{ minHeight: 56 }}
        >
          {busy ? 'Opening…' : 'Restart subscription'}
        </button>
        <button
          onClick={() => signOut()}
          className="w-full py-2 text-sm text-brown-700/50 hover:text-brown-700"
        >
          Sign out
        </button>
      </div>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      <p className="mt-8 max-w-xs text-xs text-brown-700/40">
        Questions? Write to us and we'll sort it out together.
      </p>
    </div>
  )
}

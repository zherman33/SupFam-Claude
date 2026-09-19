import { useState } from 'react'
import { useFamilyMember } from '@/features/auth/use-family-member'
import { useSubscription, PLANS } from './use-subscription'
import { openBillingPortal } from './checkout'

/**
 * Billing settings: current plan, trial time left, renewal date,
 * and a doorway to Stripe's portal for card / plan / cancel changes.
 * Only the family admin can open the portal; members see read-only info.
 */
export function BillingSettings() {
  const { data: member } = useFamilyMember()
  const sub = useSubscription()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!sub) return null
  const isAdmin = member?.role === 'admin'
  const plan = sub.planId !== 'none' ? PLANS[sub.planId] : null

  const handlePortal = async () => {
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
    <div className="space-y-4">
      <div className="rounded-2xl border border-sand-200/80 bg-white p-5 shadow-2xs">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-brown-700/50">
              Current plan
            </p>
            <p className="mt-1 font-display text-2xl text-brown-800">{sub.planLabel}</p>
            {plan && (
              <p className="text-sm text-brown-700/60">
                {plan.price}
                {plan.cadence}
              </p>
            )}
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              sub.isPro
                ? 'bg-green-100 text-green-800'
                : sub.needsPaymentAction
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-sand-100 text-brown-700/60'
            }`}
          >
            {sub.isTrialing
              ? 'Trial'
              : sub.status === 'active'
                ? 'Active'
                : sub.status === 'past_due'
                  ? 'Payment issue'
                  : sub.status}
          </span>
        </div>

        {sub.isTrialing && sub.trialDaysLeft !== null && (
          <p className="mt-3 rounded-xl bg-cream-50 px-4 py-3 text-sm text-brown-700/70">
            {sub.trialDaysLeft === 0
              ? 'Your free trial ends today.'
              : `${sub.trialDaysLeft} ${sub.trialDaysLeft === 1 ? 'day' : 'days'} left in your free trial.`}{' '}
            Your card is only charged if you stay.
          </p>
        )}

        {sub.needsPaymentAction && (
          <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Your last payment didn't go through. Update your card to keep everything running.
          </p>
        )}

        {sub.currentPeriodEnd && sub.status === 'active' && (
          <p className="mt-3 text-sm text-brown-700/60">
            {sub.cancelAtPeriodEnd ? 'Ends' : 'Renews'}{' '}
            {new Date(sub.currentPeriodEnd).toLocaleDateString(undefined, {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
            .
          </p>
        )}

        {sub.isFounding && (
          <p className="mt-3 text-sm font-medium text-terracotta-600">
            Founding family — your $39/year rate is locked for life.
          </p>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-4">
          {isAdmin ? (
            <button
              onClick={handlePortal}
              disabled={busy}
              className="rounded-xl bg-brown-800 px-5 py-3 text-sm font-semibold text-cream-50 transition-colors hover:bg-brown-900 disabled:opacity-40"
            >
              {busy ? 'Opening…' : 'Manage billing'}
            </button>
          ) : (
            <p className="text-sm text-brown-700/50">
              Only the family admin can change billing.
            </p>
          )}
        </div>
        {isAdmin && (
          <p className="mt-2 text-xs text-brown-700/40">
            Update your card, switch plans, or cancel — handled securely by Stripe.
          </p>
        )}
      </div>
    </div>
  )
}

import { supabase } from '@/lib/supabase'
import type { PlanId } from './use-subscription'

/**
 * Start a 30-day trial via Stripe Checkout (card collected upfront).
 * Redirects the browser to Stripe's hosted checkout page.
 * Throws a friendly Error when billing isn't configured yet.
 */
export async function startCheckout(plan: Exclude<PlanId, 'none'>): Promise<never> {
  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: { plan },
  })
  if (error) throw new Error("Hmm, that didn't work — try again?")
  if (data?.error === 'billing_not_configured') {
    throw new Error('Payments are still being set up — check back soon.')
  }
  if (!data?.url) throw new Error("Hmm, that didn't work — try again?")
  window.location.href = data.url as string
  // Redirect leaves the page; satisfy the return type.
  throw new Error('Redirecting to checkout…')
}

/**
 * Open the Stripe Billing Portal (update card, change plan, cancel).
 * Throws a friendly Error on failure.
 */
export async function openBillingPortal(): Promise<void> {
  const { data, error } = await supabase.functions.invoke('create-portal-session', {
    body: {},
  })
  if (error) throw new Error("Hmm, that didn't work — try again?")
  if (data?.error === 'billing_not_configured') {
    throw new Error('Payments are still being set up — check back soon.')
  }
  if (!data?.url) throw new Error("Hmm, that didn't work — try again?")
  window.location.href = data.url as string
}

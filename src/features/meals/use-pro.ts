import { useSubscription } from '@/features/billing/use-subscription'

/**
 * Pro entitlement check — driven by the family's Stripe subscription state.
 * Grandfathered founding families (status 'active', no Stripe rows) pass.
 * Past-due families keep working through a grace period; canceled/unpaid/
 * expired families hit the paywall in App.tsx before this is ever consulted.
 */
export function useProAccess(): boolean {
  const sub = useSubscription()
  return sub?.isPro ?? false
}

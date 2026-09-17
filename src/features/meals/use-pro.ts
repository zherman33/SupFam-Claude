import { useFamilyMember } from '@/features/auth/use-family-member'

/**
 * Pro entitlement check.
 *
 * Billing (Stripe) doesn't exist yet — when it does, a webhook flips
 * families.plan_tier and this hook starts enforcing automatically.
 * Until then every existing family was backfilled to 'pro' (founding beta),
 * so this is a real gate with a dormant lock.
 */
export function useProAccess(): boolean {
  const { data: member } = useFamilyMember()
  return member?.families?.plan_tier === 'pro'
}

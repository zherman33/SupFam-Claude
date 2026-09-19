import { useFamilyMember } from '@/features/auth/use-family-member'

export type PlanId = 'none' | 'founding' | 'annual' | 'monthly'
export type SubscriptionStatus =
  | 'incomplete'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'expired'

export const PLANS: Record<
  Exclude<PlanId, 'none'>,
  { label: string; price: string; cadence: string; blurb: string }
> = {
  founding: {
    label: 'Founding',
    price: '$39',
    cadence: '/year, locked for life',
    blurb: 'For our earliest families. This rate never goes up.',
  },
  annual: {
    label: 'Annual',
    price: '$99',
    cadence: '/year',
    blurb: 'The whole house, handled. Two months free vs monthly.',
  },
  monthly: {
    label: 'Monthly',
    price: '$12',
    cadence: '/month',
    blurb: 'Flexibility first. Cancel anytime.',
  },
}

export interface Subscription {
  status: SubscriptionStatus
  planId: PlanId
  isFounding: boolean
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  /** App fully works: trialing, active, or past_due (grace). */
  isPro: boolean
  isTrialing: boolean
  trialDaysLeft: number | null
  /** Payment needs attention but the app keeps working. */
  needsPaymentAction: boolean
  /** Subscription ended — show the paywall, never a broken app. */
  isPaywalled: boolean
  planLabel: string
  planPriceLabel: string
}

const PRO_STATUSES: SubscriptionStatus[] = ['trialing', 'active', 'past_due']

export function useSubscription(): Subscription | null {
  const { data: member } = useFamilyMember()
  const f = member?.families
  if (!f) return null

  const status = (f.subscription_status ?? 'incomplete') as SubscriptionStatus
  const planId = (f.plan_id ?? 'none') as PlanId

  const isPro = PRO_STATUSES.includes(status)
  const isTrialing = status === 'trialing'
  const needsPaymentAction = status === 'past_due' || status === 'unpaid'
  const isPaywalled = status === 'canceled' || status === 'unpaid' || status === 'expired'

  let trialDaysLeft: number | null = null
  if (isTrialing && f.trial_ends_at) {
    trialDaysLeft = Math.max(
      0,
      Math.ceil((new Date(f.trial_ends_at).getTime() - Date.now()) / 86400000)
    )
  }

  const plan = planId !== 'none' ? PLANS[planId] : null

  return {
    status,
    planId,
    isFounding: !!f.is_founding,
    trialEndsAt: f.trial_ends_at,
    currentPeriodEnd: f.current_period_end,
    cancelAtPeriodEnd: !!f.cancel_at_period_end,
    isPro,
    isTrialing,
    trialDaysLeft,
    needsPaymentAction,
    isPaywalled,
    planLabel: plan ? `${plan.label}${f.is_founding ? ' · Founding rate' : ''}` : 'No plan yet',
    planPriceLabel: plan ? `${plan.price}${plan.cadence}` : '',
  }
}

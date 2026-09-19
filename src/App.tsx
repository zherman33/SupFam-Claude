import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { useFamilyMember } from '@/features/auth/use-family-member'
import { LoginPage } from '@/features/auth/login-page'
import { OnboardingFlow, useOnboardingStep } from '@/features/auth/onboarding-flow'
import { useSubscription } from '@/features/billing/use-subscription'
import { Paywall } from '@/features/billing/paywall'
import { Dashboard } from '@/features/dashboard/dashboard'
import { InstallPrompt } from '@/features/pwa/install-prompt'

export default function App() {
  const { user, loading } = useAuth()
  const queryClient = useQueryClient()
  // isFetching: actively in-flight. isLoading: no data yet AND fetching.
  // We only block on loading if the auth state is still resolving, or
  // the member query is actively fetching (not retrying with backoff).
  const { data: familyMember, isFetching: memberFetching } = useFamilyMember()
  const onboardingStep = useOnboardingStep()
  const subscription = useSubscription()

  // Helper to wrap routes so the InstallPrompt is always available
  const wrap = (children: React.ReactNode) => (
    <>
      <InstallPrompt />
      {children}
    </>
  )

  // Only show the splash while:
  // 1. Auth state is still resolving from Supabase
  // 2. User is logged in and we're actively fetching their member record (first load)
  // 3. Onboarding step is still being derived
  if (
    loading ||
    (user && memberFetching && familyMember === undefined) ||
    (user && familyMember && onboardingStep === null)
  ) {
    return wrap(
      <div className="flex min-h-svh items-center justify-center bg-cream-100">
        <p className="font-handwritten text-2xl text-terracotta-500">Loading…</p>
      </div>
    )
  }

  if (!user) {
    return wrap(<LoginPage />)
  }

  const handleOnboardingDone = () => {
    // Invalidate all family-related queries so they refetch fresh
    queryClient.invalidateQueries({ queryKey: ['family-member'] })
    queryClient.invalidateQueries({ queryKey: ['family-members'] })
  }

  if (!familyMember) {
    return wrap(<OnboardingFlow onComplete={handleOnboardingDone} />)
  }

  // Resume onboarding where server state says the family left off
  // (plan → calendars → invite). Fully-set-up families resolve 'done'.
  if (onboardingStep !== 'done') {
    return wrap(<OnboardingFlow onComplete={handleOnboardingDone} />)
  }

  // Subscription ended: clear paywall, never a broken app.
  if (subscription?.isPaywalled) {
    return wrap(<Paywall />)
  }

  return wrap(
    <>
      {subscription?.needsPaymentAction && <PaymentBanner />}
      <Dashboard />
    </>
  )
}

/** Gentle nudge when the last payment failed — the app keeps working. */
function PaymentBanner() {
  return (
    <div className="bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-900">
      Your last payment didn't go through — update your card in Settings → Billing to stay
      uninterrupted.
    </div>
  )
}

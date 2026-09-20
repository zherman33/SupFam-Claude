import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Capacitor } from '@capacitor/core'
import { useAuth } from '@/features/auth/auth-context'
import { useFamilyMember } from '@/features/auth/use-family-member'
import { LoginPage } from '@/features/auth/login-page'
import { OnboardingFlow, useOnboardingStep } from '@/features/auth/onboarding-flow'
import { useSubscription } from '@/features/billing/use-subscription'
import { Paywall } from '@/features/billing/paywall'
import { Dashboard } from '@/features/dashboard/dashboard'
import { InstallPrompt } from '@/features/pwa/install-prompt'
import { track } from '@/lib/telemetry'
import { useIsStaff } from '@/features/admin/use-is-staff'
import { UxDashboard } from '@/features/admin/ux-dashboard'

import { SupportWidget } from '@/features/support/support-widget'

export default function App() {
  const { user, loading } = useAuth()
  const queryClient = useQueryClient()
  // isFetching: actively in-flight. isLoading: no data yet AND fetching.
  // We only block on loading if the auth state is still resolving, or
  // the member query is actively fetching (not retrying with backoff).
  const { data: familyMember, isFetching: memberFetching } = useFamilyMember()
  const onboardingStep = useOnboardingStep()
  const subscription = useSubscription()
  const isStaff = useIsStaff()
  const [adminView, setAdminView] = useState(
    () =>
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('view') === 'admin',
  )

  // ── Product telemetry: session usage (screen time) ──
  // app_opened brackets the session; app_heartbeat fires once a minute
  // while the tab is visible; app_closed records session length.
  // The UX dashboard turns heartbeats into per-family screen-time hours
  // and "always-on display" detection (the 24/7 iPad pattern).
  const sessionStartRef = useRef<number | null>(null)
  const telemetryIdsRef = useRef({ userId: user?.id, memberId: familyMember?.id, familyId: familyMember?.family_id })
  // Keep the ids ref fresh for heartbeats (ref writes belong in effects).
  useEffect(() => {
    telemetryIdsRef.current = { userId: user?.id, memberId: familyMember?.id, familyId: familyMember?.family_id }
  })

  useEffect(() => {
    if (!user) return
    const closeSession = () => {
      if (sessionStartRef.current !== null) {
        track(
          'app_closed',
          { session_duration_ms: Date.now() - sessionStartRef.current },
          telemetryIdsRef.current,
        )
        sessionStartRef.current = null
      }
    }
    sessionStartRef.current = Date.now()
    track(
      'app_opened',
      { platform: Capacitor.isNativePlatform() ? 'native' : 'web' },
      telemetryIdsRef.current,
    )
    const heartbeatId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        track('app_heartbeat', {}, telemetryIdsRef.current)
      }
    }, 60_000)
    window.addEventListener('pagehide', closeSession)
    return () => {
      window.clearInterval(heartbeatId)
      window.removeEventListener('pagehide', closeSession)
      closeSession()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Helper to wrap routes so the InstallPrompt and support widget are always available
  const wrap = (children: React.ReactNode) => (
    <>
      <InstallPrompt />
      <SupportWidget />
      {children}
    </>
  )

  // Staff-only embedded UX analytics dashboard (?view=admin).
  if (isStaff && adminView) {
    return wrap(
      <UxDashboard
        onExit={() => {
          setAdminView(false)
          const u = new URL(window.location.href)
          u.searchParams.delete('view')
          window.history.replaceState({}, '', u.toString())
        }}
      />,
    )
  }

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

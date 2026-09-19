import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth, flushPendingToken } from './auth-context'
import { useFamilyMember, useFamilyMembers } from './use-family-member'
import { PLANS, type PlanId } from '@/features/billing/use-subscription'
import { startCheckout } from '@/features/billing/checkout'
import { AddCalendarModal } from '@/features/calendar/add-calendar-modal'

export type OnboardingStep =
  | 'welcome'
  | 'family'
  | 'plan'
  | 'calendars'
  | 'invite'
  | 'done'

const STEP_ORDER: OnboardingStep[] = ['welcome', 'family', 'plan', 'calendars', 'invite', 'done']
const STEP_LABELS: Record<Exclude<OnboardingStep, 'done'>, string> = {
  welcome: 'Welcome',
  family: 'Your family',
  plan: 'Plan',
  calendars: 'Calendars',
  invite: 'Invite',
}

/**
 * Derive where a user is in onboarding from server state — this makes the
 * flow resumable: close the tab mid-checkout and you land back on the
 * right step. Existing, fully-set-up families (trialing/active +
 * calendars + 2+ members) resolve to 'done' immediately.
 */
export function useOnboardingStep(): OnboardingStep | null {
  const { user } = useAuth()
  const { data: member, isFetching: memberFetching } = useFamilyMember()

  const { data: calCount, isLoading: calCountLoading } = useQuery({
    queryKey: ['onboarding-cal-count', member?.id],
    enabled: !!member?.id,
    queryFn: async () => {
      const { count } = await supabase
        .from('connected_calendars')
        .select('id', { count: 'exact', head: true })
        .eq('family_member_id', member!.id)
      return count ?? 0
    },
  })
  const { data: members, isLoading: membersLoading } = useFamilyMembers()

  const [checkoutSuccess, setCheckoutSuccess] = useState(() => {
    if (typeof window === 'undefined') return false
    const p = new URLSearchParams(window.location.search)
    if (p.get('checkout') === 'success') {
      // Clear the param so refresh doesn't re-trigger the optimistic state.
      window.history.replaceState({}, '', window.location.pathname)
      return true
    }
    return false
  })

  // Once the webhook flips the family to trialing, drop the optimistic flag.
  useEffect(() => {
    if (checkoutSuccess && member?.families?.subscription_status === 'trialing') {
      setCheckoutSuccess(false)
    }
  }, [checkoutSuccess, member?.families?.subscription_status])

  if (!user) return null
  if (memberFetching && member === undefined) return null
  if (!member) return 'welcome'

  // Explicit completion wins: "Enter Sup Fam" records this per member.
  // (The checks below can never pass for someone who skipped calendars
  // or hasn't invited anyone yet, which used to trap users in onboarding.)
  if (member.onboarding_completed) return 'done'

  // While the calendar/member counts are still loading, stay unresolved —
  // treating "not yet loaded" as zero flashes the Calendars/Invite steps on
  // every cold start for fully-set-up families. App.tsx shows the splash
  // while this returns null.
  if (calCountLoading || membersLoading) return null

  const status = member.families?.subscription_status ?? 'incomplete'
  const subscribed = status === 'trialing' || status === 'active' || checkoutSuccess
  if (!subscribed) return 'plan'
  if ((calCount ?? 0) === 0) return 'calendars'
  if ((members?.length ?? 1) < 2) return 'invite'
  return 'done'
}

// ─── Main flow ────────────────────────────────────────────────────────────

export function OnboardingFlow({ onComplete }: { onComplete: () => void }) {
  const initial = useOnboardingStep()
  const [step, setStep] = useState<OnboardingStep | null>(null)
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const queryClient = useQueryClient()

  // Adopt the derived step whenever server state changes (e.g. after
  // family creation or Stripe redirect), unless the user is mid-form.
  useEffect(() => {
    if (initial && initial !== 'done') setStep(initial)
    else if (initial === 'done') onComplete()
  }, [initial]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['family-member'] })
    await queryClient.invalidateQueries({ queryKey: ['family-members'] })
  }

  if (!step) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-cream-100">
        <p className="font-handwritten text-2xl text-terracotta-500">Loading…</p>
      </div>
    )
  }

  const go = (s: OnboardingStep) => setStep(s)

  return (
    <div className="flex min-h-svh flex-col bg-cream-100 pt-safe">
      <ProgressBar step={step} />
      <div className="flex-1 px-6">
        {step === 'welcome' && (
          <WelcomeStep
            onCreate={() => { setMode('create'); go('family') }}
            onJoin={() => { setMode('join'); go('family') }}
          />
        )}
        {step === 'family' && (
          <FamilyStep
            mode={mode}
            onDone={async () => {
              await refresh()
              // Derivation will move joiners past billing automatically.
            }}
          />
        )}
        {step === 'plan' && <PlanStep onBack={() => go('family')} />}
        {step === 'calendars' && <CalendarsStep onNext={() => go('invite')} />}
        {step === 'invite' && <InviteStep onDone={onComplete} />}
      </div>
    </div>
  )
}

function ProgressBar({ step }: { step: OnboardingStep }) {
  const idx = STEP_ORDER.indexOf(step)
  const visible = STEP_ORDER.filter(s => s !== 'done' && s !== 'welcome')
  const cur = visible.indexOf(step as Exclude<OnboardingStep, 'done' | 'welcome'>)
  if (idx <= 0) return <div className="h-14" />
  return (
    <div className="px-6 pt-12 pb-2">
      <div className="flex items-center gap-2">
        {visible.map((s, i) => (
          <div key={s} className="flex flex-1 flex-col gap-1.5">
            <div
              className={`h-1.5 rounded-full transition-colors ${
                i <= cur ? 'bg-terracotta-500' : 'bg-sand-200'
              }`}
            />
            <span
              className={`text-[11px] font-medium ${
                i <= cur ? 'text-brown-800' : 'text-brown-700/40'
              }`}
            >
              {STEP_LABELS[s]}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Steps ────────────────────────────────────────────────────────────────

function WelcomeStep({ onCreate, onJoin }: { onCreate: () => void; onJoin: () => void }) {
  return (
    <div className="flex flex-col items-center pt-16 text-center">
      <h1 className="font-handwritten text-6xl text-terracotta-500">Sup Fam</h1>
      <p className="mt-4 max-w-xs font-display text-lg text-brown-700/70">
        The iPad on the counter that runs the house. Let's get your family set up.
      </p>
      <div className="mt-10 w-full max-w-sm space-y-3">
        <button
          onClick={onCreate}
          className="w-full rounded-2xl bg-brown-800 py-4 text-base font-semibold text-cream-50 hover:bg-brown-900"
          style={{ minHeight: 56 }}
        >
          Start a new family
        </button>
        <button
          onClick={onJoin}
          className="w-full rounded-2xl bg-white py-4 text-base font-semibold text-brown-800 ring-1 ring-sand-200"
          style={{ minHeight: 56 }}
        >
          I have an invite code
        </button>
      </div>
      <p className="mt-6 text-xs text-brown-700/40">Free for 30 days · card required, cancel anytime</p>
    </div>
  )
}

function FamilyStep({ mode, onDone }: { mode: 'create' | 'join'; onDone: () => void }) {
  const { user } = useAuth()
  const [displayName, setDisplayName] = useState(
    user?.user_metadata?.full_name?.split(' ')[0] ?? ''
  )
  const [familyName, setFamilyName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const createFamily = async () => {
    if (!user || !familyName.trim() || !displayName.trim()) return
    setLoading(true)
    setError('')
    try {
      // Atomic server-side creation: the families SELECT policy requires an
      // existing membership, so a raw INSERT + select-back fails RLS for new users.
      const { data, error: rpcError } = await supabase.rpc('create_family', {
        p_name: familyName.trim(),
        p_display_name: displayName.trim(),
      })
      if (rpcError) throw rpcError
      const res = data as { ok: boolean; error?: string } | null
      if (!res?.ok) {
        setError(res?.error ?? "Hmm, that didn't work — try again?")
        return
      }
      await flushPendingToken(user.id)
      onDone()
    } catch {
      setError("Hmm, that didn't work — try again?")
    } finally {
      setLoading(false)
    }
  }

  const joinFamily = async () => {
    if (!user || code.trim().length < 6 || !displayName.trim()) return
    setLoading(true)
    setError('')
    try {
      // SECURITY DEFINER RPC: looks up the family by code server-side so
      // invite codes can't be enumerated through RLS.
      const { error: rpcError } = await (supabase.rpc as any)('join_family_with_code', {
        p_code: code.trim(),
        p_display_name: displayName.trim(),
      })
      if (rpcError) throw rpcError
      await flushPendingToken(user.id)
      onDone()
    } catch {
      setError("Couldn't find that code — double-check it?")
    } finally {
      setLoading(false)
    }
  }

  const valid = mode === 'create'
    ? familyName.trim() && displayName.trim()
    : code.trim().length >= 6 && displayName.trim()

  return (
    <div className="pt-8">
      <h1 className="font-handwritten text-5xl text-terracotta-500">
        {mode === 'create' ? 'New family' : 'Join family'}
      </h1>
      <p className="mt-2 font-display text-base text-brown-700/60">
        {mode === 'create' ? "You'll be the admin." : 'Enter the code from your partner.'}
      </p>
      <div className="mt-6 space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-brown-700">Your name</label>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Alex"
            className={inputClass}
          />
        </div>
        {mode === 'create' ? (
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-brown-700">Family name</label>
            <input
              type="text"
              value={familyName}
              onChange={e => setFamilyName(e.target.value)}
              placeholder="The Millers"
              className={inputClass}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-brown-700">Invite code</label>
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder="ABC123"
              className={`${inputClass} text-center font-mono text-xl font-bold uppercase tracking-widest`}
            />
          </div>
        )}
        {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
        <button
          onClick={mode === 'create' ? createFamily : joinFamily}
          disabled={loading || !valid}
          className="w-full rounded-2xl bg-brown-800 py-4 text-base font-semibold text-cream-50 hover:bg-brown-900 disabled:opacity-40"
          style={{ minHeight: 56 }}
        >
          {loading ? 'Working…' : mode === 'create' ? 'Create family' : 'Join family'}
        </button>
      </div>
    </div>
  )
}

function PlanStep({ onBack }: { onBack: () => void }) {
  const [busyPlan, setBusyPlan] = useState<PlanId | null>(null)
  const [error, setError] = useState('')
  const [showPromo, setShowPromo] = useState(false)
  const [promoCode, setPromoCode] = useState('')
  const [promoBusy, setPromoBusy] = useState(false)
  const [promoError, setPromoError] = useState('')
  const queryClient = useQueryClient()

  const choose = async (plan: Exclude<PlanId, 'none'>) => {
    setBusyPlan(plan)
    setError('')
    try {
      await startCheckout(plan) // redirects to Stripe
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hmm, that didn't work — try again?")
      setBusyPlan(null)
    }
  }

  const redeem = async () => {
    if (!promoCode.trim() || promoBusy) return
    setPromoBusy(true)
    setPromoError('')
    try {
      const { data, error: rpcError } = await supabase.rpc('redeem_promo_code', {
        p_code: promoCode.trim(),
      })
      if (rpcError) throw rpcError
      const res = data as { ok: boolean; error?: string; plan?: string } | null
      if (!res?.ok) {
        setPromoError(res?.error ?? "That code didn't work — try again?")
        return
      }
      // Refetch membership: status flips to active, onboarding advances past this step.
      await queryClient.invalidateQueries({ queryKey: ['family-member'] })
    } catch (e) {
      setPromoError(e instanceof Error ? e.message : "That code didn't work — try again?")
    } finally {
      setPromoBusy(false)
    }
  }

  const order: Exclude<PlanId, 'none'>[] = ['founding', 'annual', 'monthly']

  return (
    <div className="pt-8 pb-10">
      <h1 className="font-handwritten text-5xl text-terracotta-500">Choose your plan</h1>
      <p className="mt-2 font-display text-base text-brown-700/60">
        Annual plans start with 30 days free. Monthly starts today — cancel anytime.
      </p>
      <div className="mt-6 space-y-3">
        {order.map(planId => {
          const p = PLANS[planId]
          const founding = planId === 'founding'
          return (
            <button
              key={planId}
              onClick={() => choose(planId)}
              disabled={busyPlan !== null}
              className={`relative w-full rounded-2xl bg-white p-5 text-left shadow-sm ring-1 transition-colors active:bg-cream-50 disabled:opacity-60 ${
                founding ? 'ring-2 ring-terracotta-500' : 'ring-sand-200/60'
              }`}
            >
              {founding && (
                <span className="absolute -top-3 left-5 rounded-full bg-terracotta-500 px-3 py-1 text-xs font-bold text-white">
                  Founding rate — limited
                </span>
              )}
              <div className="flex items-baseline justify-between">
                <p className="font-semibold text-brown-800">{p.label}</p>
                <p className="font-display text-2xl text-brown-800">
                  {p.price}
                  <span className="text-sm font-normal text-brown-700/50">{p.cadence}</span>
                </p>
              </div>
              <p className="mt-1 text-sm text-brown-700/55">{p.blurb}</p>
              <p className="mt-3 text-sm font-semibold text-terracotta-600">
                {busyPlan === planId
                  ? 'Opening checkout…'
                  : planId === 'monthly'
                    ? 'Subscribe — first $12 today →'
                    : 'Start 30-day free trial →'}
              </p>
            </button>
          )
        })}
      </div>
      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      <p className="mt-4 text-center text-xs text-brown-700/40">
        Card required upfront · cancel anytime · annual plans are $0 today
      </p>
      <div className="mt-3 text-center">
        {!showPromo ? (
          <button
            onClick={() => setShowPromo(true)}
            className="text-sm font-medium text-brown-700/60 underline underline-offset-2"
          >
            Have a promo code?
          </button>
        ) : (
          <div className="mx-auto max-w-xs">
            <div className="flex gap-2">
              <input
                value={promoCode}
                onChange={e => setPromoCode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && redeem()}
                placeholder="Enter code"
                autoCapitalize="characters"
                className="min-w-0 flex-1 rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm text-brown-800 placeholder:text-brown-700/35 focus:border-terracotta-500 focus:outline-none"
              />
              <button
                onClick={redeem}
                disabled={promoBusy || !promoCode.trim()}
                className="rounded-xl bg-brown-800 px-5 py-3 text-sm font-semibold text-cream-50 hover:bg-brown-900 disabled:opacity-40"
              >
                {promoBusy ? 'Checking…' : 'Apply'}
              </button>
            </div>
            {promoError && (
              <p className="mt-2 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">{promoError}</p>
            )}
          </div>
        )}
      </div>
      <button onClick={onBack} className="mt-2 w-full py-2 text-sm text-brown-700/50">
        ← Back
      </button>
    </div>
  )
}

function CalendarsStep({ onNext }: { onNext: () => void }) {
  const { data: member } = useFamilyMember()
  const { signInWithGoogle } = useAuth()
  const [showAdd, setShowAdd] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const queryClient = useQueryClient()

  const { data: calendars } = useQuery({
    queryKey: ['onboarding-calendars', member?.id],
    enabled: !!member?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('connected_calendars')
        .select('id, calendar_name, provider')
        .eq('family_member_id', member!.id)
      return data ?? []
    },
    refetchInterval: 5000, // pick up the token flush after re-auth
  })

  const connectGoogle = async () => {
    setConnecting(true)
    try {
      await signInWithGoogle()
    } finally {
      setConnecting(false)
    }
  }

  useEffect(() => {
    // If calendars appeared (e.g. after returning from Google), move on.
    if (calendars && calendars.length > 0) {
      const t = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['family-member'] })
        onNext()
      }, 1200)
      return () => clearTimeout(t)
    }
  }, [calendars]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="pt-8 pb-10">
      <h1 className="font-handwritten text-5xl text-terracotta-500">Calendars</h1>
      <p className="mt-2 font-display text-base text-brown-700/60">
        Bring everyone's schedule into one family view.
      </p>

      {calendars && calendars.length > 0 && (
        <div className="mt-6 space-y-2">
          {calendars.map(c => (
            <div key={c.id} className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-sand-200/60">
              <span className="h-3 w-3 rounded-full bg-terracotta-500" />
              <p className="text-sm font-medium text-brown-800">{c.calendar_name ?? c.provider}</p>
            </div>
          ))}
          <p className="pt-2 text-center text-sm text-brown-700/50">Nice — moving on…</p>
        </div>
      )}

      <div className="mt-6 space-y-3">
        <button
          onClick={connectGoogle}
          disabled={connecting}
          className="w-full rounded-2xl bg-brown-800 py-4 text-base font-semibold text-cream-50 hover:bg-brown-900 disabled:opacity-40"
          style={{ minHeight: 56 }}
        >
          {connecting ? 'Connecting…' : 'Connect Google calendars'}
        </button>
        <button
          onClick={() => setShowAdd(true)}
          className="w-full rounded-2xl bg-white py-4 text-base font-semibold text-brown-800 ring-1 ring-sand-200"
          style={{ minHeight: 56 }}
        >
          Add calendar by link (ICS)
        </button>
        <button onClick={onNext} className="w-full py-2 text-sm text-brown-700/50">
          Skip for now →
        </button>
      </div>
      {showAdd && <AddCalendarModal onClose={() => setShowAdd(false)} />}
    </div>
  )
}

function InviteStep({ onDone }: { onDone: () => void }) {
  const { data: member } = useFamilyMember()
  const { data: members } = useFamilyMembers()
  const [copied, setCopied] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [error, setError] = useState('')
  const queryClient = useQueryClient()
  const code = member?.families?.invite_code ?? ''

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable — code is visible above */
    }
  }

  const finish = async () => {
    if (finishing) return
    setFinishing(true)
    setError('')
    try {
      const { data, error: rpcError } = await supabase.rpc('complete_onboarding')
      if (rpcError) throw rpcError
      const res = data as { ok: boolean; error?: string } | null
      if (!res?.ok) throw new Error(res?.error ?? "Hmm, that didn't work — try again?")
      await queryClient.invalidateQueries({ queryKey: ['family-member'] })
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hmm, that didn't work — try again?")
      setFinishing(false)
    }
  }

  return (
    <div className="pt-8 pb-10 text-center">
      <h1 className="font-handwritten text-5xl text-terracotta-500">Invite them in</h1>
      <p className="mx-auto mt-2 max-w-xs font-display text-base text-brown-700/60">
        Sup Fam shines with the whole household. Share your invite code:
      </p>
      <button
        onClick={copy}
        className="mx-auto mt-6 rounded-2xl bg-white px-8 py-5 ring-1 ring-sand-200/60"
      >
        <p className="font-mono text-3xl font-bold uppercase tracking-[0.3em] text-brown-800">
          {code}
        </p>
        <p className="mt-2 text-xs text-brown-700/50">{copied ? 'Copied!' : 'Tap to copy'}</p>
      </button>
      {(members?.length ?? 1) > 1 && (
        <p className="mt-4 text-sm text-brown-700/60">
          {members!.length - 1} {members!.length - 1 === 1 ? 'person has' : 'people have'} joined so far.
        </p>
      )}
      <div className="mx-auto mt-8 w-full max-w-sm">
        <button
          onClick={finish}
          disabled={finishing}
          className="w-full rounded-2xl bg-brown-800 py-4 text-base font-semibold text-cream-50 hover:bg-brown-900 disabled:opacity-40"
          style={{ minHeight: 56 }}
        >
          {finishing ? 'Getting things ready…' : 'Enter Sup Fam'}
        </button>
        {error && (
          <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
        )}
        <p className="mt-3 text-xs text-brown-700/40">
          They can join anytime later from Settings, too.
        </p>
      </div>
    </div>
  )
}

const inputClass = `
  w-full rounded-xl border border-sand-300 bg-cream-50 px-4 py-3.5 text-base
  text-brown-800 placeholder:text-brown-700/35
  focus:border-terracotta-500 focus:outline-none focus:ring-1 focus:ring-terracotta-500
  transition-colors
`.trim()

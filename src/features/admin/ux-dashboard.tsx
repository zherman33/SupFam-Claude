import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────

interface FunnelRow {
  user_id: string
  family_id: string | null
  event: string
  first_seen: string
}

interface ScreenTimeRow {
  family_id: string
  day: string
  heartbeat_minutes: number
  active_hours: number
}

interface FamilyRow {
  id: string
  name: string
  created_at: string
  subscription_status: string
  plan_id: string
}

interface MemberRow {
  id: string
  family_id: string
  display_name: string
  joined_at: string
}

interface DetailEvent {
  event: string
  occurred_at: string
  properties: Record<string, unknown>
}

// ─── Funnel definition ────────────────────────────────────────────────────

interface FunnelStep {
  key: string
  label: string
  hint: string
  events: string[]
  /** stuck threshold: how long at this step before it counts as stuck */
  stuckAfterMs: number
}

const FUNNEL_STEPS: FunnelStep[] = [
  { key: 'account', label: 'Created account', hint: 'Signed in with Google', events: ['account_created'], stuckAfterMs: 24 * 3600_000 },
  { key: 'family', label: 'Created / joined family', hint: 'Named the household', events: ['family_created', 'family_joined'], stuckAfterMs: 48 * 3600_000 },
  { key: 'plan', label: 'Activated subscription', hint: 'Trial or paid plan live', events: ['subscription_activated'], stuckAfterMs: 72 * 3600_000 },
  { key: 'calendar', label: 'Connected calendar', hint: 'At least one calendar linked', events: ['calendar_connected'], stuckAfterMs: 72 * 3600_000 },
  { key: 'member', label: 'Added family member', hint: 'Someone joined via invite code', events: ['family_member_added'], stuckAfterMs: 7 * 24 * 3600_000 },
  { key: 'done', label: 'Finished onboarding', hint: 'Tapped “Enter Sup Fam”', events: ['onboarding_completed'], stuckAfterMs: 0 },
]

// ─── Helpers ──────────────────────────────────────────────────────────────

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!
}

function fmtDuration(ms: number | null): string {
  if (ms === null || !isFinite(ms)) return '—'
  if (ms < 0) return '—'
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h ${m % 60}m`
  const d = Math.floor(h / 24)
  return `${d}d ${h % 24}h`
}

function fmtHours(minutes: number): string {
  const h = minutes / 60
  return h >= 10 ? `${Math.round(h)}h` : `${h.toFixed(1)}h`
}

function shortId(id: string): string {
  return id.slice(0, 8)
}

// ─── Main dashboard ───────────────────────────────────────────────────────

export function UxDashboard({ onExit }: { onExit: () => void }) {
  const [days, setDays] = useState(7)
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null)
  // Stable "now" for stuck-duration math (avoids impure calls during render).
  const [now] = useState(() => Date.now())

  const funnelQ = useQuery({
    queryKey: ['ux-funnel', days],
    retry: false,
    queryFn: async () => {
      const since = new Date(Date.now() - days * 24 * 3600_000).toISOString()
      const { data, error } = await supabase.rpc('ux_funnel_first_seen', { p_since: since })
      if (error) throw error
      return data as FunnelRow[]
    },
  })

  const screenQ = useQuery({
    queryKey: ['ux-screen-time', days],
    retry: false,
    queryFn: async () => {
      const since = new Date(Date.now() - days * 24 * 3600_000).toISOString()
      const { data, error } = await supabase.rpc('ux_daily_screen_time', { p_since: since })
      if (error) throw error
      return data as ScreenTimeRow[]
    },
  })

  const familiesQ = useQuery({
    queryKey: ['ux-families'],
    retry: false,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('families')
        .select('id, name, created_at, subscription_status, plan_id')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return data as FamilyRow[]
    },
  })

  const membersQ = useQuery({
    queryKey: ['ux-members'],
    retry: false,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('family_members')
        .select('id, family_id, display_name, joined_at')
        .limit(2000)
      if (error) throw error
      return data as MemberRow[]
    },
  })

  const detailQ = useQuery({
    queryKey: ['ux-detail', selectedFamily],
    enabled: !!selectedFamily,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_events')
        .select('event, occurred_at, properties')
        .eq('family_id', selectedFamily!)
        .neq('event', 'app_heartbeat')
        .order('occurred_at', { ascending: false })
        .limit(150)
      if (error) throw error
      return data as DetailEvent[]
    },
  })

  const loading = funnelQ.isLoading || screenQ.isLoading || familiesQ.isLoading
  const migrationMissing =
    funnelQ.error != null || screenQ.error != null || familiesQ.error != null

  const model = useMemo(() => {
    if (!funnelQ.data) return null
    return buildModel(funnelQ.data)
  }, [funnelQ.data])

  const familyName = (id: string | null): string => {
    if (!id) return '—'
    return familiesQ.data?.find(f => f.id === id)?.name ?? `Family ${shortId(id)}`
  }

  return (
    <div className="min-h-svh bg-cream-100 pb-safe">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-sand-200 bg-cream-100/95 pt-safe backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <button
            onClick={onExit}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-brown-700 ring-1 ring-sand-200"
            aria-label="Back to app"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="font-display text-xl text-brown-800">Experience analytics</h1>
            <p className="text-xs text-brown-700/50">Signup → onboarding → screen time</p>
          </div>
          <div className="flex rounded-xl bg-white p-1 ring-1 ring-sand-200">
            {[7, 30].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                  days === d ? 'bg-brown-800 text-cream-50' : 'text-brown-700/60'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        {migrationMissing && (
          <div className="rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-200">
            <p className="font-semibold text-amber-900">Telemetry tables aren't live yet</p>
            <p className="mt-1 text-sm text-amber-800/80">
              The app is already sending events, but the database migration hasn't been applied yet —
              paste <code className="font-mono text-xs">sup-fam-ux-analytics-migration.sql</code> into the
              Supabase SQL editor and run it, then this dashboard will light up.
            </p>
          </div>
        )}

        {loading && (
          <p className="py-16 text-center font-handwritten text-2xl text-terracotta-500">Loading…</p>
        )}

        {!loading && !migrationMissing && model && (
          <>
            <KpiCards model={model} screenRows={screenQ.data ?? []} members={membersQ.data ?? []} days={days} />
            <FunnelCard model={model} />
            <ScreenTimeCard
              rows={screenQ.data ?? []}
              families={familiesQ.data ?? []}
              onSelect={setSelectedFamily}
              selected={selectedFamily}
            />
            <StuckCard model={model} familyName={familyName} onSelect={setSelectedFamily} now={now} />
          </>
        )}
      </div>

      {/* Family detail drawer */}
      {selectedFamily && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-brown-900/40" onClick={() => setSelectedFamily(null)} />
          <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-cream-50 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-sand-200 px-5 py-4">
              <div className="flex-1">
                <h2 className="font-display text-lg text-brown-800">{familyName(selectedFamily)}</h2>
                <p className="text-xs text-brown-700/50">
                  {membersQ.data?.filter(m => m.family_id === selectedFamily).length ?? 0} members · event timeline
                </p>
              </div>
              <button
                onClick={() => setSelectedFamily(null)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-brown-700 ring-1 ring-sand-200"
                aria-label="Close"
              >
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {detailQ.isLoading && <p className="text-sm text-brown-700/50">Loading events…</p>}
              {detailQ.data?.length === 0 && (
                <p className="text-sm text-brown-700/50">No events yet for this family in range.</p>
              )}
              <ol className="space-y-0">
                {detailQ.data?.map((e, i) => (
                  <li key={i} className="relative border-l-2 border-sand-200 pb-5 pl-4 last:pb-0">
                    <span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full bg-terracotta-500 ring-2 ring-cream-50" />
                    <p className="text-sm font-semibold text-brown-800">{prettyEvent(e.event)}</p>
                    <p className="text-xs text-brown-700/50">
                      {new Date(e.occurred_at).toLocaleString()}
                      {summarizeProps(e.properties) ? ` · ${summarizeProps(e.properties)}` : ''}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Data model ───────────────────────────────────────────────────────────

interface UserFunnel {
  userId: string
  familyId: string | null
  /** step key -> first seen ms */
  steps: Map<string, number>
  lastSeen: number
}

interface UxModel {
  users: UserFunnel[]
  /** step key -> sorted list of {userId, at} */
  byStep: Map<string, { userId: string; at: number }[]>
}

function buildModel(rows: FunnelRow[]): UxModel {
  const users = new Map<string, UserFunnel>()
  for (const r of rows) {
    let u = users.get(r.user_id)
    if (!u) {
      u = { userId: r.user_id, familyId: r.family_id, steps: new Map(), lastSeen: 0 }
      users.set(r.user_id, u)
    }
    if (r.family_id) u.familyId = r.family_id
    const at = new Date(r.first_seen).getTime()
    u.lastSeen = Math.max(u.lastSeen, at)
    for (const step of FUNNEL_STEPS) {
      if (step.events.includes(r.event)) {
        const prev = u.steps.get(step.key)
        if (prev === undefined || at < prev) u.steps.set(step.key, at)
      }
    }
  }
  const byStep = new Map<string, { userId: string; at: number }[]>()
  for (const step of FUNNEL_STEPS) byStep.set(step.key, [])
  for (const u of users.values()) {
    for (const [key, at] of u.steps) {
      byStep.get(key)!.push({ userId: u.userId, at })
    }
  }
  for (const list of byStep.values()) list.sort((a, b) => a.at - b.at)
  return { users: [...users.values()], byStep }
}

// ─── KPI cards ────────────────────────────────────────────────────────────

function KpiCards({ model, screenRows, members, days }: {
  model: UxModel
  screenRows: ScreenTimeRow[]
  members: MemberRow[]
  days: number
}) {
  const accounts = model.byStep.get('account')!.length
  const completed = model.byStep.get('done')!.length
  const completionRate = accounts > 0 ? Math.round((completed / accounts) * 100) : 0

  const onboardingTimes: number[] = []
  const accountAt = new Map(model.byStep.get('account')!.map(e => [e.userId, e.at]))
  for (const e of model.byStep.get('done')!) {
    const start = accountAt.get(e.userId)
    if (start !== undefined && e.at >= start) onboardingTimes.push(e.at - start)
  }

  const membersByFamily = new Map<string, number>()
  for (const m of members) membersByFamily.set(m.family_id, (membersByFamily.get(m.family_id) ?? 0) + 1)
  const multiMember = [...membersByFamily.values()].filter(n => n >= 2).length

  const alwaysOn = new Set(screenRows.filter(r => r.active_hours >= 20).map(r => r.family_id)).size
  const totalMinutes = screenRows.reduce((s, r) => s + Number(r.heartbeat_minutes), 0)
  const activeFamilies = new Set(screenRows.map(r => r.family_id)).size
  const avgHrsPerDay = activeFamilies > 0 ? totalMinutes / 60 / activeFamilies / days : 0

  const cards = [
    { label: 'New accounts', value: String(accounts), sub: `last ${days} days` },
    { label: 'Onboarding completion', value: `${completionRate}%`, sub: `${completed} of ${accounts} finished` },
    { label: 'Median time to onboard', value: fmtDuration(median(onboardingTimes)), sub: 'account → finished' },
    { label: 'Families with 2+ members', value: String(multiMember), sub: 'household activation' },
    { label: 'Always-on displays', value: String(alwaysOn), sub: '≥20h active in a day' },
    { label: 'Avg screen time', value: `${avgHrsPerDay.toFixed(1)}h`, sub: 'per family per day' },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {cards.map(c => (
        <div key={c.label} className="rounded-2xl bg-white p-4 ring-1 ring-sand-200/60">
          <p className="font-display text-3xl text-brown-800">{c.value}</p>
          <p className="mt-1 text-sm font-semibold text-brown-700">{c.label}</p>
          <p className="text-xs text-brown-700/45">{c.sub}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Funnel ───────────────────────────────────────────────────────────────

function FunnelCard({ model }: { model: UxModel }) {
  const base = model.byStep.get('account')!.length
  const prevAt = new Map<string, Map<string, number>>()
  for (const u of model.users) {
    const m = new Map<string, number>()
    for (const [k, at] of u.steps) m.set(k, at)
    prevAt.set(u.userId, m)
  }

  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-sand-200/60">
      <h2 className="font-display text-lg text-brown-800">Onboarding funnel</h2>
      <p className="text-xs text-brown-700/50">Where new accounts go — and where they stall.</p>
      <div className="mt-4 space-y-4">
        {FUNNEL_STEPS.map((step, i) => {
          const list = model.byStep.get(step.key)!
          const count = list.length
          const prevCount = i === 0 ? count : model.byStep.get(FUNNEL_STEPS[i - 1]!.key)!.length
          const conv = prevCount > 0 ? Math.round((count / prevCount) * 100) : 100
          const ofBase = base > 0 ? Math.round((count / base) * 100) : 0

          // Median time from previous step for users who reached both.
          let med: number | null = null
          if (i > 0) {
            const prevKey = FUNNEL_STEPS[i - 1]!.key
            const diffs: number[] = []
            for (const e of list) {
              const p = prevAt.get(e.userId)?.get(prevKey)
              if (p !== undefined && e.at >= p) diffs.push(e.at - p)
            }
            med = median(diffs)
          }

          return (
            <div key={step.key}>
              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <span className="text-sm font-semibold text-brown-800">
                    {i + 1}. {step.label}
                  </span>
                  <span className="ml-2 text-xs text-brown-700/45">{step.hint}</span>
                </div>
                <div className="text-right text-xs text-brown-700/60">
                  <span className="font-display text-base font-semibold text-brown-800">{count}</span>
                  {i > 0 && <span> · {conv}% of prev · {ofBase}% of accounts</span>}
                  {med !== null && <span> · ⏱ {fmtDuration(med)}</span>}
                </div>
              </div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-sand-100">
                <div
                  className="h-full rounded-full bg-terracotta-500 transition-all"
                  style={{ width: `${base > 0 ? Math.max(2, (count / base) * 100) : 0}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ─── Screen time ──────────────────────────────────────────────────────────

function ScreenTimeCard({ rows, families, onSelect, selected }: {
  rows: ScreenTimeRow[]
  families: FamilyRow[]
  onSelect: (id: string) => void
  selected: string | null
}) {
  const perFamily = useMemo(() => {
    const map = new Map<string, { minutes: number; days: Set<string>; maxHours: number; byDay: Map<string, number> }>()
    for (const r of rows) {
      let f = map.get(r.family_id)
      if (!f) {
        f = { minutes: 0, days: new Set(), maxHours: 0, byDay: new Map() }
        map.set(r.family_id, f)
      }
      const mins = Number(r.heartbeat_minutes)
      f.minutes += mins
      f.days.add(r.day)
      f.maxHours = Math.max(f.maxHours, Number(r.active_hours))
      f.byDay.set(r.day, mins)
    }
    return [...map.entries()]
      .map(([familyId, f]) => ({ familyId, ...f }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 25)
  }, [rows])

  const maxMinutes = perFamily[0]?.minutes ?? 1
  const nameOf = (id: string) => families.find(f => f.id === id)?.name ?? `Family ${shortId(id)}`

  // Daily bars for the top family (or selected one)
  const focusId = selected ?? perFamily[0]?.familyId ?? null
  const focusDays = useMemo(() => {
    const f = perFamily.find(p => p.familyId === focusId)
    if (!f) return []
    return [...f.byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-14)
  }, [perFamily, focusId])
  const focusMax = Math.max(1, ...focusDays.map(([, m]) => m))

  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-sand-200/60">
      <h2 className="font-display text-lg text-brown-800">Screen time</h2>
      <p className="text-xs text-brown-700/50">
        Tap a family for its event timeline. The 24/7 iPad pattern shows up as “always-on”.
      </p>

      {focusDays.length > 0 && (
        <div className="mt-4 rounded-xl bg-cream-50 p-4 ring-1 ring-sand-200/50">
          <p className="text-xs font-semibold uppercase tracking-widest text-brown-700/50">
            {nameOf(focusId!)} · daily hours
          </p>
          <div className="mt-3 flex h-24 items-end gap-1.5">
            {focusDays.map(([day, mins]) => (
              <div key={day} className="flex flex-1 flex-col items-center gap-1" title={`${day}: ${fmtHours(mins)}`}>
                <div
                  className="w-full rounded-t bg-terracotta-400"
                  style={{ height: `${Math.max(4, (mins / focusMax) * 88)}px` }}
                />
                <span className="text-[9px] text-brown-700/40">{day.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 divide-y divide-sand-100">
        {perFamily.length === 0 && (
          <p className="py-6 text-center text-sm text-brown-700/50">No screen-time data in range yet.</p>
        )}
        {perFamily.map(f => (
          <button
            key={f.familyId}
            onClick={() => onSelect(f.familyId)}
            className={`flex w-full items-center gap-3 py-3 text-left transition-colors ${
              selected === f.familyId ? 'bg-terracotta-50/50' : ''
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-brown-800">
                {nameOf(f.familyId)}
                {f.maxHours >= 20 && (
                  <span className="ml-2 rounded-full bg-terracotta-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-terracotta-600">
                    Always-on
                  </span>
                )}
              </p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sand-100">
                <div
                  className="h-full rounded-full bg-brown-700/70"
                  style={{ width: `${(f.minutes / maxMinutes) * 100}%` }}
                />
              </div>
            </div>
            <div className="text-right text-xs text-brown-700/60">
              <p className="font-display text-base font-semibold text-brown-800">{fmtHours(f.minutes)}</p>
              <p>{f.days.size}d active · peak {f.maxHours}h</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}

// ─── Stuck families ───────────────────────────────────────────────────────

interface StuckUser {
  userId: string
  familyId: string | null
  stepLabel: string
  stuckMs: number
  lastSeenMs: number
}

function StuckCard({ model, familyName, onSelect, now }: {
  model: UxModel
  familyName: (id: string | null) => string
  onSelect: (id: string) => void
  now: number
}) {
  const stuck = useMemo(() => {
    const out: StuckUser[] = []
    for (const u of model.users) {
      if (u.steps.has('done')) continue
      // Furthest step reached = current position.
      let cur: FunnelStep | null = null
      for (const s of FUNNEL_STEPS) {
        if (u.steps.has(s.key)) cur = s
      }
      if (!cur || cur.key === 'done') continue
      const at = u.steps.get(cur.key)!
      const stuckMs = now - at
      if (stuckMs >= cur.stuckAfterMs) {
        out.push({ userId: u.userId, familyId: u.familyId, stepLabel: cur.label, stuckMs, lastSeenMs: u.lastSeen })
      }
    }
    return out.sort((a, b) => b.stuckMs - a.stuckMs).slice(0, 30)
  }, [model, now])

  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-sand-200/60">
      <h2 className="font-display text-lg text-brown-800">Needs attention</h2>
      <p className="text-xs text-brown-700/50">
        Accounts stalled mid-onboarding — no feedback form needed, the stall is the signal.
      </p>
      {stuck.length === 0 ? (
        <p className="py-6 text-center text-sm text-brown-700/50">
          Nobody's stuck right now. 🎉
        </p>
      ) : (
        <div className="mt-3 divide-y divide-sand-100">
          {stuck.map(s => (
            <div key={s.userId} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                {s.familyId ? (
                  <button
                    onClick={() => onSelect(s.familyId!)}
                    className="truncate text-sm font-semibold text-brown-800 underline decoration-sand-300 underline-offset-2"
                  >
                    {familyName(s.familyId)}
                  </button>
                ) : (
                  <p className="truncate text-sm font-semibold text-brown-800">User {shortId(s.userId)}</p>
                )}
                <p className="text-xs text-brown-700/55">
                  Stalled at <span className="font-semibold text-terracotta-600">{s.stepLabel}</span>
                </p>
              </div>
              <div className="text-right text-xs text-brown-700/60">
                <p className="font-semibold text-brown-800">stuck {fmtDuration(s.stuckMs)}</p>
                <p>last seen {fmtDuration(now - s.lastSeenMs)} ago</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ─── Event display helpers ────────────────────────────────────────────────

const PRETTY: Record<string, string> = {
  signup_viewed: 'Viewed signup',
  signed_in: 'Signed in',
  account_created: 'Account created',
  onboarding_started: 'Started onboarding',
  onboarding_step_viewed: 'Viewed step',
  onboarding_step_completed: 'Completed step',
  family_created: 'Created family',
  family_joined: 'Joined family',
  checkout_started: 'Started checkout',
  promo_redeemed: 'Redeemed promo code',
  subscription_activated: 'Subscription activated',
  calendar_connected: 'Connected calendar',
  family_member_added: 'Family member added',
  onboarding_completed: 'Finished onboarding',
  app_opened: 'Opened app',
  app_closed: 'Closed app',
}

function prettyEvent(event: string): string {
  return PRETTY[event] ?? event
}

function summarizeProps(p: Record<string, unknown>): string {
  const bits: string[] = []
  const get = (k: string) => p[k]
  if (typeof get('step') === 'string') {
    bits.push(`step: ${get('step')}`)
    if (typeof get('duration_ms') === 'number') bits.push(fmtDuration(get('duration_ms') as number))
  }
  if (typeof get('plan') === 'string') bits.push(`plan: ${get('plan')}`)
  if (typeof get('provider') === 'string') bits.push(`provider: ${get('provider')}`)
  if (typeof get('mode') === 'string') bits.push(`mode: ${get('mode')}`)
  if (typeof get('member_count') === 'number') bits.push(`${get('member_count')} members`)
  if (typeof get('status') === 'string') bits.push(`status: ${get('status')}`)
  if (typeof get('platform') === 'string') bits.push(`${get('platform')}`)
  if (typeof get('session_duration_ms') === 'number') bits.push(fmtDuration(get('session_duration_ms') as number))
  return bits.join(' · ')
}

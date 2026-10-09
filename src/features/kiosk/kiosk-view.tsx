import { useEffect, useMemo, useState } from 'react'
import { format, isToday, parseISO } from 'date-fns'
import { useCalendarEvents, getEventDateBounds, type CalendarEvent } from '@/features/calendar/use-calendar'
import { useMealPlan } from '@/features/meals/use-meals'
import { weekStartISO, toISODate } from '@/features/meals/types'
import { useGroceryItems } from '@/features/grocery/use-grocery'
import { useTodayTasks } from '@/features/tasks/use-tasks'

/**
 * Kitchen kiosk view (?view=kiosk) — a glanceable, always-on family dashboard
 * designed for the big Echo Show's Silk browser in the kitchen.
 *
 * The Show drops Silk back to the home screen after ~10–15 idle minutes, so
 * this view runs the community keep-alive trick itself: a silent looping
 * audio element (inaudible, muted-autoplay allowed without a gesture) that
 * convinces Silk media is playing and the page is "in use".
 * See: DaGammla/keep-silk-open.
 */
export function KioskView({ onExit }: { onExit: () => void }) {
  useSilkKeepAlive()
  const now = useNow(15_000)
  const todayISO = toISODate(now)
  const todayIdx = (now.getDay() + 6) % 7 // 0 = Monday, matches meal day_index

  const { data: events } = useCalendarEvents()
  const { data: mealData } = useMealPlan(weekStartISO(now))
  const { data: groceries } = useGroceryItems()
  const { data: tasks } = useTodayTasks()

  const todaysEvents = useMemo(() => {
    if (!events) return undefined
    const list = events.filter((ev) => getEventDateBounds(ev).dates.includes(todayISO))
    return [...list].sort((a, b) => {
      if (a.all_day !== b.all_day) return a.all_day ? -1 : 1
      return a.start_at.localeCompare(b.start_at)
    })
  }, [events, todayISO])

  const tonight = useMemo(
    () => mealData?.meals.find((m) => m.day_index === todayIdx && m.slot === 'dinner'),
    [mealData, todayIdx],
  )

  const openGroceries = useMemo(
    () => groceries?.filter((g) => !g.is_checked) ?? [],
    [groceries],
  )
  const openTasks = useMemo(() => tasks?.filter((t) => !t.is_complete) ?? [], [tasks])

  useEffect(() => {
    document.title = 'Sup Fam · Kitchen'
    return () => {
      document.title = 'Sup Fam'
    }
  }, [])

  return (
    <div className="min-h-svh bg-cream-100 text-brown-800 flex flex-col p-8 lg:p-12">
      {/* Header: clock + date */}
      <header className="flex items-end justify-between border-b-2 border-sand-200 pb-6">
        <div>
          <p className="font-display text-7xl lg:text-8xl leading-none tabular-nums">
            {format(now, 'h:mm')}
            <span className="text-4xl lg:text-5xl text-brown-700/50 ml-2">{format(now, 'a')}</span>
          </p>
          <p className="mt-2 font-handwritten text-3xl text-terracotta-500">
            {format(now, 'EEEE, MMMM d')}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-3xl">Sup Fam</p>
          <p className="text-sm text-brown-700/50">the kitchen board</p>
        </div>
      </header>

      {/* Main grid */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 pt-8 min-h-0">
        {/* Today */}
        <section className="lg:col-span-2 flex flex-col min-h-0">
          <SectionTitle>Today</SectionTitle>
          <div className="flex-1 overflow-hidden">
            {todaysEvents === undefined ? (
              <KioskSkeleton rows={5} />
            ) : todaysEvents.length === 0 ? (
              <p className="text-2xl text-brown-700/40 py-10">Nothing on the calendar — open day.</p>
            ) : (
              <ul className="space-y-4">
                {todaysEvents.slice(0, 8).map((ev) => (
                  <EventRow key={ev.id} event={ev} now={now} />
                ))}
                {todaysEvents.length > 8 && (
                  <li className="text-xl text-brown-700/50">
                    + {todaysEvents.length - 8} more on the calendar
                  </li>
                )}
              </ul>
            )}
          </div>
        </section>

        {/* Side column */}
        <section className="flex flex-col gap-8 min-h-0">
          {/* Tonight */}
          <div>
            <SectionTitle>Tonight</SectionTitle>
            {mealData === undefined ? (
              <KioskSkeleton rows={2} />
            ) : tonight ? (
              <div className="rounded-2xl bg-terracotta-500 text-cream-50 p-6">
                <p className="text-xs font-semibold uppercase tracking-widest opacity-80">Dinner</p>
                <p className="mt-1 font-display text-4xl leading-tight">{tonight.title}</p>
              </div>
            ) : (
              <p className="text-xl text-brown-700/40">No dinner planned yet.</p>
            )}
          </div>

          {/* Groceries */}
          <div>
            <SectionTitle>
              Groceries
              {openGroceries.length > 0 && (
                <span className="ml-3 rounded-full bg-sand-200 px-3 py-1 text-lg font-semibold">
                  {openGroceries.length}
                </span>
              )}
            </SectionTitle>
            {groceries === undefined ? (
              <KioskSkeleton rows={3} />
            ) : openGroceries.length === 0 ? (
              <p className="text-xl text-brown-700/40">List is clear.</p>
            ) : (
              <ul className="space-y-2">
                {openGroceries.slice(0, 5).map((g) => (
                  <li key={g.id} className="flex items-center gap-3 text-2xl">
                    <span className="inline-block h-5 w-5 rounded-md border-2 border-sand-300" />
                    {g.title}
                  </li>
                ))}
                {openGroceries.length > 5 && (
                  <li className="text-xl text-brown-700/50">+ {openGroceries.length - 5} more</li>
                )}
              </ul>
            )}
          </div>

          {/* Tasks */}
          <div>
            <SectionTitle>
              Tasks
              {openTasks.length > 0 && (
                <span className="ml-3 rounded-full bg-sand-200 px-3 py-1 text-lg font-semibold">
                  {openTasks.length}
                </span>
              )}
            </SectionTitle>
            {tasks === undefined ? (
              <KioskSkeleton rows={3} />
            ) : openTasks.length === 0 ? (
              <p className="text-xl text-brown-700/40">All done.</p>
            ) : (
              <ul className="space-y-2">
                {openTasks.slice(0, 5).map((t) => (
                  <li key={t.id} className="flex items-center gap-3 text-2xl">
                    <span className="inline-block h-5 w-5 rounded-full border-2 border-sand-300" />
                    {t.title}
                  </li>
                ))}
                {openTasks.length > 5 && (
                  <li className="text-xl text-brown-700/50">+ {openTasks.length - 5} more</li>
                )}
              </ul>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-between pt-6 text-sm text-brown-700/40">
        <p>Auto-refreshes · {format(now, 'h:mm a')}</p>
        <button
          type="button"
          onClick={onExit}
          className="rounded-full border border-sand-300 px-4 py-2 hover:bg-sand-100 transition-colors"
        >
          Exit kiosk
        </button>
      </footer>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-brown-700/50">
      {children}
    </h2>
  )
}

function EventRow({ event, now }: { event: CalendarEvent; now: Date }) {
  const start = parseISO(event.start_at)
  const end = event.end_at ? parseISO(event.end_at) : null
  const isNow = !event.all_day && start <= now && (!end || end >= now)
  const isUpcoming = !event.all_day && start > now && start.getTime() - now.getTime() < 3_600_000

  return (
    <li
      className={`flex items-baseline gap-5 rounded-2xl px-5 py-4 ${
        isNow ? 'bg-terracotta-500 text-cream-50' : 'bg-cream-50 border border-sand-200'
      }`}
    >
      <span
        className={`w-36 shrink-0 text-xl font-semibold tabular-nums ${
          isNow ? 'text-cream-50' : 'text-terracotta-600'
        }`}
      >
        {event.all_day ? 'All day' : format(start, 'h:mm a')}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-2xl font-medium">{event.title}</span>
        {event.location && (
          <span
            className={`block truncate text-lg ${isNow ? 'text-cream-50/80' : 'text-brown-700/50'}`}
          >
            {event.location}
          </span>
        )}
      </span>
      {isNow && (
        <span className="shrink-0 rounded-full bg-cream-50/25 px-3 py-1 text-sm font-bold uppercase tracking-wider">
          Now
        </span>
      )}
      {!isNow && isUpcoming && (
        <span className="shrink-0 rounded-full bg-sand-200 px-3 py-1 text-sm font-bold uppercase tracking-wider text-brown-700/70">
          Up next
        </span>
      )}
      {isToday(start) && event.all_day && (
        <span className="shrink-0 text-lg text-brown-700/40">all-day</span>
      )}
    </li>
  )
}

function KioskSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-2xl bg-sand-100" />
      ))}
    </div>
  )
}

/** Ticking clock that re-renders the kiosk on an interval. */
function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

/**
 * Keeps the Echo Show's Silk browser from timing out back to the home screen.
 * Plays a silent, looping WAV (muted autoplay is allowed without a user
 * gesture); if unmuted playback is permitted it uses that, otherwise falls
 * back to muted. Re-asserts playback every 30s and on visibility changes.
 */
function useSilkKeepAlive() {
  useEffect(() => {
    const url = makeSilentWavUrl(2)
    const audio = new Audio(url)
    audio.loop = true
    // Try audible-but-silent first (strongest "media playing" signal);
    // fall back to muted, which autoplay policies always allow.
    const play = () => {
      audio.play().catch(() => {
        audio.muted = true
        audio.play().catch(() => {})
      })
    }
    play()
    const keep = window.setInterval(() => {
      if (audio.paused) play()
    }, 30_000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && audio.paused) play()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(keep)
      document.removeEventListener('visibilitychange', onVisibility)
      audio.pause()
      URL.revokeObjectURL(url)
    }
  }, [])
}

/** Builds a Blob URL for `seconds` of digital silence (8kHz mono 16-bit WAV). */
function makeSilentWavUrl(seconds: number): string {
  const sampleRate = 8000
  const samples = sampleRate * seconds
  const buffer = new ArrayBuffer(44 + samples * 2)
  const v = new DataView(buffer)
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(offset + i, s.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  v.setUint32(4, 36 + samples * 2, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true) // PCM
  v.setUint16(22, 1, true) // mono
  v.setUint32(24, sampleRate, true)
  v.setUint32(28, sampleRate * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  writeStr(36, 'data')
  v.setUint32(40, samples * 2, true)
  // sample data stays zeroed = silence
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }))
}

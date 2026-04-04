import {
  startOfWeek,
  addDays,
  addWeeks,
  format,
  isToday,
  isSameMonth,
  parseISO,
} from 'date-fns'
import { useState, useRef, useEffect, useCallback } from 'react'
import type { Task } from '@/features/tasks/use-tasks'
import type { CalendarEvent } from './use-calendar'

export type CalendarMode = 'month' | '3week' | 'week'

interface CalendarViewProps {
  tasks?: Task[]
  events?: CalendarEvent[]
  anchorDate?: Date
  mode?: CalendarMode
  onModeChange?: (mode: CalendarMode) => void
  headerRight?: React.ReactNode
}

// How many weeks to render in the scroll window
const WEEKS_BEFORE = 4
const WEEKS_AFTER = 16
const TOTAL_WEEKS = WEEKS_BEFORE + WEEKS_AFTER  // 20

// Rows per "page" by mode
const ROWS: Record<CalendarMode, number> = { week: 1, '3week': 3, month: 5 }

export function CalendarView({
  tasks = [],
  events = [],
  anchorDate,
  mode = 'month',
  onModeChange,
  headerRight,
}: CalendarViewProps) {
  const today = new Date()
  const anchor = anchorDate ?? today
  const rowsPerPage = ROWS[mode]

  // Build ALL weeks once — 20 weeks starting WEEKS_BEFORE ago
  const baseWeekStart = startOfWeek(addWeeks(anchor, -WEEKS_BEFORE), { weekStartsOn: 0 })
  const allWeeks: Date[][] = Array.from({ length: TOTAL_WEEKS }, (_, wi) =>
    Array.from({ length: 7 }, (_, di) => addDays(baseWeekStart, wi * 7 + di))
  )

  // Scroll container ref
  const scrollRef = useRef<HTMLDivElement>(null)
  // Track which week row is at the top (for month label)
  const [topWeekIdx, setTopWeekIdx] = useState(WEEKS_BEFORE)

  // Scroll to today on mount
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    // Each "page" = rowsPerPage rows. Find the page that contains today.
    const todayPageIdx = Math.floor(WEEKS_BEFORE / rowsPerPage)
    // Each page is 100% of the container height
    el.scrollTop = todayPageIdx * el.clientHeight
  }, [mode]) // re-anchor when mode changes

  // Update month label as user scrolls
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const rowH = el.clientHeight / rowsPerPage
    const topRow = Math.round(el.scrollTop / rowH)
    setTopWeekIdx(topRow)
  }, [rowsPerPage])

  // Month label: use the middle day of the middle visible row
  const midVisibleRow = topWeekIdx + Math.floor(rowsPerPage / 2)
  const safeRow = Math.min(Math.max(midVisibleRow, 0), TOTAL_WEEKS - 1)
  const labelDay = allWeeks[safeRow]?.[3] ?? today
  const monthLabel = format(labelDay, 'MMMM yyyy')

  // ── Index tasks ──────────────────────────────────────────────────────────
  const tasksByDate = new Map<string, Task[]>()
  for (const task of tasks) {
    if (!task.due_date || task.is_complete) continue
    if (!tasksByDate.has(task.due_date)) tasksByDate.set(task.due_date, [])
    tasksByDate.get(task.due_date)!.push(task)
  }

  // ── Index events — timezone-safe, multi-day expansion ───────────────────
  const eventsByDate = new Map<string, CalendarEvent[]>()
  const addEvToDate = (key: string, ev: CalendarEvent) => {
    if (!eventsByDate.has(key)) eventsByDate.set(key, [])
    if (!eventsByDate.get(key)!.find(e => e.id === ev.id)) {
      eventsByDate.get(key)!.push(ev)
    }
  }
  for (const ev of events) {
    if (ev.all_day) {
      const startKey = ev.start_at.slice(0, 10)
      const endKey = ev.end_at ? ev.end_at.slice(0, 10) : startKey
      let cur = startKey
      while (cur < endKey) {
        addEvToDate(cur, ev)
        const d = new Date(cur + 'T00:00:00')
        d.setDate(d.getDate() + 1)
        cur = format(d, 'yyyy-MM-dd')
      }
      if (startKey === endKey) addEvToDate(startKey, ev)
    } else {
      addEvToDate(format(parseISO(ev.start_at), 'yyyy-MM-dd'), ev)
    }
  }
  for (const [, evs] of eventsByDate) {
    evs.sort((a, b) => {
      if (a.all_day && !b.all_day) return -1
      if (!a.all_day && b.all_day) return 1
      return a.start_at.localeCompare(b.start_at)
    })
  }

  const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="flex h-full flex-col select-none overflow-hidden">

      {/* ── Header ── */}
      <div className="relative flex-shrink-0 flex items-center h-9 mb-2">
        {/* Month label — absolutely centered on the full width */}
        <h2 className="absolute inset-x-0 text-center font-body text-base font-semibold text-brown-800 tracking-tight pointer-events-none">
          {monthLabel}
        </h2>

        {/* Right controls — view switcher + ⋯ */}
        <div className="ml-auto flex items-center gap-1.5 relative z-10">
          {onModeChange && (
            <div className="flex items-center gap-px rounded-lg bg-sand-100 p-0.5">
              {(['week', '3week', 'month'] as CalendarMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => onModeChange(m)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    mode === m
                      ? 'bg-white text-brown-800 shadow-sm'
                      : 'text-brown-700/50 hover:text-brown-800'
                  }`}
                >
                  {m === '3week' ? '3 wk' : m === 'week' ? '1 wk' : 'Mo'}
                </button>
              ))}
            </div>
          )}
          {headerRight}
        </div>
      </div>

      {/* ── Day headers ── */}
      <div className="flex-shrink-0 grid grid-cols-7 border-b border-sand-100 pb-1.5 mb-0.5">
        {DAY_HEADERS.map((d, i) => (
          <div
            key={d}
            className={`text-center text-[11px] font-semibold uppercase tracking-widest ${
              i === 0 || i === 6 ? 'text-brown-700/25' : 'text-brown-700/45'
            }`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* ── Scroll container ── */}
      {/*
        Each "page" is rowsPerPage rows tall = 100% of the container.
        scroll-snap-type: y mandatory snaps to each page.
        Each row group is a snap point.
        We render all 20 weeks up front — no lazy loading needed for 3 months.
      */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-scroll"
        style={{
          scrollSnapType: 'y mandatory',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
        }}
        onScroll={handleScroll}
      >
        {/* Inner: total height = (TOTAL_WEEKS / rowsPerPage) pages */}
        <div
          style={{
            height: `${(TOTAL_WEEKS / rowsPerPage) * 100}%`,
            display: 'grid',
            gridTemplateRows: `repeat(${TOTAL_WEEKS}, 1fr)`,
          }}
        >
          {allWeeks.map((week, wi) => {
            // Snap point at the start of each page
            const isSnapPoint = wi % rowsPerPage === 0
            return (
              <div
                key={wi}
                className="grid grid-cols-7 border-b border-sand-100 last:border-0 min-h-0"
                style={isSnapPoint ? { scrollSnapAlign: 'start' } : undefined}
              >
                {week.map((day) => {
                  const key = format(day, 'yyyy-MM-dd')
                  const dayEvents = eventsByDate.get(key) ?? []
                  const dayTasks = tasksByDate.get(key) ?? []
                  const isCurrentDay = isToday(day)
                  const isOutsideMonth = mode === 'month' && !isSameMonth(day, labelDay)
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6

                  type Pill = { type: 'event'; ev: CalendarEvent } | { type: 'task'; task: Task }
                  const pills: Pill[] = [
                    ...dayEvents.map(ev => ({ type: 'event' as const, ev })),
                    ...dayTasks.map(task => ({ type: 'task' as const, task })),
                  ]

                  return (
                    <div
                      key={key}
                      className={`relative flex flex-col border-r border-sand-100 last:border-r-0 overflow-hidden min-h-0
                        ${isOutsideMonth ? 'opacity-25' : ''}
                        ${isWeekend && !isCurrentDay ? 'bg-[#faf8f5]' : 'bg-white'}
                        ${isCurrentDay ? 'bg-terracotta-500/[0.04]' : ''}
                      `}
                    >
                      {isCurrentDay && (
                        <div className="absolute top-0 inset-x-0 h-[2px] bg-terracotta-500 rounded-b" />
                      )}
                      <div className="flex flex-col h-full p-1.5 gap-px">
                        <div className="flex-shrink-0 mb-0.5">
                          <span className={`
                            inline-flex h-[18px] w-[18px] items-center justify-center rounded-full
                            text-[10px] font-bold leading-none
                            ${isCurrentDay ? 'bg-terracotta-500 text-white'
                              : isWeekend ? 'text-brown-700/30'
                              : 'text-brown-700/60'}
                          `}>
                            {format(day, 'd')}
                          </span>
                        </div>
                        <div className="flex flex-col gap-px flex-1 min-h-0 overflow-hidden">
                          {pills.map((pill) => pill.type === 'event'
                            ? <EventPill key={`${pill.ev.id}-${key}`} ev={pill.ev} />
                            : <TaskPill key={pill.task.id} task={pill.task} />
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function darkenForReadability(hex: string): string {
  if (!hex || hex.length < 7) return hex
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  if (luminance <= 0.45) return hex
  const dr = Math.round(r * 0.5)
  const dg = Math.round(g * 0.5)
  const db = Math.round(b * 0.5)
  return `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`
}

function EventPill({ ev }: { ev: CalendarEvent }) {
  const color = ev.color ?? '#5B7FB5'
  const textColor = darkenForReadability(color)
  return (
    <div
      className="flex items-stretch rounded overflow-hidden flex-shrink-0"
      style={{ backgroundColor: `${color}18` }}
      title={ev.title}
    >
      <div className="w-[3px] flex-shrink-0 rounded-l" style={{ backgroundColor: color }} />
      <div className="flex items-baseline gap-1 px-1 py-px min-w-0 flex-1">
        <span className="truncate text-[13px] font-semibold leading-snug" style={{ color: textColor }}>
          {ev.title}
        </span>
        {!ev.all_day && (
          <span className="flex-shrink-0 text-[10px] tabular-nums leading-snug opacity-60" style={{ color: textColor }}>
            {format(parseISO(ev.start_at), 'h:mma').replace(':00', '')}
          </span>
        )}
      </div>
    </div>
  )
}

function TaskPill({ task }: { task: Task }) {
  const color = task.assigned_member?.avatar_color ?? '#C4714F'
  return (
    <div
      className="flex items-stretch rounded overflow-hidden flex-shrink-0"
      style={{ backgroundColor: `${color}18` }}
      title={task.title}
    >
      <div className="w-[3px] flex-shrink-0 rounded-l opacity-40" style={{ backgroundColor: color }} />
      <div className="flex items-center gap-1 px-1 py-px min-w-0">
        <span className="text-[10px] flex-shrink-0" style={{ color, opacity: 0.6 }}>✓</span>
        <span className="truncate text-[12px] font-medium leading-snug" style={{ color }}>
          {task.title}
        </span>
      </div>
    </div>
  )
}

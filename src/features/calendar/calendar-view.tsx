import {
  startOfWeek,
  addDays,
  addWeeks,
  format,
  isToday,
  isSameMonth,
  parseISO,
} from 'date-fns'
import { useState } from 'react'
import type { Task } from '@/features/tasks/use-tasks'
import type { CalendarEvent } from './use-calendar'

export type CalendarMode = 'month' | '3week' | 'week'

interface CalendarViewProps {
  tasks?: Task[]
  events?: CalendarEvent[]
  anchorDate?: Date
  mode?: CalendarMode
  onModeChange?: (mode: CalendarMode) => void
  // Slot for extra controls rendered inside the calendar header (e.g. ⋯ menu)
  headerRight?: React.ReactNode
}

const MAX_VISIBLE_MONTH = 2  // taller pills need fewer rows per cell
const MAX_VISIBLE_WEEK = 6  // more room in single-week view

export function CalendarView({
  tasks = [],
  events = [],
  anchorDate,
  mode = 'month',
  onModeChange,
  headerRight,
}: CalendarViewProps) {
  const today = new Date()
  const [offset, setOffset] = useState(0)
  const anchor = anchorDate ?? today

  // Build the grid of weeks based on mode
  const weeks = buildWeeks(anchor, offset, mode)
  const maxVisible = mode === 'week' ? MAX_VISIBLE_WEEK : MAX_VISIBLE_MONTH

  // The "representative" date for the month label — middle of the grid
  const midWeek = weeks[Math.floor(weeks.length / 2)]
  const midDay = midWeek[3]

  // Nav labels + step size
  const navLabel = navLabelFor(midDay, mode)
  const stepLabel = mode === 'week' ? 'week' : mode === '3week' ? '3 weeks' : 'month'

  // Index tasks by due date
  const tasksByDate = new Map<string, Task[]>()
  for (const task of tasks) {
    if (!task.due_date || task.is_complete) continue
    if (!tasksByDate.has(task.due_date)) tasksByDate.set(task.due_date, [])
    tasksByDate.get(task.due_date)!.push(task)
  }

  // Index events by date, sorted all-day first then by time
  const eventsByDate = new Map<string, CalendarEvent[]>()
  for (const ev of events) {
    const key = format(parseISO(ev.start_at), 'yyyy-MM-dd')
    if (!eventsByDate.has(key)) eventsByDate.set(key, [])
    eventsByDate.get(key)!.push(ev)
  }
  for (const [, evs] of eventsByDate) {
    evs.sort((a, b) => {
      if (a.all_day && !b.all_day) return -1
      if (!a.all_day && b.all_day) return 1
      return a.start_at.localeCompare(b.start_at)
    })
  }

  const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const numRows = weeks.length

  return (
    <div className="flex h-full flex-col select-none">

      {/* ── Calendar header row ──────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-2 mb-3">

        {/* Prev */}
        <button
          onClick={() => setOffset(o => o - 1)}
          aria-label={`Previous ${stepLabel}`}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-brown-700/40 hover:bg-sand-100 hover:text-brown-700 transition-colors"
        >
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
            <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Month/range label — centered */}
        <div className="flex-1 flex items-center justify-center gap-3">
          <h2 className="font-display text-lg font-semibold text-brown-800 tracking-tight">
            {navLabel}
          </h2>
          <button
            onClick={() => setOffset(0)}
            className="rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-widest text-brown-700/40 hover:bg-sand-100 hover:text-brown-700 transition-colors"
          >
            Today
          </button>
        </div>

        {/* Next */}
        <button
          onClick={() => setOffset(o => o + 1)}
          aria-label={`Next ${stepLabel}`}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-brown-700/40 hover:bg-sand-100 hover:text-brown-700 transition-colors"
        >
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* View switcher */}
        {onModeChange && (
          <div className="flex items-center gap-px rounded-lg bg-sand-100 p-0.5 ml-1">
            {(['week', '3week', 'month'] as CalendarMode[]).map(m => (
              <button
                key={m}
                onClick={() => { onModeChange(m); setOffset(0) }}
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

        {/* Slot for extra controls (⋯ menu etc.) */}
        {headerRight}
      </div>

      {/* ── Day-of-week headers ──────────────────────────── */}
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

      {/* ── Calendar grid ────────────────────────────────── */}
      <div className={`flex-1 min-h-0 grid`} style={{ gridTemplateRows: `repeat(${numRows}, 1fr)` }}>
        {weeks.map((week, wi) => (
          <div
            key={wi}
            className="grid grid-cols-7 border-b border-sand-100 last:border-0 min-h-0"
          >
            {week.map((day) => {
              const key = format(day, 'yyyy-MM-dd')
              const dayEvents = eventsByDate.get(key) ?? []
              const dayTasks = tasksByDate.get(key) ?? []
              const isCurrentDay = isToday(day)
              const isOutsideMonth = mode === 'month' && !isSameMonth(day, midDay)
              const isWeekend = day.getDay() === 0 || day.getDay() === 6

              type Pill = { type: 'event'; ev: CalendarEvent } | { type: 'task'; task: Task }
              const pills: Pill[] = [
                ...dayEvents.map(ev => ({ type: 'event' as const, ev })),
                ...dayTasks.map(task => ({ type: 'task' as const, task })),
              ]
              const visible = pills.slice(0, maxVisible)
              const overflow = pills.length - maxVisible

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
                    {/* Date number */}
                    <div className="flex-shrink-0 mb-0.5">
                      <span className={`
                        inline-flex h-[18px] w-[18px] items-center justify-center rounded-full
                        text-[10px] font-bold leading-none
                        ${isCurrentDay
                          ? 'bg-terracotta-500 text-white'
                          : isWeekend
                          ? 'text-brown-700/30'
                          : 'text-brown-700/60'}
                      `}>
                        {format(day, 'd')}
                      </span>
                    </div>

                    {/* Pills */}
                    <div className="flex flex-col gap-px flex-1 min-h-0 overflow-hidden">
                      {visible.map((pill) => pill.type === 'event'
                        ? <EventPill key={pill.ev.id} ev={pill.ev} />
                        : <TaskPill key={pill.task.id} task={pill.task} />
                      )}
                      {overflow > 0 && (
                        <span className="text-[10px] font-semibold text-brown-700/35 pl-1 flex-shrink-0">
                          +{overflow}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Helper: build weeks grid ─────────────────────────────────────────────

function buildWeeks(anchor: Date, offset: number, mode: CalendarMode): Date[][] {
  const today = new Date()

  if (mode === 'week') {
    const base = startOfWeek(addWeeks(anchor, offset), { weekStartsOn: 0 })
    return [Array.from({ length: 7 }, (_, i) => addDays(base, i))]
  }

  if (mode === '3week') {
    // Rolling: current week at top, regardless of offset
    const base = startOfWeek(addWeeks(today, offset), { weekStartsOn: 0 })
    return Array.from({ length: 3 }, (_, wi) =>
      Array.from({ length: 7 }, (_, di) => addDays(base, wi * 7 + di))
    )
  }

  // month: 5 weeks anchored to the month containing anchor + offset months
  // Use offset as week-offset for consistency with prev/next
  const base = startOfWeek(addWeeks(anchor, offset), { weekStartsOn: 0 })
  return Array.from({ length: 5 }, (_, wi) =>
    Array.from({ length: 7 }, (_, di) => addDays(base, wi * 7 + di))
  )
}

function navLabelFor(midDay: Date, mode: CalendarMode): string {
  if (mode === 'week') {
    const ws = startOfWeek(midDay, { weekStartsOn: 0 })
    const we = addDays(ws, 6)
    if (format(ws, 'MMM') === format(we, 'MMM')) {
      return `${format(ws, 'MMM d')}–${format(we, 'd, yyyy')}`
    }
    return `${format(ws, 'MMM d')} – ${format(we, 'MMM d, yyyy')}`
  }
  if (mode === '3week') {
    const ws = startOfWeek(midDay, { weekStartsOn: 0 })
    const we = addDays(addWeeks(ws, 2), 6)
    return `${format(ws, 'MMM d')} – ${format(we, 'MMM d')}`
  }
  return format(midDay, 'MMMM yyyy')
}

// ── Pills ─────────────────────────────────────────────────────────────────

function EventPill({ ev }: { ev: CalendarEvent }) {
  const color = ev.color ?? '#5B7FB5'
  return (
    <div
      className="flex items-stretch rounded overflow-hidden flex-shrink-0"
      style={{ backgroundColor: `${color}18` }}
      title={ev.title}
    >
      {/* Left color bar */}
      <div className="w-[3px] flex-shrink-0 rounded-l" style={{ backgroundColor: color }} />

      <div className="flex items-baseline gap-1 px-1 py-px min-w-0 flex-1">
        {/* Event name — primary, large */}
        <span
          className="truncate text-[13px] font-semibold leading-snug"
          style={{ color }}
        >
          {ev.title}
        </span>
        {/* Time — secondary, after the name */}
        {!ev.all_day && (
          <span
            className="flex-shrink-0 text-[10px] tabular-nums leading-snug"
            style={{ color, opacity: 0.55 }}
          >
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

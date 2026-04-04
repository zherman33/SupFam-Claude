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

interface CalendarViewProps {
  tasks?: Task[]
  events?: CalendarEvent[]
  anchorDate?: Date
}

const MAX_VISIBLE = 3 // pills to show before "+N more"

export function CalendarView({ tasks = [], events = [], anchorDate }: CalendarViewProps) {
  const today = new Date()
  const [offset, setOffset] = useState(0)

  const anchor = anchorDate ?? today
  const weekStart = startOfWeek(addWeeks(anchor, offset), { weekStartsOn: 0 })

  const weeks: Date[][] = Array.from({ length: 5 }, (_, wi) =>
    Array.from({ length: 7 }, (_, di) => addDays(weekStart, wi * 7 + di))
  )

  // Center month = week 2 (index 2), middle day = Thursday
  const centerMonth = weeks[2][4]

  // Index tasks by due date
  const tasksByDate = new Map<string, Task[]>()
  for (const task of tasks) {
    if (!task.due_date || task.is_complete) continue
    const key = task.due_date
    if (!tasksByDate.has(key)) tasksByDate.set(key, [])
    tasksByDate.get(key)!.push(task)
  }

  // Index events by local date — sort by all-day first, then by time
  const eventsByDate = new Map<string, CalendarEvent[]>()
  for (const ev of events) {
    const key = format(parseISO(ev.start_at), 'yyyy-MM-dd')
    if (!eventsByDate.has(key)) eventsByDate.set(key, [])
    eventsByDate.get(key)!.push(ev)
  }
  // Sort: all-day first, then by time
  for (const [, evs] of eventsByDate) {
    evs.sort((a, b) => {
      if (a.all_day && !b.all_day) return -1
      if (!a.all_day && b.all_day) return 1
      return a.start_at.localeCompare(b.start_at)
    })
  }

  const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="flex h-full flex-col select-none">

      {/* Month header + nav */}
      <div className="mb-4 flex items-center justify-between flex-shrink-0">
        <h2 className="font-display text-2xl font-medium text-brown-800 tracking-tight">
          {format(centerMonth, 'MMMM yyyy')}
        </h2>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setOffset(o => o - 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-brown-700/50 transition-colors hover:bg-sand-100 hover:text-brown-800"
            aria-label="Previous"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
              <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button
            onClick={() => setOffset(0)}
            className="rounded-lg px-3 py-1 text-xs font-semibold text-brown-700/60 transition-colors hover:bg-sand-100 hover:text-brown-800 tracking-wide uppercase"
          >
            Today
          </button>
          <button
            onClick={() => setOffset(o => o + 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-brown-700/50 transition-colors hover:bg-sand-100 hover:text-brown-800"
            aria-label="Next"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
              <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Day-of-week headers */}
      <div className="mb-1 grid grid-cols-7 flex-shrink-0 border-b border-sand-100 pb-2">
        {DAY_HEADERS.map((d, i) => {
          const isWeekend = i === 0 || i === 6
          return (
            <div
              key={d}
              className={`text-center text-xs font-semibold uppercase tracking-widest ${
                isWeekend ? 'text-brown-700/30' : 'text-brown-700/50'
              }`}
            >
              {d}
            </div>
          )
        })}
      </div>

      {/* Grid — fills remaining height */}
      <div className="flex-1 grid grid-rows-5 min-h-0">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-sand-100 last:border-0 min-h-0">
            {week.map((day) => {
              const key = format(day, 'yyyy-MM-dd')
              const dayEvents = eventsByDate.get(key) ?? []
              const dayTasks = tasksByDate.get(key) ?? []
              const isCurrentDay = isToday(day)
              const isOutsideMonth = !isSameMonth(day, centerMonth)
              const isWeekend = day.getDay() === 0 || day.getDay() === 6

              // Combine events + tasks into one ordered list of pills
              type Pill =
                | { type: 'event'; ev: CalendarEvent }
                | { type: 'task'; task: Task }
              const pills: Pill[] = [
                ...dayEvents.map(ev => ({ type: 'event' as const, ev })),
                ...dayTasks.map(task => ({ type: 'task' as const, task })),
              ]
              const visible = pills.slice(0, MAX_VISIBLE)
              const overflow = pills.length - MAX_VISIBLE

              return (
                <div
                  key={key}
                  className={`relative flex flex-col border-r border-sand-100 last:border-r-0 overflow-hidden min-h-0
                    ${isOutsideMonth ? 'opacity-30' : ''}
                    ${isWeekend && !isCurrentDay ? 'bg-cream-50/50' : 'bg-white'}
                    ${isCurrentDay ? 'bg-terracotta-500/5' : ''}
                  `}
                >
                  {/* Today column highlight line */}
                  {isCurrentDay && (
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-terracotta-500" />
                  )}

                  <div className="flex flex-col h-full p-1.5 gap-0.5">
                    {/* Date number */}
                    <div className="flex-shrink-0 mb-0.5">
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold leading-none
                          ${isCurrentDay
                            ? 'bg-terracotta-500 text-white'
                            : isWeekend
                            ? 'text-brown-700/40'
                            : 'text-brown-700/70'
                          }`}
                      >
                        {format(day, 'd')}
                      </span>
                    </div>

                    {/* Event + task pills */}
                    <div className="flex flex-col gap-px flex-1 min-h-0 overflow-hidden">
                      {visible.map((pill) => {
                        if (pill.type === 'event') {
                          const ev = pill.ev
                          const color = ev.color ?? '#5B7FB5'
                          return (
                            <EventPill key={ev.id} ev={ev} color={color} />
                          )
                        } else {
                          const task = pill.task
                          const color = task.assigned_member?.avatar_color ?? '#C4714F'
                          return (
                            <div
                              key={task.id}
                              className="flex items-center gap-0.5 rounded px-1 py-px overflow-hidden flex-shrink-0"
                              style={{ backgroundColor: `${color}18` }}
                              title={task.title}
                            >
                              <span className="text-[9px] flex-shrink-0" style={{ color }}>☑</span>
                              <span
                                className="truncate text-[10px] font-medium leading-tight"
                                style={{ color }}
                              >
                                {task.title}
                              </span>
                            </div>
                          )
                        }
                      })}

                      {overflow > 0 && (
                        <div className="flex-shrink-0">
                          <span className="text-[10px] font-medium text-brown-700/40 pl-1">
                            +{overflow} more
                          </span>
                        </div>
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

function EventPill({ ev, color }: { ev: CalendarEvent; color: string }) {
  return (
    <div
      className="flex items-center gap-0.5 rounded px-1 py-px overflow-hidden flex-shrink-0"
      style={{
        backgroundColor: `${color}22`,
      }}
      title={ev.title}
    >
      {/* Color dot */}
      <span
        className="inline-block h-1.5 w-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      {!ev.all_day && (
        <span
          className="text-[10px] flex-shrink-0 tabular-nums opacity-60 leading-tight"
          style={{ color }}
        >
          {format(parseISO(ev.start_at), 'h:mm')}
        </span>
      )}
      <span
        className="truncate text-[10px] font-semibold leading-tight"
        style={{ color }}
      >
        {ev.title}
      </span>
    </div>
  )
}

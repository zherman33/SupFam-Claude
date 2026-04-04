import {
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  format,
  isToday,
  isSameMonth,
  isSameDay,
  parseISO,
  startOfDay,
} from 'date-fns'
import { useState } from 'react'
import type { Task } from '@/features/tasks/use-tasks'

interface CalendarViewProps {
  tasks?: Task[]
  anchorDate?: Date
}

// 5 weeks, starting from the week that contains anchorDate (defaults to today)
export function CalendarView({ tasks = [], anchorDate }: CalendarViewProps) {
  const today = new Date()
  const [offset, setOffset] = useState(0) // week offset from anchor

  const anchor = anchorDate ?? today
  // Start of the week containing anchor + offset weeks
  const weekStart = startOfWeek(addWeeks(anchor, offset), { weekStartsOn: 0 })

  // Build 5 weeks × 7 days grid
  const weeks: Date[][] = Array.from({ length: 5 }, (_, wi) =>
    Array.from({ length: 7 }, (_, di) => addDays(weekStart, wi * 7 + di))
  )

  // Map tasks to their due_date for quick lookup
  const tasksByDate = new Map<string, Task[]>()
  for (const task of tasks) {
    if (!task.due_date || task.is_complete) continue
    const key = task.due_date // 'YYYY-MM-DD'
    if (!tasksByDate.has(key)) tasksByDate.set(key, [])
    tasksByDate.get(key)!.push(task)
  }

  const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="flex h-full flex-col select-none">
      {/* Month + nav */}
      <div className="mb-3 flex items-center justify-between flex-shrink-0">
        <h2 className="font-display text-xl text-brown-800">
          {format(weeks[2][3], 'MMMM yyyy')}
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setOffset((o) => o - 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-brown-700/60 transition-colors hover:bg-cream-200 hover:text-brown-800"
            aria-label="Previous week"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
              <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            onClick={() => setOffset(0)}
            className="rounded-lg px-3 py-1 text-xs font-medium text-brown-700/60 transition-colors hover:bg-cream-200 hover:text-brown-800"
          >
            Today
          </button>
          <button
            onClick={() => setOffset((o) => o + 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-brown-700/60 transition-colors hover:bg-cream-200 hover:text-brown-800"
            aria-label="Next week"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
              <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="mb-1 grid grid-cols-7 flex-shrink-0">
        {DAY_HEADERS.map((d) => (
          <div key={d} className="py-1 text-center text-xs font-medium text-brown-700/40 uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid — fills remaining space */}
      <div className="flex-1 grid grid-rows-5 gap-px overflow-hidden rounded-xl bg-sand-200">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-px">
            {week.map((day) => {
              const key = format(day, 'yyyy-MM-dd')
              const dayTasks = tasksByDate.get(key) ?? []
              const isCurrentDay = isToday(day)
              const isFaded = !isSameMonth(day, weeks[2][3]) // dim days outside center month

              return (
                <div
                  key={key}
                  className={`relative flex flex-col bg-white p-1.5 overflow-hidden transition-colors hover:bg-cream-50 ${
                    isFaded ? 'opacity-40' : ''
                  }`}
                >
                  {/* Date number */}
                  <div className="mb-1 flex-shrink-0">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                        isCurrentDay
                          ? 'bg-terracotta-500 text-white'
                          : 'text-brown-700'
                      }`}
                    >
                      {format(day, 'd')}
                    </span>
                  </div>

                  {/* Task pills */}
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    {dayTasks.slice(0, 3).map((task) => (
                      <div
                        key={task.id}
                        className="truncate rounded px-1 py-0.5 text-xs leading-tight"
                        style={{
                          backgroundColor: task.assigned_member?.avatar_color
                            ? `${task.assigned_member.avatar_color}22`
                            : '#C4714F22',
                          color: task.assigned_member?.avatar_color ?? '#C4714F',
                        }}
                        title={task.title}
                      >
                        {task.title}
                      </div>
                    ))}
                    {dayTasks.length > 3 && (
                      <span className="text-xs text-brown-700/40 pl-1">
                        +{dayTasks.length - 3} more
                      </span>
                    )}
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

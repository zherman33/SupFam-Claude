import { useState } from 'react'
import { format, isPast, isToday, parseISO } from 'date-fns'
import type { CalendarEvent } from '@/features/calendar/use-calendar'
import { useTasks, useCreateTask, useToggleTask, useDeleteTask, type Task } from './use-tasks'
import { useFamilyMembers } from '@/features/auth/use-family-member'

interface TaskSidebarProps {
  events?: CalendarEvent[]
}

export function TaskSidebar({ events = [] }: TaskSidebarProps) {
  const { data: tasks } = useTasks()
  const { data: members } = useFamilyMembers()
  const createTask = useCreateTask()
  const toggleTask = useToggleTask()
  const deleteTask = useDeleteTask()

  const [newTitle, setNewTitle] = useState('')
  const [newDue, setNewDue] = useState('')
  const [newAssignee, setNewAssignee] = useState('')

  // ── Today's events ──────────────────────────────────────────────────────
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const todayEvents = events
    .filter(ev => {
      const dayKey = ev.all_day
        ? ev.start_at.slice(0, 10)
        : format(parseISO(ev.start_at), 'yyyy-MM-dd')
      return dayKey === todayStr
    })
    .sort((a, b) => {
      if (a.all_day && !b.all_day) return -1
      if (!a.all_day && b.all_day) return 1
      return a.start_at.localeCompare(b.start_at)
    })

  // ── Tasks split into unscheduled / scheduled ─────────────────────────────
  const incomplete = (tasks ?? []).filter(t => !t.is_complete)
  const unscheduled = incomplete.filter(t => !t.due_date)
  const scheduled = incomplete
    .filter(t => !!t.due_date)
    .sort((a, b) => a.due_date!.localeCompare(b.due_date!))

  // ── Add task ─────────────────────────────────────────────────────────────
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    await createTask.mutateAsync({
      title: newTitle.trim(),
      due_date: newDue || null,
      assigned_to: newAssignee || null,
    })
    setNewTitle('')
    setNewDue('')
    setNewAssignee('')
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Scrollable three-tier body ── */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">

        {/* Tier 1 — Today's Events */}
        <section>
          <SectionLabel>Today's Events</SectionLabel>
          {todayEvents.length === 0 ? (
            <EmptyHint>Nothing on the calendar today</EmptyHint>
          ) : (
            <ul className="px-3 pb-3 space-y-0.5">
              {todayEvents.map(ev => <EventRow key={ev.id} ev={ev} />)}
            </ul>
          )}
        </section>

        <Divider />

        {/* Tier 2 — Unscheduled Tasks */}
        <section>
          <SectionLabel>Unscheduled</SectionLabel>
          {unscheduled.length === 0 ? (
            <EmptyHint>Nothing floating</EmptyHint>
          ) : (
            <ul className="px-3 pb-3 space-y-px">
              {unscheduled.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onToggle={() => toggleTask.mutate({ id: task.id, is_complete: true })}
                  onDelete={() => deleteTask.mutate(task.id)}
                />
              ))}
            </ul>
          )}
        </section>

        <Divider />

        {/* Tier 3 — Scheduled Tasks */}
        <section>
          <SectionLabel>Coming up</SectionLabel>
          {scheduled.length === 0 ? (
            <EmptyHint>Nothing scheduled</EmptyHint>
          ) : (
            <ul className="px-3 pb-4 space-y-px">
              {scheduled.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  showDate
                  onToggle={() => toggleTask.mutate({ id: task.id, is_complete: true })}
                  onDelete={() => deleteTask.mutate(task.id)}
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ── Add task form — pinned to bottom ── */}
      <div className="flex-shrink-0 border-t border-sand-100 px-3 py-2.5">
        <form onSubmit={handleAdd}>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-terracotta-500">
              <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3 text-white">
                <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Add a task…"
              className="flex-1 bg-transparent text-sm text-brown-800 placeholder:text-brown-700/35 focus:outline-none"
            />
          </div>

          {newTitle.trim() && (
            <div className="mt-2 flex gap-1.5">
              <div className="relative flex-1">
                <input
                  type="date"
                  value={newDue}
                  onChange={e => setNewDue(e.target.value)}
                  className="w-full rounded-lg border border-sand-200 bg-cream-50 px-2 py-1 text-xs text-brown-800 focus:border-terracotta-500 focus:outline-none [color-scheme:light]"
                />
                {!newDue && (
                  <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-xs text-brown-700/35">
                    Date
                  </span>
                )}
              </div>
              <select
                value={newAssignee}
                onChange={e => setNewAssignee(e.target.value)}
                className="flex-1 rounded-lg border border-sand-200 bg-cream-50 px-2 py-1 text-xs text-brown-800 focus:border-terracotta-500 focus:outline-none"
              >
                <option value="">Anyone</option>
                {members?.map(m => (
                  <option key={m.id} value={m.id}>{m.display_name}</option>
                ))}
              </select>
              <button
                type="submit"
                disabled={!newTitle.trim() || createTask.isPending}
                className="rounded-lg bg-terracotta-500 px-3 py-1 text-xs font-semibold text-white hover:bg-terracotta-600 disabled:opacity-50 transition-colors"
              >
                {createTask.isPending ? '…' : 'Add'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

// ── Shared sub-components ──────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="px-4 pt-3.5 pb-1.5 font-display text-[11px] uppercase tracking-widest text-terracotta-500 select-none">
      {children}
    </h3>
  )
}

function Divider() {
  return <div className="mx-4 h-px bg-sand-100" />
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 pb-3 text-xs italic text-brown-700/35">{children}</p>
  )
}

function EventRow({ ev }: { ev: CalendarEvent }) {
  const color = ev.color ?? '#5B7FB5'
  const timeStr = ev.all_day
    ? null
    : format(parseISO(ev.start_at), 'h:mma').replace(':00', '')

  return (
    <li className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-cream-100 transition-colors">
      {/* Color swatch */}
      <div
        className="w-[3px] h-[18px] rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="flex-1 min-w-0 truncate text-sm font-medium text-brown-900">
        {ev.title}
      </span>
      {timeStr && (
        <span className="flex-shrink-0 text-[11px] tabular-nums text-brown-700/50">
          {timeStr}
        </span>
      )}
    </li>
  )
}

function TaskRow({
  task,
  showDate = false,
  onToggle,
  onDelete,
}: {
  task: Task
  showDate?: boolean
  onToggle: () => void
  onDelete: () => void
}) {
  const color = task.assigned_member?.avatar_color ?? '#C4714F'
  const isOverdue =
    task.due_date &&
    isPast(parseISO(task.due_date)) &&
    !isToday(parseISO(task.due_date))

  return (
    <li className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-cream-100 transition-colors">
      {/* Complete button */}
      <button
        onClick={onToggle}
        className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors hover:bg-terracotta-500/10"
        style={{ borderColor: `${color}70` }}
        title="Mark complete"
      >
        <svg
          className="h-2.5 w-2.5 opacity-0 group-hover:opacity-60 transition-opacity"
          viewBox="0 0 10 10"
          fill="none"
        >
          <path
            d="M2 5l2.5 2.5 3.5-4"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Title */}
      <span className="flex-1 min-w-0 truncate text-sm text-brown-900">
        {task.title}
      </span>

      {/* Due date (scheduled section only) */}
      {showDate && task.due_date && (
        <span
          className={`flex-shrink-0 text-[11px] tabular-nums font-medium ${
            isOverdue ? 'text-red-500' : 'text-brown-700/45'
          }`}
        >
          {isOverdue ? '⚠ ' : ''}
          {format(parseISO(task.due_date), 'MMM\u00a0d')}
        </span>
      )}

      {/* Delete — reveals on row hover */}
      <button
        onClick={onDelete}
        className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-brown-700/25 opacity-0 group-hover:opacity-100 hover:text-brown-700/60 transition-all"
        title="Delete"
      >
        <svg className="h-2.5 w-2.5" viewBox="0 0 10 10" fill="none">
          <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </li>
  )
}

import { format, isToday, isPast, parseISO } from 'date-fns'
import { useTodayTasks, useToggleTask } from '@/features/tasks/use-tasks'
import { useFamilyMember } from '@/features/auth/use-family-member'

export function TodayPanel() {
  const { data: member } = useFamilyMember()
  const { data: todayTasks, isLoading } = useTodayTasks()
  const toggleTask = useToggleTask()

  const today = new Date()
  const dayName = format(today, 'EEEE')
  const dateStr = format(today, 'MMMM d')

  const overdue = todayTasks?.filter(
    (t) => t.due_date && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date))
  ) ?? []
  const dueToday = todayTasks?.filter(
    (t) => !t.due_date || isToday(parseISO(t.due_date))
  ) ?? []

  return (
    <div className="flex h-full flex-col">
      {/* Date header */}
      <div className="mb-6">
        <p className="font-handwritten text-3xl text-terracotta-500">{dayName}</p>
        <p className="font-display text-lg text-brown-700/70">{dateStr}</p>
        {member && (
          <p className="mt-1 text-sm text-brown-700/50">
            Hey {member.display_name} 👋
          </p>
        )}
      </div>

      {/* Overdue tasks */}
      {overdue.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-red-500/80">Overdue</p>
          <div className="space-y-1">
            {overdue.map((task) => (
              <TodayTaskRow
                key={task.id}
                task={task}
                onToggle={() => toggleTask.mutate({ id: task.id, is_complete: true })}
                overdue
              />
            ))}
          </div>
        </div>
      )}

      {/* Today's tasks */}
      <div className="flex-1">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-brown-700/40">Today</p>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-sand-100" />
            ))}
          </div>
        ) : dueToday.length === 0 && overdue.length === 0 ? (
          <div className="py-8 text-center">
            <p className="font-display text-3xl text-brown-700/20">✓</p>
            <p className="mt-2 text-sm text-brown-700/50">Nothing due today</p>
          </div>
        ) : (
          <div className="space-y-1">
            {dueToday.map((task) => (
              <TodayTaskRow
                key={task.id}
                task={task}
                onToggle={() => toggleTask.mutate({ id: task.id, is_complete: true })}
                overdue={false}
              />
            ))}
          </div>
        )}
      </div>

      {/* Quick stats */}
      {(todayTasks?.length ?? 0) > 0 && (
        <div className="mt-6 rounded-xl bg-cream-50 border border-sand-200 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-brown-700/60">Tasks remaining today</p>
            <p className="font-display text-lg text-brown-800">
              {todayTasks?.length ?? 0}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function TodayTaskRow({
  task,
  onToggle,
  overdue,
}: {
  task: { id: string; title: string; due_date: string | null; is_complete: boolean; assigned_member?: { display_name: string; avatar_color: string | null } | null }
  onToggle: () => void
  overdue: boolean
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-cream-100 ${
        overdue ? 'bg-red-50/50 border border-red-100' : ''
      }`}
    >
      <button
        onClick={onToggle}
        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 border-sand-400 transition-colors hover:border-terracotta-400"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-brown-800">{task.title}</p>
        {task.assigned_member && (
          <p className="text-xs text-brown-700/50">{task.assigned_member.display_name}</p>
        )}
      </div>
      {overdue && task.due_date && (
        <span className="text-xs text-red-400">
          {format(parseISO(task.due_date), 'MMM d')}
        </span>
      )}
    </div>
  )
}

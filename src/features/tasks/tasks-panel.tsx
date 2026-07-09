import { useState } from 'react'
import { format, isPast, isToday, parseISO } from 'date-fns'
import { useTasks, useCreateTask, useToggleTask, useDeleteTask, useReorderTasks, sortUnscheduledTasks, type Task } from './use-tasks'
import { UnscheduledTaskList } from './unscheduled-task-list'
import { TaskForm } from './task-form'
import { useFamilyMember, useFamilyMembers } from '@/features/auth/use-family-member'

export function TasksPanel({ onSelectTask }: { onSelectTask?: (task: Task) => void }) {
  const { data: tasks, isLoading } = useTasks()
  const { data: member } = useFamilyMember()
  const { data: members } = useFamilyMembers()
  const createTask = useCreateTask()
  const toggleTask = useToggleTask()
  const deleteTask = useDeleteTask()
  const reorderTasks = useReorderTasks()

  const [newTitle, setNewTitle] = useState('')
  const [newDue, setNewDue] = useState('')
  const [newAssignee, setNewAssignee] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  const handleSelectTask = (task: Task) => {
    if (onSelectTask) {
      onSelectTask(task)
    } else {
      setEditingTask(task)
    }
  }

  const incomplete = tasks?.filter((t) => !t.is_complete) ?? []
  const unscheduled = sortUnscheduledTasks(incomplete.filter((t) => !t.due_date), member?.family_id)
  const scheduled = incomplete
    .filter((t) => !!t.due_date)
    .sort((a, b) => a.due_date!.localeCompare(b.due_date!))
  const complete = tasks?.filter((t) => t.is_complete) ?? []

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
    setShowForm(false)
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-sand-100" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl text-brown-800">Tasks</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-terracotta-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-terracotta-600"
        >
          + Add
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="mb-4 rounded-xl border border-sand-200 bg-cream-50 p-4 space-y-3">
          <input
            autoFocus
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="What needs doing?"
            className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-sm text-brown-800 placeholder:text-brown-700/40 focus:border-terracotta-500 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={newDue}
              onChange={(e) => setNewDue(e.target.value)}
              className="flex-1 rounded-lg border border-sand-300 bg-white px-3 py-2 text-sm text-brown-800 focus:border-terracotta-500 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
            />
            <select
              value={newAssignee}
              onChange={(e) => setNewAssignee(e.target.value)}
              className="flex-1 rounded-lg border border-sand-300 bg-white px-3 py-2 text-sm text-brown-800 focus:border-terracotta-500 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
            >
              <option value="">Anyone</option>
              {members?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!newTitle.trim() || createTask.isPending}
              className="flex-1 rounded-lg bg-brown-800 py-2 text-sm font-medium text-cream-50 transition-colors hover:bg-brown-900 disabled:opacity-50"
            >
              {createTask.isPending ? 'Adding…' : 'Add task'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-sand-300 px-4 py-2 text-sm text-brown-700 hover:bg-cream-100"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="flex-1 overflow-y-auto space-y-1">
        {incomplete.length === 0 && !showForm && (
          <div className="py-8 text-center">
            <p className="font-display text-brown-700/60">All clear — nothing on the list!</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-2 text-sm text-terracotta-500 hover:text-terracotta-600"
            >
              Add something
            </button>
          </div>
        )}

        {/* Unscheduled section with drag & drop reorder */}
        {unscheduled.length > 0 && (
          <div className="mb-5">
            <h3 className="px-1 mb-1.5 font-display text-xs font-semibold uppercase tracking-wider text-terracotta-500 select-none">
              Unscheduled
            </h3>
            <UnscheduledTaskList
              tasks={unscheduled}
              variant="panel"
              onToggle={(task) => toggleTask.mutate({ id: task.id, is_complete: true })}
              onDelete={(task) => deleteTask.mutate(task.id)}
              onReorder={(orderedIds) => reorderTasks.mutate(orderedIds)}
              onSelect={handleSelectTask}
            />
          </div>
        )}

        {/* Scheduled section */}
        {scheduled.length > 0 && (
          <div className="mb-5">
            <h3 className="px-1 mb-1.5 font-display text-xs font-semibold uppercase tracking-wider text-brown-700/60 select-none">
              Coming up
            </h3>
            <div className="space-y-1">
              {scheduled.map((task) => {
                const isOverdue = task.due_date && isPast(parseISO(task.due_date)) && !isToday(parseISO(task.due_date))
                return (
                  <TaskRow
                    key={task.id}
                    task={task}
                    isOverdue={!!isOverdue}
                    onToggle={() => toggleTask.mutate({ id: task.id, is_complete: true })}
                    onDelete={() => deleteTask.mutate(task.id)}
                    onSelect={() => handleSelectTask(task)}
                  />
                )
              })}
            </div>
          </div>
        )}

        {complete.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-xs font-medium text-brown-700/50 hover:text-brown-700">
              Done ({complete.length})
            </summary>
            <div className="mt-2 space-y-1">
              {complete.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  isOverdue={false}
                  onToggle={() => toggleTask.mutate({ id: task.id, is_complete: false })}
                  onDelete={() => deleteTask.mutate(task.id)}
                  onSelect={() => handleSelectTask(task)}
                />
              ))}
            </div>
          </details>
        )}
      </div>

      {editingTask && (
        <TaskForm task={editingTask} onClose={() => setEditingTask(null)} />
      )}
    </div>
  )
}

function TaskRow({
  task,
  isOverdue,
  onToggle,
  onDelete,
  onSelect,
}: {
  task: any
  isOverdue: boolean
  onToggle: () => void
  onDelete: () => void
  onSelect?: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onSelect}
      className={`group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors ${
        task.is_complete ? 'opacity-50' : 'hover:bg-cream-100'
      } ${onSelect ? 'cursor-pointer' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
        className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors mt-[1px] ${
          task.is_complete
            ? 'border-terracotta-400 bg-terracotta-400'
            : 'border-sand-400 hover:border-terracotta-400'
        }`}
      >
        {task.is_complete && (
          <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <p className={`break-words whitespace-normal text-sm ${task.is_complete ? 'line-through text-brown-700/50' : 'text-brown-800'}`}>
          {task.title}
        </p>
        <div className="flex items-center gap-2">
          {task.due_date && (
            <span className={`text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-brown-700/50'}`}>
              {isOverdue ? '⚠ ' : ''}
              {format(parseISO(task.due_date), 'MMM d')}
            </span>
          )}
          {task.assigned_member && (
            <span className="text-xs text-brown-700/50">→ {task.assigned_member.display_name}</span>
          )}
        </div>
      </div>

      {hovered && !task.is_complete && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="flex-shrink-0 rounded p-1 text-brown-700/30 hover:text-red-400 mt-[1px]"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none">
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  )
}

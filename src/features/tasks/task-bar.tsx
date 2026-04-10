import { useState } from 'react'
import { format, isPast, isToday, parseISO } from 'date-fns'
import { useTasks, useCreateTask, useToggleTask, useDeleteTask } from './use-tasks'
import { useFamilyMembers } from '@/features/auth/use-family-member'

export function TaskBar({ onExpand }: { onExpand?: () => void }) {
  const { data: tasks } = useTasks()
  const { data: members } = useFamilyMembers()
  const createTask = useCreateTask()
  const toggleTask = useToggleTask()
  const deleteTask = useDeleteTask()

  const [showAdd, setShowAdd] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDue, setNewDue] = useState('')
  const [newAssignee, setNewAssignee] = useState('')

  const incomplete = tasks?.filter((t) => !t.is_complete) ?? []

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
    setShowAdd(false)
  }

  return (
    <div className="flex-shrink-0 border-t border-sand-200 bg-white">
      {/* Add task form — slides up when open */}
      {showAdd && (
        <form
          onSubmit={handleAdd}
          className="border-b border-sand-200 px-4 py-3 flex items-center gap-3"
        >
          <input
            autoFocus
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="What needs doing?"
            className="flex-1 rounded-lg border border-sand-300 bg-cream-50 px-3 py-1.5 text-sm text-brown-800 placeholder:text-brown-700/40 focus:border-terracotta-500 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
          />
          <div className="relative">
            <input
              type="date"
              value={newDue}
              onChange={(e) => setNewDue(e.target.value)}
              className="rounded-lg border border-sand-300 bg-cream-50 px-3 py-1.5 text-sm text-brown-800 focus:border-terracotta-500 focus:outline-none focus:ring-1 focus:ring-terracotta-500 [color-scheme:light]"
            />
            {!newDue && (
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-brown-700/35">
                Date
              </span>
            )}
          </div>
          <select
            value={newAssignee}
            onChange={(e) => setNewAssignee(e.target.value)}
            className="rounded-lg border border-sand-300 bg-cream-50 px-3 py-1.5 text-sm text-brown-800 focus:border-terracotta-500 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
          >
            <option value="">Anyone</option>
            {members?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!newTitle.trim() || createTask.isPending}
            className="rounded-lg bg-terracotta-500 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-terracotta-600 disabled:opacity-50"
          >
            {createTask.isPending ? 'Adding…' : 'Add'}
          </button>
          <button
            type="button"
            onClick={() => setShowAdd(false)}
            className="rounded-lg border border-sand-300 px-3 py-1.5 text-sm text-brown-700 hover:bg-cream-100"
          >
            Cancel
          </button>
        </form>
      )}

      {/* Task strip */}
      <div className="flex h-12 items-center gap-2 overflow-x-auto px-4 scrollbar-hide">
        {/* Tasks panel button */}
        {onExpand && (
          <button
            onClick={onExpand}
            className="flex h-7 flex-shrink-0 items-center gap-1.5 rounded-full border border-sand-200 px-3 text-xs font-medium text-brown-700/70 transition-colors hover:bg-cream-100 hover:text-brown-800"
          >
            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
              <rect x="1" y="1" width="4" height="10" rx="1" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M7 3.5h4M7 6h4M7 8.5h2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            Tasks
          </button>
        )}

        {/* Divider before add */}
        {onExpand && <div className="h-5 w-px flex-shrink-0 bg-sand-200" />}

        {/* Add button */}
        <button
          onClick={() => setShowAdd(true)}
          className="flex h-7 flex-shrink-0 items-center gap-1.5 rounded-full bg-terracotta-500 px-3 text-xs font-medium text-white transition-colors hover:bg-terracotta-600"
        >
          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
            <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Add task
        </button>

        {/* Divider */}
        {incomplete.length > 0 && (
          <div className="h-5 w-px flex-shrink-0 bg-sand-200" />
        )}

        {/* Task chips */}
        {incomplete.length === 0 && !showAdd && (
          <span className="text-xs text-brown-700/40 italic">No tasks — all clear!</span>
        )}

        {incomplete.map((task) => {
          const isOverdue =
            task.due_date &&
            isPast(parseISO(task.due_date)) &&
            !isToday(parseISO(task.due_date))

          return (
            <TaskChip
              key={task.id}
              task={task}
              isOverdue={!!isOverdue}
              onToggle={() => toggleTask.mutate({ id: task.id, is_complete: true })}
              onDelete={() => deleteTask.mutate(task.id)}
            />
          )
        })}
      </div>
    </div>
  )
}

function TaskChip({
  task,
  isOverdue,
  onToggle,
  onDelete,
}: {
  task: { id: string; title: string; due_date: string | null; assigned_member?: { display_name: string; avatar_color: string | null } | null }
  isOverdue: boolean
  onToggle: () => void
  onDelete: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const color = task.assigned_member?.avatar_color ?? '#C4714F'

  return (
    <div
      className="group flex h-7 flex-shrink-0 items-center gap-1.5 rounded-full border pl-2 pr-1 text-xs transition-colors hover:brightness-95"
      style={{
        borderColor: `${color}44`,
        backgroundColor: `${color}11`,
        color,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Complete button */}
      <button
        onClick={onToggle}
        className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border transition-colors"
        style={{ borderColor: `${color}88` }}
        title="Mark complete"
      >
        <svg className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 10 10" fill="none">
          <path d="M2 5l2.5 2.5 3.5-4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <span className="max-w-[140px] truncate font-medium">{task.title}</span>

      {task.due_date && (
        <span
          className="text-xs"
          style={{ color: isOverdue ? '#ef4444' : `${color}99` }}
        >
          {isOverdue ? '⚠' : ''} {format(parseISO(task.due_date), 'M/d')}
        </span>
      )}

      {/* Delete on hover */}
      {hovered && (
        <button
          onClick={onDelete}
          className="ml-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full opacity-50 hover:opacity-100 transition-opacity"
          title="Delete task"
        >
          <svg className="h-2.5 w-2.5" viewBox="0 0 10 10" fill="none">
            <path d="M2 2l6 6M8 2l-6 6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  )
}

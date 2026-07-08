import { useState } from 'react'
import { format, addDays } from 'date-fns'
import { useFamilyMembers } from '@/features/auth/use-family-member'
import { useUpdateTask, useDeleteTask, type Task } from './use-tasks'

interface TaskFormProps {
  task: Task
  onClose: () => void
}

export function TaskForm({ task, onClose }: TaskFormProps) {
  const { data: familyMembers } = useFamilyMembers()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()

  const [title, setTitle] = useState(task.title ?? '')
  const [dueDate, setDueDate] = useState(task.due_date ?? '')
  const [assignedTo, setAssignedTo] = useState(task.assigned_to ?? '')
  const [notes, setNotes] = useState(task.notes ?? '')
  const [isComplete, setIsComplete] = useState(task.is_complete ?? false)

  const isPending = updateTask.isPending || deleteTask.isPending

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    await updateTask.mutateAsync({
      id: task.id,
      title: title.trim(),
      due_date: dueDate || null,
      assigned_to: assignedTo || null,
      notes: notes || null,
      is_complete: isComplete,
    })
    onClose()
  }

  const handleDelete = async () => {
    if (!confirm('Delete this task?')) return
    await deleteTask.mutateAsync(task.id)
    onClose()
  }

  const setQuickDate = (daysToAdd: number) => {
    const target = addDays(new Date(), daysToAdd)
    setDueDate(format(target, 'yyyy-MM-dd'))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-brown-900/30 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet / Modal */}
      <div className="relative z-10 w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-sand-100 flex-shrink-0">
          <h2 className="font-semibold text-brown-800 text-base">Edit task</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="rounded-xl px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-brown-700/40 hover:bg-sand-100 transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-5 py-4 space-y-5">
            {/* Title */}
            <div>
              <input
                autoFocus
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs doing?"
                className="w-full text-lg font-semibold text-brown-800 placeholder:text-brown-700/30 focus:outline-none border-b border-sand-200 pb-2"
              />
            </div>

            {/* Status toggle */}
            <div className="flex items-center justify-between rounded-xl bg-cream-50 p-3 border border-sand-200">
              <span className="text-sm font-medium text-brown-800">Status</span>
              <button
                type="button"
                onClick={() => setIsComplete((v) => !v)}
                className={`flex items-center gap-2 rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                  isComplete
                    ? 'bg-terracotta-500 text-white'
                    : 'bg-white border border-sand-300 text-brown-700 hover:bg-cream-100'
                }`}
              >
                {isComplete ? (
                  <>
                    <svg className="h-3.5 w-3.5" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Completed
                  </>
                ) : (
                  'In progress'
                )}
              </button>
            </div>

            {/* Due date & Quick scheduling */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-brown-700/60">
                Due date
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="flex-1 rounded-xl border border-sand-200 bg-cream-50 px-3 py-2 text-sm text-brown-800 focus:border-terracotta-500 focus:outline-none [color-scheme:light]"
                />
              </div>
              {/* Quick schedule shortcuts */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setQuickDate(0)}
                  className="rounded-lg border border-sand-200 bg-white px-2.5 py-1 text-xs font-medium text-brown-700 hover:bg-cream-100 transition-colors"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate(1)}
                  className="rounded-lg border border-sand-200 bg-white px-2.5 py-1 text-xs font-medium text-brown-700 hover:bg-cream-100 transition-colors"
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate(7)}
                  className="rounded-lg border border-sand-200 bg-white px-2.5 py-1 text-xs font-medium text-brown-700 hover:bg-cream-100 transition-colors"
                >
                  Next week
                </button>
                {dueDate && (
                  <button
                    type="button"
                    onClick={() => setDueDate('')}
                    className="ml-auto rounded-lg bg-sand-200/60 px-2.5 py-1 text-xs font-semibold text-brown-700 hover:bg-sand-200 transition-colors"
                  >
                    Clear date (Unschedule)
                  </button>
                )}
              </div>
            </div>

            {/* Assignee */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-brown-700/60">
                Assign to
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setAssignedTo('')}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all border ${
                    !assignedTo
                      ? 'bg-brown-800 text-cream-50 border-brown-800 shadow-sm'
                      : 'bg-cream-50 text-brown-700 border-sand-200 hover:bg-cream-100'
                  }`}
                >
                  Anyone
                </button>
                {familyMembers?.map((m) => {
                  const isSelected = assignedTo === m.id
                  const color = m.avatar_color ?? '#C4714F'
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setAssignedTo(m.id)}
                      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all border ${
                        isSelected
                          ? 'text-white shadow-sm border-transparent'
                          : 'bg-cream-50 text-brown-800 border-sand-200 hover:bg-cream-100'
                      }`}
                      style={
                        isSelected
                          ? { backgroundColor: color }
                          : {}
                      }
                    >
                      <span
                        className="h-3 w-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color, opacity: isSelected ? 1 : 0.8 }}
                      />
                      {m.display_name}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-brown-700/60">
                Notes & Details
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes, sub-tasks, or links…"
                rows={4}
                className="w-full rounded-xl border border-sand-200 bg-cream-50 px-3 py-2 text-sm text-brown-800 placeholder:text-brown-700/30 focus:border-terracotta-500 focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* Submit footer */}
          <div className="px-5 pb-6 pt-3 flex-shrink-0 border-t border-sand-100 bg-white">
            <button
              type="submit"
              disabled={!title.trim() || isPending}
              className="w-full rounded-2xl bg-brown-800 py-4 text-base font-semibold text-cream-50 disabled:opacity-40 hover:bg-brown-900 transition-colors"
            >
              {isPending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

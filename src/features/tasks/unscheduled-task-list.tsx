import { useState } from 'react'
import type { Task } from './use-tasks'

interface UnscheduledTaskListProps {
  tasks: Task[]
  onToggle: (task: Task) => void
  onDelete: (task: Task) => void
  onReorder: (orderedIds: string[]) => void
  onSelect?: (task: Task) => void
  variant?: 'sidebar' | 'panel'
}

export function UnscheduledTaskList({
  tasks,
  onToggle,
  onDelete,
  onReorder,
  onSelect,
  variant = 'sidebar',
}: UnscheduledTaskListProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [overPosition, setOverPosition] = useState<'top' | 'bottom' | null>(null)

  const handleReorder = (fromId: string, toId: string, position: 'top' | 'bottom' | null) => {
    if (fromId === toId || !position) return
    const fromIndex = tasks.findIndex((t) => t.id === fromId)
    const toIndex = tasks.findIndex((t) => t.id === toId)
    if (fromIndex === -1 || toIndex === -1) return

    const newTasks = [...tasks]
    const [moved] = newTasks.splice(fromIndex, 1)

    // After removing fromIndex, find where toId is now located in newTasks
    const targetIndexInNew = newTasks.findIndex((t) => t.id === toId)
    const insertIndex = position === 'top' ? targetIndexInNew : targetIndexInNew + 1

    newTasks.splice(insertIndex, 0, moved)
    onReorder(newTasks.map((t) => t.id))
  }

  // ── Drag & Drop ──────────────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
    setDraggedId(id)
  }

  const handleDragOver = (e: React.DragEvent<HTMLLIElement>, id: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (id !== draggedId && draggedId !== null) {
      const rect = e.currentTarget.getBoundingClientRect()
      const isTopHalf = e.clientY < rect.top + rect.height / 2
      setOverId(id)
      setOverPosition(isTopHalf ? 'top' : 'bottom')
    }
  }

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    const sourceId = draggedId || e.dataTransfer.getData('text/plain')
    if (sourceId && sourceId !== targetId && overPosition) {
      handleReorder(sourceId, targetId, overPosition)
    }
    setDraggedId(null)
    setOverId(null)
    setOverPosition(null)
  }

  const handleDragEnd = () => {
    setDraggedId(null)
    setOverId(null)
    setOverPosition(null)
  }

  return (
    <ul className={variant === 'sidebar' ? 'px-3 pb-3 space-y-1 relative' : 'space-y-1 relative'}>
      {tasks.map((task) => {
        const color = task.assigned_member?.avatar_color ?? '#C4714F'
        const isDragging = draggedId === task.id
        const isOver = overId === task.id && !isDragging

        const baseClasses =
          variant === 'sidebar'
            ? 'group relative flex items-start gap-2 rounded-lg px-2 py-2 transition-all select-none'
            : 'group relative flex items-start gap-3 rounded-lg px-3 py-2.5 transition-all select-none'

        const cursorClass = onSelect ? 'cursor-pointer' : ''

        const stateClasses = isDragging
          ? 'opacity-60 bg-cream-200/60 border-2 border-dashed border-terracotta-400/80 rounded-lg scale-[0.98] z-10'
          : 'hover:bg-cream-100'

        return (
          <li
            key={task.id}
            data-task-id={task.id}
            draggable
            onClick={() => onSelect?.(task)}
            onDragStart={(e) => handleDragStart(e, task.id)}
            onDragOver={(e) => handleDragOver(e, task.id)}
            onDrop={(e) => handleDrop(e, task.id)}
            onDragEnd={handleDragEnd}
            className={`${baseClasses} ${cursorClass} ${stateClasses}`}
          >
            {/* Top insertion line indicator */}
            {isOver && overPosition === 'top' && (
              <div className="absolute -top-1 left-0 right-0 h-1 bg-terracotta-500 rounded-full shadow-sm z-30 pointer-events-none flex items-center">
                <div className="h-2.5 w-2.5 rounded-full bg-terracotta-600 -ml-1 shadow" />
              </div>
            )}

            {/* Bottom insertion line indicator */}
            {isOver && overPosition === 'bottom' && (
              <div className="absolute -bottom-1 left-0 right-0 h-1 bg-terracotta-500 rounded-full shadow-sm z-30 pointer-events-none flex items-center">
                <div className="h-2.5 w-2.5 rounded-full bg-terracotta-600 -ml-1 shadow" />
              </div>
            )}

            {/* Grip handle for drag reorder */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-center p-0.5 cursor-grab active:cursor-grabbing text-brown-700/30 group-hover:text-brown-700/60 hover:text-brown-700 transition-colors mt-[3px]"
              title="Drag to reorder"
            >
              <svg className="h-3.5 w-2.5 flex-shrink-0" viewBox="0 0 8 12" fill="currentColor">
                <circle cx="2" cy="2" r="1" />
                <circle cx="6" cy="2" r="1" />
                <circle cx="2" cy="6" r="1" />
                <circle cx="6" cy="6" r="1" />
                <circle cx="2" cy="10" r="1" />
                <circle cx="6" cy="10" r="1" />
              </svg>
            </div>

            {/* Complete toggle button */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggle(task)
              }}
              className={`flex flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors hover:bg-terracotta-500/10 mt-[1px] ${
                variant === 'sidebar' ? 'h-[18px] w-[18px]' : 'h-5 w-5'
              }`}
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
            <div className="flex-1 min-w-0">
              <span
                className={`block break-words whitespace-normal text-brown-900 ${
                  variant === 'sidebar' ? 'text-sm' : 'text-sm font-medium'
                }`}
              >
                {task.title}
              </span>
              {variant === 'panel' && task.assigned_member && (
                <span className="text-xs text-brown-700/50 block mt-0.5">→ {task.assigned_member.display_name}</span>
              )}
            </div>

            {/* Delete button — reveals on row hover */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(task)
              }}
              className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-brown-700/25 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all mt-[1px]"
              title="Delete"
            >
              <svg className="h-2.5 w-2.5" viewBox="0 0 10 10" fill="none">
                <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

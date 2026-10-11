import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { useTasks, useToggleTask, useCreateTask, type Task } from '@/features/tasks/use-tasks'
import { useGroceryItems, useToggleGroceryItem, useAddGroceryItem } from '@/features/grocery/use-grocery'
import { useMealPlan } from '@/features/meals/use-meals'
import { weekStartISO } from '@/features/meals/types'

type Board = 'tasks' | 'dinner' | 'groceries'

const DOCK_KEY = 'supfam-dock-open'

/**
 * The collapsed boards dock under the calendar: Tasks, Dinner, Groceries
 * each live as a single slim row with a live summary, expanding in place
 * when tapped. The calendar stays the hero — everything else tucks away.
 */
export function BoardsDock({
  onSelectTask,
  onOpenDinner,
}: {
  onSelectTask: (task: Task) => void
  onOpenDinner: () => void
}) {
  const [open, setOpen] = useState<Board | null>(() => {
    try {
      const saved = localStorage.getItem(DOCK_KEY)
      return saved === 'tasks' || saved === 'dinner' || saved === 'groceries' ? saved : null
    } catch {
      return null
    }
  })

  const toggle = (b: Board) => {
    const next = open === b ? null : b
    setOpen(next)
    try {
      if (next) localStorage.setItem(DOCK_KEY, next)
      else localStorage.removeItem(DOCK_KEY)
    } catch {
      /* noop */
    }
  }

  return (
    <div className="mx-3 mt-3 mb-safe flex-shrink-0 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-sand-200/60">
      <BoardRow
        board="tasks"
        open={open}
        onToggle={toggle}
        icon={<TaskIcon />}
        label="Tasks"
        summary={<TasksSummary />}
      >
        <TasksPanel onSelectTask={onSelectTask} />
      </BoardRow>
      <BoardRow
        board="dinner"
        open={open}
        onToggle={toggle}
        icon={<DinnerIcon />}
        label="Dinner"
        summary={<DinnerSummary />}
      >
        <DinnerPanel onOpenDinner={onOpenDinner} />
      </BoardRow>
      <BoardRow
        board="groceries"
        open={open}
        onToggle={toggle}
        icon={<GroceryIcon />}
        label="Groceries"
        summary={<GroceriesSummary />}
      >
        <GroceriesPanel />
      </BoardRow>
    </div>
  )
}

function BoardRow({
  board,
  open,
  onToggle,
  icon,
  label,
  summary,
  children,
}: {
  board: Board
  open: Board | null
  onToggle: (b: Board) => void
  icon: React.ReactNode
  label: string
  summary: React.ReactNode
  children: React.ReactNode
}) {
  const isOpen = open === board
  return (
    <div className={open && !isOpen ? 'hidden' : ''}>
      <button
        type="button"
        onClick={() => onToggle(board)}
        aria-expanded={isOpen}
        className={`flex h-11 w-full items-center gap-2.5 px-4 text-left transition-colors ${
          isOpen ? 'bg-cream-50' : 'hover:bg-cream-50/60'
        }`}
      >
        <span className="text-brown-700/50">{icon}</span>
        <span className="text-sm font-semibold text-brown-800">{label}</span>
        <span className="min-w-0 flex-1 truncate text-xs text-brown-700/50">{summary}</span>
        <svg
          className={`h-3.5 w-3.5 flex-shrink-0 text-brown-700/40 transition-transform ${isOpen ? 'rotate-90' : ''}`}
          viewBox="0 0 14 14"
          fill="none"
        >
          <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {isOpen && (
        <div className="max-h-64 overflow-y-auto border-t border-sand-100 bg-cream-50/60 px-4 py-3">
          {children}
        </div>
      )}
    </div>
  )
}

/* ── Summaries (collapsed row subtitles) ─────────────────────────────── */

function TasksSummary() {
  const { data: tasks } = useTasks()
  const open = (tasks ?? []).filter((t) => !t.is_complete).length
  return <>{open === 0 ? 'All clear' : `${open} open`}</>
}

function DinnerSummary() {
  const [now] = useState(() => new Date())
  const { data: mealData } = useMealPlan(weekStartISO(now))
  const todayIdx = (now.getDay() + 6) % 7
  const tonight = mealData?.meals.find((m) => m.day_index === todayIdx && m.slot === 'dinner')
  return <>{tonight ? `Tonight: ${tonight.title}` : 'Not planned yet'}</>
}

function GroceriesSummary() {
  const { data: items } = useGroceryItems()
  const open = (items ?? []).filter((g) => !g.is_checked).length
  return <>{open === 0 ? 'List clear' : `${open} to buy`}</>
}

/* ── Expanded panels ─────────────────────────────────────────────────── */

function TasksPanel({ onSelectTask }: { onSelectTask: (task: Task) => void }) {
  const { data: tasks } = useTasks()
  const toggleTask = useToggleTask()
  const createTask = useCreateTask()
  const [title, setTitle] = useState('')

  const open = (tasks ?? []).filter((t) => !t.is_complete)

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    await createTask.mutateAsync({ title: title.trim(), due_date: null, assigned_to: null })
    setTitle('')
  }

  return (
    <div>
      <form onSubmit={add} className="mb-2 flex items-center gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task…"
          className="h-9 flex-1 rounded-lg border border-sand-300 bg-white px-3 text-sm text-brown-800 placeholder:text-brown-700/40 focus:border-terracotta-500 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
        />
        <button
          type="submit"
          disabled={!title.trim() || createTask.isPending}
          className="h-9 flex-shrink-0 rounded-lg bg-terracotta-500 px-4 text-sm font-medium text-white transition-colors hover:bg-terracotta-600 disabled:opacity-50"
        >
          Add
        </button>
      </form>
      {open.length === 0 ? (
        <p className="py-2 text-sm italic text-brown-700/40">No tasks — all clear!</p>
      ) : (
        <ul className="divide-y divide-sand-100">
          {open.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-2">
              <button
                type="button"
                onClick={() => toggleTask.mutate({ id: t.id, is_complete: true })}
                className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 border-sand-300 transition-colors hover:border-terracotta-500"
                aria-label={`Complete ${t.title}`}
              />
              <button
                type="button"
                onClick={() => onSelectTask(t)}
                className="min-w-0 flex-1 truncate text-left text-sm text-brown-800 hover:text-terracotta-600"
              >
                {t.title}
              </button>
              {t.due_date && (
                <span className="flex-shrink-0 text-xs text-brown-700/50">
                  {format(parseISO(t.due_date), 'M/d')}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function DinnerPanel({ onOpenDinner }: { onOpenDinner: () => void }) {
  const [now] = useState(() => new Date())
  const { data: mealData } = useMealPlan(weekStartISO(now))
  const todayIdx = (now.getDay() + 6) % 7
  const tonight = mealData?.meals.find((m) => m.day_index === todayIdx && m.slot === 'dinner')

  return (
    <div className="flex items-center gap-3">
      {tonight ? (
        <div className="min-w-0 flex-1 rounded-xl bg-terracotta-500 px-4 py-3 text-cream-50">
          <p className="text-[11px] font-semibold uppercase tracking-widest opacity-80">Tonight</p>
          <p className="truncate font-display text-2xl leading-tight">{tonight.title}</p>
        </div>
      ) : (
        <p className="min-w-0 flex-1 text-sm italic text-brown-700/40">No dinner planned yet.</p>
      )}
      <button
        type="button"
        onClick={onOpenDinner}
        className="flex-shrink-0 rounded-lg border border-sand-300 bg-white px-4 py-2 text-sm font-medium text-brown-800 transition-colors hover:bg-cream-100"
      >
        {tonight ? 'Dinner board' : 'Plan dinner'}
      </button>
    </div>
  )
}

function GroceriesPanel() {
  const { data: items } = useGroceryItems()
  const toggleItem = useToggleGroceryItem()
  const addItem = useAddGroceryItem()
  const [title, setTitle] = useState('')

  const open = (items ?? []).filter((g) => !g.is_checked)

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    await addItem.mutateAsync({ title: title.trim() })
    setTitle('')
  }

  return (
    <div>
      <form onSubmit={add} className="mb-2 flex items-center gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add an item…"
          className="h-9 flex-1 rounded-lg border border-sand-300 bg-white px-3 text-sm text-brown-800 placeholder:text-brown-700/40 focus:border-terracotta-500 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
        />
        <button
          type="submit"
          disabled={!title.trim() || addItem.isPending}
          className="h-9 flex-shrink-0 rounded-lg bg-terracotta-500 px-4 text-sm font-medium text-white transition-colors hover:bg-terracotta-600 disabled:opacity-50"
        >
          Add
        </button>
      </form>
      {open.length === 0 ? (
        <p className="py-2 text-sm italic text-brown-700/40">List is clear.</p>
      ) : (
        <ul className="divide-y divide-sand-100">
          {open.map((g) => (
            <li key={g.id} className="flex items-center gap-3 py-2">
              <button
                type="button"
                onClick={() => toggleItem.mutate({ id: g.id, is_checked: true })}
                className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 border-sand-300 transition-colors hover:border-terracotta-500"
                aria-label={`Check off ${g.title}`}
              />
              <span className="min-w-0 flex-1 truncate text-sm text-brown-800">{g.title}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ── Icons ───────────────────────────────────────────────────────────── */

function TaskIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
      <path d="M2.5 8.5l3.5 3.5 7-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DinnerIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
      <path d="M2 6h12M2 6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2M2 6v5.5A2.5 2.5 0 0 0 4.5 14h7a2.5 2.5 0 0 0 2.5-2.5V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6 2.5V4M10 2.5V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function GroceryIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
      <path d="M2 2h1.5l2 8h7l1.5-5.5H5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="7" cy="13" r="1" fill="currentColor" />
      <circle cx="11" cy="13" r="1" fill="currentColor" />
    </svg>
  )
}

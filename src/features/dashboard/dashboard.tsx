import { useState, useEffect } from 'react'
import { useAuth } from '@/features/auth/auth-context'
import { useFamilyMember } from '@/features/auth/use-family-member'
import { CalendarView } from '@/features/calendar/calendar-view'
import { CalendarPicker } from '@/features/calendar/calendar-picker'
import { TaskBar } from '@/features/tasks/task-bar'
import { GroceryPanel } from '@/features/grocery/grocery-panel'
import { NotesPanel } from '@/features/notes/notes-panel'
import { useTasks } from '@/features/tasks/use-tasks'
import { useCalendarEvents, useSyncCalendars } from '@/features/calendar/use-calendar'

type Drawer = 'grocery' | 'notes' | null

export function Dashboard() {
  const { signOut } = useAuth()
  const { data: member } = useFamilyMember()
  const { data: tasks } = useTasks()
  const { data: events } = useCalendarEvents()
  const syncCalendars = useSyncCalendars()

  const [showSettings, setShowSettings] = useState(false)
  const [showCalendarPicker, setShowCalendarPicker] = useState(false)
  const [drawer, setDrawer] = useState<Drawer>(null)

  const familyName = member?.families?.name ?? 'Your Family'
  const inviteCode = member?.families?.invite_code

  // Auto-sync on mount
  useEffect(() => {
    if (member?.id) syncCalendars.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member?.id])

  const closeAll = () => {
    setShowSettings(false)
    setShowCalendarPicker(false)
  }

  return (
    <div className="flex h-svh flex-col bg-cream-100 overflow-hidden">

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="flex-shrink-0 flex items-center justify-between px-5 py-2.5 border-b border-sand-200/60">

        {/* Wordmark */}
        <div className="flex items-center gap-3">
          <span className="font-handwritten text-2xl leading-none text-terracotta-500">
            Sup Fam
          </span>
          <span className="text-sand-300 text-sm">·</span>
          <span className="font-display text-sm text-brown-700/50 tracking-wide">
            {familyName}
          </span>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-1.5">

          {/* Calendar picker */}
          <div className="relative">
            <button
              onClick={() => { setShowCalendarPicker(v => !v); setShowSettings(false) }}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                showCalendarPicker
                  ? 'border-terracotta-400 bg-terracotta-500 text-white'
                  : 'border-sand-200 bg-white text-brown-700 hover:bg-cream-100'
              }`}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none">
                <rect x="1.5" y="2.5" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M4.5 1.5v2M9.5 1.5v2M1.5 6h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Calendars
              {syncCalendars.isPending && (
                <svg className="h-3 w-3 animate-spin opacity-60" viewBox="0 0 14 14" fill="none">
                  <path d="M12 7A5 5 0 1 1 7 2M12 2v4H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
            {showCalendarPicker && (
              <CalendarPicker onClose={() => setShowCalendarPicker(false)} />
            )}
          </div>

          {/* Grocery */}
          <button
            onClick={() => setDrawer(d => d === 'grocery' ? null : 'grocery')}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
              drawer === 'grocery'
                ? 'border-terracotta-400 bg-terracotta-500 text-white'
                : 'border-sand-200 bg-white text-brown-700 hover:bg-cream-100'
            }`}
          >
            Grocery
          </button>

          {/* Notes */}
          <button
            onClick={() => setDrawer(d => d === 'notes' ? null : 'notes')}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
              drawer === 'notes'
                ? 'border-terracotta-400 bg-terracotta-500 text-white'
                : 'border-sand-200 bg-white text-brown-700 hover:bg-cream-100'
            }`}
          >
            Notes
          </button>

          {/* Divider */}
          <div className="h-5 w-px bg-sand-200 mx-0.5" />

          {/* Profile */}
          <div className="relative">
            <button
              onClick={() => { setShowSettings(v => !v); setShowCalendarPicker(false) }}
              className="flex items-center gap-2 rounded-lg border border-sand-200 bg-white px-3 py-1.5 transition-colors hover:bg-cream-100"
            >
              <div
                className="h-5 w-5 rounded-full ring-2 ring-white ring-offset-1 flex-shrink-0"
                style={{ backgroundColor: member?.avatar_color ?? '#5B8C5A' }}
              />
              <span className="text-xs font-semibold text-brown-800">{member?.display_name}</span>
              <svg className={`h-3 w-3 text-brown-700/40 transition-transform ${showSettings ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="none">
                <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {showSettings && (
              <div className="absolute right-0 top-full z-50 mt-2 w-68 rounded-xl border border-sand-200 bg-white p-4 shadow-xl">
                {inviteCode && (
                  <div className="mb-4">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-brown-700/50">
                      Partner invite code
                    </p>
                    <div className="flex items-center gap-2 rounded-lg border border-sand-200 bg-cream-50 px-3 py-2.5">
                      <span className="flex-1 font-mono text-xl tracking-[0.3em] text-brown-800 font-bold">
                        {inviteCode}
                      </span>
                      <button
                        onClick={() => navigator.clipboard.writeText(inviteCode)}
                        className="rounded-md bg-terracotta-500/10 px-2 py-1 text-xs font-semibold text-terracotta-600 hover:bg-terracotta-500/20 transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                    <p className="mt-1.5 text-[11px] text-brown-700/40 leading-relaxed">
                      Your partner signs in with Google, then enters this code to join {familyName}.
                    </p>
                  </div>
                )}
                <button
                  onClick={signOut}
                  className="w-full rounded-lg border border-sand-300 py-2 text-xs font-semibold text-brown-600 transition-colors hover:bg-cream-100"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Backdrop to close dropdowns */}
      {(showSettings || showCalendarPicker) && (
        <div className="fixed inset-0 z-40" onClick={closeAll} />
      )}

      {/* ── Main ───────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 gap-3 p-3 pb-0">

        {/* Calendar — fills all space */}
        <div className="flex-1 min-w-0 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-sand-200/60 p-4">
          <CalendarView tasks={tasks} events={events} />
        </div>

        {/* Side drawer — grocery or notes */}
        {drawer && (
          <div className="w-72 flex-shrink-0 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-sand-200/60 flex flex-col">
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-sand-100 flex-shrink-0">
              <div className="flex gap-0.5 rounded-lg bg-cream-100 p-0.5">
                {(['grocery', 'notes'] as const).map(panel => (
                  <button
                    key={panel}
                    onClick={() => setDrawer(panel)}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                      drawer === panel
                        ? 'bg-white text-brown-800 shadow-sm'
                        : 'text-brown-700/50 hover:text-brown-800'
                    }`}
                  >
                    {panel}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setDrawer(null)}
                className="rounded-lg p-1.5 text-brown-700/30 hover:bg-cream-100 hover:text-brown-700 transition-colors"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none">
                  <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {drawer === 'grocery' ? <GroceryPanel /> : <NotesPanel />}
            </div>
          </div>
        )}
      </div>

      {/* ── Task bar ───────────────────────────────────────── */}
      <div className="mx-3 my-3 flex-shrink-0 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-sand-200/60">
        <TaskBar />
      </div>
    </div>
  )
}

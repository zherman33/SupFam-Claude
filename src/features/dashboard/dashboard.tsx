import { useState, useEffect, useRef } from 'react'
import { queryClient } from '@/lib/query-client'
import { AdvancedSettings } from '@/features/settings/advanced-settings'
import { useAuth } from '@/features/auth/auth-context'
import { useFamilyMember } from '@/features/auth/use-family-member'
import { CalendarView, type CalendarMode } from '@/features/calendar/calendar-view'
import { CalendarPicker } from '@/features/calendar/calendar-picker'
import { TaskBar } from '@/features/tasks/task-bar'
import { GroceryPanel } from '@/features/grocery/grocery-panel'
import { NotesPanel } from '@/features/notes/notes-panel'
import { useTasks, useSyncTasks } from '@/features/tasks/use-tasks'
import { useCalendarEvents, useSyncCalendars } from '@/features/calendar/use-calendar'

type Drawer = 'grocery' | 'notes' | null

export function Dashboard() {
  const { signOut } = useAuth()
  const { data: member } = useFamilyMember()
  const { data: tasks } = useTasks()
  const { data: events } = useCalendarEvents()
  const syncCalendars = useSyncCalendars()
  const syncTasks = useSyncTasks()

  const [mode, setMode] = useState<CalendarMode>('month')
  const [drawer, setDrawer] = useState<Drawer>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [calPickerOpen, setCalPickerOpen] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const familyName = member?.families?.name ?? 'Your Family'
  const inviteCode = member?.families?.invite_code

  // Auto-sync on mount and whenever the app comes back into view
  // (covers PWA waking from background on iPad/iPhone)
  useEffect(() => {
    if (!member?.id) return
    syncCalendars.mutate()
    syncTasks.mutate()

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncCalendars.mutate()
        syncTasks.mutate()
        queryClient.invalidateQueries()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member?.id])

  // The ⋯ menu — rendered inside the calendar header via headerRight prop
  const dotsMenu = (
    <div className="relative ml-1" ref={menuRef}>
      <button
        onClick={() => { setMenuOpen(v => !v); setCalPickerOpen(false) }}
        className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
          menuOpen ? 'bg-sand-200 text-brown-800' : 'text-brown-700/40 hover:bg-sand-100 hover:text-brown-700'
        }`}
        aria-label="Menu"
      >
        <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
          <circle cx="3" cy="8" r="1.2" fill="currentColor"/>
          <circle cx="8" cy="8" r="1.2" fill="currentColor"/>
          <circle cx="13" cy="8" r="1.2" fill="currentColor"/>
        </svg>
      </button>

      {menuOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />

          <div className="absolute right-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-sand-200 bg-white shadow-xl overflow-hidden">

            {/* Sync indicator */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-sand-100 bg-cream-50">
              <span className="text-xs font-semibold text-brown-700/60 uppercase tracking-widest">
                {familyName}
              </span>
              {syncCalendars.isPending && (
                <span className="flex items-center gap-1 text-[11px] text-brown-700/40">
                  <svg className="h-3 w-3 animate-spin" viewBox="0 0 14 14" fill="none">
                    <path d="M12 7A5 5 0 1 1 7 2M12 2v4H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Syncing…
                </span>
              )}
            </div>

            {/* Menu items */}
            <div className="py-1">
              {/* Calendars */}
              <div className="relative">
                <button
                  onClick={() => setCalPickerOpen(v => !v)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-brown-700 hover:bg-cream-50 transition-colors"
                >
                  <svg className="h-4 w-4 text-brown-700/50" viewBox="0 0 16 16" fill="none">
                    <rect x="1.5" y="2.5" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M5 1.5v2M11 1.5v2M1.5 7h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  Calendars
                  <svg className={`ml-auto h-3.5 w-3.5 text-brown-700/30 transition-transform ${calPickerOpen ? 'rotate-180' : ''}`} viewBox="0 0 14 14" fill="none">
                    <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                {calPickerOpen && (
                  <div className="border-t border-sand-100">
                    <CalendarPicker onClose={() => setCalPickerOpen(false)} inline />
                  </div>
                )}
              </div>

              {/* Grocery */}
              <button
                onClick={() => { setDrawer(d => d === 'grocery' ? null : 'grocery'); setMenuOpen(false) }}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  drawer === 'grocery' ? 'bg-terracotta-50 text-terracotta-600' : 'text-brown-700 hover:bg-cream-50'
                }`}
              >
                <svg className="h-4 w-4 opacity-50" viewBox="0 0 16 16" fill="none">
                  <path d="M2 2h1.5l2 8h7l1.5-5.5H5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="7" cy="13" r="1" fill="currentColor"/>
                  <circle cx="11" cy="13" r="1" fill="currentColor"/>
                </svg>
                Grocery list
              </button>

              {/* Notes */}
              <button
                onClick={() => { setDrawer(d => d === 'notes' ? null : 'notes'); setMenuOpen(false) }}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  drawer === 'notes' ? 'bg-terracotta-50 text-terracotta-600' : 'text-brown-700 hover:bg-cream-50'
                }`}
              >
                <svg className="h-4 w-4 opacity-50" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4h8M4 7h8M4 10h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
                Notes
              </button>

              <div className="h-px bg-sand-100 my-1" />

              {/* Profile */}
              <div className="px-4 py-2.5 flex items-center gap-2.5">
                <div
                  className="h-6 w-6 rounded-full flex-shrink-0"
                  style={{ backgroundColor: member?.avatar_color ?? '#5B8C5A' }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-brown-800 truncate">{member?.display_name}</p>
                  <p className="text-[11px] text-brown-700/40 truncate">{familyName}</p>
                </div>
              </div>

              {/* Invite code */}
              {inviteCode && (
                <div className="px-4 pb-2.5">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-brown-700/40">
                    Partner invite code
                  </p>
                  <div className="flex items-center gap-2 rounded-lg border border-sand-200 bg-cream-50 px-3 py-2">
                    <span className="flex-1 font-mono text-base tracking-[0.25em] text-brown-800 font-bold">
                      {inviteCode}
                    </span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(inviteCode); setMenuOpen(false) }}
                      className="text-[11px] font-semibold text-terracotta-500 hover:text-terracotta-600 transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}

              <div className="h-px bg-sand-100" />

              {/* Advanced Settings */}
              <div className="relative">
                <button
                  onClick={() => { setAdvancedOpen(true); setMenuOpen(false) }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-brown-700 hover:bg-cream-50 transition-colors"
                >
                  <svg className="h-4 w-4 opacity-50" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M8 2v1M8 13v1M2 8h1M13 8h1M3.5 3.5l.7.7M11.8 11.8l.7.7M3.5 12.5l.7-.7M11.8 4.2l.7-.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  Advanced settings
                  <svg className={`ml-auto h-3.5 w-3.5 text-brown-700/30 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} viewBox="0 0 14 14" fill="none">
                    <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>

              <div className="h-px bg-sand-100" />

              {/* Sign out */}
              <button
                onClick={signOut}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-brown-700/60 hover:bg-cream-50 hover:text-brown-700 transition-colors"
              >
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                  <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M11 11l3-3-3-3M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )

  return (
    <div className="flex h-svh flex-col bg-cream-100 overflow-hidden">
      {/* Advanced Settings full-screen panel */}
      {advancedOpen && (
        <AdvancedSettings onClose={() => setAdvancedOpen(false)} />
      )}

      {/* ── Main: calendar + optional side drawer ── */}
      <div className="flex flex-1 min-h-0 gap-3 p-3 pb-0">

        <div className="flex-1 min-w-0 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-sand-200/60 p-4">
          <CalendarView
            tasks={tasks}
            events={events}
            mode={mode}
            onModeChange={setMode}
            headerRight={dotsMenu}
            onRefresh={() => syncCalendars.mutate()}
            isRefreshing={syncCalendars.isPending}
          />
        </div>

        {/* Side drawer */}
        {drawer && (
          <div className="w-72 flex-shrink-0 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-sand-200/60 flex flex-col">
            <div className="flex items-center justify-between px-4 pt-3.5 pb-3 border-b border-sand-100 flex-shrink-0">
              <div className="flex gap-px rounded-lg bg-cream-100 p-0.5">
                {(['grocery', 'notes'] as const).map(panel => (
                  <button
                    key={panel}
                    onClick={() => setDrawer(panel)}
                    className={`rounded-md px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                      drawer === panel ? 'bg-white text-brown-800 shadow-sm' : 'text-brown-700/50 hover:text-brown-800'
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

      {/* ── Task bar ── */}
      <div className="mx-3 my-3 flex-shrink-0 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-sand-200/60">
        <TaskBar />
      </div>
    </div>
  )
}

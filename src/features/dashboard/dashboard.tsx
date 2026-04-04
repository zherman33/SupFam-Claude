import { useState } from 'react'
import { useAuth } from '@/features/auth/auth-context'
import { useFamilyMember } from '@/features/auth/use-family-member'
import { CalendarView } from '@/features/calendar/calendar-view'
import { TaskBar } from '@/features/tasks/task-bar'
import { GroceryPanel } from '@/features/grocery/grocery-panel'
import { NotesPanel } from '@/features/notes/notes-panel'
import { useTasks } from '@/features/tasks/use-tasks'

type Drawer = 'grocery' | 'notes' | null

export function Dashboard() {
  const { signOut } = useAuth()
  const { data: member } = useFamilyMember()
  const { data: tasks } = useTasks()
  const [showSettings, setShowSettings] = useState(false)
  const [drawer, setDrawer] = useState<Drawer>(null)

  const familyName = member?.families?.name ?? 'Your Family'
  const inviteCode = member?.families?.invite_code

  const toggleDrawer = (panel: 'grocery' | 'notes') => {
    setDrawer((d) => (d === panel ? null : panel))
  }

  return (
    <div className="flex h-svh flex-col bg-cream-100 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="font-handwritten text-3xl leading-none text-terracotta-500">
              Sup Fam
            </h1>
            <p className="mt-0.5 font-display text-sm text-brown-700/60">{familyName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Grocery + Notes drawer toggles */}
          <button
            onClick={() => toggleDrawer('grocery')}
            className={`rounded-xl border px-4 py-1.5 text-sm font-medium transition-colors ${
              drawer === 'grocery'
                ? 'border-terracotta-400 bg-terracotta-500 text-white'
                : 'border-sand-200 bg-white text-brown-700 hover:bg-cream-100'
            }`}
          >
            Grocery
          </button>
          <button
            onClick={() => toggleDrawer('notes')}
            className={`rounded-xl border px-4 py-1.5 text-sm font-medium transition-colors ${
              drawer === 'notes'
                ? 'border-terracotta-400 bg-terracotta-500 text-white'
                : 'border-sand-200 bg-white text-brown-700 hover:bg-cream-100'
            }`}
          >
            Notes
          </button>

          {/* Profile / settings */}
          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-2 rounded-xl border border-sand-200 bg-white px-4 py-1.5 shadow-sm transition-colors hover:bg-cream-100"
            >
              <div
                className="h-5 w-5 rounded-full"
                style={{ backgroundColor: member?.avatar_color ?? '#5B8C5A' }}
              />
              <span className="text-sm font-medium text-brown-800">{member?.display_name}</span>
              <svg
                className={`h-4 w-4 text-brown-700/50 transition-transform ${showSettings ? 'rotate-180' : ''}`}
                viewBox="0 0 16 16"
                fill="none"
              >
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {showSettings && (
              <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-sand-200 bg-white p-4 shadow-lg">
                {inviteCode && (
                  <div className="mb-4">
                    <p className="mb-1 text-xs font-medium text-brown-700/60 uppercase tracking-wide">
                      Invite your partner
                    </p>
                    <div className="flex items-center gap-2 rounded-lg border border-sand-200 bg-cream-50 px-3 py-2">
                      <span className="flex-1 font-mono text-lg tracking-widest text-brown-800 font-bold">
                        {inviteCode}
                      </span>
                      <button
                        onClick={() => navigator.clipboard.writeText(inviteCode)}
                        className="text-xs text-terracotta-500 hover:text-terracotta-600"
                      >
                        Copy
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-brown-700/50">
                      Share this code with your partner to join {familyName}
                    </p>
                  </div>
                )}
                <button
                  onClick={signOut}
                  className="w-full rounded-lg border border-sand-300 py-2 text-sm text-brown-700 transition-colors hover:bg-cream-100"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Click outside to close settings */}
      {showSettings && (
        <div className="fixed inset-0 z-40" onClick={() => setShowSettings(false)} />
      )}

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden px-6 pb-0 gap-4">
        {/* Calendar — fills all available space */}
        <div className="flex-1 overflow-hidden rounded-2xl bg-white p-5 shadow-sm">
          <CalendarView tasks={tasks} />
        </div>

        {/* Side drawer — slides in when grocery or notes is open */}
        {drawer && (
          <div className="w-80 flex-shrink-0 overflow-hidden rounded-2xl bg-white p-5 shadow-sm flex flex-col">
            <div className="mb-4 flex items-center justify-between flex-shrink-0">
              <div className="flex gap-1 rounded-lg bg-cream-100 p-1">
                <button
                  onClick={() => setDrawer('grocery')}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    drawer === 'grocery'
                      ? 'bg-white text-brown-800 shadow-sm'
                      : 'text-brown-700/60 hover:text-brown-800'
                  }`}
                >
                  Grocery
                </button>
                <button
                  onClick={() => setDrawer('notes')}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    drawer === 'notes'
                      ? 'bg-white text-brown-800 shadow-sm'
                      : 'text-brown-700/60 hover:text-brown-800'
                  }`}
                >
                  Notes
                </button>
              </div>
              <button
                onClick={() => setDrawer(null)}
                className="rounded-lg p-1.5 text-brown-700/40 transition-colors hover:bg-cream-100 hover:text-brown-700"
              >
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                  <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {drawer === 'grocery' ? <GroceryPanel /> : <NotesPanel />}
            </div>
          </div>
        )}
      </div>

      {/* Task bar — pinned to bottom */}
      <div className="mx-6 mb-4 mt-3 overflow-hidden rounded-2xl shadow-sm">
        <TaskBar />
      </div>
    </div>
  )
}

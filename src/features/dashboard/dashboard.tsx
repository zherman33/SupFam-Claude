import { useState } from 'react'
import { useAuth } from '@/features/auth/auth-context'
import { useFamilyMember } from '@/features/auth/use-family-member'
import { TodayPanel } from './today-panel'
import { TasksPanel } from '@/features/tasks/tasks-panel'
import { GroceryPanel } from '@/features/grocery/grocery-panel'
import { NotesPanel } from '@/features/notes/notes-panel'

type RightTab = 'grocery' | 'notes'

export function Dashboard() {
  const { signOut } = useAuth()
  const { data: member } = useFamilyMember()
  const [rightTab, setRightTab] = useState<RightTab>('grocery')
  const [showSettings, setShowSettings] = useState(false)

  const familyName = member?.families?.name ?? 'Your Family'
  const inviteCode = member?.families?.invite_code

  return (
    <div className="flex h-svh flex-col bg-cream-100 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 flex-shrink-0">
        <div>
          <h1 className="font-handwritten text-3xl leading-none text-terracotta-500">
            Sup Fam
          </h1>
          <p className="mt-0.5 font-display text-sm text-brown-700/60">{familyName}</p>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 rounded-xl border border-sand-200 bg-white px-4 py-2 shadow-sm transition-colors hover:bg-cream-100"
          >
            <div
              className="h-6 w-6 rounded-full"
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
                  <p className="mb-1 text-xs font-medium text-brown-700/60 uppercase tracking-wide">Invite your partner</p>
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
      </header>

      {/* Click outside to close settings */}
      {showSettings && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowSettings(false)}
        />
      )}

      {/* Three-panel layout */}
      <main className="flex flex-1 gap-4 overflow-hidden px-6 pb-6">
        {/* Left: Today */}
        <div className="w-72 flex-shrink-0 overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
          <TodayPanel />
        </div>

        {/* Center: Tasks */}
        <div className="flex-1 overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
          <TasksPanel />
        </div>

        {/* Right: Grocery + Notes tabs */}
        <div className="w-80 flex-shrink-0 overflow-hidden rounded-2xl bg-white p-6 shadow-sm flex flex-col">
          {/* Tab switcher */}
          <div className="mb-4 flex rounded-lg bg-cream-100 p-1 flex-shrink-0">
            <button
              onClick={() => setRightTab('grocery')}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                rightTab === 'grocery'
                  ? 'bg-white text-brown-800 shadow-sm'
                  : 'text-brown-700/60 hover:text-brown-800'
              }`}
            >
              Grocery
            </button>
            <button
              onClick={() => setRightTab('notes')}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                rightTab === 'notes'
                  ? 'bg-white text-brown-800 shadow-sm'
                  : 'text-brown-700/60 hover:text-brown-800'
              }`}
            >
              Notes
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            {rightTab === 'grocery' ? <GroceryPanel /> : <NotesPanel />}
          </div>
        </div>
      </main>
    </div>
  )
}

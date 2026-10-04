import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/query-client'
import { AuthProvider } from '@/features/auth/auth-context'
import { ThemeProvider } from '@/features/settings/theme-context'
import { initFontSize } from '@/features/settings/font-size-utils'
import { Dashboard } from '@/features/dashboard/dashboard'
import { DinnerBoard } from '@/features/meals/dinner-board'
import { DinnerAiTab } from '@/features/settings/dinner-ai-tab'
import '../index.css'

initFontSize()

// Allow ?view=week|3week|month to preset the calendar mode for screenshots,
// or ?view=dinner to open the dinner board directly.
const params = new URLSearchParams(window.location.search)
const previewView = params.get('view')
try {
  if (previewView === 'week' || previewView === '3week' || previewView === 'month') {
    localStorage.setItem('family-planner-calendar-mode', previewView)
  }
} catch { /* noop */ }

const Root =
  previewView === 'dinner'
    ? () => <DinnerBoard onClose={() => {}} />
    : previewView === 'dinner-ai'
      ? () => (
          <div className="min-h-screen bg-cream-50 p-6">
            <div className="mx-auto max-w-2xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-sand-200/60">
              <DinnerAiTab />
            </div>
          </div>
        )
      : Dashboard

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Root />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)

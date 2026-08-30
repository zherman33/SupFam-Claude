import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/query-client'
import { AuthProvider } from '@/features/auth/auth-context'
import { ThemeProvider } from '@/features/settings/theme-context'
import { initFontSize } from '@/features/settings/font-size-utils'
import App from './App'
import './index.css'

// Initialize font size scaling immediately before render to avoid flash of unscaled content
initFontSize()


// Register service worker with skipWaiting — reloads immediately when
// a new version is deployed so the PWA never serves stale code
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(reg => {
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing
      if (!newWorker) return
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'activated') {
          // New SW activated — reload to get fresh assets
          window.location.reload()
        }
      })
    })

    // Programmatically check for service worker updates every 15 minutes
    // (Crucial for 24/7 ambient displays that never refresh/navigate)
    setInterval(() => {
      if (navigator.onLine) {
        reg.update().catch(err => console.error('Failed to update Service Worker:', err))
      }
    }, 15 * 60 * 1000)

    // Check immediately when the iPad wakes up from screen sleep or tab becomes active
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        reg.update().catch(err => console.error('Failed to update Service Worker on wake:', err))
      }
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)

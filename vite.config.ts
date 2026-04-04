import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // "prompt" mode: service worker installs silently and auto-activates
      // on next navigation — no stale app shell ever shown
      registerType: 'autoUpdate',
      // Don't cache API calls or Supabase — only the app shell
      workbox: {
        // Only precache the built assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Never cache Supabase or Google API calls
        navigateFallbackDenylist: [/^\/rest/, /^\/auth/, /^\/functions/],
        runtimeCaching: [
          {
            // Google Fonts — cache for a year
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      manifest: {
        name: 'Sup Fam',
        short_name: 'Sup Fam',
        description: 'The family dashboard that runs the house.',
        theme_color: '#FAF7F2',
        background_color: '#FAF7F2',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})

// Dev-only config for marketing screenshots: renders the REAL app UI
// (src/preview/preview-entry.tsx) with a mocked Supabase client serving
// sample data. Never used for production builds.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      {
        find: '@/lib/supabase',
        replacement: path.resolve(__dirname, './src/preview/mock-supabase.ts'),
      },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
})

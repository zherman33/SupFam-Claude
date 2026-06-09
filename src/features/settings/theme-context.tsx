import React, { createContext, useContext, useEffect, useState } from 'react'

export type ThemeId =
  | 'warm-cream'
  | 'ocean-breeze'
  | 'forest-moss'
  | 'sunset-rose'
  | 'midnight-slate'
  | 'sunset-glow'
  | 'neon-synth'

export interface ThemeConfig {
  id: ThemeId
  name: string
  description: string
  metaThemeColor: string
  previewColors: {
    bg: string
    text: string
    accent: string
  }
}

export const THEMES: ThemeConfig[] = [
  {
    id: 'warm-cream',
    name: 'Warm Cream',
    description: 'Cozy and soft neutral aesthetic',
    metaThemeColor: '#FAF7F2',
    previewColors: {
      bg: '#FAF7F2',
      text: '#4A3728',
      accent: '#C4714F',
    },
  },
  {
    id: 'ocean-breeze',
    name: 'Ocean Breeze',
    description: 'Fresh and serene coastal vibes',
    metaThemeColor: '#ECF3F6',
    previewColors: {
      bg: '#ECF3F6',
      text: '#1D3640',
      accent: '#348AA7',
    },
  },
  {
    id: 'forest-moss',
    name: 'Forest Moss',
    description: 'Grounded, earthy woodland tones',
    metaThemeColor: '#EFF3E9',
    previewColors: {
      bg: '#EFF3E9',
      text: '#1E2E19',
      accent: '#557F49',
    },
  },
  {
    id: 'sunset-rose',
    name: 'Sunset Rose',
    description: 'Soft, romantic twilight palette',
    metaThemeColor: '#F6ECE8',
    previewColors: {
      bg: '#F6ECE8',
      text: '#3E2325',
      accent: '#B95B60',
    },
  },
  {
    id: 'midnight-slate',
    name: 'Midnight Slate',
    description: 'Sleek and immersive dark mode',
    metaThemeColor: '#12151C',
    previewColors: {
      bg: '#12151C',
      text: '#E5ECF6',
      accent: '#C86C41',
    },
  },
  {
    id: 'sunset-glow',
    name: 'Sunset Glow',
    description: 'Vibrant sunlit coral & gold hues',
    metaThemeColor: '#FFF8F0',
    previewColors: {
      bg: '#FFF8F0',
      text: '#2F1D13',
      accent: '#FF5A5F',
    },
  },
  {
    id: 'neon-synth',
    name: 'Neon Synth',
    description: 'Vibrant electric vaporwave dark mode',
    metaThemeColor: '#121620',
    previewColors: {
      bg: '#121620',
      text: '#E5F8FF',
      accent: '#FF007F',
    },
  },
]

interface ThemeContextType {
  theme: ThemeId
  setTheme: (theme: ThemeId) => void
  currentConfig: ThemeConfig
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const STORAGE_KEY = 'family-planner-theme'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeId
    if (saved && THEMES.some(t => t.id === saved)) {
      return saved
    }
    return 'warm-cream'
  })

  const currentConfig = THEMES.find(t => t.id === theme) || THEMES[0]

  const setTheme = (newTheme: ThemeId) => {
    setThemeState(newTheme)
    localStorage.setItem(STORAGE_KEY, newTheme)
  }

  // Apply theme to document element and update status bar color dynamically
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)

    const metaThemeColor = document.querySelector('meta[name="theme-color"]')
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', currentConfig.metaThemeColor)
    }
  }, [theme, currentConfig.metaThemeColor])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, currentConfig }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

// ─── Theme-Coordinated Color Helpers ─────────────────────────────────────

export function getCalendarColor(storedColor: string | null | undefined): string {
  if (!storedColor) return 'var(--color-cal-1)'
  switch (storedColor.toUpperCase()) {
    case '#C4714F':
      return 'var(--color-cal-1)'
    case '#5E7C67':
      return 'var(--color-cal-2)'
    case '#4F7396':
      return 'var(--color-cal-3)'
    case '#7B6F9A':
      return 'var(--color-cal-4)'
    case '#BC5D76':
      return 'var(--color-cal-5)'
    case '#C68A2C':
      return 'var(--color-cal-6)'
    case '#6E7A8A':
      return 'var(--color-cal-7)'
    default:
      return storedColor
  }
}

export function getFamilyMemberColor(storedColor: string | null | undefined): string {
  if (!storedColor) return 'var(--color-family-shared)'
  switch (storedColor.toUpperCase()) {
    case '#5B8C5A':
      return 'var(--color-family-zac)'
    case '#5B7FB5':
      return 'var(--color-family-partner)'
    case '#C4714F':
      return 'var(--color-family-shared)'
    case '#8B6BAE':
      return 'var(--color-family-child)'
    default:
      return storedColor
  }
}

function darkenForReadability(hex: string): string {
  if (!hex || hex.length < 7) return hex
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  if (luminance <= 0.45) return hex
  const dr = Math.round(r * 0.5)
  const dg = Math.round(g * 0.5)
  const db = Math.round(b * 0.5)
  return `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`
}

export interface EventStyles {
  backgroundColor: string
  borderColor: string
  textColor: string
  backgroundGradient?: string
}

export function getEventThemeStyles(colorHexOrVar: string): EventStyles {
  const color = getCalendarColor(colorHexOrVar)

  if (color.startsWith('var(')) {
    const textVar = color.replace(')', '-text)')
    return {
      backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`,
      borderColor: color,
      textColor: textVar,
      backgroundGradient: `linear-gradient(to right, color-mix(in srgb, ${color} 9%, transparent), color-mix(in srgb, ${color} 9%, transparent)), var(--color-white)`,
    }
  } else {
    const textColor = darkenForReadability(color)
    return {
      backgroundColor: `${color}18`,
      borderColor: color,
      textColor,
      backgroundGradient: `linear-gradient(to right, ${color}16, ${color}16), white`,
    }
  }
}

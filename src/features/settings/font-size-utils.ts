export type FontSizeScale = 'sm' | 'base' | 'lg' | 'xl' | '2xl'

export interface FontSizeStep {
  value: FontSizeScale
  label: string
  scale: string
}

export const FONT_SIZE_STEPS: FontSizeStep[] = [
  { value: 'sm', label: 'Small', scale: '90%' },
  { value: 'base', label: 'Medium', scale: '100%' },
  { value: 'lg', label: 'Large', scale: '110%' },
  { value: 'xl', label: 'Extra Large', scale: '120%' },
  { value: '2xl', label: 'Huge', scale: '130%' },
]

export const LOCAL_STORAGE_KEY = 'supfam_font_size'

export function getSavedFontSize(): FontSizeScale {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (saved && FONT_SIZE_STEPS.some(s => s.value === saved)) {
      return saved as FontSizeScale
    }
  } catch {
    // Ignore localStorage errors
  }
  return 'base'
}

export function applyFontSize(size: FontSizeScale) {
  const step = FONT_SIZE_STEPS.find(s => s.value === size)
  const scale = step ? step.scale : '100%'
  if (typeof document !== 'undefined') {
    document.documentElement.style.fontSize = scale
  }
}

export function initFontSize() {
  const saved = getSavedFontSize()
  applyFontSize(saved)
}

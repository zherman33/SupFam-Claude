export interface MealPlan {
  id: string
  family_id: string
  week_start: string // yyyy-MM-dd, Monday
  created_by: string | null
  created_at: string
}

export interface Meal {
  id: string
  meal_plan_id: string
  day_index: number // 0 = Monday … 6 = Sunday
  slot: string // 'dinner' today; breakfast/lunch later
  title: string
  notes: string | null
  recipe_url: string | null
  servings: number
  created_at: string
}

export interface MealIngredient {
  id: string
  meal_id: string
  name: string
  quantity: number | null
  unit: string | null
  category: string | null
  position: number
}

export interface MealWithIngredients extends Meal {
  ingredients: MealIngredient[]
}

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
export const DAY_NAMES_FULL = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const

/** yyyy-MM-dd for a Date (local time, no UTC shift) */
export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Monday of the week containing `d` */
export function mondayOfWeek(d: Date): Date {
  const copy = new Date(d)
  const dow = (copy.getDay() + 6) % 7 // 0 = Monday
  copy.setDate(copy.getDate() - dow)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function weekStartISO(d: Date = new Date()): string {
  return toISODate(mondayOfWeek(d))
}

/** Date of a day_index (0=Mon) within the week starting weekStartISO */
export function dateForDay(weekStart: string, dayIndex: number): Date {
  const [y, m, dd] = weekStart.split('-').map(Number)
  const d = new Date(y, m - 1, dd)
  d.setDate(d.getDate() + dayIndex)
  return d
}

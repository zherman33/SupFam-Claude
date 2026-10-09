// Dev-only marketing preview harness. NOT shipped — aliased in via
// vite.preview.config.ts so the real Dashboard renders with sample data.
// No real family data, no network calls.
import type { Session, User } from '@supabase/supabase-js'

const now = new Date()
const at = (h: number, m = 0, dayOffset = 0) => {
  const d = new Date(now)
  d.setDate(d.getDate() + dayOffset)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}
const dstr = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
const iso = (dayOffset = 0) => {
  const d = new Date(now)
  d.setDate(d.getDate() + dayOffset)
  return dstr(d)
}
const todayStr = () => {
  return dstr(new Date(now))
}
const mondayStr = (offsetDays = 0) => {
  const d = new Date(now)
  const dow = (d.getDay() + 6) % 7 // 0 = Monday
  d.setDate(d.getDate() - dow + offsetDays)
  return dstr(d)
}

const fakeUser = {
  id: 'preview-user-1',
  email: 'preview@supfam.app',
  user_metadata: { full_name: 'Alex Rivera' },
} as unknown as User

const fakeSession = {
  user: fakeUser,
  access_token: 'preview',
  refresh_token: 'preview',
  expires_in: 3600,
} as unknown as Session

// Busy family calendar: 5 weeks of realistic events spread across the whole
// month so no week looks empty. Colors come from the source calendar.
interface SeedEvent {
  day: number; sh: number; sm?: number; eh: number; em?: number
  title: string; location?: string; cal?: string; by?: string; allDay?: boolean
}
const E: SeedEvent[] = []
const ev = (e: SeedEvent) => E.push(e)
const FAM = 'cal-family', WORK = 'cal-work', KIDS = 'cal-kids'

// weekday school runs (Mon-Fri) for 5 weeks back + 5 weeks forward,
// so the calendar looks populated no matter which range is visible
for (let d = -14; d < 35; d++) {
  const wd = (new Date(now).getDay() + d) % 7
  if (wd >= 1 && wd <= 5) {
    ev({ day: d, sh: 8, eh: 8, em: 30, title: 'School drop-off', location: 'Maple Elementary', cal: KIDS, by: 'member-alex' })
    ev({ day: d, sh: 15, eh: 15, em: 30, title: 'School pickup', location: 'Maple Elementary', cal: KIDS, by: 'member-sam' })
  }
}
// rotating after-school activities
const weekly: [number, string, string, number, number, string][] = [
  // weekday(1=Mon), title, location, startH, endH, cal
  [1, 'Soccer practice', 'Community Field 3', 16, 17, KIDS],
  [2, 'Piano lessons', 'Ms. Alvarez', 17, 18, KIDS],
  [3, 'Swim team', 'YMCA pool', 16.5, 17.5, KIDS],
  [4, 'Soccer practice', 'Community Field 3', 16, 17, KIDS],
]
for (let d = -14; d < 35; d++) {
  const wd = (new Date(now).getDay() + d) % 7
  for (const [wday, title, loc, sh, ehh, cal] of weekly) {
    if (wd === wday && d % 7 !== 6) {
      const e = Math.floor(ehh), em = Math.round((ehh - e) * 60)
      const s = Math.floor(sh), sm = Math.round((sh - s) * 60)
      ev({ day: d, sh: s, sm, eh: e, em, title, location: loc, cal, by: 'member-sam' })
    }
  }
}
// one-off life, spread across all 5 weeks
const oneOffs: [number, number, number, string, string?, string?][] = [
  // past two weeks — keeps the visible past populated too
  [-1, 19, 21, 'Movie night', 'Home', FAM],
  [-2, 11, 12, 'Grocery run', 'Whole Foods', FAM],
  [-2, 18, 19.5, 'Back-to-school night', 'Maple Elementary', KIDS],
  [-3, 9, 11, 'Farmers market', 'Downtown', FAM],
  [-4, 12, 14, 'Sunday cookout', 'Home', FAM],
  [-5, 19, 21, 'Date night', "Cafe D'Avignon", FAM],
  [-6, 10, 11, 'Dentist appointment', 'Bright Smiles Dental', FAM],
  [-7, 9, 9.5, 'Team standup', undefined, WORK],
  [-7, 12, 13, 'Lunch with Priya', 'Copper Kitchen', FAM],
  [-8, 14, 16, 'Science fair', 'Maple Elementary', KIDS],
  [-9, 9, 11, 'Farmers market', 'Downtown', FAM],
  [-9, 16, 18, 'Pool party', "The Hendersons'", KIDS],
  [-10, 11, 13, 'Brunch with grandparents', "Nonna's", FAM],
  [-11, 19, 20.5, 'Trivia night', "O'Brien's", FAM],
  [-12, 10, 12, 'Zoo trip', 'Zoo Tampa', FAM],
  [-13, 9, 11, 'Yard work', 'Home', FAM],
  [-14, 9, 9.5, 'Team standup', undefined, WORK],
  [-14, 18, 20, 'Dinner with grandparents', undefined, FAM],
  [0, 9, 9.5, 'Team standup', undefined, WORK],
  [0, 10.5, 11.5, 'Dentist appointment', 'Bright Smiles Dental', FAM],
  [0, 12, 13, 'Lunch with Priya', 'Copper Kitchen', FAM],
  [0, 18.5, 20, 'Dinner with grandparents', undefined, FAM],
  [1, 11, 12, 'Grocery run', 'Whole Foods', FAM],
  [1, 19, 20.5, 'Date night', 'Osteria Francescana', FAM],
  [2, 9, 10, 'HVAC maintenance', 'Home', FAM],
  [3, 10, 11, 'Vet appointment', 'Paws & Claws', FAM],
  [3, 19, 21, 'Book club', "Jen's place", FAM],
  [4, 13, 14, 'Parent-teacher conference', 'Maple Elementary', KIDS],
  [4, 19, 21, 'Movie night', 'Home', FAM],
  [5, 9, 11, 'Farmers market', 'Downtown', FAM],
  [5, 14, 16, "Emma's birthday party", 'Sky Zone', KIDS],
  [6, 11, 13, 'Brunch with grandparents', "Nonna's", FAM],
  [6, 16, 17.5, 'Meal prep for the week', 'Home', FAM],
  [8, 12, 13, 'Lunch with Marcus', 'Taco Libre', WORK],
  [9, 19, 20, 'HOA meeting', 'Clubhouse', FAM],
  [11, 11, 12, 'Grocery run', 'Whole Foods', FAM],
  [11, 19, 21, 'Date night', 'Cinebistro', FAM],
  [12, 9, 10, 'Library story time', 'Main Library', KIDS],
  [12, 13, 15, 'Playdate at the park', 'Hyde Park', KIDS],
  [13, 10, 12, 'Hiking', 'Hillsborough River', FAM],
  [13, 17, 19, 'Family BBQ', "Uncle Rob's", FAM],
  [14, 9, 9.5, 'Team standup', undefined, WORK],
  [15, 10, 11, 'Oil change', 'Tires Plus', FAM],
  [17, 14, 15, 'Dental cleaning', 'Bright Smiles Dental', FAM],
  [18, 19, 21, 'Movie night', 'Home', FAM],
  [19, 9, 11, 'Farmers market', 'Downtown', FAM],
  [19, 12, 14, "Leo's soccer game", 'Community Field 1', KIDS],
  [20, 11, 13, 'Brunch with grandparents', "Nonna's", FAM],
  [21, 9, 9.5, 'Team standup', undefined, WORK],
  [21, 18, 19.5, 'School fundraiser', 'Maple Elementary', KIDS],
  [22, 10, 11.5, 'Haircuts', 'Snip & Co', FAM],
  [23, 12, 13.5, 'Lunch with the neighbors', 'Daily Eats', FAM],
  [24, 9, 10, 'Car inspection', 'Tires Plus', FAM],
  [25, 18, 20, 'Trivia night', "O'Brien's", FAM],
  [26, 8.5, 10, 'Park run', 'Bayshore', FAM],
  [26, 15, 17, 'Birthday party', 'Jump House', KIDS],
  [27, 10, 12, 'Zoo trip', 'Zoo Tampa', FAM],
  [28, 9, 9.5, 'Team standup', undefined, WORK],
  [28, 17.5, 19, 'Back-to-school night', 'Maple Elementary', KIDS],
  [29, 11, 12, 'Grocery run', 'Whole Foods', FAM],
  [30, 19, 20.5, 'Date night', 'Eddie V’s', FAM],
  [31, 10, 11, 'Eye exam', 'LensCrafters', FAM],
  [32, 14, 16, 'Science fair', 'Maple Elementary', KIDS],
  [33, 9, 11, 'Farmers market', 'Downtown', FAM],
  [33, 16, 18, 'Pool party', "The Hendersons'", KIDS],
  [34, 12, 14, 'Sunday cookout', 'Home', FAM],
]
for (const [d, sh, ehh, title, loc, cal] of oneOffs) {
  const e = Math.floor(ehh), em = Math.round((ehh - e) * 60)
  const s = Math.floor(sh), sm = Math.round((sh - s) * 60)
  ev({ day: d, sh: s, sm, eh: e, em, title, location: loc, cal: cal ?? FAM, by: 'member-alex' })
}
// all-day events
ev({ day: -12, sh: 0, eh: 0, title: 'First day of school', allDay: true, cal: KIDS, by: 'member-alex' })
ev({ day: -5, sh: 0, eh: 0, title: "Grandma's birthday", allDay: true, by: 'member-alex' })
ev({ day: 5, sh: 0, eh: 0, title: "Emma's birthday", allDay: true, cal: KIDS, by: 'member-alex' })
ev({ day: 9, sh: 0, eh: 0, title: 'No school \u2014 teacher workday', allDay: true, cal: KIDS, by: 'member-alex' })
ev({ day: 16, sh: 0, eh: 0, title: 'Anniversary', allDay: true, by: 'member-alex' })
ev({ day: 23, sh: 0, eh: 0, title: 'First day of fall break', allDay: true, cal: KIDS, by: 'member-alex' })
ev({ day: 30, sh: 0, eh: 0, title: "Grandma's visit", allDay: true, by: 'member-alex' })

const CAL_EVENTS = E.map((e, i) => ({
  id: `ev-${i + 1}`,
  family_id: 'family-1',
  source_calendar_id: e.cal ?? 'cal-family',
  external_event_id: null,
  title: e.title,
  description: null,
  location: e.location ?? null,
  start_at: at(e.sh, e.sm ?? 0, e.day),
  end_at: at(e.eh, e.em ?? 0, e.day),
  all_day: e.allDay ?? false,
  color: null,
  created_by: e.by ?? 'member-alex',
}))

const SEED: Record<string, any[]> = {
  family_members: [
    {
      id: 'member-alex',
      family_id: 'family-1',
      user_id: 'preview-user-1',
      display_name: 'Alex',
      role: 'admin',
      avatar_color: '#C4704F',
      joined_at: iso(-90),
      onboarding_completed: true,
      families: {
        id: 'family-1',
        name: 'The Rivera Family',
        invite_code: 'MAPLE-42',
        plan_tier: 'founding',
        stripe_customer_id: null,
        stripe_subscription_id: null,
        subscription_status: 'active',
        plan_id: 'founding-yearly',
        is_founding: true,
        trial_ends_at: null,
        current_period_end: null,
        cancel_at_period_end: false,
        created_at: iso(-90),
      },
    },
    {
      id: 'member-sam',
      family_id: 'family-1',
      user_id: 'preview-user-2',
      display_name: 'Sam',
      role: 'member',
      avatar_color: '#7D8C6F',
      joined_at: iso(-90),
      onboarding_completed: true,
    },
  ],
  connected_calendars: [
    {
      id: 'cc-1',
      family_member_id: 'member-alex',
      provider: 'google',
      calendar_id: 'cal-family',
      calendar_name: 'Family',
      color: '#C4704F',
      is_visible: true,
      is_default: true,
      last_synced_at: iso(),
      account_email: 'preview@supfam.app',
    },
    {
      id: 'cc-2',
      family_member_id: 'member-sam',
      provider: 'google',
      calendar_id: 'cal-work',
      calendar_name: 'Work',
      color: '#5B7B8C',
      is_visible: true,
      is_default: false,
      last_synced_at: iso(),
      account_email: 'preview@supfam.app',
    },
    {
      id: 'cc-3',
      family_member_id: 'member-sam',
      provider: 'google',
      calendar_id: 'cal-kids',
      calendar_name: 'Kids',
      color: '#7D8C6F',
      is_visible: true,
      is_default: false,
      last_synced_at: iso(),
      account_email: 'preview@supfam.app',
    },
  ],
  calendar_events: CAL_EVENTS,
  event_color_rules: [],
  tasks: [
    { id: 't-1', family_id: 'family-1', assigned_to: 'member-sam', title: 'Buy birthday gift for Emma', notes: null, due_date: todayStr(), is_complete: false, is_recurring: false, recurrence_rule: null, created_by: 'member-alex', created_at: iso(-1), google_task_id: null, google_tasklist_id: null, position: 1, assigned_member: { display_name: 'Sam', avatar_color: '#7D8C6F' } },
    { id: 't-2', family_id: 'family-1', assigned_to: null, title: 'Schedule HVAC maintenance', notes: 'Before the heat kicks in', due_date: todayStr(), is_complete: false, is_recurring: false, recurrence_rule: null, created_by: 'member-alex', created_at: iso(-1), google_task_id: null, google_tasklist_id: null, position: 2 },
    { id: 't-3', family_id: 'family-1', assigned_to: 'member-alex', title: 'Return library books', notes: null, due_date: todayStr(), is_complete: false, is_recurring: false, recurrence_rule: null, created_by: 'member-sam', created_at: iso(-2), google_task_id: null, google_tasklist_id: null, position: 3, assigned_member: { display_name: 'Alex', avatar_color: '#C4704F' } },
    { id: 't-4', family_id: 'family-1', assigned_to: null, title: 'Plan next week\u2019s meals', notes: null, due_date: null, is_complete: false, is_recurring: true, recurrence_rule: 'weekly', created_by: 'member-alex', created_at: iso(-3), google_task_id: null, google_tasklist_id: null, position: 4 },
    { id: 't-5', family_id: 'family-1', assigned_to: null, title: 'Water the plants', notes: null, due_date: todayStr(), is_complete: true, is_recurring: false, recurrence_rule: null, created_by: 'member-sam', created_at: iso(-1), google_task_id: null, google_tasklist_id: null, position: 5 },
  ],
  grocery_items: [
    { id: 'g-1', family_id: 'family-1', title: 'Milk', category: 'Dairy', is_checked: true, added_by: 'member-alex', source: 'manual', meal_plan_id: null, created_at: iso(-1) },
    { id: 'g-2', family_id: 'family-1', title: 'Eggs', category: 'Dairy', is_checked: true, added_by: 'member-alex', source: 'manual', meal_plan_id: null, created_at: iso(-1) },
    { id: 'g-3', family_id: 'family-1', title: 'Sourdough bread', category: 'Bakery', is_checked: false, added_by: 'member-sam', source: 'manual', meal_plan_id: null, created_at: iso(-1) },
    { id: 'g-4', family_id: 'family-1', title: 'Avocados', category: 'Produce', is_checked: false, added_by: 'member-sam', source: 'manual', meal_plan_id: null, created_at: iso() },
    { id: 'g-5', family_id: 'family-1', title: 'Chicken breast', category: 'Meat', is_checked: false, added_by: 'member-alex', source: 'meal_plan', meal_plan_id: 'mp-1', created_at: iso() },
    { id: 'g-6', family_id: 'family-1', title: 'Baby spinach', category: 'Produce', is_checked: false, added_by: 'member-alex', source: 'meal_plan', meal_plan_id: 'mp-1', created_at: iso() },
    { id: 'g-7', family_id: 'family-1', title: 'Coffee beans', category: 'Pantry', is_checked: false, added_by: 'member-sam', source: 'manual', meal_plan_id: null, created_at: iso() },
  ],
  notes: [
    { id: 'n-1', family_id: 'family-1', title: 'Weekend trip ideas', content: 'Beach house in October?\nCheck flights before Friday.', updated_at: iso(-1), created_at: iso(-2) },
    { id: 'n-2', family_id: 'family-1', title: 'Babysitter numbers', content: 'Maya: available weekends\nLuis: weekday evenings', updated_at: iso(-3), created_at: iso(-3) },
  ],
  meal_plans: [
    { id: 'mp-1', family_id: 'family-1', week_start: mondayStr(), created_by: 'member-alex', created_at: iso(-1) },
    // Four weeks of dinner history so recommendations/recency have something to chew on
    { id: 'mp-2', family_id: 'family-1', week_start: mondayStr(-7), created_by: 'member-alex', created_at: iso(-8) },
    { id: 'mp-3', family_id: 'family-1', week_start: mondayStr(-14), created_by: 'member-sam', created_at: iso(-15) },
    { id: 'mp-4', family_id: 'family-1', week_start: mondayStr(-21), created_by: 'member-alex', created_at: iso(-22) },
    { id: 'mp-5', family_id: 'family-1', week_start: mondayStr(-28), created_by: 'member-sam', created_at: iso(-29) },
  ],
  meals: [
    { id: 'meal-1', meal_plan_id: 'mp-1', day_index: 0, slot: 'dinner', title: 'Taco night', notes: null, recipe_url: null, servings: 4, ingredients: [] },
    { id: 'meal-2', meal_plan_id: 'mp-1', day_index: 1, slot: 'dinner', title: 'Lemon herb chicken', notes: null, recipe_url: null, servings: 4, ingredients: [] },
    { id: 'meal-3', meal_plan_id: 'mp-1', day_index: 2, slot: 'dinner', title: 'Pasta primavera', notes: null, recipe_url: null, servings: 4, ingredients: [] },
    // last week
    { id: 'meal-10', meal_plan_id: 'mp-2', day_index: 0, slot: 'dinner', title: 'Sheet-pan salmon', notes: null, recipe_url: null, servings: 4, ingredients: [] },
    { id: 'meal-11', meal_plan_id: 'mp-2', day_index: 1, slot: 'dinner', title: 'Taco night', notes: null, recipe_url: null, servings: 4, ingredients: [] },
    { id: 'meal-12', meal_plan_id: 'mp-2', day_index: 2, slot: 'dinner', title: 'Chicken stir-fry', notes: null, recipe_url: null, servings: 4, ingredients: [] },
    { id: 'meal-13', meal_plan_id: 'mp-2', day_index: 3, slot: 'dinner', title: 'Homemade pizza', notes: null, recipe_url: null, servings: 4, ingredients: [] },
    { id: 'meal-14', meal_plan_id: 'mp-2', day_index: 4, slot: 'dinner', title: 'Spaghetti bolognese', notes: null, recipe_url: null, servings: 4, ingredients: [] },
    // two weeks ago
    { id: 'meal-20', meal_plan_id: 'mp-3', day_index: 0, slot: 'dinner', title: 'Butter chicken', notes: null, recipe_url: null, servings: 4, ingredients: [] },
    { id: 'meal-21', meal_plan_id: 'mp-3', day_index: 1, slot: 'dinner', title: 'Sheet-pan salmon', notes: null, recipe_url: null, servings: 4, ingredients: [] },
    { id: 'meal-22', meal_plan_id: 'mp-3', day_index: 2, slot: 'dinner', title: 'Burgers', notes: null, recipe_url: null, servings: 4, ingredients: [] },
    { id: 'meal-23', meal_plan_id: 'mp-3', day_index: 4, slot: 'dinner', title: 'Chicken fajitas', notes: null, recipe_url: null, servings: 4, ingredients: [] },
    { id: 'meal-24', meal_plan_id: 'mp-3', day_index: 5, slot: 'dinner', title: 'Breakfast for dinner', notes: null, recipe_url: null, servings: 4, ingredients: [] },
    // three weeks ago
    { id: 'meal-30', meal_plan_id: 'mp-4', day_index: 0, slot: 'dinner', title: 'Taco night', notes: null, recipe_url: null, servings: 4, ingredients: [] },
    { id: 'meal-31', meal_plan_id: 'mp-4', day_index: 2, slot: 'dinner', title: 'Lemon herb chicken', notes: null, recipe_url: null, servings: 4, ingredients: [] },
    { id: 'meal-32', meal_plan_id: 'mp-4', day_index: 3, slot: 'dinner', title: 'Mushroom risotto', notes: null, recipe_url: null, servings: 4, ingredients: [] },
    { id: 'meal-33', meal_plan_id: 'mp-4', day_index: 4, slot: 'dinner', title: 'Sheet-pan salmon', notes: null, recipe_url: null, servings: 4, ingredients: [] },
    // four weeks ago
    { id: 'meal-40', meal_plan_id: 'mp-5', day_index: 1, slot: 'dinner', title: 'Chicken stir-fry', notes: null, recipe_url: null, servings: 4, ingredients: [] },
    { id: 'meal-41', meal_plan_id: 'mp-5', day_index: 2, slot: 'dinner', title: 'Homemade pizza', notes: null, recipe_url: null, servings: 4, ingredients: [] },
    { id: 'meal-42', meal_plan_id: 'mp-5', day_index: 3, slot: 'dinner', title: 'Taco night', notes: null, recipe_url: null, servings: 4, ingredients: [] },
  ],
  meal_ingredients: [],
  meal_ratings: [
    { id: 'r-1', family_id: 'family-1', family_member_id: 'member-alex', meal_title: 'Taco night', rating: 5, created_at: iso(-8), updated_at: iso(-8) },
    { id: 'r-2', family_id: 'family-1', family_member_id: 'member-sam', meal_title: 'Taco night', rating: 5, created_at: iso(-8), updated_at: iso(-8) },
    { id: 'r-3', family_id: 'family-1', family_member_id: 'member-alex', meal_title: 'Sheet-pan salmon', rating: 5, created_at: iso(-9), updated_at: iso(-9) },
    { id: 'r-4', family_id: 'family-1', family_member_id: 'member-sam', meal_title: 'Butter chicken', rating: 4, created_at: iso(-15), updated_at: iso(-15) },
    { id: 'r-5', family_id: 'family-1', family_member_id: 'member-alex', meal_title: 'Mushroom risotto', rating: 2, created_at: iso(-22), updated_at: iso(-22) },
  ],
  family_food_prefs: [
    { family_id: 'family-1', dietary_restrictions: [], dislikes: ['mushrooms'], favorites: ['Taco night', 'Sheet-pan salmon'], default_servings: 4, updated_at: iso(-3) },
  ],
  dinner_conversations: [],
  google_tokens: [],
}

// Chainable query builder: honors basic filters (eq/neq/in/gte/lte/order/limit)
// so multi-week seeds render correctly. Mutations resolve without persisting.
function chainable(rows: any[]): any {
  const filters: Array<(r: any) => boolean> = []
  let order: { col: string; asc: boolean } | null = null
  let limitN: number | null = null
  const apply = () => {
    let out = rows.filter((r) => filters.every((f) => f(r)))
    if (order) {
      out = [...out].sort((a, b) => {
        const av = a?.[order!.col]
        const bv = b?.[order!.col]
        if (av === bv) return 0
        return (av < bv ? -1 : 1) * (order!.asc ? 1 : -1)
      })
    }
    if (limitN != null) out = out.slice(0, limitN)
    return out
  }
  const asInserted = (row: any) => ({
    ...row,
    id: row.id ?? `mock-${Math.random().toString(36).slice(2, 9)}`,
  })
  // Thenable for insert/upsert: resolves the inserted row(s).
  const insertChain = (payload: any) => {
    const list = (Array.isArray(payload) ? payload : [payload]).map(asInserted)
    const ch: any = new Proxy(function () {}, {
      get(_t, prop: string | symbol) {
        if (prop === 'then') {
          return (resolve: (v: any) => void) =>
            resolve({ data: Array.isArray(payload) ? list : list[0], error: null })
        }
        if (prop === 'single' || prop === 'maybeSingle') {
          return async () => ({ data: list[0] ?? null, error: null })
        }
        if (typeof prop === 'symbol') return undefined
        return (..._a: any[]) => ch
      },
      apply() {
        return ch
      },
    })
    return ch
  }
  // Thenable for update/delete: resolves success.
  const writeChain = () => {
    const ch: any = new Proxy(function () {}, {
      get(_t, prop: string | symbol) {
        if (prop === 'then') {
          return (resolve: (v: any) => void) => resolve({ data: null, error: null })
        }
        if (prop === 'single' || prop === 'maybeSingle') {
          return async () => ({ data: null, error: null })
        }
        if (typeof prop === 'symbol') return undefined
        return (..._a: any[]) => ch
      },
      apply() {
        return ch
      },
    })
    return ch
  }
  const proxy: any = new Proxy(function () {}, {
    get(_t, prop: string | symbol) {
      if (prop === 'then') {
        // Match real Supabase/promise semantics: .then(cb) resolves to cb's
        // return value, so `await chain.then(cb)` yields the mapped result.
        return (resolve: (v: any) => void) => {
          const data = apply()
          return resolve({ data, error: null, count: data.length })
        }
      }
      if (prop === 'single' || prop === 'maybeSingle') {
        return async () => ({ data: apply()[0] ?? null, error: null })
      }
      if (prop === 'eq') {
        return (col: string, val: unknown) => {
          filters.push((r) => r?.[col] === val)
          return proxy
        }
      }
      if (prop === 'neq') {
        return (col: string, val: unknown) => {
          filters.push((r) => r?.[col] !== val)
          return proxy
        }
      }
      if (prop === 'in') {
        return (col: string, vals: unknown[]) => {
          filters.push((r) => vals.includes(r?.[col]))
          return proxy
        }
      }
      if (prop === 'gte') {
        return (col: string, val: string | number) => {
          filters.push((r) => (r?.[col] as string | number) >= val)
          return proxy
        }
      }
      if (prop === 'lte') {
        return (col: string, val: string | number) => {
          filters.push((r) => (r?.[col] as string | number) <= val)
          return proxy
        }
      }
      if (prop === 'order') {
        return (col: string, opts?: { ascending?: boolean }) => {
          order = { col, asc: opts?.ascending !== false }
          return proxy
        }
      }
      if (prop === 'limit') {
        return (n: number) => {
          limitN = n
          return proxy
        }
      }
      if (prop === 'insert' || prop === 'upsert') {
        return (payload: any) => insertChain(payload)
      }
      if (prop === 'update' || prop === 'delete') {
        return (..._a: any[]) => writeChain()
      }
      // symbols / inspection guards
      if (typeof prop === 'symbol') return undefined
      // select() and everything else: absorb, keep chaining
      return (..._a: any[]) => proxy
    },
    apply() {
      return proxy
    },
  })
  return proxy
}

const channelStub = {
  on: (..._args: any[]) => channelStub,
  subscribe: (..._args: any[]) => ({}),
  unsubscribe: () => {},
}

const storageStub = {
  from: (_bucket: string) => ({
    upload: async () => ({ data: null, error: null }),
    download: async () => ({ data: null, error: null }),
    list: async () => ({ data: [], error: null }),
    getPublicUrl: () => ({ data: { publicUrl: '' } }),
    remove: async () => ({ data: null, error: null }),
  }),
}

export const supabase: any = {
  from: (table: string) => chainable(SEED[table] ?? []),
  rpc: async () => ({ data: null, error: null }),
  channel: (_name: string) => channelStub,
  removeChannel: () => {},
  functions: {
    invoke: async () => ({ data: null, error: null }),
  },
  storage: storageStub,
  auth: {
    getSession: async () => ({ data: { session: fakeSession }, error: null }),
    getUser: async () => ({ data: { user: fakeUser }, error: null }),
    onAuthStateChange: (_cb: any) => ({
      data: { subscription: { unsubscribe: () => {} } },
    }),
    setSession: async () => ({ data: { session: fakeSession }, error: null }),
    signInWithOAuth: async () => ({ data: { url: null }, error: null }),
    signInWithOtp: async () => ({ data: {}, error: null }),
    verifyOtp: async () => ({ data: { session: fakeSession }, error: null }),
    signOut: async () => ({ error: null }),
    exchangeCodeForSession: async () => ({ data: { session: fakeSession }, error: null }),
  },
}

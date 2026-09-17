import { useState } from 'react'
import { format } from 'date-fns'
import { useProAccess } from './use-pro'
import {
  useMealPlan,
  useEnsureMealPlan,
  useSaveMeal,
  useDeleteMeal,
  useBuildGroceryList,
  type IngredientInput,
} from './use-meals'
import {
  DAY_NAMES,
  DAY_NAMES_FULL,
  weekStartISO,
  dateForDay,
  toISODate,
  type MealWithIngredients,
} from './types'

export function DinnerBoard({ onClose }: { onClose: () => void }) {
  const hasPro = useProAccess()
  const [weekStart, setWeekStart] = useState(() => weekStartISO())
  const [editingDay, setEditingDay] = useState<number | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const { data, isLoading } = useMealPlan(weekStart)
  const ensurePlan = useEnsureMealPlan()
  const buildList = useBuildGroceryList()

  const mealsByDay = new Map((data?.meals ?? []).map((m) => [m.day_index, m]))
  const plannedCount = data?.meals.length ?? 0

  const shiftWeek = (delta: number) => {
    const [y, m, d] = weekStart.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    dt.setDate(dt.getDate() + delta * 7)
    setWeekStart(toISODate(dt))
    setNotice(null)
  }

  const handleBuildList = async () => {
    setNotice(null)
    try {
      const plan = await ensurePlan.mutateAsync(weekStart)
      const result = await buildList.mutateAsync({ planId: plan.id, meals: data?.meals ?? [] })
      if (result.added === 0 && result.skipped === 0) {
        setNotice('Plan a few dinners first — then I’ll turn them into a grocery list.')
      } else {
        setNotice(
          `Added ${result.added} item${result.added === 1 ? '' : 's'} to your grocery list` +
            (result.skipped > 0 ? ` (${result.skipped} already there)` : '') +
            '. Ready to order below.'
        )
      }
    } catch {
      setNotice('Hmm, that didn’t work — try again?')
    }
  }

  // Re-read the current query data for the plan we just ensured
  const weekLabel = (() => {
    const start = dateForDay(weekStart, 0)
    const end = dateForDay(weekStart, 6)
    return `${format(start, 'MMM d')} – ${format(end, 'MMM d')}`
  })()

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-cream-100">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-sand-200 bg-cream-100 px-4 py-3 sm:px-6">
        <button
          onClick={onClose}
          aria-label="Close dinner board"
          className="flex h-11 w-11 items-center justify-center rounded-xl text-brown-700/60 hover:bg-sand-100 hover:text-brown-800"
        >
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none">
            <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl text-brown-800">Dinner board</h1>
          <p className="font-handwritten text-lg leading-tight text-terracotta-500">
            what’s for dinner? it’s on the board.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => shiftWeek(-1)}
            aria-label="Previous week"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-brown-700/60 hover:bg-sand-100"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none">
              <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            onClick={() => setWeekStart(weekStartISO())}
            className="rounded-xl px-3 py-2 text-sm font-semibold text-brown-700 hover:bg-sand-100"
          >
            {weekLabel}
          </button>
          <button
            onClick={() => shiftWeek(1)}
            aria-label="Next week"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-brown-700/60 hover:bg-sand-100"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none">
              <path d="M8 4l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {!hasPro ? (
        <ProUpsell />
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Build list bar */}
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <p className="flex-1 text-sm text-brown-700/60">
              {plannedCount === 0
                ? 'Tap a day to plan dinner.'
                : `${plannedCount} dinner${plannedCount === 1 ? '' : 's'} planned — turn them into groceries in one tap.`}
            </p>
            <button
              onClick={handleBuildList}
              disabled={buildList.isPending || ensurePlan.isPending || plannedCount === 0}
              className="rounded-xl bg-terracotta-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-terracotta-600 disabled:opacity-40"
            >
              {buildList.isPending || ensurePlan.isPending ? 'Building…' : 'Build grocery list'}
            </button>
          </div>

          {notice && (
            <div className="mx-4 mb-1 rounded-xl border border-sage-300/60 bg-sage-100/50 px-4 py-2.5 text-sm text-brown-800 sm:mx-6">
              {notice}
            </div>
          )}

          {/* Week grid */}
          <div className="flex-1 overflow-y-auto px-4 pb-6 sm:px-6">
            {isLoading ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="h-40 animate-pulse rounded-2xl bg-sand-100" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
                {DAY_NAMES.map((short, i) => {
                  const meal = mealsByDay.get(i)
                  const date = dateForDay(weekStart, i)
                  const isToday = toISODate(new Date()) === toISODate(date)
                  return (
                    <DayCard
                      key={i}
                      dayShort={short}
                      dayFull={DAY_NAMES_FULL[i]}
                      dateLabel={format(date, 'MMM d')}
                      isToday={isToday}
                      meal={meal}
                      onPlan={() => setEditingDay(i)}
                    />
                  )
                })}
              </div>
            )}
            <p className="mt-6 text-center text-xs text-brown-700/40">
              Built from this week’s board, the grocery list below is one tap from Shipt or Amazon Fresh.
            </p>
          </div>
        </div>
      )}

      {editingDay !== null && (
        <MealEditor
          weekStart={weekStart}
          dayIndex={editingDay}
          existing={mealsByDay.get(editingDay) ?? null}
          onClose={() => setEditingDay(null)}
        />
      )}
    </div>
  )
}

/* ── Day card ─────────────────────────────────────────────────────────── */

function DayCard({
  dayShort,
  dayFull,
  dateLabel,
  isToday,
  meal,
  onPlan,
}: {
  dayShort: string
  dayFull: string
  dateLabel: string
  isToday: boolean
  meal: MealWithIngredients | undefined
  onPlan: () => void
}) {
  return (
    <button
      onClick={onPlan}
      className={`flex min-h-[10rem] flex-col rounded-2xl bg-white p-3 text-left shadow-sm ring-1 transition-all hover:shadow-md ${
        isToday ? 'ring-2 ring-terracotta-400' : 'ring-sand-200/60'
      }`}
    >
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-brown-700/50">{dayShort}</span>
        <span className="text-[11px] text-brown-700/40">{dateLabel}</span>
      </div>
      {isToday && (
        <span className="mb-1 w-fit rounded-full bg-terracotta-100 px-2 py-0.5 text-[10px] font-bold text-terracotta-600">
          Today
        </span>
      )}
      {meal ? (
        <div className="flex flex-1 flex-col">
          <p className="font-display text-lg leading-snug text-brown-800">{meal.title}</p>
          <div className="mt-auto space-y-1 pt-2">
            <p className="text-[11px] text-brown-700/50">
              {meal.servings} servings
              {meal.ingredients.length > 0 &&
                ` · ${meal.ingredients.length} ingredient${meal.ingredients.length === 1 ? '' : 's'}`}
            </p>
            {meal.recipe_url && <p className="text-[11px] font-semibold text-terracotta-500">Recipe saved ↗</p>}
          </div>
          <span className="sr-only">Edit {dayFull} dinner</span>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-sand-200 py-6 text-brown-700/40">
          <span className="text-2xl leading-none">+</span>
          <span className="text-xs font-semibold">Plan dinner</span>
          <span className="sr-only">Plan {dayFull} dinner</span>
        </div>
      )}
    </button>
  )
}

/* ── Meal editor ──────────────────────────────────────────────────────── */

function MealEditor({
  weekStart,
  dayIndex,
  existing,
  onClose,
}: {
  weekStart: string
  dayIndex: number
  existing: MealWithIngredients | null
  onClose: () => void
}) {
  const [title, setTitle] = useState(existing?.title ?? '')
  const [servings, setServings] = useState(existing?.servings ?? 4)
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [recipeUrl, setRecipeUrl] = useState(existing?.recipe_url ?? '')
  const [ingredients, setIngredients] = useState<IngredientInput[]>(
    existing?.ingredients.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      category: i.category,
    })) ?? [{ name: '', quantity: null, unit: null }]
  )
  const [error, setError] = useState<string | null>(null)

  const ensurePlan = useEnsureMealPlan()
  const saveMeal = useSaveMeal()
  const deleteMeal = useDeleteMeal()
  const saving = ensurePlan.isPending || saveMeal.isPending

  const updateIngredient = (idx: number, patch: Partial<IngredientInput>) => {
    setIngredients((prev) => prev.map((ing, i) => (i === idx ? { ...ing, ...patch } : ing)))
  }

  const removeIngredient = (idx: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSave = async () => {
    setError(null)
    if (!title.trim()) {
      setError('Give this dinner a name first.')
      return
    }
    try {
      const plan = await ensurePlan.mutateAsync(weekStart)
      await saveMeal.mutateAsync({
        planId: plan.id,
        dayIndex,
        title,
        notes,
        recipeUrl,
        servings,
        ingredients: ingredients.filter((i) => i.name.trim()),
      })
      onClose()
    } catch {
      setError('Hmm, that didn’t save — try again?')
    }
  }

  const handleDelete = async () => {
    if (!existing) return
    try {
      await deleteMeal.mutateAsync(existing.id)
      onClose()
    } catch {
      setError('Hmm, that didn’t work — try again?')
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-brown-900/40 sm:items-center sm:p-6">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative flex max-h-[92%] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-cream-100 shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-sand-200 px-5 py-4">
          <div>
            <h2 className="font-display text-xl text-brown-800">{DAY_NAMES_FULL[dayIndex]} dinner</h2>
            <p className="text-xs text-brown-700/50">{format(dateForDay(weekStart, dayIndex), 'MMMM d')}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close editor"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-brown-700/50 hover:bg-sand-100"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none">
              <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-brown-700/40">
              What’s cooking
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Taco Tuesday"
              className="w-full rounded-xl border border-sand-300 bg-white px-3.5 py-2.5 text-sm text-brown-800 placeholder:text-brown-700/35 focus:border-terracotta-500 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-widest text-brown-700/40">Servings</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setServings((s) => Math.max(1, s - 1))}
                aria-label="Fewer servings"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-sand-300 bg-white text-lg text-brown-700"
              >
                −
              </button>
              <span className="w-8 text-center text-lg font-bold text-brown-800">{servings}</span>
              <button
                onClick={() => setServings((s) => Math.min(24, s + 1))}
                aria-label="More servings"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-sand-300 bg-white text-lg text-brown-700"
              >
                +
              </button>
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-widest text-brown-700/40">
                Ingredients
              </label>
              <button
                onClick={() => setIngredients((prev) => [...prev, { name: '', quantity: null, unit: null }])}
                className="text-xs font-semibold text-terracotta-500 hover:text-terracotta-600"
              >
                + Add
              </button>
            </div>
            <div className="space-y-2">
              {ingredients.map((ing, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    value={ing.name}
                    onChange={(e) => updateIngredient(idx, { name: e.target.value })}
                    placeholder="Ingredient"
                    aria-label={`Ingredient ${idx + 1} name`}
                    className="min-w-0 flex-1 rounded-xl border border-sand-300 bg-white px-3 py-2 text-sm text-brown-800 placeholder:text-brown-700/35 focus:border-terracotta-500 focus:outline-none"
                  />
                  <input
                    value={ing.quantity ?? ''}
                    onChange={(e) =>
                      updateIngredient(idx, {
                        quantity: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                    placeholder="Qty"
                    inputMode="decimal"
                    aria-label={`Ingredient ${idx + 1} quantity`}
                    className="w-16 rounded-xl border border-sand-300 bg-white px-2 py-2 text-center text-sm text-brown-800 focus:border-terracotta-500 focus:outline-none"
                  />
                  <input
                    value={ing.unit ?? ''}
                    onChange={(e) => updateIngredient(idx, { unit: e.target.value || null })}
                    placeholder="unit"
                    aria-label={`Ingredient ${idx + 1} unit`}
                    className="w-16 rounded-xl border border-sand-300 bg-white px-2 py-2 text-center text-sm text-brown-800 placeholder:text-brown-700/35 focus:border-terracotta-500 focus:outline-none"
                  />
                  <button
                    onClick={() => removeIngredient(idx)}
                    aria-label={`Remove ingredient ${idx + 1}`}
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-brown-700/40 hover:bg-red-50 hover:text-red-500"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-brown-700/40">
              Quantities roll up automatically when you build the grocery list.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-brown-700/40">
              Recipe link <span className="font-normal normal-case tracking-normal">(optional)</span>
            </label>
            <input
              value={recipeUrl}
              onChange={(e) => setRecipeUrl(e.target.value)}
              placeholder="https://…"
              inputMode="url"
              className="w-full rounded-xl border border-sand-300 bg-white px-3.5 py-2.5 text-sm text-brown-800 placeholder:text-brown-700/35 focus:border-terracotta-500 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-brown-700/40">
              Notes <span className="font-normal normal-case tracking-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Kids love it, go easy on the spice…"
              rows={2}
              className="w-full rounded-xl border border-sand-300 bg-white px-3.5 py-2.5 text-sm text-brown-800 placeholder:text-brown-700/35 focus:border-terracotta-500 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="flex gap-2.5 border-t border-sand-200 bg-white px-5 py-4">
          {existing && (
            <button
              onClick={handleDelete}
              disabled={deleteMeal.isPending}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-50 disabled:opacity-40"
            >
              Remove
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="rounded-xl border border-sand-300 bg-white px-5 py-2.5 text-sm font-semibold text-brown-700 hover:bg-cream-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-terracotta-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-terracotta-600 disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save dinner'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Pro upsell (billing doesn't exist yet — gate is real, lock is dormant) ── */

function ProUpsell() {
  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="max-w-sm rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-sand-200/60">
        <p className="font-handwritten text-3xl text-terracotta-500">the dinner board</p>
        <h2 className="mt-2 font-display text-2xl text-brown-800">A Sup Fam Pro feature</h2>
        <p className="mt-3 text-sm leading-relaxed text-brown-700/70">
          Plan the week’s dinners, roll every ingredient into one grocery list, and hand it
          straight to Shipt or Amazon Fresh. Dinner, decided.
        </p>
        <div className="mt-5 rounded-2xl bg-cream-100 px-4 py-3">
          <p className="text-sm font-bold text-brown-800">Pro — $4.99/mo or $39/yr</p>
          <p className="mt-1 text-xs text-brown-700/50">
            Pro checkout isn’t open yet — founding families keep it free while we finish it.
          </p>
        </div>
      </div>
    </div>
  )
}

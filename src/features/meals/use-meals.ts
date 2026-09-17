import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useFamilyMember } from '@/features/auth/use-family-member'
import type { MealPlan, Meal, MealWithIngredients, MealIngredient } from './types'

export interface IngredientInput {
  name: string
  quantity: number | null
  unit: string | null
  category?: string | null
}

export interface SaveMealInput {
  planId: string
  dayIndex: number
  slot?: string
  title: string
  notes?: string | null
  recipeUrl?: string | null
  servings: number
  ingredients: IngredientInput[]
}

function mealQueryKey(familyId: string | undefined, weekStart: string) {
  return ['meal-plan', familyId, weekStart]
}

export function useMealPlan(weekStart: string) {
  const { data: member } = useFamilyMember()

  return useQuery({
    queryKey: mealQueryKey(member?.family_id, weekStart),
    enabled: !!member?.family_id,
    queryFn: async (): Promise<{ plan: MealPlan | null; meals: MealWithIngredients[] }> => {
      const { data: plan, error: planError } = await supabase
        .from('meal_plans')
        .select('*')
        .eq('family_id', member!.family_id)
        .eq('week_start', weekStart)
        .maybeSingle()
      if (planError) throw planError
      if (!plan) return { plan: null, meals: [] }

      const { data: meals, error: mealsError } = await supabase
        .from('meals')
        .select('*')
        .eq('meal_plan_id', plan.id)
        .order('day_index', { ascending: true })
      if (mealsError) throw mealsError

      const mealIds = (meals ?? []).map((m) => m.id)
      let ingredients: MealIngredient[] = []
      if (mealIds.length > 0) {
        const { data: ing, error: ingError } = await supabase
          .from('meal_ingredients')
          .select('*')
          .in('meal_id', mealIds)
          .order('position', { ascending: true })
        if (ingError) throw ingError
        ingredients = (ing ?? []) as MealIngredient[]
      }

      const byMeal = new Map<string, MealIngredient[]>()
      for (const ing of ingredients) {
        const arr = byMeal.get(ing.meal_id) ?? []
        arr.push(ing)
        byMeal.set(ing.meal_id, arr)
      }

      return {
        plan: plan as MealPlan,
        meals: ((meals ?? []) as Meal[]).map((m) => ({
          ...m,
          ingredients: byMeal.get(m.id) ?? [],
        })),
      }
    },
  })
}

/** Get-or-create the meal plan row for a week. Returns the plan. */
export function useEnsureMealPlan() {
  const queryClient = useQueryClient()
  const { data: member } = useFamilyMember()

  return useMutation({
    mutationFn: async (weekStart: string): Promise<MealPlan> => {
      if (!member) throw new Error('No family member')
      // Try existing first (unique constraint makes this race-safe anyway)
      const { data: existing, error: selError } = await supabase
        .from('meal_plans')
        .select('*')
        .eq('family_id', member.family_id)
        .eq('week_start', weekStart)
        .maybeSingle()
      if (selError) throw selError
      if (existing) return existing as MealPlan

      const { data, error } = await supabase
        .from('meal_plans')
        .insert({ family_id: member.family_id, week_start: weekStart, created_by: member.id })
        .select()
        .single()
      if (error) throw error
      return data as MealPlan
    },
    onSuccess: (_plan, weekStart) => {
      queryClient.invalidateQueries({ queryKey: mealQueryKey(member?.family_id, weekStart) })
    },
  })
}

export function useSaveMeal() {
  const queryClient = useQueryClient()
  const { data: member } = useFamilyMember()

  return useMutation({
    mutationFn: async (input: SaveMealInput): Promise<void> => {
      const slot = input.slot ?? 'dinner'
      const title = input.title.trim()
      if (!title) throw new Error('Meal needs a name')

      // Upsert the meal (one per plan/day/slot)
      const { data: meal, error: mealError } = await supabase
        .from('meals')
        .upsert(
          {
            meal_plan_id: input.planId,
            day_index: input.dayIndex,
            slot,
            title,
            notes: input.notes?.trim() || null,
            recipe_url: input.recipeUrl?.trim() || null,
            servings: input.servings,
          },
          { onConflict: 'meal_plan_id,day_index,slot' }
        )
        .select()
        .single()
      if (mealError) throw mealError

      // Replace ingredients wholesale — simplest correct sync for an editor
      const { error: delError } = await supabase
        .from('meal_ingredients')
        .delete()
        .eq('meal_id', meal.id)
      if (delError) throw delError

      const rows = input.ingredients
        .filter((i) => i.name.trim())
        .map((i, idx) => ({
          meal_id: meal.id,
          name: i.name.trim(),
          quantity: i.quantity,
          unit: i.unit?.trim() || null,
          category: i.category?.trim() || null,
          position: idx,
        }))
      if (rows.length > 0) {
        const { error: insError } = await supabase.from('meal_ingredients').insert(rows)
        if (insError) throw insError
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-plan', member?.family_id] })
    },
  })
}

export function useDeleteMeal() {
  const queryClient = useQueryClient()
  const { data: member } = useFamilyMember()

  return useMutation({
    mutationFn: async (mealId: string) => {
      const { error } = await supabase.from('meals').delete().eq('id', mealId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-plan', member?.family_id] })
    },
  })
}

interface AggregatedItem {
  title: string
  category: string | null
}

function formatQuantity(q: number | null, unit: string | null): string {
  if (q == null || Number.isNaN(q)) return ''
  const num = Number.isInteger(q) ? String(q) : String(Math.round(q * 100) / 100)
  return unit ? `${num} ${unit} ` : `${num}× `
}

/**
 * Turn a week's meals into grocery list rows: consolidate duplicate
 * ingredients across meals (summing quantities when units match), skip anything
 * already on the unchecked list, and tag rows with source='meal_plan'.
 */
export function useBuildGroceryList() {
  const queryClient = useQueryClient()
  const { data: member } = useFamilyMember()

  return useMutation({
    mutationFn: async (args: {
      planId: string
      meals: MealWithIngredients[]
    }): Promise<{ added: number; skipped: number }> => {
      if (!member) throw new Error('No family member')

      // 1. Aggregate across meals
      const agg = new Map<string, { qty: number | null; unit: string | null; category: string | null; name: string }>()
      for (const meal of args.meals) {
        for (const ing of meal.ingredients) {
          const key = ing.name.trim().toLowerCase()
          const cur = agg.get(key)
          if (cur && cur.unit === (ing.unit ?? null) && cur.qty != null && ing.quantity != null) {
            cur.qty += ing.quantity
          } else if (!cur) {
            agg.set(key, {
              qty: ing.quantity,
              unit: ing.unit ?? null,
              category: ing.category ?? null,
              name: ing.name.trim(),
            })
          } else {
            // Same name, different unit — keep as separate line item
            agg.set(`${key}__${ing.unit ?? 'x'}_${Math.random().toString(36).slice(2, 7)}`, {
              qty: ing.quantity,
              unit: ing.unit ?? null,
              category: ing.category ?? null,
              name: ing.name.trim(),
            })
          }
        }
      }

      const rows: AggregatedItem[] = [...agg.values()].map((a) => ({
        title: `${formatQuantity(a.qty, a.unit)}${a.name}`,
        category: a.category,
      }))
      if (rows.length === 0) return { added: 0, skipped: 0 }

      // 2. Skip anything already on the unchecked list (or already added from this plan)
      const { data: existing, error: selError } = await supabase
        .from('grocery_items')
        .select('title')
        .eq('family_id', member.family_id)
        .eq('is_checked', false)
      if (selError) throw selError
      const existingTitles = new Set((existing ?? []).map((r) => r.title.trim().toLowerCase()))

      const fresh = rows.filter((r) => !existingTitles.has(r.title.trim().toLowerCase()))
      const skipped = rows.length - fresh.length

      // 3. Insert
      if (fresh.length > 0) {
        const { error: insError } = await supabase.from('grocery_items').insert(
          fresh.map((r) => ({
            family_id: member.family_id,
            added_by: member.id,
            title: r.title,
            category: r.category,
            source: 'meal_plan',
            meal_plan_id: args.planId,
          }))
        )
        if (insError) throw insError
      }

      return { added: fresh.length, skipped }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grocery', member?.family_id] })
      queryClient.invalidateQueries({ queryKey: ['meal-plan', member?.family_id] })
    },
  })
}

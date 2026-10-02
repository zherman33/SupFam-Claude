import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useFamilyMember } from '@/features/auth/use-family-member'
import {
  normalizeTitle,
  scoreDishes,
  type FoodPrefs,
  type MealHistoryEntry,
  type RatingSummary,
  type Recommendation,
} from './recommendations'
import { dateForDay, toISODate } from './types'

const DEFAULT_PREFS: FoodPrefs = {
  dietary_restrictions: [],
  dislikes: [],
  favorites: [],
  default_servings: 4,
}

function historyKey(familyId: string | undefined) {
  return ['meal-history', familyId]
}
function ratingsKey(familyId: string | undefined) {
  return ['meal-ratings', familyId]
}
function prefsKey(familyId: string | undefined) {
  return ['food-prefs', familyId]
}

/** Every dinner the family has planned, newest first (up to ~6 months back). */
export function useMealHistory() {
  const { data: member } = useFamilyMember()
  return useQuery({
    queryKey: historyKey(member?.family_id),
    enabled: !!member?.family_id,
    queryFn: async (): Promise<MealHistoryEntry[]> => {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - 180)
      const cutoffISO = toISODate(cutoff)

      const { data: plans, error: planError } = await supabase
        .from('meal_plans')
        .select('id, week_start')
        .eq('family_id', member!.family_id)
        .gte('week_start', cutoffISO)
        .order('week_start', { ascending: false })
      if (planError) throw planError
      if (!plans || plans.length === 0) return []

      const planIds = plans.map((p) => p.id)
      const weekById = new Map(plans.map((p) => [p.id, p.week_start as string]))

      const { data: meals, error: mealsError } = await supabase
        .from('meals')
        .select('meal_plan_id, day_index, title')
        .in('meal_plan_id', planIds)
        .eq('slot', 'dinner')
      if (mealsError) throw mealsError

      return (meals ?? []).map((m) => {
        const weekStart = weekById.get(m.meal_plan_id) ?? ''
        const date = weekStart ? toISODate(dateForDay(weekStart, m.day_index)) : ''
        return { title: m.title as string, date, dayIndex: m.day_index as number }
      })
    },
  })
}

export function useMealRatings() {
  const { data: member } = useFamilyMember()
  return useQuery({
    queryKey: ratingsKey(member?.family_id),
    enabled: !!member?.family_id,
    queryFn: async (): Promise<RatingSummary[]> => {
      const { data, error } = await supabase
        .from('meal_ratings')
        .select('meal_title, rating')
        .eq('family_id', member!.family_id)
      if (error) throw error
      const byTitle = new Map<string, number[]>()
      for (const r of data ?? []) {
        // Normalize so "Taco Night" ratings match "taco night" history entries —
        // scoreDishes looks ratings up by normalized title.
        const key = normalizeTitle(r.meal_title)
        const arr = byTitle.get(key) ?? []
        arr.push(r.rating)
        byTitle.set(key, arr)
      }
      return [...byTitle.entries()].map(([title, rs]) => ({
        title,
        avg: rs.reduce((a, b) => a + b, 0) / rs.length,
        count: rs.length,
      }))
    },
  })
}

export function useFoodPrefs() {
  const { data: member } = useFamilyMember()
  return useQuery({
    queryKey: prefsKey(member?.family_id),
    enabled: !!member?.family_id,
    queryFn: async (): Promise<FoodPrefs> => {
      const { data, error } = await supabase
        .from('family_food_prefs')
        .select('dietary_restrictions, dislikes, favorites, default_servings')
        .eq('family_id', member!.family_id)
        .maybeSingle()
      if (error) throw error
      if (!data) return DEFAULT_PREFS
      return {
        dietary_restrictions: data.dietary_restrictions ?? [],
        dislikes: data.dislikes ?? [],
        favorites: data.favorites ?? [],
        default_servings: data.default_servings ?? 4,
      }
    },
  })
}

export function useSaveFoodPrefs() {
  const queryClient = useQueryClient()
  const { data: member } = useFamilyMember()
  return useMutation({
    mutationFn: async (prefs: FoodPrefs) => {
      if (!member) throw new Error('No family member')
      const { error } = await supabase.from('family_food_prefs').upsert(
        {
          family_id: member.family_id,
          dietary_restrictions: prefs.dietary_restrictions,
          dislikes: prefs.dislikes,
          favorites: prefs.favorites,
          default_servings: prefs.default_servings,
        },
        { onConflict: 'family_id' }
      )
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: prefsKey(member?.family_id) })
    },
  })
}

/** Rate a dish 1–5. Stored per family member against the normalized title. */
export function useRateMeal() {
  const queryClient = useQueryClient()
  const { data: member } = useFamilyMember()
  return useMutation({
    mutationFn: async ({ title, rating }: { title: string; rating: number }) => {
      if (!member) throw new Error('No family member')
      const { error } = await supabase.from('meal_ratings').upsert(
        {
          family_id: member.family_id,
          family_member_id: member.id,
          meal_title: normalizeTitle(title),
          rating,
        },
        { onConflict: 'family_member_id,meal_title' }
      )
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ratingsKey(member?.family_id) })
    },
  })
}

/**
 * Top-3 dinner recommendations for a day, from the family's own history.
 * `plannedTitles` are this week's already-planned dishes (excluded).
 */
export function useRecommendations(
  weekStart: string,
  plannedTitles: string[] = []
): { recommendations: Recommendation[]; isLoading: boolean; hasHistory: boolean } {
  const { data: history, isLoading: hLoading } = useMealHistory()
  const { data: ratings, isLoading: rLoading } = useMealRatings()
  const { data: prefs, isLoading: pLoading } = useFoodPrefs()

  const recommendations = useMemo(() => {
    if (!history || history.length === 0) return []
    return scoreDishes(history, ratings ?? [], prefs ?? DEFAULT_PREFS, toISODate(new Date()), plannedTitles)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, ratings, prefs, weekStart, JSON.stringify(plannedTitles)])

  return {
    recommendations,
    isLoading: hLoading || rLoading || pLoading,
    hasHistory: (history?.length ?? 0) > 0,
  }
}

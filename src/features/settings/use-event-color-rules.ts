import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useFamilyMember } from '@/features/auth/use-family-member'

export interface EventColorRule {
  id: string
  family_id: string
  keyword: string
  color: string
  match_type: 'contains' | 'starts_with' | 'ends_with' | 'exact'
  label: string | null
  sort_order: number
}

export function useEventColorRules() {
  const { data: member } = useFamilyMember()
  return useQuery({
    queryKey: ['event-color-rules', member?.family_id],
    enabled: !!member?.family_id,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await (supabase.from('event_color_rules') as any)
        .select('*')
        .eq('family_id', member!.family_id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as EventColorRule[]
    },
  })
}

export function useCreateEventColorRule() {
  const queryClient = useQueryClient()
  const { data: member } = useFamilyMember()
  return useMutation({
    mutationFn: async (rule: Pick<EventColorRule, 'keyword' | 'color' | 'match_type' | 'label'>) => {
      const { error } = await (supabase.from('event_color_rules') as any).insert({
        family_id: member!.family_id,
        ...rule,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event-color-rules', member?.family_id] }),
  })
}

export function useUpdateEventColorRule() {
  const queryClient = useQueryClient()
  const { data: member } = useFamilyMember()
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<EventColorRule> & { id: string }) => {
      const { error } = await (supabase.from('event_color_rules') as any)
        .update(updates)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event-color-rules', member?.family_id] }),
  })
}

export function useDeleteEventColorRule() {
  const queryClient = useQueryClient()
  const { data: member } = useFamilyMember()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from('event_color_rules') as any)
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event-color-rules', member?.family_id] }),
  })
}

// ── Apply rules to an event title ─────────────────────────────────────────
export function applyColorRules(
  title: string,
  rules: EventColorRule[] | undefined
): string | null {
  if (!rules?.length) return null
  for (const rule of rules) {
    const kw = rule.keyword.toLowerCase()
    const t = title.toLowerCase()
    const match =
      rule.match_type === 'contains' ? t.includes(kw) :
      rule.match_type === 'starts_with' ? t.startsWith(kw) :
      rule.match_type === 'ends_with' ? t.endsWith(kw) :
      t === kw
    if (match) return rule.color
  }
  return null
}

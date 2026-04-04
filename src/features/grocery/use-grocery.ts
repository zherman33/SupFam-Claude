import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useFamilyMember } from '@/features/auth/use-family-member'

export interface GroceryItem {
  id: string
  family_id: string
  title: string
  category: string | null
  is_checked: boolean
  added_by: string | null
  created_at: string
}

export function useGroceryItems() {
  const { data: member } = useFamilyMember()

  return useQuery({
    queryKey: ['grocery', member?.family_id],
    enabled: !!member?.family_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grocery_items')
        .select('*')
        .eq('family_id', member!.family_id)
        .order('is_checked', { ascending: true })
        .order('category', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as GroceryItem[]
    },
  })
}

export function useAddGroceryItem() {
  const queryClient = useQueryClient()
  const { data: member } = useFamilyMember()

  return useMutation({
    mutationFn: async (input: { title: string; category?: string | null }) => {
      if (!member) throw new Error('No family member')
      const { data, error } = await supabase
        .from('grocery_items')
        .insert({
          family_id: member.family_id,
          added_by: member.id,
          title: input.title.trim(),
          category: input.category ?? null,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grocery', member?.family_id] })
    },
  })
}

export function useToggleGroceryItem() {
  const queryClient = useQueryClient()
  const { data: member } = useFamilyMember()

  return useMutation({
    mutationFn: async ({ id, is_checked }: { id: string; is_checked: boolean }) => {
      const { error } = await supabase
        .from('grocery_items')
        .update({ is_checked })
        .eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, is_checked }) => {
      await queryClient.cancelQueries({ queryKey: ['grocery', member?.family_id] })
      const prev = queryClient.getQueryData<GroceryItem[]>(['grocery', member?.family_id])
      queryClient.setQueryData<GroceryItem[]>(['grocery', member?.family_id], (old) =>
        old?.map((item) => (item.id === id ? { ...item, is_checked } : item)) ?? []
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(['grocery', member?.family_id], ctx.prev)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['grocery', member?.family_id] })
    },
  })
}

export function useClearCheckedItems() {
  const queryClient = useQueryClient()
  const { data: member } = useFamilyMember()

  return useMutation({
    mutationFn: async () => {
      if (!member) throw new Error('No family member')
      const { error } = await supabase
        .from('grocery_items')
        .delete()
        .eq('family_id', member.family_id)
        .eq('is_checked', true)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grocery', member?.family_id] })
    },
  })
}

export function useDeleteGroceryItem() {
  const queryClient = useQueryClient()
  const { data: member } = useFamilyMember()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('grocery_items').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grocery', member?.family_id] })
    },
  })
}

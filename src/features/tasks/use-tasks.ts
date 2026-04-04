import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useFamilyMember } from '@/features/auth/use-family-member'

export interface Task {
  id: string
  family_id: string
  assigned_to: string | null
  title: string
  notes: string | null
  due_date: string | null
  is_complete: boolean
  is_recurring: boolean
  recurrence_rule: string | null
  created_by: string
  created_at: string
  // joined
  assigned_member?: { display_name: string; avatar_color: string | null } | null
}

export function useTasks() {
  const { data: member } = useFamilyMember()

  return useQuery({
    queryKey: ['tasks', member?.family_id],
    enabled: !!member?.family_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          assigned_member:family_members!tasks_assigned_to_fkey(display_name, avatar_color)
        `)
        .eq('family_id', member!.family_id)
        .order('is_complete', { ascending: true })
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Task[]
    },
  })
}

export function useTodayTasks() {
  const { data: member } = useFamilyMember()
  const today = new Date().toISOString().split('T')[0]

  return useQuery({
    queryKey: ['tasks-today', member?.family_id, today],
    enabled: !!member?.family_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          assigned_member:family_members!tasks_assigned_to_fkey(display_name, avatar_color)
        `)
        .eq('family_id', member!.family_id)
        .or(`due_date.eq.${today},due_date.lt.${today}`)
        .eq('is_complete', false)
        .order('due_date', { ascending: true })

      if (error) throw error
      return data as Task[]
    },
  })
}

export function useCreateTask() {
  const queryClient = useQueryClient()
  const { data: member } = useFamilyMember()

  return useMutation({
    mutationFn: async (input: { title: string; due_date?: string | null; assigned_to?: string | null; notes?: string | null }) => {
      if (!member) throw new Error('No family member')
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          family_id: member.family_id,
          created_by: member.id,
          title: input.title,
          due_date: input.due_date ?? null,
          assigned_to: input.assigned_to ?? null,
          notes: input.notes ?? null,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_, __, _ctx) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', member?.family_id] })
      queryClient.invalidateQueries({ queryKey: ['tasks-today', member?.family_id] })
    },
  })
}

export function useToggleTask() {
  const queryClient = useQueryClient()
  const { data: member } = useFamilyMember()

  return useMutation({
    mutationFn: async ({ id, is_complete }: { id: string; is_complete: boolean }) => {
      const { error } = await supabase
        .from('tasks')
        .update({ is_complete })
        .eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, is_complete }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', member?.family_id] })
      await queryClient.cancelQueries({ queryKey: ['tasks-today', member?.family_id] })
      const prev = queryClient.getQueryData<Task[]>(['tasks', member?.family_id])
      queryClient.setQueryData<Task[]>(['tasks', member?.family_id], (old) =>
        old?.map((t) => (t.id === id ? { ...t, is_complete } : t)) ?? []
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(['tasks', member?.family_id], ctx.prev)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', member?.family_id] })
      queryClient.invalidateQueries({ queryKey: ['tasks-today', member?.family_id] })
    },
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()
  const { data: member } = useFamilyMember()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', member?.family_id] })
      queryClient.invalidateQueries({ queryKey: ['tasks-today', member?.family_id] })
    },
  })
}

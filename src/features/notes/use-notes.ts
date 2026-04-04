import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useFamilyMember } from '@/features/auth/use-family-member'

export interface Note {
  id: string
  family_id: string
  title: string | null
  content: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export function useNotes() {
  const { data: member } = useFamilyMember()

  return useQuery({
    queryKey: ['notes', member?.family_id],
    enabled: !!member?.family_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('family_id', member!.family_id)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data as Note[]
    },
  })
}

export function useCreateNote() {
  const queryClient = useQueryClient()
  const { data: member } = useFamilyMember()

  return useMutation({
    mutationFn: async (input: { title?: string; content: string }) => {
      if (!member) throw new Error('No family member')
      const { data, error } = await supabase
        .from('notes')
        .insert({
          family_id: member.family_id,
          created_by: member.id,
          title: input.title ?? null,
          content: input.content,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', member?.family_id] })
    },
  })
}

export function useUpdateNote() {
  const queryClient = useQueryClient()
  const { data: member } = useFamilyMember()

  return useMutation({
    mutationFn: async (input: { id: string; title?: string | null; content?: string }) => {
      const { error } = await supabase
        .from('notes')
        .update({ title: input.title, content: input.content })
        .eq('id', input.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', member?.family_id] })
    },
  })
}

export function useDeleteNote() {
  const queryClient = useQueryClient()
  const { data: member } = useFamilyMember()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', member?.family_id] })
    },
  })
}

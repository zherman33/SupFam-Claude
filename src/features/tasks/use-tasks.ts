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
  google_task_id: string | null
  google_tasklist_id: string | null
  // joined
  assigned_member?: { display_name: string; avatar_color: string | null } | null
}

// ── Google Tasks API helpers ──────────────────────────────────────────────

const GTASKS = 'https://tasks.googleapis.com/tasks/v1'

async function getGoogleToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.provider_token ?? null
}

async function getDefaultTasklist(token: string): Promise<string> {
  const res = await fetch(`${GTASKS}/users/@me/lists?maxResults=1`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return '@default'
  const data = await res.json()
  return data.items?.[0]?.id ?? '@default'
}

async function pushTaskToGoogle(
  token: string,
  task: { title: string; notes?: string | null; due_date?: string | null },
  tasklistId?: string
): Promise<{ id: string; tasklistId: string } | null> {
  const listId = tasklistId ?? await getDefaultTasklist(token)
  const body: any = { title: task.title }
  if (task.notes) body.notes = task.notes
  if (task.due_date) body.due = `${task.due_date}T00:00:00.000Z`

  const res = await fetch(`${GTASKS}/lists/${encodeURIComponent(listId)}/tasks`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) return null
  const created = await res.json()
  return { id: created.id, tasklistId: listId }
}

async function completeGoogleTask(
  token: string,
  googleTaskId: string,
  tasklistId: string,
  complete: boolean
): Promise<void> {
  await fetch(`${GTASKS}/lists/${encodeURIComponent(tasklistId)}/tasks/${encodeURIComponent(googleTaskId)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: complete ? 'completed' : 'needsAction' }),
  })
}

async function deleteGoogleTask(
  token: string,
  googleTaskId: string,
  tasklistId: string
): Promise<void> {
  await fetch(`${GTASKS}/lists/${encodeURIComponent(tasklistId)}/tasks/${encodeURIComponent(googleTaskId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

// ── Hooks ──────────────────────────────────────────────────────────────────

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
    mutationFn: async (input: {
      title: string
      due_date?: string | null
      assigned_to?: string | null
      notes?: string | null
    }) => {
      if (!member) throw new Error('No family member')

      // 1. Create in Supabase first
      const { data: task, error } = await (supabase.from('tasks') as any)
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

      // 2. Push to Google Tasks in background (non-blocking)
      getGoogleToken().then(async token => {
        if (!token) return
        const result = await pushTaskToGoogle(token, input)
        if (result) {
          // Store the Google Task ID back on our task
          await supabase
            .from('tasks')
            .update({ google_task_id: result.id, google_tasklist_id: result.tasklistId } as any)
            .eq('id', task.id)
        }
      })

      return task
    },
    onSuccess: () => {
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
      // Get task's Google IDs before updating
      const { data: task } = await (supabase.from('tasks') as any)
        .select('google_task_id, google_tasklist_id')
        .eq('id', id)
        .maybeSingle()

      const { error } = await supabase
        .from('tasks')
        .update({ is_complete })
        .eq('id', id)
      if (error) throw error

      // Sync to Google Tasks if linked
      if (task?.google_task_id && task?.google_tasklist_id) {
        getGoogleToken().then(token => {
          if (token) completeGoogleTask(token, task.google_task_id!, task.google_tasklist_id!, is_complete)
        })
      }
    },
    onMutate: async ({ id, is_complete }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', member?.family_id] })
      await queryClient.cancelQueries({ queryKey: ['tasks-today', member?.family_id] })
      const prev = queryClient.getQueryData<Task[]>(['tasks', member?.family_id])
      queryClient.setQueryData<Task[]>(
        ['tasks', member?.family_id],
        old => old?.map(t => t.id === id ? { ...t, is_complete } : t) ?? []
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['tasks', member?.family_id], ctx.prev)
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
      // Get Google IDs before deleting
      const { data: task } = await (supabase.from('tasks') as any)
        .select('google_task_id, google_tasklist_id')
        .eq('id', id)
        .maybeSingle()

      const { error } = await supabase.from('tasks').delete().eq('id', id)
      if (error) throw error

      // Delete from Google Tasks in background
      if (task?.google_task_id && task?.google_tasklist_id) {
        getGoogleToken().then(token => {
          if (token) deleteGoogleTask(token, task.google_task_id!, task.google_tasklist_id!)
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', member?.family_id] })
      queryClient.invalidateQueries({ queryKey: ['tasks-today', member?.family_id] })
    },
  })
}

// ── Sync from Google Tasks ─────────────────────────────────────────────────

export function useSyncTasks() {
  const queryClient = useQueryClient()
  const { data: member } = useFamilyMember()

  return useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await supabase.functions.invoke('sync-tasks', {
        body: {},
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
      })
      if (res.error) throw res.error
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', member?.family_id] })
    },
  })
}

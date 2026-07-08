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
  position?: number | null
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

async function updateGoogleTask(
  token: string,
  googleTaskId: string,
  tasklistId: string,
  task: { title?: string; notes?: string | null; due_date?: string | null }
): Promise<void> {
  const body: any = {}
  if (task.title !== undefined) body.title = task.title
  if (task.notes !== undefined) body.notes = task.notes ?? ''
  if (task.due_date !== undefined) {
    body.due = task.due_date ? `${task.due_date}T00:00:00.000Z` : null
  }

  await fetch(`${GTASKS}/lists/${encodeURIComponent(tasklistId)}/tasks/${encodeURIComponent(googleTaskId)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 30,
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
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 30,
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
        if (token) {
          const result = await pushTaskToGoogle(token, input)
          if (result) {
            await supabase
              .from('tasks')
              .update({ google_task_id: result.id, google_tasklist_id: result.tasklistId })
              .eq('id', task.id)
            return
          }
        }
        // Fallback: invoke server-side edge function which uses refreshed OAuth token from DB
        const { data: { session } } = await supabase.auth.getSession()
        await supabase.functions.invoke('sync-tasks', {
          body: { action: 'create', task_id: task.id },
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        })
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
        getGoogleToken().then(async token => {
          if (token) {
            await completeGoogleTask(token, task.google_task_id!, task.google_tasklist_id!, is_complete)
          } else {
            const { data: { session } } = await supabase.auth.getSession()
            await supabase.functions.invoke('sync-tasks', {
              body: {
                action: 'complete',
                google_task_id: task.google_task_id,
                google_tasklist_id: task.google_tasklist_id,
                is_complete,
              },
              headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
            })
          }
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

export function useUpdateTask() {
  const queryClient = useQueryClient()
  const { data: member } = useFamilyMember()

  return useMutation({
    mutationFn: async (input: {
      id: string
      title: string
      due_date?: string | null
      assigned_to?: string | null
      notes?: string | null
      is_complete?: boolean
    }) => {
      const { data: existing } = await (supabase.from('tasks') as any)
        .select('google_task_id, google_tasklist_id, is_complete')
        .eq('id', input.id)
        .maybeSingle()

      const updates: any = {
        title: input.title,
        due_date: input.due_date ?? null,
        assigned_to: input.assigned_to ?? null,
        notes: input.notes ?? null,
      }
      if (input.is_complete !== undefined) {
        updates.is_complete = input.is_complete
      }

      const { data: task, error } = await (supabase.from('tasks') as any)
        .update(updates)
        .eq('id', input.id)
        .select()
        .single()
      if (error) throw error

      if (existing?.google_task_id && existing?.google_tasklist_id) {
        getGoogleToken().then(async token => {
          if (token) {
            await updateGoogleTask(token, existing.google_task_id!, existing.google_tasklist_id!, input)
            if (input.is_complete !== undefined && input.is_complete !== existing.is_complete) {
              await completeGoogleTask(token, existing.google_task_id!, existing.google_tasklist_id!, input.is_complete)
            }
          } else {
            const { data: { session } } = await supabase.auth.getSession()
            await supabase.functions.invoke('sync-tasks', {
              body: {
                action: 'update',
                google_task_id: existing.google_task_id,
                google_tasklist_id: existing.google_tasklist_id,
                title: input.title,
                notes: input.notes,
                due_date: input.due_date,
                ...(input.is_complete !== undefined ? { is_complete: input.is_complete } : {}),
              },
              headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
            })
          }
        })
      }

      return task
    },
    onSuccess: () => {
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
        getGoogleToken().then(async token => {
          if (token) {
            await deleteGoogleTask(token, task.google_task_id!, task.google_tasklist_id!)
          } else {
            const { data: { session } } = await supabase.auth.getSession()
            await supabase.functions.invoke('sync-tasks', {
              body: {
                action: 'delete',
                google_task_id: task.google_task_id,
                google_tasklist_id: task.google_tasklist_id,
              },
              headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
            })
          }
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
      queryClient.invalidateQueries({ queryKey: ['tasks-today', member?.family_id] })
    },
  })
}

// ── Reorder Unscheduled Tasks ──────────────────────────────────────────────

export function sortUnscheduledTasks(tasks: Task[], familyId?: string): Task[] {
  if (!tasks || tasks.length === 0) return []

  let savedIds: string[] = []
  if (familyId && typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(`supfam_unscheduled_order_${familyId}`)
      if (stored) savedIds = JSON.parse(stored)
    } catch {
      // ignore
    }
  }

  const idToIndex = new Map<string, number>()
  savedIds.forEach((id, idx) => idToIndex.set(id, idx))

  return [...tasks].sort((a, b) => {
    const idxA = idToIndex.get(a.id)
    const idxB = idToIndex.get(b.id)

    // If both have saved order, sort by saved order
    if (idxA !== undefined && idxB !== undefined) {
      return idxA - idxB
    }
    // If both have database position, sort by position
    if (a.position != null && b.position != null && a.position !== b.position) {
      return a.position - b.position
    }
    // If only A has order/position and B does not (B is newly added)
    if ((idxA !== undefined || a.position != null) && idxB === undefined && b.position == null) {
      return b.created_at > a.created_at ? 1 : -1
    }
    // If only B has order/position and A does not (A is newly added)
    if ((idxB !== undefined || b.position != null) && idxA === undefined && a.position == null) {
      return a.created_at > b.created_at ? -1 : 1
    }
    // Default: newest first
    return b.created_at.localeCompare(a.created_at)
  })
}

export function useReorderTasks() {
  const queryClient = useQueryClient()
  const { data: member } = useFamilyMember()

  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      if (!member) return

      // 1. Immediately persist to localStorage for instant reliable local ordering
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(`supfam_unscheduled_order_${member.family_id}`, JSON.stringify(orderedIds))
        } catch {
          // ignore
        }
      }

      // 2. Persist position updates to database in background
      try {
        await Promise.all(
          orderedIds.map((id, index) =>
            (supabase.from('tasks') as any).update({ position: index }).eq('id', id)
          )
        )
      } catch {
        // Silently ignore if migration hasn't run yet on live DB
      }
    },
    onMutate: async (orderedIds: string[]) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', member?.family_id] })
      const prev = queryClient.getQueryData<Task[]>(['tasks', member?.family_id])

      if (member && typeof window !== 'undefined') {
        try {
          localStorage.setItem(`supfam_unscheduled_order_${member.family_id}`, JSON.stringify(orderedIds))
        } catch {
          // ignore
        }
      }

      if (prev) {
        const idToIndex = new Map<string, number>()
        orderedIds.forEach((id, idx) => idToIndex.set(id, idx))
        const updated = prev.map(t => {
          if (idToIndex.has(t.id)) {
            return { ...t, position: idToIndex.get(t.id) }
          }
          return t
        })
        queryClient.setQueryData<Task[]>(['tasks', member?.family_id], updated)
      }

      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(['tasks', member?.family_id], ctx.prev)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', member?.family_id] })
    },
  })
}


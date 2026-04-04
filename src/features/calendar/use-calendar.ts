import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useFamilyMember } from '@/features/auth/use-family-member'

export interface CalendarEvent {
  id: string
  family_id: string
  source_calendar_id: string
  external_event_id: string | null
  title: string
  description: string | null
  location: string | null
  start_at: string
  end_at: string | null
  all_day: boolean
  color: string | null
  created_by: string
}

export interface ConnectedCalendar {
  id: string
  family_member_id: string
  provider: string
  calendar_id: string
  calendar_name: string | null
  color: string | null
  is_visible: boolean
  is_default: boolean
  last_synced_at: string | null
  // joined
  owner?: { display_name: string; avatar_color: string | null }
}

// ─── Calendar events for the visible window ───────────────────────────────
export function useCalendarEvents() {
  const { data: member } = useFamilyMember()

  return useQuery({
    queryKey: ['calendar-events', member?.family_id],
    enabled: !!member?.family_id,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      // Fetch events ±5 weeks from today
      const now = new Date()
      const from = new Date(now)
      from.setDate(now.getDate() - 28)  // 4 weeks back
      const to = new Date(now)
      to.setDate(now.getDate() + 84)    // 12 weeks forward

      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('family_id', member!.family_id)
        .gte('start_at', from.toISOString())
        .lte('start_at', to.toISOString())
        .order('start_at', { ascending: true })

      if (error) throw error
      return data as CalendarEvent[]
    },
  })
}

// ─── Connected calendars for the whole family ─────────────────────────────
export function useConnectedCalendars() {
  const { data: member } = useFamilyMember()

  return useQuery({
    queryKey: ['connected-calendars', member?.family_id],
    enabled: !!member?.family_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('connected_calendars')
        .select(`
          *,
          owner:family_members!connected_calendars_family_member_id_fkey(display_name, avatar_color)
        `)
        .in(
          'family_member_id',
          // get all member IDs in this family
          (await supabase
            .from('family_members')
            .select('id')
            .eq('family_id', member!.family_id)
            .then(({ data }) => data?.map((m) => m.id) ?? []))
        )
        .order('calendar_name', { ascending: true })

      if (error) throw error
      return data as unknown as ConnectedCalendar[]
    },
  })
}

// ─── Toggle a calendar's visibility ──────────────────────────────────────
export function useToggleCalendarVisibility() {
  const queryClient = useQueryClient()
  const { data: member } = useFamilyMember()

  return useMutation({
    mutationFn: async ({ id, is_visible }: { id: string; is_visible: boolean }) => {
      const { error } = await supabase
        .from('connected_calendars')
        .update({ is_visible })
        .eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, is_visible }) => {
      await queryClient.cancelQueries({ queryKey: ['connected-calendars', member?.family_id] })
      const prev = queryClient.getQueryData<ConnectedCalendar[]>(['connected-calendars', member?.family_id])
      queryClient.setQueryData<ConnectedCalendar[]>(
        ['connected-calendars', member?.family_id],
        (old) => old?.map((c) => (c.id === id ? { ...c, is_visible } : c)) ?? []
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['connected-calendars', member?.family_id], ctx.prev)
    },
    onSuccess: () => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['connected-calendars', member?.family_id] })
      }, 500)
    },
  })
}

// ─── Trigger a calendar sync via Edge Function ────────────────────────────
export function useSyncCalendars() {
  const queryClient = useQueryClient()
  const { data: member } = useFamilyMember()

  return useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await supabase.functions.invoke('sync-calendars', {
        body: {},
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
      })
      if (res.error) throw res.error
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events', member?.family_id] })
      queryClient.invalidateQueries({ queryKey: ['connected-calendars', member?.family_id] })
    },
  })
}

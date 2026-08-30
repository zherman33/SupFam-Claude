import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useFamilyMember } from '@/features/auth/use-family-member'
import { format, parseISO } from 'date-fns'

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
  is_quick_toggle?: boolean
  is_default: boolean
  last_synced_at: string | null
  ics_url?: string | null
  account_email?: string | null
  // joined
  owner?: { display_name: string; avatar_color: string | null }
}

export interface EventDateBounds {
  firstDay: string
  lastDay: string
  dates: string[]
  isMultiDay: boolean
}

export function getEventLocalDate(dateStr: string, allDay: boolean): string {
  if (allDay) {
    return dateStr.slice(0, 10)
  }
  return format(parseISO(dateStr), 'yyyy-MM-dd')
}

export function getEventDateBounds(ev: CalendarEvent): EventDateBounds {
  const firstDay = getEventLocalDate(ev.start_at, ev.all_day)
  if (!ev.end_at) {
    return { firstDay, lastDay: firstDay, dates: [firstDay], isMultiDay: false }
  }

  let lastDay = getEventLocalDate(ev.end_at, ev.all_day)
  const isExclusiveEnd =
    ev.all_day &&
    (ev.end_at.includes('T00:00:00') || ev.end_at.includes(' 00:00:00')) &&
    lastDay > firstDay

  if (isExclusiveEnd) {
    const d = new Date(lastDay + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() - 1)
    lastDay = d.toISOString().slice(0, 10)
  }
  if (lastDay < firstDay) lastDay = firstDay

  const isMultiDay = lastDay !== firstDay
  const dates: string[] = []
  let cur = firstDay
  let iterations = 0
  const maxIterations = 366 // Prevent infinite loop in case of abnormal inputs

  while (cur <= lastDay && iterations < maxIterations) {
    iterations++
    dates.push(cur)
    const d = new Date(cur + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() + 1)
    cur = d.toISOString().slice(0, 10)
  }

  return { firstDay, lastDay, dates, isMultiDay }
}

// ─── Calendar events for the visible window ───────────────────────────────
export function useCalendarEvents() {
  const { data: member } = useFamilyMember()
  const { data: connectedCalendars } = useConnectedCalendars()

  const query = useQuery({
    queryKey: ['calendar-events', member?.family_id],
    enabled: !!member?.family_id,
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 60 * 5,
    queryFn: async () => {
      // Fetch events covering the entire grid range (-90 days to +400 days to cover scrolled weeks + 3-week sync buffers)
      const now = new Date()
      const from = new Date(now)
      from.setDate(now.getDate() - 90)  // 90 days back
      const to = new Date(now)
      to.setDate(now.getDate() + 400)   // 400 days forward

      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('family_id', member!.family_id)
        .lte('start_at', to.toISOString())
        .or(`end_at.gte.${from.toISOString()},and(end_at.is.null,start_at.gte.${from.toISOString()})`)
        .order('start_at', { ascending: true })

      if (error) throw error
      return data as CalendarEvent[]
    },
  })

  const visibleCalendarIds = useMemo(() => {
    return new Set(
      (connectedCalendars ?? [])
        .filter((c) => c.is_visible)
        .map((c) => c.calendar_id)
    )
  }, [connectedCalendars])

  const knownCalendarIds = useMemo(() => {
    return new Set((connectedCalendars ?? []).map((c) => c.calendar_id))
  }, [connectedCalendars])

  const filteredData = useMemo(() => {
    if (!query.data) return undefined
    
    // Filter by visibility first
    const visibleEvents = query.data.filter((ev) => {
      if (!ev.source_calendar_id) return true
      if (!knownCalendarIds.has(ev.source_calendar_id)) return true
      return visibleCalendarIds.has(ev.source_calendar_id)
    })

    const seenExternalIds = new Set<string>()
    const seenOccurrenceKeys = new Set<string>()
    const deduped: CalendarEvent[] = []

    for (const ev of visibleEvents) {
      if (ev.external_event_id) {
        // Direct duplicate match
        if (seenExternalIds.has(ev.external_event_id)) {
          continue
        }
        seenExternalIds.add(ev.external_event_id)

        // Recurrence instance duplicate match (same base event ID on the same day)
        // Extract base ID (e.g., "eventId" from "eventId_20260706T120000Z")
        let baseId = ev.external_event_id
        const parts = ev.external_event_id.split('_')
        if (parts.length > 1) {
          const lastPart = parts[parts.length - 1]
          // If the last part matches a date or datetime recurrence pattern, strip it
          if (/^(\d{8}(T\d{6}Z?)?|\d{4}-\d{2}-\d{2})$/.test(lastPart)) {
            baseId = parts.slice(0, -1).join('_')
          }
        }
        const eventDate = getEventLocalDate(ev.start_at, ev.all_day)
        const occurrenceKey = `${baseId}_${eventDate}`

        if (seenOccurrenceKeys.has(occurrenceKey)) {
          continue
        }
        seenOccurrenceKeys.add(occurrenceKey)
      }
      deduped.push(ev)
    }

    return deduped
  }, [query.data, knownCalendarIds, visibleCalendarIds])

  return {
    ...query,
    data: filteredData,
  }
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

// ─── Toggle a calendar's quick toggle status on the main screen ──────────
export function useToggleQuickToggle() {
  const queryClient = useQueryClient()
  const { data: member } = useFamilyMember()

  return useMutation({
    mutationFn: async ({ id, is_quick_toggle }: { id: string; is_quick_toggle: boolean }) => {
      const { error } = await supabase
        .from('connected_calendars')
        .update({ is_quick_toggle })
        .eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, is_quick_toggle }) => {
      await queryClient.cancelQueries({ queryKey: ['connected-calendars', member?.family_id] })
      const prev = queryClient.getQueryData<ConnectedCalendar[]>(['connected-calendars', member?.family_id])
      queryClient.setQueryData<ConnectedCalendar[]>(
        ['connected-calendars', member?.family_id],
        (old) => old?.map((c) => (c.id === id ? { ...c, is_quick_toggle } : c)) ?? []
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
    mutationFn: async (variables: { timeMin?: string; timeMax?: string } | void) => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await supabase.functions.invoke('sync-calendars', {
        body: { ...variables, family_id: member?.family_id },
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

// ─── Update a connected calendar's default color ──────────────────────────
export function useUpdateCalendarColor() {
  const queryClient = useQueryClient()
  const { data: member } = useFamilyMember()

  return useMutation({
    mutationFn: async ({ id, color, calendar_id }: { id: string; color: string; calendar_id?: string }) => {
      const { error: calError } = await supabase
        .from('connected_calendars')
        .update({ color })
        .eq('id', id)
      if (calError) throw calError

      if (member?.family_id && calendar_id) {
        const { error: evError } = await supabase
          .from('calendar_events')
          .update({ color })
          .eq('family_id', member.family_id)
          .eq('source_calendar_id', calendar_id)
        if (evError) throw evError
      }
    },
    onMutate: async ({ id, color, calendar_id }) => {
      await queryClient.cancelQueries({ queryKey: ['connected-calendars', member?.family_id] })
      await queryClient.cancelQueries({ queryKey: ['calendar-events', member?.family_id] })

      const prevCals = queryClient.getQueryData<ConnectedCalendar[]>(['connected-calendars', member?.family_id])
      const prevEvents = queryClient.getQueryData<CalendarEvent[]>(['calendar-events', member?.family_id])

      queryClient.setQueryData<ConnectedCalendar[]>(
        ['connected-calendars', member?.family_id],
        (old) => old?.map((c) => (c.id === id ? { ...c, color } : c)) ?? []
      )

      if (calendar_id) {
        queryClient.setQueryData<CalendarEvent[]>(
          ['calendar-events', member?.family_id],
          (old) => old?.map((ev) => (ev.source_calendar_id === calendar_id ? { ...ev, color } : ev)) ?? []
        )
      }

      return { prevCals, prevEvents }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevCals) queryClient.setQueryData(['connected-calendars', member?.family_id], ctx.prevCals)
      if (ctx?.prevEvents) queryClient.setQueryData(['calendar-events', member?.family_id], ctx.prevEvents)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connected-calendars', member?.family_id] })
      queryClient.invalidateQueries({ queryKey: ['calendar-events', member?.family_id] })
    },
  })
}

// ─── Add a calendar via ICS/iCal URL ──────────────────────────────────────
export function useAddIcsCalendar() {
  const queryClient = useQueryClient()
  const { data: member } = useFamilyMember()

  return useMutation({
    mutationFn: async ({
      name,
      url,
      color,
      provider = 'outlook',
    }: {
      name: string
      url: string
      color: string
      provider?: 'outlook' | 'apple' | 'ical' | 'google'
    }) => {
      if (!member?.id) throw new Error('No family member profile found')
      
      const calendarId = `ics_${crypto.randomUUID()}`
      const { error } = await supabase.from('connected_calendars').insert({
        family_member_id: member.id,
        provider,
        calendar_id: calendarId,
        calendar_name: name,
        color,
        is_visible: true,
        ics_url: url,
      })
      if (error) throw error
      return calendarId
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connected-calendars', member?.family_id] })
    },
  })
}

// ─── Delete/Disconnect a connected calendar ───────────────────────────────
export function useDeleteConnectedCalendar() {
  const queryClient = useQueryClient()
  const { data: member } = useFamilyMember()

  return useMutation({
    mutationFn: async ({ id, calendar_id }: { id: string; calendar_id: string }) => {
      if (!member?.family_id) throw new Error('No family found')

      // 1. Delete events associated with this calendar first
      const { error: evError } = await supabase
        .from('calendar_events')
        .delete()
        .eq('family_id', member.family_id)
        .eq('source_calendar_id', calendar_id)
      if (evError) throw evError

      // 2. Delete the calendar connection
      const { error: calError } = await supabase
        .from('connected_calendars')
        .delete()
        .eq('id', id)
      if (calError) throw calError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connected-calendars', member?.family_id] })
      queryClient.invalidateQueries({ queryKey: ['calendar-events', member?.family_id] })
    },
  })
}

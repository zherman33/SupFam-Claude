import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useFamilyMember } from '@/features/auth/use-family-member'
import { useConnectedCalendars } from './use-calendar'

export interface EventWrite {
  id?: string              // present for update/delete
  title: string
  start: string            // ISO datetime or YYYY-MM-DD for all-day
  end: string
  all_day: boolean
  description?: string
  location?: string
  attendee_emails?: string[]
  timezone?: string
}

async function invokeWriteEvent(payload: {
  action: 'create' | 'update' | 'delete'
  family_member_id: string
  calendar_id: string
  event: EventWrite
}) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await supabase.functions.invoke('write-event', {
    body: payload,
    headers: session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {},
  })
  if (res.error) throw res.error
  if (res.data?.error) throw new Error(res.data.error)
  return res.data
}

export function useDefaultCalendar() {
  const { data: member } = useFamilyMember()
  const { data: calendars } = useConnectedCalendars()

  // Find the default calendar for the current user
  const myCalendars = calendars?.filter(
    c => c.family_member_id === member?.id && c.provider === 'google'
  ) ?? []

  const defaultCal = myCalendars.find(c => c.is_default) ?? myCalendars[0]
  return { defaultCal, myCalendars, member }
}

export function useCreateEvent() {
  const queryClient = useQueryClient()
  const { member } = useDefaultCalendar()

  return useMutation({
    mutationFn: async ({
      event,
      calendarId,
      familyMemberId,
    }: {
      event: EventWrite
      calendarId: string
      familyMemberId: string
    }) => {
      const result = await invokeWriteEvent({
        action: 'create',
        family_member_id: familyMemberId,
        calendar_id: calendarId,
        event,
      })
      // Trigger background sync
      const { data: { session } } = await supabase.auth.getSession()
      supabase.functions.invoke('sync-calendars', {
        body: { family_member_id: familyMemberId },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
      }).catch(console.error)
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events', member?.family_id] })
    },
  })
}

export function useUpdateEvent() {
  const queryClient = useQueryClient()
  const { member } = useDefaultCalendar()

  return useMutation({
    mutationFn: async ({
      event,
      calendarId,
      familyMemberId,
    }: {
      event: EventWrite
      calendarId: string
      familyMemberId: string
    }) => {
      const result = await invokeWriteEvent({
        action: 'update',
        family_member_id: familyMemberId,
        calendar_id: calendarId,
        event,
      })
      // Trigger background sync
      const { data: { session } } = await supabase.auth.getSession()
      supabase.functions.invoke('sync-calendars', {
        body: { family_member_id: familyMemberId },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
      }).catch(console.error)
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events', member?.family_id] })
    },
  })
}

export function useDeleteEvent() {
  const queryClient = useQueryClient()
  const { member } = useDefaultCalendar()

  return useMutation({
    mutationFn: async ({
      eventId,
      calendarId,
      familyMemberId,
    }: {
      eventId: string
      calendarId: string
      familyMemberId: string
    }) => {
      const deletePromise = invokeWriteEvent({
        action: 'delete',
        family_member_id: familyMemberId,
        calendar_id: calendarId,
        event: { id: eventId, title: '', start: '', end: '', all_day: false },
      })
      
      const localDeletePromise = supabase
        .from('calendar_events')
        .delete()
        .eq('external_event_id', eventId)

      const [result] = await Promise.all([deletePromise, localDeletePromise])

      // Trigger background sync
      const { data: { session } } = await supabase.auth.getSession()
      supabase.functions.invoke('sync-calendars', {
        body: { family_member_id: familyMemberId },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
      }).catch(console.error)

      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events', member?.family_id] })
    },
  })
}

export function useSetDefaultCalendar() {
  const queryClient = useQueryClient()
  const { member } = useDefaultCalendar()

  return useMutation({
    mutationFn: async ({ calendarId }: { calendarId: string }) => {
      if (!member?.id) return
      // Clear all defaults for this member then set new one
      await (supabase.from('connected_calendars') as any)
        .update({ is_default: false })
        .eq('family_member_id', member.id)
      await (supabase.from('connected_calendars') as any)
        .update({ is_default: true })
        .eq('family_member_id', member.id)
        .eq('calendar_id', calendarId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connected-calendars', member?.family_id] })
    },
  })
}

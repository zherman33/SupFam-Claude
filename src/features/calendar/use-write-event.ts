import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useFamilyMember } from '@/features/auth/use-family-member'
import { useConnectedCalendars, isReadOnlyCalendar } from './use-calendar'

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
  if (res.error) throw new Error(await describeFunctionError(res))
  if (res.data?.error) throw new Error(friendlyWriteError(String(res.data.error)))
  return res.data
}

/**
 * Extract the real error from a failed edge-function invocation.
 * supabase-js throws a generic "Edge Function returned a non-2xx status code",
 * but the function itself returns JSON { error: "..." } — surface that instead.
 */
async function describeFunctionError(res: { error: any; response?: Response }): Promise<string> {
  const fallback = res.error?.message || 'Something went wrong saving the event.'
  try {
    const body = res.response ? await res.response.json() : null
    if (body?.error) return friendlyWriteError(String(body.error))
  } catch {
    // Non-JSON error body — fall through to the generic message
  }
  return friendlyWriteError(fallback)
}

/** Turn terse function/Google errors into something actionable for the user. */
function friendlyWriteError(raw: string): string {
  if (/no token for member/i.test(raw))
    return 'Google needs to be reconnected for that family member — sign out and back in, then try again.'
  if (/google 404/i.test(raw))
    return "Google couldn't find that calendar or event — it may have been deleted, or the calendar is read-only."
  if (/google 403/i.test(raw))
    return 'Google refused the change (permission denied). Check that the calendar is writable and still shared with you.'
  if (/google 401/i.test(raw))
    return 'Google sign-in expired — sign out and back in, then try again.'
  if (/missing: action, family_member_id, calendar_id/i.test(raw))
    return 'No calendar was selected — pick a calendar and try again.'
  if (/event\.id required/i.test(raw))
    return "This event can't be saved back — it has no Google event ID (it may come from a read-only subscription)."
  return raw
}

export function useDefaultCalendar() {
  const { data: member } = useFamilyMember()
  const { data: calendars } = useConnectedCalendars()

  // Find the default calendar for the current user
  const myCalendars = calendars?.filter(
    c => c.family_member_id === member?.id && c.provider === 'google'
  ) ?? []

  // Never default to a read-only (ICS subscription) calendar — writes to it
  // would always fail. Fall back to the old behavior only if nothing writable exists.
  const writable = myCalendars.filter(c => !isReadOnlyCalendar(c))
  const pool = writable.length > 0 ? writable : myCalendars

  const defaultCal = pool.find(c => c.is_default) ?? pool[0]
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

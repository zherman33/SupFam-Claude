import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { useFamilyMember, useFamilyMembers } from '@/features/auth/use-family-member'
import { useConnectedCalendars, type CalendarEvent } from './use-calendar'
import {
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
  useSetDefaultCalendar,
  useDefaultCalendar,
} from './use-write-event'

interface EventFormProps {
  // New event: pass initialDate
  initialDate?: Date
  // Edit mode: pass existing event
  event?: CalendarEvent
  onClose: () => void
}

export function EventForm({ initialDate, event, onClose }: EventFormProps) {
  const isEdit = !!event
  const { data: member } = useFamilyMember()
  const { data: familyMembers } = useFamilyMembers()
  const { data: calendars } = useConnectedCalendars()
  const { defaultCal } = useDefaultCalendar()
  const setDefault = useSetDefaultCalendar()
  const createEvent = useCreateEvent()
  const updateEvent = useUpdateEvent()
  const deleteEvent = useDeleteEvent()

  // ── Form state ─────────────────────────────────────────────────────────
  const [title, setTitle] = useState(event?.title ?? '')
  const [allDay, setAllDay] = useState(event?.all_day ?? true)
  const [startDate, setStartDate] = useState(
    event ? event.start_at.slice(0, 10)
    : initialDate ? format(initialDate, 'yyyy-MM-dd')
    : format(new Date(), 'yyyy-MM-dd')
  )
  const [startTime, setStartTime] = useState(
    event && !event.all_day ? format(parseISO(event.start_at), 'HH:mm') : '09:00'
  )
  const [endDate, setEndDate] = useState(
    event?.end_at ? event.end_at.slice(0, 10) : startDate
  )
  const [endTime, setEndTime] = useState(
    event?.end_at && !event.all_day ? format(parseISO(event.end_at), 'HH:mm') : '10:00'
  )
  const [description, setDescription] = useState(event?.description ?? '')
  const [location, setLocation] = useState(event?.location ?? '')

  // Calendar to save to — default to user's default calendar
  // For edits, use the source calendar of the event
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>(
    event?.source_calendar_id ?? defaultCal?.calendar_id ?? ''
  )
  // Which family member owns the selected calendar
  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    event ? (calendars?.find(c => c.calendar_id === event.source_calendar_id)?.family_member_id ?? member?.id ?? '')
    : member?.id ?? ''
  )

  // Attendees — pre-populate from existing event if editing
  const [attendeeEmails, setAttendeeEmails] = useState<Set<string>>(new Set())

  // Update selectedCalendarId when defaultCal loads
  useEffect(() => {
    if (!isEdit && defaultCal && !selectedCalendarId) {
      setSelectedCalendarId(defaultCal.calendar_id)
    }
  }, [defaultCal, isEdit, selectedCalendarId])

  // Toggle an attendee email
  const toggleAttendee = (email: string) => {
    setAttendeeEmails(prev => {
      const next = new Set(prev)
      if (next.has(email)) next.delete(email)
      else next.add(email)
      return next
    })
  }

  // Get email for a family member
  const getMemberEmail = (memberId: string) => {
    const cal = calendars?.find(
      c => c.family_member_id === memberId && c.calendar_id.includes('@')
    )
    return cal?.calendar_id ?? null
  }

  const isPending = createEvent.isPending || updateEvent.isPending || deleteEvent.isPending

  const buildEventPayload = () => {
    const start = allDay ? startDate : `${startDate}T${startTime}:00`
    const end = allDay ? endDate : `${endDate}T${endTime}:00`
    return {
      id: event?.external_event_id ?? undefined,
      title,
      start,
      end,
      all_day: allDay,
      description: description || undefined,
      location: location || undefined,
      attendee_emails: attendeeEmails.size > 0 ? Array.from(attendeeEmails) : undefined,
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !selectedCalendarId || !selectedMemberId) return

    const payload = {
      event: buildEventPayload(),
      calendarId: selectedCalendarId,
      familyMemberId: selectedMemberId,
    }

    if (isEdit) {
      await updateEvent.mutateAsync(payload)
    } else {
      await createEvent.mutateAsync(payload)
    }
    onClose()
  }

  const handleDelete = async () => {
    if (!event?.external_event_id || !selectedCalendarId || !selectedMemberId) return
    if (!confirm('Delete this event?')) return
    await deleteEvent.mutateAsync({
      eventId: event.external_event_id,
      calendarId: selectedCalendarId,
      familyMemberId: selectedMemberId,
    })
    onClose()
  }

  // All calendars grouped by owner name for the calendar picker
  const calsByMember = new Map<string, typeof calendars>()
  for (const cal of calendars ?? []) {
    if (cal.calendar_name?.toLowerCase().includes('holiday')) continue
    const ownerName = (cal.owner as any)?.display_name ?? 'Unknown'
    if (!calsByMember.has(ownerName)) calsByMember.set(ownerName, [])
    calsByMember.get(ownerName)!.push(cal)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-brown-900/30 backdrop-blur-sm" onClick={onClose}/>

      {/* Sheet */}
      <div className="relative z-10 w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-sand-100 flex-shrink-0">
          <h2 className="font-semibold text-brown-800 text-base">
            {isEdit ? 'Edit event' : 'New event'}
          </h2>
          <div className="flex items-center gap-2">
            {isEdit && (
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="rounded-xl px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
              >
                Delete
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-brown-700/40 hover:bg-sand-100 transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-5 py-4 space-y-4">

            {/* Title */}
            <input
              autoFocus
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Event title"
              className="w-full text-lg font-semibold text-brown-800 placeholder:text-brown-700/30 focus:outline-none border-b border-sand-200 pb-2"
            />

            {/* All-day toggle */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setAllDay(v => !v)}
                className={`relative h-6 w-11 rounded-full transition-colors flex-shrink-0 ${allDay ? 'bg-terracotta-500' : 'bg-sand-300'}`}
              >
                <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${allDay ? 'translate-x-5' : 'translate-x-0'}`}/>
              </button>
              <span className="text-sm text-brown-700">All day</span>
            </div>

            {/* Date/time pickers */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-brown-700/60">
                  {allDay ? 'Start date' : 'Start'}
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-sand-200 bg-cream-50 px-3 py-2 text-sm text-brown-800 focus:border-terracotta-500 focus:outline-none [color-scheme:light]"
                />
                {!allDay && (
                  <input
                    type="time"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    className="w-full rounded-xl border border-sand-200 bg-cream-50 px-3 py-2 text-sm text-brown-800 focus:border-terracotta-500 focus:outline-none [color-scheme:light]"
                  />
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-brown-700/60">
                  {allDay ? 'End date' : 'End'}
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full rounded-xl border border-sand-200 bg-cream-50 px-3 py-2 text-sm text-brown-800 focus:border-terracotta-500 focus:outline-none [color-scheme:light]"
                />
                {!allDay && (
                  <input
                    type="time"
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                    className="w-full rounded-xl border border-sand-200 bg-cream-50 px-3 py-2 text-sm text-brown-800 focus:border-terracotta-500 focus:outline-none [color-scheme:light]"
                  />
                )}
              </div>
            </div>

            {/* Location */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brown-700/60">Location</label>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="Add location"
                className="w-full rounded-xl border border-sand-200 bg-cream-50 px-3 py-2 text-sm text-brown-800 placeholder:text-brown-700/30 focus:border-terracotta-500 focus:outline-none"
              />
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brown-700/60">Notes</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Add notes"
                rows={2}
                className="w-full rounded-xl border border-sand-200 bg-cream-50 px-3 py-2 text-sm text-brown-800 placeholder:text-brown-700/30 focus:border-terracotta-500 focus:outline-none resize-none"
              />
            </div>

            {/* Calendar picker */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-brown-700/60">Save to calendar</label>
              <div className="space-y-1">
                {Array.from(calsByMember.entries()).map(([ownerName, cals]) => (
                  <div key={ownerName}>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-brown-700/40 px-1 mb-1">
                      {ownerName}
                    </p>
                    {cals!.map(cal => {
                      const isSelected = selectedCalendarId === cal.calendar_id
                      return (
                        <label
                          key={cal.id}
                          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer transition-colors ${
                            isSelected ? 'bg-cream-100' : 'hover:bg-cream-50'
                          }`}
                          onClick={() => { setSelectedCalendarId(cal.calendar_id); setSelectedMemberId(cal.family_member_id) }}
                        >
                          <div
                            className="h-4 w-4 rounded flex-shrink-0 flex items-center justify-center"
                            style={{ backgroundColor: cal.color ?? '#5B7FB5' }}
                          >
                            {isSelected && (
                              <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 10" fill="none">
                                <path d="M2 5l2.5 2.5 3.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </div>
                          <span className="text-sm text-brown-800 flex-1">{cal.calendar_name}</span>
                          {cal.is_default && (
                            <span className="text-[11px] text-brown-700/40 bg-sand-100 rounded px-1.5 py-0.5">default</span>
                          )}
                          {!cal.is_default && isSelected && (
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); setDefault.mutate({ calendarId: cal.calendar_id }) }}
                              className="text-[11px] text-terracotta-500 hover:text-terracotta-600"
                            >
                              Set default
                            </button>
                          )}
                        </label>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Family attendees */}
            {familyMembers && familyMembers.length > 1 && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-brown-700/60">Invite family</label>
                <div className="flex flex-wrap gap-2">
                  {familyMembers
                    .filter(m => m.id !== selectedMemberId)
                    .map(m => {
                      const email = getMemberEmail(m.id)
                      if (!email) return null
                      const isAdded = attendeeEmails.has(email)
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => toggleAttendee(email)}
                          className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors border ${
                            isAdded
                              ? 'border-transparent text-white'
                              : 'border-sand-200 text-brown-700 hover:bg-cream-100'
                          }`}
                          style={isAdded ? { backgroundColor: m.avatar_color ?? '#5B7FB5', borderColor: m.avatar_color ?? '#5B7FB5' } : {}}
                        >
                          <div
                            className="h-5 w-5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: m.avatar_color ?? '#5B7FB5', opacity: isAdded ? 1 : 0.6 }}
                          />
                          {m.display_name}
                          {isAdded && (
                            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6l2.5 2.5 5.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </button>
                      )
                    })}
                </div>
              </div>
            )}

          </div>

          {/* Submit */}
          <div className="px-5 pb-6 pt-2 flex-shrink-0 border-t border-sand-100 bg-white">
            <button
              type="submit"
              disabled={!title.trim() || !selectedCalendarId || isPending}
              className="w-full rounded-2xl bg-brown-800 py-4 text-base font-semibold text-cream-50 disabled:opacity-40 hover:bg-brown-900 transition-colors"
            >
              {isPending ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save changes' : 'Create event')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

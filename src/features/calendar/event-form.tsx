import { useState, useEffect, useRef, useMemo } from 'react'
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isSameDay,
  parse,
} from 'date-fns'
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
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState(event?.title ?? '')
  const [allDay, setAllDay] = useState(event?.all_day ?? false)
  const [startDate, setStartDate] = useState(
    event ? (event.all_day ? event.start_at.slice(0, 10) : format(parseISO(event.start_at), 'yyyy-MM-dd'))
    : initialDate ? format(initialDate, 'yyyy-MM-dd')
    : format(new Date(), 'yyyy-MM-dd')
  )
  const [startTime, setStartTime] = useState(
    event && !event.all_day ? format(parseISO(event.start_at), 'HH:mm') : '09:00'
  )
  const [endDate, setEndDate] = useState(
    event?.end_at ? (event.all_day ? event.end_at.slice(0, 10) : format(parseISO(event.end_at), 'yyyy-MM-dd')) : startDate
  )
  const [endTime, setEndTime] = useState(
    event?.end_at && !event.all_day ? format(parseISO(event.end_at), 'HH:mm') : '10:00'
  )
  const [description, setDescription] = useState(event?.description ?? '')
  const [location, setLocation] = useState(event?.location ?? '')

  // Google Places Autocomplete integration
  const [mapsLoaded, setMapsLoaded] = useState(false)
  const locationInputRef = useRef<HTMLInputElement>(null)
  const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

  useEffect(() => {
    if (!googleApiKey) return

    // If script is already in the document, wait for it or just set true
    if ((window as any).google?.maps?.places) {
      setMapsLoaded(true)
      return
    }

    const existingScript = document.getElementById('google-maps-places-script')
    if (existingScript) {
      const handleLoad = () => setMapsLoaded(true)
      existingScript.addEventListener('load', handleLoad)
      return () => {
        existingScript.removeEventListener('load', handleLoad)
      }
    }

    const script = document.createElement('script')
    script.id = 'google-maps-places-script'
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleApiKey}&libraries=places`
    script.async = true
    script.defer = true
    script.onload = () => setMapsLoaded(true)
    document.head.appendChild(script)
  }, [googleApiKey])

  useEffect(() => {
    if (!mapsLoaded || !locationInputRef.current || !(window as any).google?.maps?.places) return

    const autocomplete = new (window as any).google.maps.places.Autocomplete(locationInputRef.current, {
      types: ['geocode', 'establishment'],
    })

    const listener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      const formattedAddress = place.formatted_address || place.name || ''
      setLocation(formattedAddress)
    })

    // Prevent submitting the form when pressing 'Enter' in the autocomplete list
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        const pacContainer = document.querySelector('.pac-container')
        if (pacContainer && window.getComputedStyle(pacContainer).display !== 'none') {
          e.preventDefault()
        }
      }
    }

    const inputElement = locationInputRef.current
    inputElement.addEventListener('keydown', handleKeyDown)

    return () => {
      if ((window as any).google?.maps?.event && listener) {
        (window as any).google.maps.event.removeListener(listener)
      }
      inputElement.removeEventListener('keydown', handleKeyDown)
    }
  }, [mapsLoaded])

  // Calendar to save to — default to user's default calendar (connected_calendars UUID)
  // For edits, use the source calendar of the event
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>(() => {
    if (event && calendars) {
      const cal = calendars.find(c => 
        c.calendar_id === event.source_calendar_id && 
        c.family_member_id === event.created_by
      )
      if (cal) return cal.id
    }
    return defaultCal?.id ?? ''
  })
  
  // Which family member owns the selected calendar
  const selectedMemberId = useMemo(() => {
    if (calendars && selectedCalendarId) {
      const cal = calendars.find(c => c.id === selectedCalendarId)
      if (cal) return cal.family_member_id
    }
    return member?.id ?? ''
  }, [calendars, selectedCalendarId, member?.id])

  // Attendees — pre-populate from existing event if editing
  const [attendeeEmails, setAttendeeEmails] = useState<Set<string>>(new Set())

  // Update selectedCalendarId when defaultCal or calendars load
  useEffect(() => {
    if (!selectedCalendarId && calendars) {
      if (isEdit && event) {
        const cal = calendars.find(c => 
          c.calendar_id === event.source_calendar_id && 
          c.family_member_id === event.created_by
        )
        if (cal) setSelectedCalendarId(cal.id)
      } else if (defaultCal) {
        setSelectedCalendarId(defaultCal.id)
      }
    }
  }, [defaultCal, calendars, isEdit, event, selectedCalendarId])

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
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !selectedCalendarId || !selectedMemberId) return
    setError(null)

    const selectedCal = calendars?.find(c => c.id === selectedCalendarId)
    const payload = {
      event: buildEventPayload(),
      calendarId: selectedCal?.calendar_id ?? '',
      familyMemberId: selectedMemberId,
    }

    try {
      if (isEdit) {
        await updateEvent.mutateAsync(payload)
      } else {
        await createEvent.mutateAsync(payload)
      }
      onClose()
    } catch (err: any) {
      console.error('Error saving event:', err)
      setError(err?.message || "Hmm, that didn't work — try again?")
    }
  }

  const handleDelete = async () => {
    if (!event?.external_event_id || !selectedCalendarId || !selectedMemberId) return
    if (!confirm('Delete this event?')) return
    const selectedCal = calendars?.find(c => c.id === selectedCalendarId)
    await deleteEvent.mutateAsync({
      eventId: event.external_event_id,
      calendarId: selectedCal?.calendar_id ?? '',
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
      <div className="relative z-10 w-full max-w-lg short-modal-container bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
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
          <div className="px-5 py-4 space-y-4 short-form-grid">
            
            {/* Left Column */}
            <div className="space-y-4">
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
              <div className="space-y-3">
                {/* Start Date & Time */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <span className="text-xs font-semibold text-brown-700/60 sm:w-12 flex-shrink-0">
                    Start
                  </span>
                  <div className="flex items-center gap-2 flex-1">
                    <CustomDatePicker
                      value={startDate}
                      onChange={val => {
                        setStartDate(val)
                        if (val > endDate) {
                          setEndDate(val)
                        }
                      }}
                    />
                    {!allDay && (
                      <CustomTimePicker
                        value={startTime}
                        onChange={setStartTime}
                      />
                    )}
                  </div>
                </div>

                {/* End Date & Time */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <span className="text-xs font-semibold text-brown-700/60 sm:w-12 flex-shrink-0">
                    End
                  </span>
                  <div className="flex items-center gap-2 flex-1">
                    <CustomDatePicker
                      value={endDate}
                      onChange={setEndDate}
                    />
                    {!allDay && (
                      <CustomTimePicker
                        value={endTime}
                        onChange={setEndTime}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-brown-700/60">Location</label>
                <input
                  ref={locationInputRef}
                  type="text"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="Add location"
                  className="w-full rounded-xl border border-sand-200 bg-cream-50 px-3 py-2 text-sm text-brown-800 placeholder:text-brown-700/30 focus:border-terracotta-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
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
                            onClick={() => { setSelectedCalendarId(cal.calendar_id) }}
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

          </div>

          {/* Error Message */}
          {error && (
            <div className="px-5 py-2.5 text-xs font-semibold text-red-600 bg-red-50 border-t border-b border-red-100 flex-shrink-0">
              {error}
            </div>
          )}

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

function CustomDatePicker({
  value,
  onChange,
  className = "",
}: {
  value: string // 'yyyy-MM-dd'
  onChange: (val: string) => void
  className?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(() => {
    return value ? parseISO(value) : new Date()
  })
  const popoverRef = useRef<HTMLDivElement>(null)

  // Parse current value
  const selectedDate = value ? parseISO(value) : new Date()

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  // Calendar calculations
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart)
  const endDate = endOfWeek(monthEnd)

  const days = eachDayOfInterval({ start: startDate, end: endDate })

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))

  return (
    <div className="relative flex-1" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 rounded-xl border border-sand-200 bg-cream-50 px-3 py-2 text-sm text-brown-800 hover:bg-cream-100 transition-colors focus:border-terracotta-500 focus:outline-none ${className}`}
      >
        <span>{format(selectedDate, "MMM d, yyyy")}</span>
        <svg className="h-4 w-4 text-brown-700/40" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="4" width="14" height="14" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" />
          <line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round" />
          <line x1="3" y1="10" x2="17" y2="10" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1.5 z-[100] w-64 rounded-2xl border border-sand-200 bg-white p-3 shadow-xl animate-in fade-in zoom-in-95 duration-100">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 rounded-lg text-brown-700/60 hover:bg-cream-100 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-xs font-semibold text-brown-800">
              {format(currentMonth, "MMMM yyyy")}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1 rounded-lg text-brown-700/60 hover:bg-cream-100 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Day Names */}
          <div className="grid grid-cols-7 gap-px text-center mb-1">
            {["S", "M", "T", "W", "T", "F", "S"].map((day, idx) => (
              <span key={idx} className="text-[10px] font-bold text-brown-700/40">
                {day}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, dayIdx) => {
              const isSelected = isSameDay(day, selectedDate)
              const isCurrentMonth = day.getMonth() === currentMonth.getMonth()
              return (
                <button
                  key={dayIdx}
                  type="button"
                  onClick={() => {
                    onChange(format(day, "yyyy-MM-dd"))
                    setIsOpen(false)
                  }}
                  className={`h-7 w-7 text-xs rounded-full flex items-center justify-center font-medium transition-colors ${
                    isSelected
                      ? "bg-terracotta-500 text-white"
                      : isCurrentMonth
                      ? "text-brown-800 hover:bg-cream-100"
                      : "text-brown-700/25 hover:bg-cream-50"
                  }`}
                >
                  {format(day, "d")}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function CustomTimePicker({
  value,
  onChange,
  className = "",
}: {
  value: string // 'HH:mm'
  onChange: (val: string) => void
  className?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Generate list of 30-minute interval times
  const times = useMemo(() => {
    const list = []
    for (let h = 0; h < 24; h++) {
      for (const m of ["00", "30"]) {
        const hh = h.toString().padStart(2, "0")
        const timeStr = `${hh}:${m}`
        // Format for display
        const displayStr = format(parse(`${hh}:${m}`, "HH:mm", new Date()), "h:mm a")
        list.push({ value: timeStr, display: displayStr })
      }
    }
    return list
  }, [])

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  // Get current display string
  const activeDisplay = useMemo(() => {
    try {
      return format(parse(value, "HH:mm", new Date()), "h:mm a")
    } catch {
      return value
    }
  }, [value])

  return (
    <div className="relative w-28" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-1 rounded-xl border border-sand-200 bg-cream-50 px-3 py-2 text-sm text-brown-800 hover:bg-cream-100 transition-colors focus:border-terracotta-500 focus:outline-none ${className}`}
      >
        <span>{activeDisplay}</span>
        <svg className="h-4 w-4 text-brown-700/40" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="10" cy="10" r="7" />
          <polyline points="10 6 10 10 13 10" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1.5 z-[100] w-36 rounded-2xl border border-sand-200 bg-white shadow-xl max-h-48 overflow-y-auto p-1.5 animate-in fade-in zoom-in-95 duration-100 scrollbar-hide">
          {times.map((t) => {
            const isSelected = t.value === value
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  onChange(t.value)
                  setIsOpen(false)
                }}
                className={`w-full text-left px-3 py-1.5 text-xs rounded-xl font-medium transition-colors ${
                  isSelected
                    ? "bg-terracotta-500 text-white"
                    : "text-brown-800 hover:bg-cream-100"
                }`}
              >
                {t.display}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

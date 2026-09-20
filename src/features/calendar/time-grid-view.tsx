import { useEffect, useRef, useMemo, useCallback } from 'react'
import { format, isToday, parseISO } from 'date-fns'
import { useConnectedCalendars, type CalendarEvent } from './use-calendar'
import { useEventColorRules, applyColorRules } from '@/features/settings/use-event-color-rules'
import { getEventThemeStyles } from '@/features/settings/theme-context'

interface TimeGridViewProps {
  weeks: Date[][]
  activeWeekIdx?: number
  onWeekChange?: (index: number) => void
  events: CalendarEvent[]
  onEventClick?: (ev: CalendarEvent) => void
  onCellClick?: (day: Date) => void
}

function formatTimeShort(dateStr: string): string {
  return format(parseISO(dateStr), 'h:mma')
    .replace(':00', '')
    .toLowerCase()
    .replace('am', 'a')
    .replace('pm', 'p')
}

function formatTimeRange(startStr: string, endStr: string | null): string {
  if (!endStr) return formatTimeShort(startStr)
  return `${formatTimeShort(startStr)}\u2013${formatTimeShort(endStr)}`
}

export function TimeGridView({
  weeks,
  activeWeekIdx = 0,
  onWeekChange,
  events,
  onEventClick,
  onCellClick,
}: TimeGridViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeWeekIdxRef = useRef(activeWeekIdx)
  const isProgrammaticScrollRef = useRef(false)

  // Finger-drag state for the week pager.
  //
  // Why manual, and why raw Touch Events: on iOS a touch gesture latches to
  // the first (inner) scroller it hits — the day columns' vertical event
  // lists. iOS decides asynchronously: a few moves come through, then it
  // claims the gesture (pointercancel) and the page snaps back — the "moves
  // a little but doesn't work" symptom. The fix is a non-passive touchmove
  // listener: once the gesture is clearly horizontal we preventDefault(),
  // which stops iOS from ever claiming it as a native scroll. Vertical pans
  // are never prevented, so day-column scrolling stays native. (React's
  // synthetic onTouchMove is passive, so these listeners are attached
  // natively with { passive: false } in the effect below.)
  const suppressClickRef = useRef(false)

  const { data: colorRules } = useEventColorRules()
  const { data: calendars } = useConnectedCalendars()

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    const addEvToMap = (key: string, ev: CalendarEvent) => {
      if (!map.has(key)) map.set(key, [])
      if (!map.get(key)!.find(e => e.id === ev.id)) {
        map.get(key)!.push(ev)
      }
    }

    for (const ev of events) {
      if (ev.all_day) {
        const startKey = ev.start_at.slice(0, 10)
        const endKey = ev.end_at ? ev.end_at.slice(0, 10) : startKey
        let cur = startKey
        while (cur < endKey) {
          addEvToMap(cur, ev)
          const d = new Date(cur + 'T00:00:00')
          d.setDate(d.getDate() + 1)
          cur = format(d, 'yyyy-MM-dd')
        }
        if (startKey === endKey) addEvToMap(startKey, ev)
      } else {
        addEvToMap(format(parseISO(ev.start_at), 'yyyy-MM-dd'), ev)
      }
    }
    return map
  }, [events])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const timer = setTimeout(() => {
      if (!scrollRef.current) return
      const weekWidth = scrollRef.current.clientWidth
      if (weekWidth > 0) {
        scrollRef.current.scrollLeft = activeWeekIdx * weekWidth
        activeWeekIdxRef.current = activeWeekIdx
      }
    }, 40)

    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    if (activeWeekIdxRef.current !== activeWeekIdx) {
      activeWeekIdxRef.current = activeWeekIdx
      const weekWidth = el.clientWidth
      if (weekWidth > 0) {
        const targetLeft = activeWeekIdx * weekWidth
        if (Math.abs(el.scrollLeft - targetLeft) > 5) {
          isProgrammaticScrollRef.current = true
          el.scrollTo({ left: targetLeft, behavior: 'smooth' })
          const resetTimer = setTimeout(() => {
            isProgrammaticScrollRef.current = false
          }, 350)
          return () => clearTimeout(resetTimer)
        }
      }
    }
  }, [activeWeekIdx])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return

    const weekWidth = el.clientWidth
    if (weekWidth <= 0) return

    if (!isProgrammaticScrollRef.current) {
      const newIdx = Math.round(el.scrollLeft / weekWidth)
      if (newIdx >= 0 && newIdx < weeks.length && newIdx !== activeWeekIdxRef.current) {
        activeWeekIdxRef.current = newIdx
        onWeekChange?.(newIdx)
      }
    }
  }, [weeks.length, onWeekChange])

  // ── Finger-drag paging (raw Touch Events; see note at the top) ──────────

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    let drag: {
      id: number
      startX: number
      startY: number
      startScrollLeft: number
      claimed: boolean // horizontal — we own it
      dead: boolean // vertical — native scroll owns it
      movedFar: boolean
      lastX: number
      lastT: number
      velocity: number // px/ms of scrollLeft; positive = heading to next week
    } | null = null

    const onTouchStart = (e: TouchEvent) => {
      if (drag || e.touches.length !== 1) return
      const t = e.touches[0]
      drag = {
        id: t.identifier,
        startX: t.clientX,
        startY: t.clientY,
        startScrollLeft: el.scrollLeft,
        claimed: false,
        dead: false,
        movedFar: false,
        lastX: t.clientX,
        lastT: performance.now(),
        velocity: 0,
      }
    }

    const findTouch = (e: TouchEvent): Touch | null => {
      if (!drag) return null
      const all = [...e.touches, ...e.changedTouches]
      return all.find(t => t.identifier === drag!.id) ?? null
    }

    const onTouchMove = (e: TouchEvent) => {
      const t = findTouch(e)
      if (!t || !drag || drag.dead) return
      const dx = t.clientX - drag.startX
      const dy = t.clientY - drag.startY

      if (!drag.claimed) {
        // Claim the gesture only once it's clearly horizontal — taps and
        // vertical pans stay native and untouched.
        if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
          drag.claimed = true
          el.style.scrollSnapType = 'none'
        } else if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
          // Clearly vertical: hand the gesture back; native scroll owns it.
          drag.dead = true
          return
        } else {
          return
        }
      }

      // Claimed: preventDefault() stops iOS from hijacking the gesture as a
      // native scroll (which would cancel us mid-drag and snap back).
      if (e.cancelable) e.preventDefault()
      const now = performance.now()
      const dt = Math.max(1, now - drag.lastT)
      // scrollLeft grows as the finger moves left (toward the next week).
      drag.velocity = -((t.clientX - drag.lastX) / dt)
      drag.lastX = t.clientX
      drag.lastT = now
      if (Math.abs(dx) > 8) drag.movedFar = true
      el.scrollLeft = drag.startScrollLeft - dx
    }

    const endTouch = (cancelled: boolean) => {
      const d = drag
      drag = null
      el.style.scrollSnapType = ''
      if (!d || d.dead || !d.claimed) return

      const weekWidth = el.clientWidth
      if (weekWidth <= 0) return
      let target = Math.round(el.scrollLeft / weekWidth)
      // Fast flick: carry into the neighboring week even before halfway.
      if (!cancelled && Math.abs(d.velocity) > 0.6) {
        target += d.velocity > 0 ? 1 : -1
      }
      target = Math.max(0, Math.min(weeks.length - 1, target))

      if (d.movedFar) {
        // Swallow the click that follows a drag so a swipe never opens
        // the event form. The timeout is a backstop in case no click fires.
        suppressClickRef.current = true
        setTimeout(() => {
          suppressClickRef.current = false
        }, 350)
      }

      // Commit the target week immediately so the header label updates
      // without waiting for the snap animation. The [activeWeekIdx] effect
      // no-ops because the ref already matches.
      if (activeWeekIdxRef.current !== target) {
        activeWeekIdxRef.current = target
        onWeekChange?.(target)
      }
      const targetLeft = target * weekWidth
      if (Math.abs(el.scrollLeft - targetLeft) > 2) {
        isProgrammaticScrollRef.current = true
        el.scrollTo({ left: targetLeft, behavior: 'smooth' })
        setTimeout(() => {
          isProgrammaticScrollRef.current = false
        }, 450)
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (findTouch(e)) endTouch(false)
    }
    const onTouchCancel = () => endTouch(true)

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchCancel)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchCancel)
    }
  }, [weeks.length, onWeekChange])

  // Capture-phase: runs before day/event click handlers, so a swipe that
  // ends over an event or day cell can't trigger its tap action.
  const onClickCapture = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      e.stopPropagation()
      e.preventDefault()
    }
  }, [])

  return (
    <div className="flex h-full flex-col select-none overflow-hidden bg-white relative">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onClickCapture={onClickCapture}
        className="flex-1 overflow-x-auto flex relative scrollbar-hide"
        style={{
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          overscrollBehaviorX: 'contain',
          // Native horizontal panning is disabled so our pointer-drag owns
          // week changes (iOS latches touches to the inner vertical event
          // lists otherwise). Vertical day scrolling stays native.
          touchAction: 'pan-y',
        }}
      >
        {weeks.map((week, wi) => (
          <div
            key={`week-${wi}`}
            className="w-full min-w-full flex-shrink-0 grid grid-cols-7 divide-x divide-sand-200 h-full"
            style={{ scrollSnapAlign: 'start' }}
          >
            {week.map((day) => {
              const key = format(day, 'yyyy-MM-dd')
              const isCurrentDay = isToday(day)
              const dayEvents = eventsByDate.get(key) ?? []

              const dayAllDay = dayEvents.filter(e => e.all_day)
              const birthdayEvents = dayAllDay.filter(isBirthdayEvent)
              const otherAllDay = dayAllDay.filter(ev => !isBirthdayEvent(ev))

              const nonAllDay = dayEvents.filter(e => !e.all_day)
              nonAllDay.sort((a, b) => a.start_at.localeCompare(b.start_at))

              return (
                <div
                  key={`day-${key}`}
                  onClick={() => onCellClick?.(day)}
                  className={`flex flex-col h-full relative cursor-pointer min-h-0 ${
                    isCurrentDay ? 'bg-terracotta-500/[0.015]' : 'bg-white'
                  }`}
                >
                  <div
                    className={`text-center py-2 flex flex-col items-center gap-0.5 border-b border-sand-200 flex-shrink-0 ${
                      isCurrentDay ? 'bg-terracotta-50/60 text-terracotta-500' : 'bg-cream-50/50 text-brown-700/60'
                    }`}
                  >
                    <span className={`text-[11px] font-semibold uppercase tracking-wider ${
                      isCurrentDay ? 'text-terracotta-500' : 'text-brown-700/50'
                    }`}>
                      {format(day, 'EEE')}
                    </span>
                    {isCurrentDay ? (
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-terracotta-500 text-white text-sm font-bold leading-none shadow-sm">
                        {format(day, 'd')}
                      </span>
                    ) : (
                      <span className="text-base font-bold text-brown-800">
                        {format(day, 'd')}
                      </span>
                    )}
                    {isCurrentDay && (
                      <span className="rounded-full bg-terracotta-500 px-2 py-px text-[9px] font-bold uppercase tracking-widest text-white">
                        Today
                      </span>
                    )}
                  </div>

                  {isCurrentDay && (
                    <div className="absolute inset-y-0 inset-x-0 border-x-2 border-terracotta-500/30 bg-terracotta-500/[0.015] pointer-events-none z-10" />
                  )}

                  <div className="flex-1 flex flex-col gap-1.5 p-1.5 overflow-y-auto scrollbar-hide z-20 min-h-0">
                    {birthdayEvents.length > 0 && (
                      <BirthdayGroupPill
                        events={birthdayEvents}
                        colorRules={colorRules}
                        calendars={calendars}
                        onClickEvent={onEventClick}
                      />
                    )}
                    {otherAllDay.map((ev) => {
                      const calendar = calendars?.find(c => 
                        c.calendar_id === ev.source_calendar_id && 
                        (!ev.created_by || c.family_member_id === ev.created_by)
                      )
                      const calendarColor = calendar?.color
                      const ruleColor = applyColorRules(ev.title, colorRules)
                      const color = ruleColor ?? calendarColor ?? ev.color ?? '#5B7FB5'
                      const styles = getEventThemeStyles(color)
                      return (
                        <div
                          key={ev.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            onEventClick?.(ev)
                          }}
                          className="rounded-md px-2.5 py-1.5 text-[13.5px] font-bold truncate cursor-pointer hover:brightness-95 active:brightness-90 transition-all shrink-0"
                          style={{
                            backgroundColor: styles.backgroundColor,
                            color: styles.textColor,
                            borderLeft: `4px solid ${styles.borderColor}`,
                          }}
                          title={ev.title}
                        >
                          {ev.title}
                        </div>
                      )
                    })}

                    {nonAllDay.map((ev) => {
                      const calendar = calendars?.find(c => 
                        c.calendar_id === ev.source_calendar_id && 
                        (!ev.created_by || c.family_member_id === ev.created_by)
                      )
                      const calendarColor = calendar?.color
                      const ruleColor = applyColorRules(ev.title, colorRules)
                      const color = ruleColor ?? calendarColor ?? ev.color ?? '#5B7FB5'
                      const styles = getEventThemeStyles(color)

                      return (
                        <div
                          key={ev.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            onEventClick?.(ev)
                          }}
                          className="rounded-md px-2.5 py-2 flex flex-col hover:brightness-95 active:brightness-90 transition-all select-none border-l-[4px] shadow-[0_1px_2px_rgba(0,0,0,0.02)] shrink-0 min-h-[50px]"
                          style={{
                            background: styles.backgroundGradient,
                            borderLeftColor: styles.borderColor,
                          }}
                          title={`${ev.title} (${formatTimeRange(ev.start_at, ev.end_at)})`}
                        >
                          <p className="font-bold text-[13.5px] leading-snug line-clamp-2 break-words" style={{ color: styles.textColor }}>
                            {ev.title}
                          </p>
                          <p className="text-[10px] font-semibold opacity-70 leading-none mt-1" style={{ color: styles.textColor }}>
                            {formatTimeRange(ev.start_at, ev.end_at)}
                          </p>
                          {ev.location && (
                            <p className="text-[10px] truncate opacity-70 mt-1 flex items-center gap-0.5" style={{ color: styles.textColor }}>
                              <span className="text-[11px]">📍</span>
                              <span className="truncate">{ev.location}</span>
                            </p>
                          )}
                        </div>
                      )
                    })}

                    {dayEvents.length === 0 && (
                      <div className="flex-1 flex items-center justify-center py-4">
                        <span className="text-xs text-brown-700/20 font-medium select-none">No events</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function isBirthdayEvent(ev: CalendarEvent): boolean {
  return (
    ev.title.toLowerCase().includes('birthday') ||
    !!ev.source_calendar_id?.includes('#contacts')
  )
}

function extractBirthdayName(title: string): string {
  return title
    .replace(/'s\s+birthday/i, '')
    .replace(/\s+birthday/i, '')
    .trim() || title
}

function BirthdayGroupPill({
  events,
  colorRules,
  calendars,
  onClickEvent,
}: {
  events: CalendarEvent[]
  colorRules?: import('@/features/settings/use-event-color-rules').EventColorRule[]
  calendars?: import('./use-calendar').ConnectedCalendar[]
  onClickEvent?: (ev: CalendarEvent) => void
}) {
  const firstEv = events[0]
  const calendar = calendars?.find(c => 
    c.calendar_id === firstEv.source_calendar_id && 
    (!firstEv.created_by || c.family_member_id === firstEv.created_by)
  )
  const calendarColor = calendar?.color
  const ruleColor = applyColorRules(firstEv.title, colorRules)
  const color = ruleColor ?? calendarColor ?? firstEv.color ?? '#C4714F'
  const styles = getEventThemeStyles(color)

  if (events.length === 1) {
    const cleanName = extractBirthdayName(firstEv.title)
    return (
      <div
        onClick={() => onClickEvent?.(firstEv)}
        className="rounded-md px-2.5 py-1.5 text-[13.5px] font-bold truncate cursor-pointer hover:brightness-95 active:brightness-90 transition-all"
        style={{ backgroundColor: styles.backgroundColor, color: styles.textColor, borderLeft: `4px solid ${styles.borderColor}` }}
        title={firstEv.title}
      >
        🎂 {cleanName}
      </div>
    )
  }

  return (
    <div
      onClick={() => onClickEvent?.(firstEv)}
      className="rounded-md px-2.5 py-1.5 text-[13.5px] font-bold truncate cursor-pointer hover:brightness-95 active:brightness-90 transition-all"
      style={{ backgroundColor: styles.backgroundColor, color: styles.textColor, borderLeft: `4px solid ${styles.borderColor}` }}
      title={events.map(e => extractBirthdayName(e.title)).join(', ')}
    >
      🎂 {events.length} Birthdays
    </div>
  )
}

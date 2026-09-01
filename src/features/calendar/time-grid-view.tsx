import { useEffect, useRef, useMemo, useCallback, useState } from 'react'
import { format, isToday, parseISO } from 'date-fns'
import { useConnectedCalendars, type CalendarEvent } from './use-calendar'
import { useEventColorRules, applyColorRules } from '@/features/settings/use-event-color-rules'
import { getEventThemeStyles } from '@/features/settings/theme-context'

interface TimeGridViewProps {
  allDays: Date[]
  activeDayIdx?: number
  onDayChange?: (index: number) => void
  events: CalendarEvent[]
  onEventClick?: (ev: CalendarEvent) => void
  onCellClick?: (day: Date) => void
}

const HOUR_HEIGHT = 56 

function formatHourLabel(h: number): string {
  if (h === 0) return '12 AM'
  if (h === 12) return '12 PM'
  return h > 12 ? `${h - 12} PM` : `${h} AM`
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

interface PositionedEvent {
  ev: CalendarEvent
  top: number
  height: number
  left: number
  width: number
}

function layoutDayEvents(dayEvents: CalendarEvent[]): PositionedEvent[] {
  const nonAllDay = dayEvents.filter(e => !e.all_day)
  nonAllDay.sort((a, b) => {
    const comp = a.start_at.localeCompare(b.start_at)
    if (comp !== 0) return comp
    const aEnd = a.end_at ?? a.start_at
    const bEnd = b.end_at ?? b.start_at
    return bEnd.localeCompare(aEnd)
  })

  const positioned: PositionedEvent[] = []
  let currentGroup: CalendarEvent[] = []
  let groupEnd: Date | null = null

  for (const ev of nonAllDay) {
    const start = parseISO(ev.start_at)
    const end = ev.end_at ? parseISO(ev.end_at) : new Date(start.getTime() + 60 * 60 * 1000)

    if (groupEnd === null || start < groupEnd) {
      currentGroup.push(ev)
      if (groupEnd === null || end > groupEnd) groupEnd = end
    } else {
      layoutGroup(currentGroup, positioned)
      currentGroup = [ev]
      groupEnd = end
    }
  }

  if (currentGroup.length > 0) {
    layoutGroup(currentGroup, positioned)
  }

  return positioned
}

function layoutGroup(group: CalendarEvent[], positioned: PositionedEvent[]) {
  const columns: CalendarEvent[][] = []
  const colIndexMap = new Map<string, number>()

  for (const ev of group) {
    const start = parseISO(ev.start_at)
    let colIndex = -1
    for (let i = 0; i < columns.length; i++) {
      const lastEv = columns[i][columns[i].length - 1]
      const lastEnd = lastEv.end_at
        ? parseISO(lastEv.end_at)
        : new Date(parseISO(lastEv.start_at).getTime() + 3600000)
      if (start >= lastEnd) {
        colIndex = i
        break
      }
    }

    if (colIndex === -1) {
      columns.push([ev])
      colIndex = columns.length - 1
    } else {
      columns[colIndex].push(ev)
    }

    colIndexMap.set(ev.id, colIndex)
  }

  const colCount = columns.length
  for (const ev of group) {
    const start = parseISO(ev.start_at)
    const end = ev.end_at ? parseISO(ev.end_at) : new Date(start.getTime() + 3600000)

    const startHour = start.getHours() + start.getMinutes() / 60
    let endHour = end.getHours() + end.getMinutes() / 60

    if (end.getDate() !== start.getDate()) {
      endHour = 24
    }

    const top = startHour * HOUR_HEIGHT
    const height = Math.max(22, (endHour - startHour) * HOUR_HEIGHT)

    const colIndex = colIndexMap.get(ev.id) ?? 0
    const left = colIndex * (100 / colCount)
    const width = 100 / colCount

    positioned.push({
      ev,
      top,
      height,
      left,
      width,
    })
  }
}

export function TimeGridView({
  allDays,
  activeDayIdx = 0,
  onDayChange,
  events,
  onEventClick,
  onCellClick,
}: TimeGridViewProps) {
  const headerScrollRef = useRef<HTMLDivElement>(null)
  const allDayScrollRef = useRef<HTMLDivElement>(null)
  const horizontalScrollRef = useRef<HTMLDivElement>(null)
  const verticalScrollRef = useRef<HTMLDivElement>(null)

  const activeDayIdxRef = useRef(activeDayIdx)
  const isProgrammaticScrollRef = useRef(false)
  const [dayWidth, setDayWidth] = useState(0)

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
    if (verticalScrollRef.current) {
      verticalScrollRef.current.scrollTop = 8 * HOUR_HEIGHT - 20
    }
  }, [])

  useEffect(() => {
    const el = horizontalScrollRef.current
    if (!el) return

    const updateWidth = () => {
      const clientW = el.clientWidth
      if (clientW > 0) {
        const computedDayW = clientW / 7
        setDayWidth(computedDayW)
        if (!isProgrammaticScrollRef.current) {
          const target = activeDayIdxRef.current * computedDayW
          el.scrollLeft = target
          if (headerScrollRef.current) headerScrollRef.current.scrollLeft = target
          if (allDayScrollRef.current) allDayScrollRef.current.scrollLeft = target
        }
      }
    }

    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const el = horizontalScrollRef.current
    if (!el) return

    const timer = setTimeout(() => {
      if (!horizontalScrollRef.current || dayWidth <= 0) return
      const targetLeft = activeDayIdx * dayWidth
      horizontalScrollRef.current.scrollLeft = targetLeft
      if (headerScrollRef.current) headerScrollRef.current.scrollLeft = targetLeft
      if (allDayScrollRef.current) allDayScrollRef.current.scrollLeft = targetLeft
      activeDayIdxRef.current = activeDayIdx
    }, 40)

    return () => clearTimeout(timer)
  }, [dayWidth]) 

  useEffect(() => {
    const el = horizontalScrollRef.current
    if (!el || dayWidth <= 0) return

    if (activeDayIdxRef.current !== activeDayIdx) {
      activeDayIdxRef.current = activeDayIdx
      const targetLeft = activeDayIdx * dayWidth
      if (Math.abs(el.scrollLeft - targetLeft) > 3) {
        isProgrammaticScrollRef.current = true
        el.scrollTo({ left: targetLeft, behavior: 'smooth' })
        const resetTimer = setTimeout(() => {
          isProgrammaticScrollRef.current = false
        }, 350)
        return () => clearTimeout(resetTimer)
      }
    }
  }, [activeDayIdx, dayWidth])

  const handleHorizontalScroll = useCallback(() => {
    const el = horizontalScrollRef.current
    if (!el || dayWidth <= 0) return

    const scrollLeft = el.scrollLeft
    if (headerScrollRef.current) headerScrollRef.current.scrollLeft = scrollLeft
    if (allDayScrollRef.current) allDayScrollRef.current.scrollLeft = scrollLeft

    if (!isProgrammaticScrollRef.current) {
      const newIdx = Math.round(scrollLeft / dayWidth)
      if (newIdx >= 0 && newIdx < allDays.length && newIdx !== activeDayIdxRef.current) {
        activeDayIdxRef.current = newIdx
        onDayChange?.(newIdx)
      }
    }
  }, [dayWidth, allDays.length, onDayChange])

  const touchStateRef = useRef<{
    startX: number
    startY: number
    startTime: number
    startScrollLeft: number
    history: { x: number; t: number }[]
  } | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    touchStateRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
      startScrollLeft: horizontalScrollRef.current?.scrollLeft ?? 0,
      history: [{ x: touch.clientX, t: Date.now() }],
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStateRef.current) return
    const touch = e.touches[0]
    const now = Date.now()
    touchStateRef.current.history.push({ x: touch.clientX, t: now })
    if (touchStateRef.current.history.length > 10) {
      touchStateRef.current.history.shift()
    }
  }

  const handleTouchEnd = () => {
    const state = touchStateRef.current
    touchStateRef.current = null
    const el = horizontalScrollRef.current
    if (!state || !el || dayWidth <= 0) return

    const now = Date.now()
    const recent = state.history.filter((p) => now - p.t <= 150)
    if (recent.length < 2) return

    const first = recent[0]
    const last = recent[recent.length - 1]
    const dt = last.t - first.t
    const dx = last.x - first.x
    const velocity = dt > 0 ? dx / dt : 0 

    const FLICK_VELOCITY_THRESHOLD = 0.45
    const isFastFlick = Math.abs(velocity) > FLICK_VELOCITY_THRESHOLD || (Math.abs(dx) > 60 && dt < 120)

    if (isFastFlick) {
      const direction = velocity < 0 ? 1 : -1
      const currentDay = Math.round(state.startScrollLeft / dayWidth)
      const targetDay = Math.max(0, Math.min(allDays.length - 7, currentDay + direction * 7))

      isProgrammaticScrollRef.current = true
      el.scrollTo({ left: targetDay * dayWidth, behavior: 'smooth' })
      setTimeout(() => {
        isProgrammaticScrollRef.current = false
      }, 400)
    }
  }

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), [])
  const isNear = useCallback((di: number) => Math.abs(di - activeDayIdx) <= 14, [activeDayIdx])

  return (
    <div
      className="flex h-full flex-col select-none overflow-hidden bg-white relative"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex flex-shrink-0 border-b border-sand-200 pb-2 bg-cream-50 z-20">
        <div className="w-[52px] flex-shrink-0" />
        <div
          ref={headerScrollRef}
          className="flex-1 overflow-hidden flex scrollbar-hide"
          style={{ scrollbarWidth: 'none' }}
        >
          {allDays.map((day, di) => {
            const isCurrentDay = isToday(day)
            return (
              <div
                key={`header-${day.toISOString()}-${di}`}
                className={`text-center py-1 flex flex-col items-center gap-1 border-r border-sand-200 last:border-r-0 ${
                  isCurrentDay ? 'text-terracotta-500' : 'text-brown-700/60'
                }`}
                style={{
                  width: `${dayWidth}px`,
                  minWidth: `${dayWidth}px`,
                  maxWidth: `${dayWidth}px`,
                  flexShrink: 0,
                  scrollSnapAlign: 'start',
                }}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider">
                  {format(day, 'E')}
                </span>
                {isCurrentDay ? (
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-terracotta-500 text-white text-xs font-bold leading-none shadow-sm">
                    {format(day, 'd')}
                  </span>
                ) : (
                  <span className="text-sm font-bold text-brown-800">
                    {format(day, 'd')}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex flex-shrink-0 border-b border-sand-200 bg-[#FAF9F5]/40 py-1 min-h-[28px] z-20">
        <div className="w-[52px] flex-shrink-0 flex items-center justify-center">
          <span className="text-[9px] font-bold text-brown-700/40 uppercase tracking-wider">
            All-Day
          </span>
        </div>
        <div
          ref={allDayScrollRef}
          className="flex-1 overflow-hidden flex scrollbar-hide"
          style={{ scrollbarWidth: 'none' }}
        >
          {allDays.map((day, di) => {
            const key = format(day, 'yyyy-MM-dd')
            const dayAllDay = isNear(di) ? (eventsByDate.get(key) ?? []).filter(e => e.all_day) : []
            const birthdayEvents = dayAllDay.filter(isBirthdayEvent)
            const otherAllDay = dayAllDay.filter(ev => !isBirthdayEvent(ev))
            return (
              <div
                key={`allday-${key}-${di}`}
                className="px-1.5 space-y-0.5 min-h-[22px] border-r border-sand-200 last:border-r-0"
                style={{
                  width: `${dayWidth}px`,
                  minWidth: `${dayWidth}px`,
                  maxWidth: `${dayWidth}px`,
                  flexShrink: 0,
                  scrollSnapAlign: 'start',
                }}
              >
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
                      onClick={() => onEventClick?.(ev)}
                      className="rounded px-1.5 py-0.5 text-[10px] font-semibold truncate cursor-pointer hover:brightness-95 transition-all"
                      style={{ backgroundColor: styles.backgroundColor, color: styles.textColor, borderLeft: `3px solid ${styles.borderColor}` }}
                      title={ev.title}
                    >
                      {ev.title}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      <div
        ref={verticalScrollRef}
        className="flex-1 overflow-y-auto scrollbar-hide relative"
        style={{ scrollbarWidth: 'none' }}
      >
        <div className="flex" style={{ height: `${24 * HOUR_HEIGHT}px` }}>
          <div className="w-[52px] flex-shrink-0 flex flex-col relative border-r border-sand-200 bg-white z-10">
            {hours.map((h) => (
              <div
                key={h}
                className="absolute text-right pr-2 text-[10px] font-semibold text-brown-700/35 uppercase select-none w-full"
                style={{ top: `${h * HOUR_HEIGHT - 6}px` }}
              >
                {h !== 0 ? formatHourLabel(h) : ''}
              </div>
            ))}
          </div>

          <div
            ref={horizontalScrollRef}
            onScroll={handleHorizontalScroll}
            className="flex-1 overflow-x-auto flex relative scrollbar-hide"
            style={{
              scrollSnapType: 'x mandatory',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
              overscrollBehaviorX: 'contain',
            }}
          >
            {allDays.map((day, di) => {
              const key = format(day, 'yyyy-MM-dd')
              const isCurrentDay = isToday(day)
              const near = isNear(di)
              const dayEvents = near ? (eventsByDate.get(key) ?? []) : []
              const positionedEvents = near ? layoutDayEvents(dayEvents) : []

              return (
                <div
                  key={`col-${key}-${di}`}
                  onClick={() => onCellClick?.(day)}
                  className={`relative h-full cursor-pointer transition-colors min-h-0 border-r border-sand-200 last:border-r-0 ${
                    isCurrentDay ? 'bg-terracotta-500/[0.015]' : 'bg-white'
                  }`}
                  style={{
                    width: `${dayWidth}px`,
                    minWidth: `${dayWidth}px`,
                    maxWidth: `${dayWidth}px`,
                    flexShrink: 0,
                    scrollSnapAlign: 'start',
                  }}
                >
                  {hours.map((h) => (
                    <div
                      key={`line-${h}`}
                      className="absolute inset-x-0 border-b border-sand-200/40 pointer-events-none"
                      style={{ top: `${h * HOUR_HEIGHT}px`, height: '1px' }}
                    />
                  ))}

                  {isCurrentDay && (
                    <div className="absolute inset-y-0 inset-x-0 border-x-2 border-terracotta-500/30 bg-terracotta-500/[0.015] pointer-events-none z-10" />
                  )}

                  {positionedEvents.map(({ ev, top, height, left, width }) => {
                    const calendar = calendars?.find(c => 
                      c.calendar_id === ev.source_calendar_id && 
                      (!ev.created_by || c.family_member_id === ev.created_by)
                    )
                    const calendarColor = calendar?.color
                    const ruleColor = applyColorRules(ev.title, colorRules)
                    const color = ruleColor ?? calendarColor ?? ev.color ?? '#5B7FB5'
                    const styles = getEventThemeStyles(color)
                    const isShort = height < 38
                    const isTall = height > 56

                    return (
                      <div
                        key={ev.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          onEventClick?.(ev)
                        }}
                        className={`rounded-md px-2 flex flex-col justify-between hover:brightness-95 active:brightness-90 transition-all select-none border-l-[3.5px] shadow-[0_1px_2px_rgba(0,0,0,0.02)] z-10 ${
                          isShort ? 'py-0.5 justify-center' : 'py-1.5'
                        }`}
                        style={{
                          position: 'absolute',
                          top: `${top + 1}px`,
                          height: `${height - 2}px`,
                          left: `${left}%`,
                          width: `${width - 1}%`,
                          background: styles.backgroundGradient,
                          borderLeftColor: styles.borderColor,
                        }}
                        title={`${ev.title} (${formatTimeRange(ev.start_at, ev.end_at)})`}
                      >
                        {isShort ? (
                          <div className="flex items-center justify-between gap-1 w-full min-w-0 h-full">
                            <span className="font-bold text-[10.5px] leading-none truncate" style={{ color: styles.textColor }}>
                              {ev.title}
                            </span>
                            {!ev.all_day && (
                              <span className="text-[9px] font-semibold opacity-70 flex-shrink-0" style={{ color: styles.textColor }}>
                                {formatTimeShort(ev.start_at)}
                              </span>
                            )}
                          </div>
                        ) : !isTall ? (
                          <div className="flex flex-col justify-between h-full min-w-0">
                            <p className="font-bold text-[11px] leading-tight line-clamp-2 break-words" style={{ color: styles.textColor }}>
                              {ev.title}
                            </p>
                            {!ev.all_day && (
                              <p className="text-[9px] font-semibold opacity-70 leading-none flex-shrink-0" style={{ color: styles.textColor }}>
                                {formatTimeRange(ev.start_at, ev.end_at)}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col h-full justify-between min-w-0">
                            <div className="min-w-0">
                              <p className="font-bold text-[11.5px] leading-snug line-clamp-2 break-words" style={{ color: styles.textColor }}>
                                {ev.title}
                              </p>
                              {ev.location && (
                                <p className="text-[9px] truncate opacity-70 mt-0.5 flex items-center gap-0.5" style={{ color: styles.textColor }}>
                                  <span className="text-[10px]">📍</span>
                                  <span className="truncate">{ev.location}</span>
                                </p>
                              )}
                            </div>
                            {!ev.all_day && (
                              <p className="text-[9px] font-semibold opacity-70 leading-none flex-shrink-0" style={{ color: styles.textColor }}>
                                {formatTimeRange(ev.start_at, ev.end_at)}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
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
        className="rounded px-1.5 py-0.5 text-[10px] font-semibold truncate cursor-pointer hover:brightness-95 transition-all"
        style={{ backgroundColor: styles.backgroundColor, color: styles.textColor, borderLeft: `3px solid ${styles.borderColor}` }}
        title={firstEv.title}
      >
        🎂 {cleanName}
      </div>
    )
  }

  return (
    <div
      className="rounded px-1.5 py-1 text-[10px] font-semibold flex flex-col gap-0.5"
      style={{ backgroundColor: styles.backgroundColor, borderLeft: `3px solid ${styles.borderColor}` }}
    >
      <span className="text-[8px] uppercase tracking-wider font-bold opacity-80" style={{ color: styles.textColor }}>
        🎂 Birthdays
      </span>
      <div className="flex flex-col gap-0.5">
        {events.map((ev) => {
          const cleanName = extractBirthdayName(ev.title)
          return (
            <span
              key={ev.id}
              onClick={(e) => {
                e.stopPropagation()
                onClickEvent?.(ev)
              }}
              className="truncate cursor-pointer hover:underline"
              style={{ color: styles.textColor }}
              title={ev.title}
            >
              {cleanName}
            </span>
          )
        })}
      </div>
    </div>
  )
}

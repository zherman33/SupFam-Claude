import { useEffect, useRef, useMemo } from 'react'
import { format, isToday, parseISO } from 'date-fns'
import { useConnectedCalendars, type CalendarEvent } from './use-calendar'
import { useEventColorRules, applyColorRules } from '@/features/settings/use-event-color-rules'
import { getEventThemeStyles } from '@/features/settings/theme-context'

interface TimeGridViewProps {
  week: Date[]
  events: CalendarEvent[]
  onEventClick?: (ev: CalendarEvent) => void
  onCellClick?: (day: Date) => void
}

const HOUR_HEIGHT = 56 // height in pixels of one hour slot

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

// ── Overlap Layout Algorithm ──────────────────────────────────────────────
function layoutDayEvents(dayEvents: CalendarEvent[]): PositionedEvent[] {
  const nonAllDay = dayEvents.filter(e => !e.all_day)
  // Sort by start_at ascending, then end_at descending
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

    ;(ev as any)._colIndex = colIndex
  }

  const colCount = columns.length
  for (const ev of group) {
    const start = parseISO(ev.start_at)
    const end = ev.end_at ? parseISO(ev.end_at) : new Date(start.getTime() + 3600000)

    const startHour = start.getHours() + start.getMinutes() / 60
    let endHour = end.getHours() + end.getMinutes() / 60

    // Clip to midnight bounds if event crosses day boundary
    if (end.getDate() !== start.getDate()) {
      endHour = 24
    }

    const top = startHour * HOUR_HEIGHT
    const height = Math.max(22, (endHour - startHour) * HOUR_HEIGHT)

    const colIndex = (ev as any)._colIndex
    const left = colIndex * (100 / colCount)
    const width = 100 / colCount

    positioned.push({
      ev,
      top,
      height,
      left,
      width,
    })

    delete (ev as any)._colIndex
  }
}

export function TimeGridView({
  week,
  events,
  onEventClick,
  onCellClick,
}: TimeGridViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { data: colorRules } = useEventColorRules()
  const { data: calendars } = useConnectedCalendars()

  // Scroll to 8 AM on mount to focus on active hours
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 8 * HOUR_HEIGHT - 20
    }
  }, [])

  // 1. Timezone-safe index events by date
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

  const hours = Array.from({ length: 24 }, (_, i) => i)

  return (
    <div className="flex h-full flex-col select-none overflow-hidden bg-white">
      {/* ── Fixed Day Headers (with spacing for the hour axis) ── */}
      <div className="flex flex-shrink-0 border-b border-sand-200 pb-2 bg-cream-50">
        {/* Empty spacing block corresponding to hour axis width */}
        <div className="w-[52px] flex-shrink-0" />
        <div className="flex-1 grid grid-cols-7 divide-x divide-sand-200">
          {week.map((day) => {
            const isCurrentDay = isToday(day)
            return (
              <div
                key={day.toISOString()}
                className={`text-center py-1 flex flex-col items-center gap-1 ${
                  isCurrentDay ? 'text-terracotta-500' : 'text-brown-700/60'
                }`}
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

      {/* ── All-Day Events row (if any exist in this week) ── */}
      <div className="flex flex-shrink-0 border-b border-sand-200 bg-[#FAF9F5]/40 py-1">
        <div className="w-[52px] flex-shrink-0 flex items-center justify-center">
          <span className="text-[9px] font-bold text-brown-700/40 uppercase tracking-wider">
            All-Day
          </span>
        </div>
        <div className="flex-1 grid grid-cols-7 divide-x divide-sand-200">
          {week.map((day) => {
            const key = format(day, 'yyyy-MM-dd')
            const dayAllDay = (eventsByDate.get(key) ?? []).filter(e => e.all_day)
            const birthdayEvents = dayAllDay.filter(isBirthdayEvent)
            const otherAllDay = dayAllDay.filter(ev => !isBirthdayEvent(ev))
            return (
              <div key={`all-day-${key}`} className="px-1.5 space-y-0.5 min-h-[22px]">
                {birthdayEvents.length > 0 && (
                  <BirthdayGroupPill
                    events={birthdayEvents}
                    colorRules={colorRules}
                    calendars={calendars}
                    onClickEvent={onEventClick}
                  />
                )}
                 {otherAllDay.map((ev) => {
                  const calendar = calendars?.find(c => c.calendar_id === ev.source_calendar_id)
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

      {/* ── Scrollable Hourly Grid ── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scrollbar-hide relative"
        style={{ scrollbarWidth: 'none' }}
      >
        <div className="flex" style={{ height: `${24 * HOUR_HEIGHT}px` }}>
          {/* Hour labels axis */}
          <div className="w-[52px] flex-shrink-0 flex flex-col relative border-r border-sand-200">
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

          {/* 7 Columns Grid with timeline lines */}
          <div className="flex-1 grid grid-cols-7 divide-x divide-sand-200 relative bg-white">
            {/* Individual day columns */}
            {week.map((day) => {
              const key = format(day, 'yyyy-MM-dd')
              const dayEvents = eventsByDate.get(key) ?? []
              const isCurrentDay = isToday(day)

              // Compute absolute positions for non-all-day events
              const positionedEvents = layoutDayEvents(dayEvents)

              return (
                <div
                  key={`col-${key}`}
                  onClick={() => onCellClick?.(day)}
                  className={`relative h-full cursor-pointer transition-colors min-h-0 ${
                    isCurrentDay ? 'bg-terracotta-500/[0.015]' : 'bg-white'
                  }`}
                >
                  {/* Horizontal timeline grid lines */}
                  {hours.map((h) => (
                    <div
                      key={`line-${h}`}
                      className="absolute inset-x-0 border-b border-sand-200/40 pointer-events-none"
                      style={{ top: `${h * HOUR_HEIGHT}px`, height: '1px' }}
                    />
                  ))}

                  {/* Today vertical highlighted border */}
                  {isCurrentDay && (
                    <div className="absolute inset-y-0 inset-x-0 border-x-2 border-terracotta-500/30 bg-terracotta-500/[0.015] pointer-events-none z-10" />
                  )}

                  {/* Absolute rendered event blocks */}
                  {positionedEvents.map(({ ev, top, height, left, width }) => {
                    const calendar = calendars?.find(c => c.calendar_id === ev.source_calendar_id)
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
  const calendar = calendars?.find(c => c.calendar_id === firstEv.source_calendar_id)
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

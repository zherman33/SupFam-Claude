import { useMemo } from 'react'
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
  week,
  events,
  onEventClick,
  onCellClick,
}: TimeGridViewProps) {
  const { data: colorRules } = useEventColorRules()
  const { data: calendars } = useConnectedCalendars()

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

  return (
    <div className="flex h-full flex-col select-none overflow-hidden bg-white">
      {/* ── Fixed Day Headers ── */}
      <div className="flex flex-shrink-0 border-b border-sand-200 pb-2 bg-cream-50">
        <div className="flex-1 grid grid-cols-7 divide-x divide-sand-200">
          {week.map((day) => {
            const isCurrentDay = isToday(day)
            return (
              <div
                key={day.toISOString()}
                className={`text-center py-1.5 flex flex-col items-center gap-1 ${
                  isCurrentDay ? 'text-terracotta-500' : 'text-brown-700/60'
                }`}
              >
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  {format(day, 'E')}
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
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Non-Scrolling Stacked Grid ── */}
      <div className="flex-1 relative bg-white overflow-hidden">
        <div className="absolute inset-0 grid grid-cols-7 divide-x divide-sand-200">
          {week.map((day) => {
            const key = format(day, 'yyyy-MM-dd')
            const dayEvents = eventsByDate.get(key) ?? []
            const isCurrentDay = isToday(day)

            // Split into all-day and timed events
            const dayAllDay = dayEvents.filter(e => e.all_day)
            const birthdayEvents = dayAllDay.filter(isBirthdayEvent)
            const otherAllDay = dayAllDay.filter(ev => !isBirthdayEvent(ev))

            const nonAllDay = dayEvents.filter(e => !e.all_day)
            nonAllDay.sort((a, b) => a.start_at.localeCompare(b.start_at))

            return (
              <div
                key={`col-${key}`}
                onClick={() => onCellClick?.(day)}
                className={`relative h-full flex flex-col gap-1 p-1 cursor-pointer overflow-hidden ${
                  isCurrentDay ? 'bg-terracotta-500/[0.015]' : 'bg-white'
                }`}
              >
                {/* Today vertical highlighted border */}
                {isCurrentDay && (
                  <div className="absolute inset-y-0 inset-x-0 border-x-2 border-terracotta-500/30 bg-terracotta-500/[0.015] pointer-events-none z-10" />
                )}

                <div className="flex flex-col gap-1.5 z-20 overflow-y-auto scrollbar-hide h-full">
                  {/* All-Day Events first */}
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
                        onClick={(e) => { e.stopPropagation(); onEventClick?.(ev) }}
                        className="rounded-md px-2.5 py-1.5 text-[13.5px] font-bold truncate cursor-pointer hover:brightness-95 transition-all shrink-0"
                        style={{ backgroundColor: styles.backgroundColor, color: styles.textColor, borderLeft: `3px solid ${styles.borderColor}` }}
                        title={ev.title}
                      >
                        {ev.title}
                      </div>
                    )
                  })}

                  {/* Timed Events */}
                  {nonAllDay.map((ev) => {
                    const calendar = calendars?.find(c => c.calendar_id === ev.source_calendar_id)
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
                </div>
              </div>
            )
          })}
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
        className="rounded-md px-2.5 py-1.5 text-[13.5px] font-bold truncate cursor-pointer hover:brightness-95 transition-all"
        style={{ backgroundColor: styles.backgroundColor, color: styles.textColor, borderLeft: `3px solid ${styles.borderColor}` }}
        title={firstEv.title}
      >
        🎂 {cleanName}
      </div>
    )
  }

  return (
    <div
      onClick={() => onClickEvent?.(firstEv)}
      className="rounded-md px-2.5 py-1.5 text-[13.5px] font-bold truncate cursor-pointer hover:brightness-95 transition-all"
      style={{ backgroundColor: styles.backgroundColor, color: styles.textColor, borderLeft: `3px solid ${styles.borderColor}` }}
      title={events.map(e => extractBirthdayName(e.title)).join(', ')}
    >
      🎂 {events.length} Birthdays
    </div>
  )
}

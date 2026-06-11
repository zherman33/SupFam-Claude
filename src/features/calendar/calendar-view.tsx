import {
  startOfWeek,
  addDays,
  addWeeks,
  format,
  isToday,
  parseISO,
} from 'date-fns'
import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react'
import type { Task } from '@/features/tasks/use-tasks'
import { useConnectedCalendars, type CalendarEvent } from './use-calendar'
import { useEventColorRules, applyColorRules } from '@/features/settings/use-event-color-rules'
import { EventForm } from './event-form'
import { TimeGridView } from './time-grid-view'
import { getEventThemeStyles, getFamilyMemberColor } from '@/features/settings/theme-context'

export type CalendarMode = 'month' | '3week' | 'week'

interface CalendarViewProps {
  tasks?: Task[]
  events?: CalendarEvent[]
  anchorDate?: Date
  mode?: CalendarMode
  onModeChange?: (mode: CalendarMode) => void
  headerRight?: React.ReactNode
  onRefresh?: () => void
  isRefreshing?: boolean
  onSyncRange?: (timeMin: Date, timeMax: Date) => void
}

// Render 60 weeks: 8 back + 52 forward (~1 year forward)
const WEEKS_BEFORE = 8
const WEEKS_AFTER = 52
const TOTAL_WEEKS = WEEKS_BEFORE + WEEKS_AFTER

export function CalendarView({
  tasks = [],
  events = [],
  anchorDate,
  mode = 'month',
  onModeChange,
  headerRight,
  onRefresh,
  isRefreshing = false,
  onSyncRange,
}: CalendarViewProps) {
  const [today, setToday] = useState(() => new Date())

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date()
      setToday((prev) => {
        if (
          prev.getDate() !== now.getDate() ||
          prev.getMonth() !== now.getMonth() ||
          prev.getFullYear() !== now.getFullYear()
        ) {
          return now
        }
        return prev
      })
    }, 60000)
    return () => clearInterval(interval)
  }, [])
  const anchor = anchorDate ?? today
  const { data: colorRules } = useEventColorRules()

  // Event form state
  const [formDate, setFormDate] = useState<Date | null>(null)
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null)

  // Rows visible at once per mode
  const rowsPerPage = mode === 'week' ? 1 : mode === '3week' ? 3 : 5

  // Build ALL weeks — start far enough back that month boundaries are clean
  const allWeeks = useMemo(() => {
    const baseWeekStart = startOfWeek(addWeeks(anchor, -WEEKS_BEFORE), { weekStartsOn: 0 })
    return Array.from({ length: TOTAL_WEEKS }, (_, wi) =>
      Array.from({ length: 7 }, (_, di) => addDays(baseWeekStart, wi * 7 + di))
    )
  }, [anchor])

  // ── Snap row indices ────────────────────────────────────────────────────
  // Snap every week row in all views to ensure clean alignment
  const snapRows = useMemo(() => {
    const snap = new Set<number>()
    for (let wi = 0; wi < TOTAL_WEEKS; wi++) {
      snap.add(wi)
    }
    return snap
  }, [])

  // ── Scroll state ────────────────────────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null)
  const [topWeekIdx, setTopWeekIdx] = useState(WEEKS_BEFORE)
  const topWeekIdxRef = useRef(WEEKS_BEFORE)
  const [isTouchDevice, setIsTouchDevice] = useState(false)

  // Keep track of the synced date ranges to avoid redundant API/DB calls
  const syncedRangesRef = useRef<{ start: Date; end: Date }[]>([])

  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0)
  }, [])

  // Initialize syncedRangesRef with the initial sync range on mount
  useEffect(() => {
    const start = new Date(today)
    start.setDate(today.getDate() - 7)
    const end = new Date(today)
    end.setDate(today.getDate() + 35)
    
    syncedRangesRef.current = [{ start, end }]
  }, [today])

  // Check if we need to sync when scrolling to a new week
  useEffect(() => {
    if (!onSyncRange) return

    const currentWeek = allWeeks[topWeekIdx]
    if (!currentWeek || currentWeek.length === 0) return

    const weekStart = currentWeek[0]
    
    // Check if the week start date is covered by any synced range
    const isCovered = syncedRangesRef.current.some(
      (range) => weekStart >= range.start && weekStart <= range.end
    )

    if (!isCovered) {
      // Trigger sync for this week and an additional 2 weeks worth (total 3 weeks / 21 days)
      const syncStart = new Date(weekStart)
      const syncEnd = new Date(weekStart)
      syncEnd.setDate(weekStart.getDate() + 21)

      // Add to synced ranges first to avoid duplicate requests during transit
      syncedRangesRef.current.push({ start: syncStart, end: syncEnd })
      
      onSyncRange(syncStart, syncEnd)
    }
  }, [topWeekIdx, allWeeks, onSyncRange, today])

  const handleManualRefresh = () => {
    const currentWeek = allWeeks[topWeekIdx]
    const weekStart = currentWeek ? currentWeek[0] : today
    
    const start = new Date(weekStart)
    start.setDate(weekStart.getDate() - 7)
    const end = new Date(weekStart)
    end.setDate(weekStart.getDate() + 35)
    
    syncedRangesRef.current = [{ start, end }]
    
    if (onSyncRange) {
      onSyncRange(start, end)
    } else if (onRefresh) {
      onRefresh()
    }
  }

  // Scroll to today's week on mount / mode change / today change
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    
    // Set a layout-safe timer to calculate the dimensions once the grid is laid out
    const timer = setTimeout(() => {
      const rowH = el.scrollHeight / TOTAL_WEEKS
      const scrollRow = WEEKS_BEFORE
      
      el.scrollTop = scrollRow * rowH
      setTopWeekIdx(scrollRow)
      topWeekIdxRef.current = scrollRow
    }, 50)

    return () => clearTimeout(timer)
  }, [mode, today])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const rowH = el.scrollHeight / TOTAL_WEEKS
    const topRow = Math.round(el.scrollTop / rowH)
    if (topWeekIdxRef.current !== topRow) {
      topWeekIdxRef.current = topRow
      setTopWeekIdx(topRow)
    }
  }, [])

  const monthLabel = useMemo(() => {
    const midRow = Math.min(topWeekIdx + Math.floor(rowsPerPage / 2), TOTAL_WEEKS - 1)
    const labelDay = allWeeks[midRow]?.[3] ?? today
    return mode === 'week'
      ? (() => {
          const ws = allWeeks[topWeekIdx]?.[0] ?? today
          const we = allWeeks[topWeekIdx]?.[6] ?? today
          return format(ws, 'MMM') === format(we, 'MMM')
            ? `${format(ws, 'MMM d')}\u2013${format(we, 'd, yyyy')}`
            : `${format(ws, 'MMM d')} \u2013 ${format(we, 'MMM d')}`
        })()
      : mode === '3week'
      ? (() => {
          const ws = allWeeks[topWeekIdx]?.[0] ?? today
          const we = allWeeks[Math.min(topWeekIdx + 2, TOTAL_WEEKS - 1)]?.[6] ?? today
          return `${format(ws, 'MMM d')} \u2013 ${format(we, 'MMM d')}`
        })()
      : format(labelDay, 'MMMM yyyy')
  }, [allWeeks, topWeekIdx, mode, rowsPerPage, today])

  // ── Index tasks ──────────────────────────────────────────────────────────
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const task of tasks) {
      if (!task.due_date || task.is_complete) continue
      if (!map.has(task.due_date)) map.set(task.due_date, [])
      map.get(task.due_date)!.push(task)
    }
    return map
  }, [tasks])

  // ── Index events — timezone-safe, multi-day expansion ───────────────────
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    const addEvToDate = (key: string, ev: CalendarEvent) => {
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
          addEvToDate(cur, ev)
          const d = new Date(cur + 'T00:00:00')
          d.setDate(d.getDate() + 1)
          cur = format(d, 'yyyy-MM-dd')
        }
        if (startKey === endKey) addEvToDate(startKey, ev)
      } else {
        addEvToDate(format(parseISO(ev.start_at), 'yyyy-MM-dd'), ev)
      }
    }
    for (const [, evs] of map) {
      evs.sort((a, b) => {
        if (a.all_day && !b.all_day) return -1
        if (!a.all_day && b.all_day) return 1
        return a.start_at.localeCompare(b.start_at)
      })
    }
    return map
  }, [events])

  const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const todayDow = today.getDay() // 0 = Sun … 6 = Sat

  return (
    <>
    {(formDate || editEvent) && (
      <EventForm
        initialDate={formDate ?? undefined}
        event={editEvent ?? undefined}
        onClose={() => { setFormDate(null); setEditEvent(null) }}
      />
    )}
    <div className="flex h-full flex-col select-none overflow-hidden">

      {/* ── Header ── */}
      <div className="relative flex-shrink-0 flex items-center h-9 mb-2">
        {/* Month label — absolutely centered; tapping triggers a sync refresh */}
        <div className="absolute inset-x-0 flex items-center justify-center pointer-events-none">
          <button
            className="flex items-center gap-1.5 pointer-events-auto active:opacity-60 transition-opacity disabled:cursor-default"
            onClick={handleManualRefresh}
            disabled={(!onRefresh && !onSyncRange) || isRefreshing}
          >
            <span className="font-body text-base font-semibold text-brown-800 tracking-tight">
              {monthLabel}
            </span>
            {isRefreshing && (
              <svg
                className="h-3.5 w-3.5 animate-spin text-brown-700/40"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
          </button>
        </div>

        {/* Right controls — view switcher + ⋯ */}
        <div className="ml-auto flex items-center gap-1.5 relative z-10">
          {onModeChange && (
            <div className="flex items-center gap-px rounded-lg bg-sand-100 p-0.5">
              {(['week', '3week', 'month'] as CalendarMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => onModeChange(m)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    mode === m
                      ? 'bg-white text-brown-800 shadow-sm'
                      : 'text-brown-700/50 hover:text-brown-800'
                  }`}
                >
                  {m === '3week' ? '3 wk' : m === 'week' ? '1 wk' : 'Mo'}
                </button>
              ))}
            </div>
          )}
          {headerRight}
        </div>
      </div>

      {mode === 'week' ? (
        <div className="flex-1 min-h-0">
          <TimeGridView
            week={allWeeks[topWeekIdx] ?? today}
            events={events}
            onEventClick={(ev) => setEditEvent(ev)}
            onCellClick={(day) => setFormDate(day)}
          />
        </div>
      ) : (
        <>
          {/* ── Day headers ── */}
          <div className="flex-shrink-0 grid grid-cols-7 border-b border-sand-100 pb-1.5 mb-0.5">
            {DAY_HEADERS.map((d, i) => (
              <div
                key={d}
                className={`text-center text-[11px] font-semibold uppercase tracking-widest ${
                  i === todayDow
                    ? 'text-terracotta-500'
                    : i === 0 || i === 6 ? 'text-brown-700/25' : 'text-brown-700/45'
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* ── Scroll container ── */}
          {/*
            Each "page" is rowsPerPage rows tall = 100% of the container.
            scroll-snap-type: y mandatory snaps to each page.
            Each row group is a snap point.
            We render all 20 weeks up front — no lazy loading needed for 3 months.
          */}
          {/* ── Scroll container wrapper to fix Safari % height bug ── */}
          <div className="flex-1 min-h-0 relative">
            <div
              ref={scrollRef}
              className="absolute inset-0 overflow-y-scroll calendar-scroll-container"
              style={{
                scrollSnapType: isTouchDevice ? 'y proximity' : 'none',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
                overflowX: 'hidden',
                overflowAnchor: 'none',
                overscrollBehavior: 'contain',
                willChange: 'transform',
              }}
              onScroll={handleScroll}
            >
              {/* Inner: total height = (TOTAL_WEEKS / rowsPerPage) pages */}
              <div
                style={{
                  height: `${(TOTAL_WEEKS / rowsPerPage) * 100}%`,
                  display: 'grid',
                  gridTemplateRows: `repeat(${TOTAL_WEEKS}, minmax(0, 1fr))`,
                }}
              >
          {allWeeks.map((week, wi) => {
            const isSnapPoint = snapRows.has(wi)

            // Check if this week contains any holiday events (since birthdays are grouped in the main grid)
            const weekHasAmbient = week.some(day => {
              const key = format(day, 'yyyy-MM-dd')
              const dayEvents = eventsByDate.get(key) ?? []
              return dayEvents.some(isHolidayEvent)
            })

            return (
              <WeekRow
                key={wi}
                week={week}
                isSnapPoint={isSnapPoint && isTouchDevice}
                weekHasAmbient={weekHasAmbient}
                eventsByDate={eventsByDate}
                tasksByDate={tasksByDate}
                colorRules={colorRules}
                setFormDate={setFormDate}
                setEditEvent={setEditEvent}
              />
            )
          })}
        </div>
      </div>
      </div>
    </>
  )}
    </div>
    </>
  )
}

interface WeekRowProps {
  week: Date[]
  isSnapPoint: boolean
  weekHasAmbient: boolean
  eventsByDate: Map<string, CalendarEvent[]>
  tasksByDate: Map<string, Task[]>
  colorRules: import('@/features/settings/use-event-color-rules').EventColorRule[] | undefined
  setFormDate: (d: Date | null) => void
  setEditEvent: (e: CalendarEvent | null) => void
}

const WeekRow = memo(function WeekRow({
  week,
  isSnapPoint,
  weekHasAmbient,
  eventsByDate,
  tasksByDate,
  colorRules,
  setFormDate,
  setEditEvent,
}: WeekRowProps) {
  return (
    <div
      className="flex flex-col border-b border-sand-100 last:border-0 min-h-0"
      style={isSnapPoint ? { scrollSnapAlign: 'start' } : undefined}
    >
      {/* 1. Personal Grid: Date Numbers + Personal Events + Tasks */}
      <div className="grid grid-cols-7 flex-1 min-h-0">
        {week.map((day) => {
          const key = format(day, 'yyyy-MM-dd')
          const dayEvents = eventsByDate.get(key) ?? []
          const dayTasks = tasksByDate.get(key) ?? []
          const isCurrentDay = isToday(day)
          const isWeekend = day.getDay() === 0 || day.getDay() === 6

          const birthdayEvents = dayEvents.filter(isBirthdayEvent)
          const personalEvents = dayEvents.filter(ev => !isHolidayEvent(ev) && !isBirthdayEvent(ev))

          type Pill = { type: 'event'; ev: CalendarEvent } | { type: 'task'; task: Task }
          const personalPills: Pill[] = [
            ...personalEvents.map(ev => ({ type: 'event' as const, ev })),
            ...dayTasks.map(task => ({ type: 'task' as const, task })),
          ]

          return (
            <div
              key={`personal-${key}`}
              className={`relative flex flex-col border-r border-sand-100 last:border-r-0 overflow-hidden min-h-0 cursor-pointer
                ${isWeekend && !isCurrentDay ? 'bg-[#faf8f5]' : 'bg-white'}
                ${isCurrentDay ? `bg-[#FAF2EE] ring-2 ring-terracotta-500/80 ring-inset z-10 ${weekHasAmbient ? 'rounded-t-xl' : 'rounded-xl'}` : ''}
              `}
              onClick={() => setFormDate(day)}
            >
              {isCurrentDay && (
                <div className="absolute top-0 inset-x-0 h-[3px] bg-terracotta-500 z-10" />
              )}
              <div className="flex flex-col h-full p-1.5 gap-px">
                <div className="flex-shrink-0 mb-0.5">
                  {isCurrentDay ? (
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-terracotta-500 text-white text-xs font-bold leading-none shadow-sm">
                      {format(day, 'd')}
                    </span>
                  ) : (
                    <span className={`
                      inline-flex h-[18px] w-[18px] items-center justify-center rounded-full
                      text-[10px] font-bold leading-none
                      ${isWeekend ? 'text-brown-700/30' : 'text-brown-700/60'}
                    `}>
                      {format(day, 'd')}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-px flex-1 min-h-0 overflow-hidden">
                  {birthdayEvents.length > 0 && (
                    <BirthdayGroupPill
                      events={birthdayEvents}
                      colorRules={colorRules}
                      onClickEvent={setEditEvent}
                    />
                  )}
                  {personalPills.map((pill) => pill.type === 'event'
                    ? <EventPill
                        key={`${pill.ev.id}-${key}`}
                        ev={pill.ev}
                        colorRules={colorRules}
                        isAmbient={false}
                        onClick={e => { e.stopPropagation(); setEditEvent(pill.ev) }}
                      />
                    : <TaskPill key={pill.task.id} task={pill.task} />
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 2. Birthday / Holiday row at the bottom of columns */}
      {weekHasAmbient && (
        <div className="grid grid-cols-7 border-t border-sand-100/50 bg-[#FAF9F5]/40 min-h-7 flex-shrink-0">
          {week.map((day) => {
            const key = format(day, 'yyyy-MM-dd')
            const dayEvents = eventsByDate.get(key) ?? []
            const isCurrentDay = isToday(day)
            const isWeekend = day.getDay() === 0 || day.getDay() === 6

            const ambientPills = dayEvents
              .filter(isHolidayEvent)

            return (
              <div
                key={`ambient-${key}`}
                className={`flex flex-col border-r border-sand-100 last:border-r-0 overflow-hidden p-1 gap-px cursor-pointer min-h-7
                  ${isWeekend && !isCurrentDay ? 'bg-[#faf8f5]' : 'bg-white'}
                  ${isCurrentDay ? 'bg-[#FAF2EE] ring-2 ring-terracotta-500/80 ring-inset rounded-b-xl z-10' : ''}
                `}
                onClick={() => setFormDate(day)}
              >
                {ambientPills.map((ev) => (
                  <EventPill
                    key={`${ev.id}-${key}`}
                    ev={ev}
                    colorRules={colorRules}
                    isAmbient={true}
                    onClick={e => { e.stopPropagation(); setEditEvent(ev) }}
                  />
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
})

// ── Helpers ────────────────────────────────────────────────────────────────


function isBirthdayEvent(ev: CalendarEvent): boolean {
  return (
    ev.title.toLowerCase().includes('birthday') ||
    !!ev.source_calendar_id?.includes('#contacts')
  )
}

function isHolidayEvent(ev: CalendarEvent): boolean {
  return !!ev.source_calendar_id?.includes('#holiday')
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
  onClickEvent,
}: {
  events: CalendarEvent[]
  colorRules?: import('@/features/settings/use-event-color-rules').EventColorRule[]
  onClickEvent: (ev: CalendarEvent) => void
}) {
  const { data: calendars } = useConnectedCalendars()

  // Use the color of the first event (from color rules, calendar, or a fallback)
  const firstEv = events[0]
  const calendar = calendars?.find(c => c.calendar_id === firstEv.source_calendar_id)
  const calendarColor = calendar?.color
  const ruleColor = applyColorRules(firstEv.title, colorRules)
  const color = ruleColor ?? calendarColor ?? firstEv.color ?? '#C4714F' // Terracotta/peach fallback
  const styles = getEventThemeStyles(color)

  if (events.length === 1) {
    const cleanName = extractBirthdayName(firstEv.title)
    return (
      <div
        className="flex items-stretch rounded overflow-hidden flex-shrink-0 cursor-pointer hover:brightness-95 active:brightness-90 transition-[filter] py-1 min-h-[26px]"
        style={{ backgroundColor: styles.backgroundColor }}
        title={firstEv.title}
        onClick={() => onClickEvent(firstEv)}
      >
        <div className="w-[3px] flex-shrink-0 rounded-l" style={{ backgroundColor: styles.borderColor }} />
        <div className="flex items-center px-1.5 min-w-0 flex-1">
          <span
            className="truncate text-[12px] font-semibold leading-none"
            style={{ color: styles.textColor }}
          >
            🎂 {cleanName}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex items-stretch rounded overflow-hidden flex-shrink-0"
      style={{ backgroundColor: styles.backgroundColor }}
    >
      <div className="w-[3px] flex-shrink-0 rounded-l" style={{ backgroundColor: styles.borderColor }} />
      <div className="flex flex-col px-1.5 py-1 min-w-0 flex-1 gap-0.5">
        {/* Header */}
        <span
          className="font-bold uppercase tracking-wider text-[9px] select-none opacity-80"
          style={{ color: styles.textColor }}
        >
          🎂 Birthdays
        </span>
        {/* Names list */}
        <div className="flex flex-col gap-0.5">
          {events.map((ev) => {
            const cleanName = extractBirthdayName(ev.title)
            return (
              <span
                key={ev.id}
                className="truncate text-[12px] font-semibold leading-normal hover:underline cursor-pointer active:opacity-75"
                style={{ color: styles.textColor }}
                onClick={(e) => {
                  e.stopPropagation()
                  onClickEvent(ev)
                }}
                title={ev.title}
              >
                {cleanName}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}


function formatTimeShort(dateStr: string): string {
  return format(parseISO(dateStr), 'h:mma')
    .replace(':00', '')
    .toLowerCase()
    .replace('am', 'a')
    .replace('pm', 'p')
}

function EventPill({
  ev,
  colorRules,
  isAmbient = false,
  onClick,
}: {
  ev: CalendarEvent
  colorRules?: import('@/features/settings/use-event-color-rules').EventColorRule[]
  isAmbient?: boolean
  onClick?: (e: React.MouseEvent) => void
}) {
  const { data: calendars } = useConnectedCalendars()
  const calendar = calendars?.find(c => c.calendar_id === ev.source_calendar_id)
  const calendarColor = calendar?.color

  // Color rule overrides take priority over the calendar's default color
  const ruleColor = applyColorRules(ev.title, colorRules)
  const color = ruleColor ?? calendarColor ?? ev.color ?? '#5B7FB5'
  const styles = getEventThemeStyles(color)

  return (
    <div
      className={`flex items-stretch rounded overflow-hidden flex-shrink-0 cursor-pointer hover:brightness-95 active:brightness-90 transition-[filter] ${
        isAmbient ? 'py-0.5' : 'py-2 min-h-[38px]'
      }`}
      style={{ backgroundColor: styles.backgroundColor }}
      title={ev.title}
      onClick={onClick}
    >
      <div className="w-[3px] flex-shrink-0 rounded-l" style={{ backgroundColor: styles.borderColor }} />
      <div className="flex items-center justify-between px-1.5 min-w-0 flex-1 gap-2">
        <span
          className={`font-semibold leading-snug flex-1 ${
            isAmbient
              ? 'truncate text-[10px]'
              : 'line-clamp-2 break-words text-[13.5px]'
          }`}
          style={{ color: styles.textColor }}
        >
          {ev.title}
        </span>
        {!ev.all_day && (
          <span
            className={`font-semibold tracking-tight flex-shrink-0 self-start mt-0.5 ${
              isAmbient ? 'text-[9px]' : 'text-[11px]'
            }`}
            style={{ color: styles.textColor, opacity: 0.65 }}
          >
            {formatTimeShort(ev.start_at)}
          </span>
        )}
      </div>
    </div>
  )
}

function TaskPill({ task }: { task: Task }) {
  const rawColor = task.assigned_member?.avatar_color ?? '#C4714F'
  const color = getFamilyMemberColor(rawColor)
  const styles = getEventThemeStyles(color)
  return (
    <div
      className="flex items-stretch rounded overflow-hidden flex-shrink-0"
      style={{ backgroundColor: styles.backgroundColor }}
      title={task.title}
    >
      <div className="w-[3px] flex-shrink-0 rounded-l opacity-40" style={{ backgroundColor: styles.borderColor }} />
      <div className="flex items-center gap-1 px-1 py-px min-w-0">
        <span className="text-[10px] flex-shrink-0" style={{ color: styles.textColor, opacity: 0.6 }}>✓</span>
        <span className="truncate text-[12px] font-medium leading-snug" style={{ color: styles.textColor }}>
          {task.title}
        </span>
      </div>
    </div>
  )
}

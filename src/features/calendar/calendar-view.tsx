import {
  startOfWeek,
  addDays,
  addWeeks,
  format,
  isToday,
  parseISO,
} from 'date-fns'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import type { Task } from '@/features/tasks/use-tasks'
import {
  useConnectedCalendars,
  useToggleCalendarVisibility,
  getEventDateBounds,
  type CalendarEvent,
  type EventDateBounds,
} from './use-calendar'
import { useEventColorRules, applyColorRules } from '@/features/settings/use-event-color-rules'
import { EventForm } from './event-form'
import { TimeGridView } from './time-grid-view'

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
  onSelectTask?: (task: Task) => void
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
  onSelectTask,
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
  const { data: connectedCalendars } = useConnectedCalendars()
  const toggleVisibility = useToggleCalendarVisibility()

  const calColorMap = new Map<string, string>()
  for (const c of connectedCalendars ?? []) {
    if (c.calendar_id && c.color) {
      calColorMap.set(c.calendar_id, c.color)
    }
  }
  const quickToggleCalendars = (connectedCalendars ?? []).filter(c => c.is_quick_toggle)

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
  // Snap to every week row in all modes to allow smooth, non-skipping scrolling
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

  // ── Index events — multi-day expansion using getEventDateBounds ─────────
  const { eventsByDate, eventBoundsMap } = useMemo(() => {
    const evMap = new Map<string, CalendarEvent[]>()
    const boundsMap = new Map<string, EventDateBounds>()
    const addEvToDate = (key: string, ev: CalendarEvent) => {
      if (!evMap.has(key)) evMap.set(key, [])
      if (!evMap.get(key)!.find(e => e.id === ev.id)) {
        evMap.get(key)!.push(ev)
      }
    }
    for (const ev of events) {
      const bounds = getEventDateBounds(ev)
      boundsMap.set(ev.id, bounds)
      for (const dateKey of bounds.dates) {
        addEvToDate(dateKey, ev)
      }
    }
    for (const [, evs] of evMap) {
      evs.sort((a, b) => {
        const boundsA = boundsMap.get(a.id)!
        const boundsB = boundsMap.get(b.id)!
        const isBannerA = a.all_day || boundsA.isMultiDay
        const isBannerB = b.all_day || boundsB.isMultiDay
        if (isBannerA && !isBannerB) return -1
        if (!isBannerA && isBannerB) return 1
        if (isBannerA && isBannerB) {
          const startDiff = boundsA.firstDay.localeCompare(boundsB.firstDay)
          if (startDiff !== 0) return startDiff
          const durA = boundsA.dates.length
          const durB = boundsB.dates.length
          if (durA !== durB) return durB - durA
        }
        return a.start_at.localeCompare(b.start_at)
      })
    }
    return { eventsByDate: evMap, eventBoundsMap: boundsMap }
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
        {/* Left controls — Quick Toggle calendars */}
        {quickToggleCalendars.length > 0 && (
          <div className="flex items-center gap-1.5 relative z-10 mr-auto overflow-x-auto no-scrollbar max-w-[42%] py-0.5">
            {quickToggleCalendars.map(cal => {
              const color = cal.color ?? '#C4714F'
              const isVisible = cal.is_visible
              return (
                <button
                  key={cal.id}
                  type="button"
                  onClick={() => toggleVisibility.mutate({ id: cal.id, is_visible: !isVisible })}
                  title={`${cal.calendar_name ?? cal.calendar_id} (${isVisible ? 'Currently visible — click to hide' : 'Currently hidden — click to show'})`}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-all flex-shrink-0 ${
                    isVisible
                      ? 'shadow-sm active:scale-95'
                      : 'bg-white border border-sand-200 text-brown-700/50 hover:bg-cream-50 hover:text-brown-700 active:scale-95'
                  }`}
                  style={
                    isVisible
                      ? {
                          backgroundColor: `${color}18`,
                          border: `1px solid ${color}40`,
                          color: darkenForReadability(color),
                        }
                      : undefined
                  }
                >
                  <span
                    className={`h-2 w-2 rounded-full flex-shrink-0 transition-opacity ${isVisible ? 'opacity-100' : 'opacity-40'}`}
                    style={{ backgroundColor: color }}
                  />
                  <span className="truncate max-w-[120px]">
                    {cal.calendar_name ?? cal.calendar_id}
                  </span>
                </button>
              )
            })}
          </div>
        )}

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
                  className={`rounded-md px-2.5 py-1 text-[0.6875rem] font-semibold transition-colors ${
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
                className={`text-center font-semibold uppercase tracking-widest ${
                  mode === 'month' ? 'text-[0.6875rem]' : mode === '3week' ? 'text-xs' : 'text-[0.8125rem]'
                } ${
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
            We render all weeks up front — no lazy loading needed for 3 months.
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
                  const weekDateKeys = week.map(d => format(d, 'yyyy-MM-dd'))
                  const weekBanners: CalendarEvent[] = []
                  const seenBannerIds = new Set<string>()
                  for (const dk of weekDateKeys) {
                    const evs = eventsByDate.get(dk) ?? []
                    for (const ev of evs) {
                      const bounds = eventBoundsMap.get(ev.id)
                      if (!isAmbientCalendarEvent(ev) && (ev.all_day || bounds?.isMultiDay)) {
                        if (!seenBannerIds.has(ev.id)) {
                          seenBannerIds.add(ev.id)
                          weekBanners.push(ev)
                        }
                      }
                    }
                  }
                  weekBanners.sort((a, b) => {
                    const boundsA = eventBoundsMap.get(a.id)!
                    const boundsB = eventBoundsMap.get(b.id)!
                    const startDiff = boundsA.firstDay.localeCompare(boundsB.firstDay)
                    if (startDiff !== 0) return startDiff
                    const durA = boundsA.dates.length
                    const durB = boundsB.dates.length
                    if (durA !== durB) return durB - durA
                    return a.start_at.localeCompare(b.start_at)
                  })
                  const slotOccupancies: boolean[][] = []
                  const bannerSlotMap = new Map<string, number>()
                  for (const ev of weekBanners) {
                    const bounds = eventBoundsMap.get(ev.id)!
                    let foundSlot = -1
                    for (let s = 0; s < slotOccupancies.length; s++) {
                      let conflict = false
                      for (let d = 0; d < 7; d++) {
                        if (bounds.dates.includes(weekDateKeys[d]) && slotOccupancies[s][d]) {
                          conflict = true
                          break
                        }
                      }
                      if (!conflict) {
                        foundSlot = s
                        break
                      }
                    }
                    if (foundSlot === -1) {
                      foundSlot = slotOccupancies.length
                      slotOccupancies.push(Array(7).fill(false))
                    }
                    for (let d = 0; d < 7; d++) {
                      if (bounds.dates.includes(weekDateKeys[d])) {
                        slotOccupancies[foundSlot][d] = true
                      }
                    }
                    bannerSlotMap.set(ev.id, foundSlot)
                  }
                  const totalBannerSlots = slotOccupancies.length

                  return (
                    <div
                      key={wi}
                      className="grid grid-cols-7 border-b border-sand-100 last:border-0 min-h-0"
                      style={isSnapPoint ? { scrollSnapAlign: 'start' } : undefined}
                    >
                      {week.map((day, dayIdx) => {
                        const key = format(day, 'yyyy-MM-dd')
                        const dayEvents = eventsByDate.get(key) ?? []
                        const dayTasks = tasksByDate.get(key) ?? []
                        const isCurrentDay = isToday(day)
                        const isWeekend = day.getDay() === 0 || day.getDay() === 6

                        const dayBannerSlots: (CalendarEvent | null)[] = Array(totalBannerSlots).fill(null)
                        for (const ev of dayEvents) {
                          const bounds = eventBoundsMap.get(ev.id)
                          if (!isAmbientCalendarEvent(ev) && (ev.all_day || bounds?.isMultiDay)) {
                            const slot = bannerSlotMap.get(ev.id)
                            if (slot !== undefined) {
                              dayBannerSlots[slot] = ev
                            }
                          }
                        }

                        const singleDayEvents = dayEvents.filter(ev => {
                          const bounds = eventBoundsMap.get(ev.id)
                          return !isAmbientCalendarEvent(ev) && !ev.all_day && !bounds?.isMultiDay
                        })
                        type Pill = { type: 'event'; ev: CalendarEvent } | { type: 'task'; task: Task }
                        const personalPills: Pill[] = [
                          ...singleDayEvents.map(ev => ({ type: 'event' as const, ev })),
                          ...dayTasks.map(task => ({ type: 'task' as const, task })),
                        ]
                        const ambientPills: { type: 'event'; ev: CalendarEvent }[] = dayEvents
                          .filter(ev => isAmbientCalendarEvent(ev))
                          .map(ev => ({ type: 'event' as const, ev }))

                        const lastOccupiedSlot = dayBannerSlots.map(ev => ev !== null).lastIndexOf(true)
                        const renderedBannerSlots = dayBannerSlots.slice(0, lastOccupiedSlot + 1)
                        const hasOtherContent = renderedBannerSlots.some(ev => ev !== null) || personalPills.length > 0

                        return (
                          <div
                            key={key}
                            className={`relative flex flex-col border-r border-sand-100 last:border-r-0 overflow-hidden min-h-0 cursor-pointer
                              ${isWeekend && !isCurrentDay ? 'bg-[#faf8f5]' : 'bg-white'}
                              ${isCurrentDay ? 'bg-terracotta-500/[0.09]' : ''}
                            `}
                            onClick={() => setFormDate(day)}
                          >
                            {isCurrentDay && (
                              <div className="absolute top-0 inset-x-0 h-[3px] bg-terracotta-500" />
                            )}
                            <div className={`flex flex-col h-full ${mode === 'month' ? 'p-1.5 gap-px' : 'p-2 gap-1'}`}>
                              <div className="flex-shrink-0 mb-0.5">
                                {isCurrentDay ? (
                                  // Outline ring — subtle, lighter feel
                                  <span className={`inline-flex items-center justify-center rounded-full border border-terracotta-400 text-terracotta-500 font-semibold leading-none ${
                                    mode === 'month' ? 'h-[1.375rem] w-[1.375rem] text-[0.6875rem]' : 'h-[1.625rem] w-[1.625rem] text-[0.8125rem]'
                                  }`}>
                                    {format(day, 'd')}
                                  </span>
                                ) : (
                                  <span className={`
                                    inline-flex items-center justify-center rounded-full font-bold leading-none
                                    ${mode === 'month' ? 'h-[1.125rem] w-[1.125rem] text-[0.625rem]' : 'h-[1.375rem] w-[1.375rem] text-[0.75rem]'}
                                    ${isWeekend ? 'text-brown-700/30' : 'text-brown-700/60'}
                                  `}>
                                    {format(day, 'd')}
                                  </span>
                                )}
                              </div>
                              <div className={`flex flex-col flex-1 min-h-0 ${mode === 'month' ? 'gap-px' : 'gap-1'}`}>
                                {renderedBannerSlots.map((ev, slotIdx) => {
                                  if (!ev) {
                                    return <BannerSpacer key={`spacer-${slotIdx}-${key}`} mode={mode} />
                                  }
                                  const bounds = eventBoundsMap.get(ev.id)!
                                  const isRealStart = key === bounds.firstDay
                                  const isRealEnd = key === bounds.lastDay
                                  const isRowStart = dayIdx === 0
                                  const showTitle = isRealStart || isRowStart
                                  return (
                                    <EventPill
                                      key={`${ev.id}-${key}`}
                                      ev={ev}
                                      mode={mode}
                                      colorRules={colorRules}
                                      calColor={calColorMap.get(ev.source_calendar_id)}
                                      onClick={e => { e.stopPropagation(); setEditEvent(ev) }}
                                      isBanner={true}
                                      isStart={isRealStart}
                                      isEnd={isRealEnd}
                                      showTitle={showTitle}
                                    />
                                  )
                                })}
                                {personalPills.map((pill) => pill.type === 'event'
                                  ? <EventPill
                                      key={`${pill.ev.id}-${key}`}
                                      ev={pill.ev}
                                      mode={mode}
                                      colorRules={colorRules}
                                      calColor={calColorMap.get(pill.ev.source_calendar_id)}
                                      onClick={e => { e.stopPropagation(); setEditEvent(pill.ev) }}
                                    />
                                  : <TaskPill
                                      key={pill.task.id}
                                      task={pill.task}
                                      mode={mode}
                                      onClick={onSelectTask ? (e) => { e.stopPropagation(); onSelectTask(pill.task); } : undefined}
                                    />
                                )}
                                {ambientPills.length > 0 && (
                                  <>
                                    {hasOtherContent && <div className="flex-1 min-h-0" />}
                                    {ambientPills.map((pill) => (
                                      <EventPill
                                        key={`${pill.ev.id}-${key}`}
                                        ev={pill.ev}
                                        mode={mode}
                                        colorRules={colorRules}
                                        calColor={calColorMap.get(pill.ev.source_calendar_id)}
                                        onClick={e => { e.stopPropagation(); setEditEvent(pill.ev) }}
                                      />
                                    ))}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
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

// ── Helpers ────────────────────────────────────────────────────────────────

// Birthday (#contacts) and holiday (#holiday) calendars are "ambient" —
// they render compact and are pinned to the bottom of the day cell.
function isAmbientCalendarEvent(ev: CalendarEvent): boolean {
  return !!(
    ev.source_calendar_id?.includes('#holiday') ||
    ev.source_calendar_id?.includes('#contacts')
  )
}

function darkenForReadability(hex: string): string {
  if (!hex || hex.length < 7) return hex
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  if (luminance <= 0.45) return hex
  const dr = Math.round(r * 0.5)
  const dg = Math.round(g * 0.5)
  const db = Math.round(b * 0.5)
  return `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`
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
  mode = 'month',
  colorRules,
  calColor,
  onClick,
  isBanner = false,
  isStart = true,
  isEnd = true,
  showTitle = true,
}: {
  ev: CalendarEvent
  mode?: CalendarMode
  colorRules?: import('@/features/settings/use-event-color-rules').EventColorRule[]
  calColor?: string
  onClick?: (e: React.MouseEvent) => void
  isBanner?: boolean
  isStart?: boolean
  isEnd?: boolean
  showTitle?: boolean
}) {
  // Color rule overrides take priority over connected calendar color, which takes priority over event color
  const ruleColor = applyColorRules(ev.title, colorRules)
  const color = ruleColor ?? calColor ?? ev.color ?? '#5B7FB5'
  const textColor = darkenForReadability(color)

  const label = (!ev.all_day && !isBanner)
    ? `${formatTimeShort(ev.start_at)} ${ev.title}`
    : (!ev.all_day && isStart)
    ? `${formatTimeShort(ev.start_at)} ${ev.title}`
    : ev.title

  const barWidth = mode === 'month' ? 'w-[0.1875rem]' : mode === '3week' ? 'w-1' : 'w-1.5'
  const padding = mode === 'month' ? 'px-1 py-px' : mode === '3week' ? 'px-1.5 py-1' : 'px-2 py-1.5'
  const textSize = mode === 'month'
    ? 'text-[0.625rem] font-medium leading-snug'
    : mode === '3week'
    ? 'text-[0.84375rem] font-semibold leading-snug'
    : 'text-[0.9375rem] font-semibold leading-snug'

  const negMarginLeft = isBanner && !isStart ? (mode === 'month' ? '-7px' : '-9px') : undefined
  const negMarginRight = isBanner && !isEnd ? (mode === 'month' ? '-7px' : '-9px') : undefined

  const compPaddingLeft = isBanner && !isStart && showTitle
    ? (mode === 'month' ? '11px' : mode === '3week' ? '15px' : '17px')
    : undefined

  const roundedClass = !isBanner
    ? 'rounded'
    : isStart && isEnd
    ? 'rounded'
    : isStart && !isEnd
    ? 'rounded-l rounded-r-none'
    : !isStart && isEnd
    ? 'rounded-r rounded-l-none'
    : 'rounded-none'

  return (
    <div
      className={`flex items-stretch overflow-hidden flex-shrink-0 cursor-pointer hover:brightness-95 active:brightness-90 transition-[filter] ${roundedClass}`}
      style={{
        backgroundColor: `${color}18`,
        marginLeft: negMarginLeft,
        marginRight: negMarginRight,
      }}
      title={ev.title}
      onClick={onClick}
    >
      {(!isBanner || isStart) && (
        <div className={`${barWidth} flex-shrink-0 ${isStart ? 'rounded-l' : ''}`} style={{ backgroundColor: color }} />
      )}
      <div
        className={`flex items-center ${padding} min-w-0 flex-1`}
        style={compPaddingLeft ? { paddingLeft: compPaddingLeft } : undefined}
      >
        <span className={`truncate ${textSize}`} style={{ color: textColor }}>
          {showTitle ? label : '\u00A0'}
        </span>
      </div>
    </div>
  )
}

function BannerSpacer({ mode = 'month' }: { mode?: CalendarMode }) {
  const padding = mode === 'month' ? 'px-1 py-px' : mode === '3week' ? 'px-1.5 py-1' : 'px-2 py-1.5'
  const textSize = mode === 'month'
    ? 'text-[0.625rem] font-medium leading-snug'
    : mode === '3week'
    ? 'text-[0.84375rem] font-semibold leading-snug'
    : 'text-[0.9375rem] font-semibold leading-snug'

  return (
    <div className="flex items-stretch overflow-hidden flex-shrink-0 opacity-0 pointer-events-none">
      <div className={`flex items-center ${padding} min-w-0 flex-1`}>
        <span className={`truncate ${textSize}`}>{"\u00A0"}</span>
      </div>
    </div>
  )
}

function TaskPill({
  task,
  mode = 'month',
  onClick,
}: {
  task: Task
  mode?: CalendarMode
  onClick?: (e: React.MouseEvent) => void
}) {
  const color = task.assigned_member?.avatar_color ?? '#C4714F'
  const barWidth = mode === 'month' ? 'w-[0.1875rem]' : mode === '3week' ? 'w-1' : 'w-1.5'
  const padding = mode === 'month' ? 'px-1 py-px' : mode === '3week' ? 'px-1.5 py-1' : 'px-2 py-1.5'
  const checkSize = mode === 'month' ? 'text-[0.625rem]' : mode === '3week' ? 'text-[0.75rem]' : 'text-[0.875rem]'
  const textSize = mode === 'month'
    ? 'text-[0.75rem] font-medium leading-snug'
    : mode === '3week'
    ? 'text-[0.84375rem] font-semibold leading-snug'
    : 'text-[0.9375rem] font-semibold leading-snug'

  return (
    <div
      onClick={onClick}
      className={`flex items-stretch rounded overflow-hidden flex-shrink-0 ${
        onClick ? 'cursor-pointer hover:brightness-95 active:brightness-90 transition-[filter]' : ''
      }`}
      style={{ backgroundColor: `${color}18` }}
      title={task.title}
    >
      <div className={`${barWidth} flex-shrink-0 rounded-l opacity-40`} style={{ backgroundColor: color }} />
      <div className={`flex items-center gap-1 ${padding} min-w-0`}>
        <span className={`${checkSize} flex-shrink-0`} style={{ color, opacity: 0.6 }}>✓</span>
        <span className={`truncate ${textSize}`} style={{ color }}>
          {task.title}
        </span>
      </div>
    </div>
  )
}

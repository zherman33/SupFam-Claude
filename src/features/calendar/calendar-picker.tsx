import { useState } from 'react'
import { useConnectedCalendars, useToggleCalendarVisibility, useSyncCalendars, useUpdateCalendarColor } from './use-calendar'
import { getCalendarColor } from '@/features/settings/theme-context'

const COLOR_PALETTE = [
  { name: 'Terracotta', hex: '#C4714F', cssVar: 'var(--color-cal-1)' },
  { name: 'Sage', hex: '#5E7C67', cssVar: 'var(--color-cal-2)' },
  { name: 'Steel Blue', hex: '#4F7396', cssVar: 'var(--color-cal-3)' },
  { name: 'Lavender', hex: '#7B6F9A', cssVar: 'var(--color-cal-4)' },
  { name: 'Rose', hex: '#BC5D76', cssVar: 'var(--color-cal-5)' },
  { name: 'Ochre', hex: '#C68A2C', cssVar: 'var(--color-cal-6)' },
  { name: 'Slate', hex: '#6E7A8A', cssVar: 'var(--color-cal-7)' }
]

interface CalendarPickerProps {
  onClose: () => void
  /** When true, renders as a flat list with no card chrome (used inside the ⋯ menu) */
  inline?: boolean
}

export function CalendarPicker({ onClose, inline = false }: CalendarPickerProps) {
  const { data: calendars, isLoading } = useConnectedCalendars()
  const toggle = useToggleCalendarVisibility()
  const sync = useSyncCalendars()
  const updateColor = useUpdateCalendarColor()
  const [activeColorPickerId, setActiveColorPickerId] = useState<string | null>(null)

  // Group by owner
  const byOwner = new Map<string, typeof calendars>()
  for (const cal of calendars ?? []) {
    const ownerName = (cal.owner as any)?.display_name ?? 'Unknown'
    if (!byOwner.has(ownerName)) byOwner.set(ownerName, [])
    byOwner.get(ownerName)!.push(cal)
  }

  const body = (
    <>
      {/* Sync row */}
      <div className={`flex items-center justify-between ${inline ? 'px-4 py-2' : 'px-4 py-3 border-b border-sand-100'}`}>
        {!inline && <h3 className="text-sm font-semibold text-brown-800">Calendars</h3>}
        {inline && <span className="text-xs text-brown-700/50">Calendars</span>}
        <div className="flex items-center gap-2">
          <button
            onClick={() => sync.mutate(undefined)}
            disabled={sync.isPending}
            className="flex items-center gap-1 text-xs font-semibold text-brown-700/50 hover:text-terracotta-500 transition-colors disabled:opacity-40"
          >
            <svg className={`h-3 w-3 ${sync.isPending ? 'animate-spin' : ''}`} viewBox="0 0 14 14" fill="none">
              <path d="M12 7A5 5 0 1 1 7 2M12 2v4H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {sync.isPending ? 'Syncing…' : 'Sync'}
          </button>
          {!inline && (
            <button onClick={onClose} className="rounded-lg p-1 text-brown-700/40 hover:bg-cream-100 hover:text-brown-700">
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-1.5 p-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-7 animate-pulse rounded-lg bg-sand-100"/>
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && (!calendars || calendars.length === 0) && (
        <div className="px-4 py-3 text-xs text-brown-700/40">
          No calendars yet — hit Sync to fetch them.
        </div>
      )}

      {/* Calendar list grouped by owner */}
      {Array.from(byOwner.entries()).map(([ownerName, cals]) => (
        <div key={ownerName}>
          <div className="bg-cream-50 px-4 py-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-brown-700/40">
              {ownerName}
            </p>
          </div>
          <div className="px-2 py-1 space-y-px">
            {cals!.map(cal => {
              const isPickerOpen = activeColorPickerId === cal.id
              return (
                <div
                  key={cal.id}
                  onClick={() => toggle.mutate({ id: cal.id, is_visible: !cal.is_visible })}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-cream-50 relative cursor-pointer select-none"
                >
                  {/* Visibility Checkbox */}
                  <div
                    className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors ${
                      cal.is_visible
                        ? 'border-terracotta-400 bg-terracotta-400 text-white'
                        : 'border-sand-400 bg-white'
                    }`}
                  >
                    {cal.is_visible && (
                      <svg className="h-2.5 w-2.5" viewBox="0 0 10 10" fill="none">
                        <path
                          d="M1.5 5l2.5 2.5 4.5-4.5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>

                  {/* Color swatch trigger */}
                  <div className="relative flex-shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveColorPickerId(isPickerOpen ? null : cal.id)
                      }}
                      className="relative flex-shrink-0 h-4 w-4 rounded-full border border-sand-200/60 hover:scale-110 active:scale-95 focus:outline-none transition-transform cursor-pointer flex items-center justify-center"
                      style={{
                        backgroundColor: getCalendarColor(cal.color),
                      }}
                      title="Change calendar color"
                    >
                      {isPickerOpen && (
                        <div className="absolute inset-0 m-auto h-1 w-1 rounded-full bg-white animate-ping" />
                      )}
                    </button>

                    {/* Inline Color Picker Popover */}
                    {isPickerOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={(e) => {
                            e.stopPropagation()
                            setActiveColorPickerId(null)
                          }}
                        />
                        <div className="absolute left-6 -top-1.5 z-50 flex gap-1 p-1 rounded-lg border border-sand-200 bg-white shadow-lg animate-in fade-in slide-in-from-left-1 duration-150">
                          {COLOR_PALETTE.map((color) => (
                            <button
                              key={color.hex}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                updateColor.mutate({ id: cal.id, color: color.hex })
                                setActiveColorPickerId(null)
                              }}
                              className="h-4 w-4 rounded-full hover:scale-110 active:scale-95 transition-transform border border-sand-200/50 cursor-pointer flex items-center justify-center"
                              style={{ backgroundColor: color.cssVar }}
                              title={color.name}
                            >
                              {getCalendarColor(cal.color) === color.cssVar && (
                                <div className="h-1.5 w-1.5 rounded-full bg-white shadow-sm" />
                              )}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Clickable text to toggle visibility */}
                  <span className={`text-xs block truncate flex-1 ${cal.is_visible ? 'text-brown-800' : 'text-brown-700/35'}`}>
                    {cal.calendar_name ?? cal.calendar_id}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Status bar */}
      {sync.isSuccess && (
        <div className="px-4 py-2 border-t border-sand-100">
          <p className="text-[11px] text-green-600 font-medium">✓ Synced</p>
        </div>
      )}
      {sync.isError && (
        <div className="px-4 py-2 border-t border-sand-100">
          <p className="text-[11px] text-red-500">Sync failed — try signing out and back in.</p>
        </div>
      )}
    </>
  )

  if (inline) return <div>{body}</div>

  return (
    <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-sand-200 bg-white shadow-lg overflow-hidden">
      {body}
    </div>
  )
}

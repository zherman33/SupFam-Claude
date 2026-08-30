import { useState } from 'react'
import {
  useConnectedCalendars,
  useToggleCalendarVisibility,
  useToggleQuickToggle,
  useSyncCalendars,
  useUpdateCalendarColor,
  useDeleteConnectedCalendar,
} from './use-calendar'
import { AddCalendarModal } from './add-calendar-modal'
import { getCalendarColor } from '@/features/settings/theme-context'

interface CalendarPickerProps {
  onClose: () => void
  /** When true, renders as a flat list with no card chrome (used inside the ⋯ menu) */
  inline?: boolean
}

const COLOR_PALETTE = [
  { name: 'Terracotta', hex: '#C4714F', cssVar: 'var(--color-cal-1)' },
  { name: 'Sage', hex: '#5E7C67', cssVar: 'var(--color-cal-2)' },
  { name: 'Steel Blue', hex: '#4F7396', cssVar: 'var(--color-cal-3)' },
  { name: 'Lavender', hex: '#7B6F9A', cssVar: 'var(--color-cal-4)' },
  { name: 'Rose', hex: '#BC5D76', cssVar: 'var(--color-cal-5)' },
  { name: 'Ochre', hex: '#C68A2C', cssVar: 'var(--color-cal-6)' },
  { name: 'Slate', hex: '#6E7A8A', cssVar: 'var(--color-cal-7)' },
]

export function CalendarPicker({ onClose, inline = false }: CalendarPickerProps) {
  const { data: calendars, isLoading } = useConnectedCalendars()
  const toggle = useToggleCalendarVisibility()
  const toggleQuick = useToggleQuickToggle()
  const sync = useSyncCalendars()
  const updateColor = useUpdateCalendarColor()
  const deleteCal = useDeleteConnectedCalendar()
  const [editingColorId, setEditingColorId] = useState<string | null>(null)
  const [addModalOpen, setAddModalOpen] = useState(false)

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
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-0.5 text-xs font-semibold text-terracotta-500 hover:text-terracotta-600 transition-colors"
          >
            <span className="text-[13px] leading-none">+</span> Add
          </button>
          <span className="text-brown-700/15 text-xs">|</span>
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
            {cals!.map(cal => (
              <div key={cal.id} className="flex flex-col">
                <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-cream-50">
                  {/* Color swatch with check - clickable to edit color */}
                  <button
                    type="button"
                    title="Click to customize calendar color"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setEditingColorId(editingColorId === cal.id ? null : cal.id)
                    }}
                    className="relative flex-shrink-0 h-4 w-4 rounded-full transition-transform hover:scale-110 focus:outline-none ring-1 ring-black/5"
                    style={{
                      backgroundColor: getCalendarColor(cal.color),
                      opacity: cal.is_visible ? 1 : 0.25,
                    }}
                  >
                    {cal.is_visible && (
                      <svg className="absolute inset-0 m-auto h-2.5 w-2.5 text-white" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2.5 2.5 3.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>

                  {/* Calendar name & visibility toggle */}
                  <label className="flex-1 flex items-center cursor-pointer min-w-0">
                    <span className={`truncate text-xs ${cal.is_visible ? 'text-brown-800 font-medium' : 'text-brown-700/35'}`}>
                      {cal.calendar_name ?? cal.calendar_id}
                    </span>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={cal.is_visible}
                      onChange={e => toggle.mutate({ id: cal.id, is_visible: e.target.checked })}
                    />
                  </label>

                  {/* Quick toggle button */}
                  <button
                    type="button"
                    title={cal.is_quick_toggle ? "Quick toggle button shown on main screen (click to remove)" : "Add quick toggle button to main screen"}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      toggleQuick.mutate({ id: cal.id, is_quick_toggle: !cal.is_quick_toggle })
                    }}
                    className={`rounded p-1 transition-colors flex-shrink-0 ${
                      cal.is_quick_toggle
                        ? 'text-terracotta-500 bg-terracotta-50 hover:bg-terracotta-100'
                        : 'text-brown-700/25 hover:bg-cream-100 hover:text-brown-700/60'
                    }`}
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill={cal.is_quick_toggle ? "currentColor" : "none"}>
                      <path d="M9 2L3 9H8L7 14L13 7H8L9 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>

                  {/* Delete button (only for subscribed/external calendars) */}
                  {cal.ics_url && (
                    <button
                      type="button"
                      title="Remove calendar subscription"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        if (confirm(`Remove "${cal.calendar_name ?? 'this calendar'}" subscription? This will delete all its synced events.`)) {
                          deleteCal.mutate({ id: cal.id, calendar_id: cal.calendar_id })
                        }
                      }}
                      className="rounded p-1 text-brown-700/30 hover:bg-red-50 hover:text-red-500 transition-colors flex-shrink-0"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
                        <path d="M3 4h10M6 4V3h4v1M5 4l.5 9h5l.5-9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  )}
                </div>

                {/* Inline color picker tray */}
                {editingColorId === cal.id && (
                  <div className="mx-2 my-1 p-2 bg-cream-100 rounded-lg border border-sand-200 space-y-2 shadow-inner">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-brown-700">
                      <span>Default color</span>
                      <button
                        type="button"
                        onClick={() => setEditingColorId(null)}
                        className="text-brown-700/40 hover:text-brown-800"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {COLOR_PALETTE.map(color => (
                        <button
                          key={color.hex}
                          type="button"
                          title={color.name}
                          onClick={() => {
                            updateColor.mutate({ id: cal.id, color: color.hex, calendar_id: cal.calendar_id })
                            setEditingColorId(null)
                          }}
                          className="h-5 w-5 rounded-full transition-transform hover:scale-110 flex items-center justify-center shadow-sm"
                          style={{ backgroundColor: color.cssVar }}
                        >
                          {(cal.color ?? '#C4714F').toUpperCase() === color.hex.toUpperCase() && (
                            <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 10" fill="none">
                              <path d="M2 5l2.5 2.5 3.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </button>
                      ))}
                      <label className="h-5 w-5 rounded-full border border-dashed border-sand-400 cursor-pointer flex items-center justify-center hover:border-terracotta-500 transition-colors bg-white shadow-sm" title="Custom color">
                        <input
                          type="color"
                          value={cal.color ?? '#C4714F'}
                          onChange={(e) => updateColor.mutate({ id: cal.id, color: e.target.value, calendar_id: cal.calendar_id })}
                          className="sr-only"
                        />
                        <span className="text-[11px] text-brown-700/60 font-bold leading-none">+</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            ))}
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

  if (inline) {
    return (
      <>
        <div>{body}</div>
        {addModalOpen && <AddCalendarModal onClose={() => setAddModalOpen(false)} />}
      </>
    )
  }

  return (
    <>
      <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-sand-200 bg-white shadow-lg overflow-hidden">
        {body}
      </div>
      {addModalOpen && <AddCalendarModal onClose={() => setAddModalOpen(false)} />}
    </>
  )
}

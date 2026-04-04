import { useConnectedCalendars, useToggleCalendarVisibility, useSyncCalendars } from './use-calendar'

interface CalendarPickerProps {
  onClose: () => void
  /** When true, renders as a flat list with no card chrome (used inside the ⋯ menu) */
  inline?: boolean
}

export function CalendarPicker({ onClose, inline = false }: CalendarPickerProps) {
  const { data: calendars, isLoading } = useConnectedCalendars()
  const toggle = useToggleCalendarVisibility()
  const sync = useSyncCalendars()

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
            onClick={() => sync.mutate()}
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
              <label
                key={cal.id}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-cream-50"
              >
                {/* Color swatch with check */}
                <div className="relative flex-shrink-0 h-4 w-4">
                  <div
                    className="h-4 w-4 rounded"
                    style={{
                      backgroundColor: cal.color ?? '#C4714F',
                      opacity: cal.is_visible ? 1 : 0.25,
                    }}
                  />
                  {cal.is_visible && (
                    <svg className="absolute inset-0 m-auto h-2.5 w-2.5 text-white" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2.5 2.5 3.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>

                <span className={`flex-1 text-xs ${cal.is_visible ? 'text-brown-800' : 'text-brown-700/35'}`}>
                  {cal.calendar_name ?? cal.calendar_id}
                </span>

                <input
                  type="checkbox"
                  className="sr-only"
                  checked={cal.is_visible}
                  onChange={e => toggle.mutate({ id: cal.id, is_visible: e.target.checked })}
                />
              </label>
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

  if (inline) return <div>{body}</div>

  return (
    <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-sand-200 bg-white shadow-lg overflow-hidden">
      {body}
    </div>
  )
}

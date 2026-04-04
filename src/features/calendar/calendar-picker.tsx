import { useConnectedCalendars, useToggleCalendarVisibility, useSyncCalendars } from './use-calendar'

export function CalendarPicker({ onClose }: { onClose: () => void }) {
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

  return (
    <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-sand-200 bg-white shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-sand-100 px-4 py-3">
        <h3 className="text-sm font-medium text-brown-800">Calendars</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-cream-100 px-3 py-1 text-xs font-medium text-brown-700 transition-colors hover:bg-cream-200 disabled:opacity-50"
          >
            <svg
              className={`h-3 w-3 ${sync.isPending ? 'animate-spin' : ''}`}
              viewBox="0 0 14 14"
              fill="none"
            >
              <path
                d="M12 7A5 5 0 1 1 7 2M12 2v4H8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {sync.isPending ? 'Syncing…' : 'Sync now'}
          </button>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-brown-700/40 hover:bg-cream-100 hover:text-brown-700"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="max-h-96 overflow-y-auto">
        {isLoading && (
          <div className="space-y-2 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 animate-pulse rounded-lg bg-sand-100" />
            ))}
          </div>
        )}

        {!isLoading && (!calendars || calendars.length === 0) && (
          <div className="p-4 text-center">
            <p className="text-sm text-brown-700/60">No calendars connected yet.</p>
            <p className="mt-1 text-xs text-brown-700/40">
              Click "Sync now" to fetch your Google calendars.
            </p>
          </div>
        )}

        {Array.from(byOwner.entries()).map(([ownerName, cals]) => (
          <div key={ownerName} className="border-b border-sand-100 last:border-0">
            <div className="bg-cream-50 px-4 py-2">
              <p className="text-xs font-medium text-brown-700/60 uppercase tracking-wide">
                {ownerName}
              </p>
            </div>
            <div className="p-2 space-y-0.5">
              {cals!.map((cal) => (
                <label
                  key={cal.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-cream-50"
                >
                  {/* Color swatch + checkbox */}
                  <div className="relative flex-shrink-0">
                    <div
                      className="h-5 w-5 rounded"
                      style={{
                        backgroundColor: cal.color ?? '#C4714F',
                        opacity: cal.is_visible ? 1 : 0.3,
                      }}
                    />
                    {cal.is_visible && (
                      <svg
                        className="absolute inset-0 m-auto h-3 w-3 text-white"
                        viewBox="0 0 12 12"
                        fill="none"
                      >
                        <path
                          d="M2 6l3 3 5-5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>

                  <span
                    className={`flex-1 text-sm ${
                      cal.is_visible ? 'text-brown-800' : 'text-brown-700/40'
                    }`}
                  >
                    {cal.calendar_name ?? cal.calendar_id}
                  </span>

                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={cal.is_visible}
                    onChange={(e) =>
                      toggle.mutate({ id: cal.id, is_visible: e.target.checked })
                    }
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {sync.isSuccess && (
        <div className="border-t border-sand-100 bg-green-50 px-4 py-2">
          <p className="text-xs text-green-700">
            ✓ Synced successfully
          </p>
        </div>
      )}

      {sync.isError && (
        <div className="border-t border-sand-100 bg-red-50 px-4 py-2">
          <p className="text-xs text-red-600">
            Sync failed — check that your Google Calendar token is still valid.
          </p>
        </div>
      )}
    </div>
  )
}

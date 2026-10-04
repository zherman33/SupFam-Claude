import { useState, useEffect } from 'react'
import { SystemSettings } from '@/lib/system-settings'
import {
  useEventColorRules,
  useCreateEventColorRule,
  useUpdateEventColorRule,
  useDeleteEventColorRule,
  type EventColorRule,
} from './use-event-color-rules'
import { useTheme, THEMES } from './theme-context'
import {
  useConnectedCalendars,
  useUpdateCalendarColor,
  useDeleteConnectedCalendar,
  useToggleQuickToggle,
  useToggleCalendarVisibility,
  type ConnectedCalendar,
} from '@/features/calendar/use-calendar'
import { AddCalendarModal } from '@/features/calendar/add-calendar-modal'
import {
  FONT_SIZE_STEPS,
  LOCAL_STORAGE_KEY,
  getSavedFontSize,
  applyFontSize,
  type FontSizeScale,
} from './font-size-utils'
import { BillingSettings } from '@/features/billing/billing-settings'
import { DinnerAiTab } from './dinner-ai-tab'
import { ReleaseNotesPanel } from './release-notes-panel'
import { YouSection, FamilySection } from './account-sections'
import { openSupportDialog } from './settings-events'
import { APP_VERSION, APP_UPDATE_DATE } from '@/lib/version'

const PRESET_COLORS = [
  { label: 'Pink', value: '#E91E8C' },
  { label: 'Red', value: '#F44336' },
  { label: 'Orange', value: '#FF9800' },
  { label: 'Yellow', value: '#FFC107' },
  { label: 'Green', value: '#4CAF50' },
  { label: 'Teal', value: '#009688' },
  { label: 'Blue', value: '#2196F3' },
  { label: 'Purple', value: '#9C27B0' },
  { label: 'Brown', value: '#795548' },
  { label: 'Terracotta', value: '#C4714F' },
]

export type SettingsGroup =
  | 'you'
  | 'family'
  | 'calendars'
  | 'appearance'
  | 'display'
  | 'dinner-ai'
  | 'billing'
  | 'about'
  | 'notifications'

const GROUP_META: { id: SettingsGroup; label: string; icon: React.ReactNode }[] = [
  {
    id: 'you',
    label: 'You',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M2.5 13.5c.8-2.6 2.9-4 5.5-4s4.7 1.4 5.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'family',
    label: 'Family',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
        <circle cx="5.5" cy="6" r="2.3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M1.5 13.2c.7-2.3 2.2-3.5 4-3.5s3.3 1.2 4 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="11.3" cy="6.4" r="1.8" stroke="currentColor" strokeWidth="1.5" />
        <path d="M9.4 13.2c.5-1.7 1.5-2.6 2.9-2.6 1 0 1.9.5 2.4 1.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'calendars',
    label: 'Calendars',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
        <path d="M3.5 2V3.5M12.5 2V3.5M2.5 5.5H13.5M3.5 3.5H12.5C13.0523 3.5 13.5 3.94772 13.5 4.5V13.5C13.5 14.0523 13.0523 14.5 12.5 14.5H3.5C2.94772 14.5 2.5 14.0523 2.5 13.5V4.5C2.5 3.94772 2.94772 3.5 3.5 3.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'appearance',
    label: 'Appearance',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 2.5a5.5 5.5 0 0 1 0 11Z" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: 'display',
    label: 'This display',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
        <rect x="2.5" y="3" width="11" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6 13.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'dinner-ai',
    label: 'Dinner AI',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
        <path d="M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    id: 'billing',
    label: 'Billing',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
        <rect x="2.5" y="4" width="11" height="8.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M2.5 7h11" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    id: 'about',
    label: 'About',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 7.4V11M8 5.2v.3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
        <path d="M8 2.5a3.5 3.5 0 0 1 3.5 3.5c0 2.5.8 3.5 1.5 4.5H3c.7-1 1.5-2 1.5-4.5A3.5 3.5 0 0 1 8 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M6.6 13a1.5 1.5 0 0 0 2.8 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
]

const LAST_GROUP_KEY = 'supfam-settings-group'

/** One settings home: stable groups, plain-language labels, remembered position. */
export function SettingsPanel({
  onClose,
  initialGroup,
}: {
  onClose: () => void
  initialGroup?: SettingsGroup
}) {
  const [group, setGroup] = useState<SettingsGroup>(() => {
    if (initialGroup && GROUP_META.some(g => g.id === initialGroup)) return initialGroup
    try {
      const saved = localStorage.getItem(LAST_GROUP_KEY)
      if (saved && GROUP_META.some(g => g.id === saved)) return saved as SettingsGroup
    } catch {
      /* storage unavailable */
    }
    return 'you'
  })
  const [notesOpen, setNotesOpen] = useState(false)

  // Remember where people left off so they don't re-orient every visit.
  useEffect(() => {
    try {
      localStorage.setItem(LAST_GROUP_KEY, group)
    } catch {
      /* storage unavailable */
    }
  }, [group])

  // Escape closes, everywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    // Full-screen overlay
    <div className="fixed inset-0 z-50 flex items-stretch justify-end animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-brown-950/15 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />

      {/* Panel — slides in from the right */}
      <div className="relative z-10 flex flex-col bg-cream-50 w-full max-w-2xl shadow-2xl border-l border-sand-200 animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex flex-col border-b border-sand-200/80 bg-white px-6 pt-5 pb-0 flex-shrink-0">
          <div className="flex items-start justify-between pb-4">
            <div>
              <h2 className="font-serif text-2xl font-normal text-brown-800">Settings</h2>
              <p className="text-xs text-brown-700/60 mt-1 font-sans">
                You, your family, and this display — all in one place
              </p>
            </div>
            <button
              onClick={onClose}
              title="Close settings"
              aria-label="Close settings"
              className="rounded-xl p-2 text-brown-700/50 hover:bg-sand-100 hover:text-brown-800 transition-colors"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none">
                <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Group navigation */}
          <div className="flex items-center gap-2 -mb-px overflow-x-auto no-scrollbar" role="tablist" aria-label="Settings groups">
            {GROUP_META.map(g => (
              <TabButton
                key={g.id}
                active={group === g.id}
                onClick={() => setGroup(g.id)}
                icon={g.icon}
                label={g.label}
              />
            ))}
          </div>
        </div>

        {/* Scrollable group content */}
        <div className="flex-1 overflow-y-auto p-6">
          {group === 'you' && <YouSection />}
          {group === 'family' && <FamilySection />}
          {group === 'calendars' && (
            <div className="space-y-6">
              <ConnectedCalendarsSection />
              <ColorRulesSection />
            </div>
          )}
          {group === 'appearance' && (
            <div className="space-y-6">
              <ColorThemeSection />
              <TextSizeSection />
            </div>
          )}
          {group === 'display' && <ThisDisplaySection />}
          {group === 'dinner-ai' && <DinnerAiTab />}
          {group === 'billing' && <BillingSettings />}
          {group === 'about' && <AboutSection onOpenNotes={() => setNotesOpen(true)} />}
          {group === 'notifications' && <NotificationsPlaceholder />}
        </div>
      </div>

      {notesOpen && <ReleaseNotesPanel onClose={() => setNotesOpen(false)} />}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-all whitespace-nowrap ${
        active
          ? 'border-terracotta-500 text-brown-800'
          : 'border-transparent text-brown-700/50 hover:text-brown-700 hover:border-sand-300'
      }`}
    >
      <span className={active ? 'text-terracotta-500' : 'text-brown-700/40'}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

// ── Reusable Color Picker Component ─────────────────────────────────────────
function ColorSwatchPicker({
  selectedColor,
  onSelectColor,
}: {
  selectedColor: string
  onSelectColor: (color: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PRESET_COLORS.map(c => {
        const isSelected = selectedColor.toLowerCase() === c.value.toLowerCase()
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => onSelectColor(c.value)}
            title={c.label}
            className={`h-7 w-7 rounded-lg flex items-center justify-center transition-all ${
              isSelected
                ? 'ring-2 ring-brown-800 ring-offset-2 ring-offset-cream-50 scale-105 shadow-xs'
                : 'hover:scale-110 opacity-90 hover:opacity-100'
            }`}
            style={{ backgroundColor: c.value }}
          >
            {isSelected && (
              <svg className="h-3.5 w-3.5 text-white drop-shadow" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        )
      })}
      <label
        className="h-7 w-7 rounded-lg border border-dashed border-sand-300 cursor-pointer flex items-center justify-center bg-white hover:border-sand-400 transition-colors shadow-2xs"
        title="Custom hex color"
      >
        <input
          type="color"
          value={selectedColor}
          onChange={e => onSelectColor(e.target.value)}
          className="sr-only"
        />
        <svg className="h-3 w-3 text-brown-700/40" viewBox="0 0 12 12" fill="none">
          <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </label>
    </div>
  )
}

// ── "Calendars" group: connected calendars + color rules, one surface ────────
function ConnectedCalendarsSection() {
  const { data: calendars, isLoading } = useConnectedCalendars()
  const updateColor = useUpdateCalendarColor()
  const [addModalOpen, setAddModalOpen] = useState(false)

  // Group by owner; calendars without a known owner land in "Other calendars"
  // instead of an "UNKNOWN" section header.
  const byOwner = new Map<string, ConnectedCalendar[]>()
  for (const cal of calendars ?? []) {
    const ownerName = cal.owner?.display_name ?? 'Other calendars'
    if (!byOwner.has(ownerName)) byOwner.set(ownerName, [])
    byOwner.get(ownerName)!.push(cal)
  }

  return (
    <div className="space-y-6">
      {/* Section Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-white border border-sand-200/80 p-4 shadow-2xs">
        <div>
          <h3 className="text-sm font-semibold text-brown-800">Connected calendars</h3>
          <p className="text-xs text-brown-700/60 mt-0.5">
            Choose which calendars appear on the dashboard, recolor them, and put shortcuts on your home screen.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddModalOpen(true)}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-terracotta-500 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-terracotta-600 shadow-xs flex-shrink-0"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 12 12" fill="none">
            <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Add Calendar
        </button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-sand-100" />
          ))}
        </div>
      )}

      {!isLoading && (!calendars || calendars.length === 0) && (
        <div className="rounded-2xl border border-dashed border-sand-300 bg-white p-8 text-center">
          <svg className="mx-auto h-10 w-10 text-brown-700/30 mb-2" viewBox="0 0 24 24" fill="none">
            <path d="M8 2V5M16 2V5M3.5 9.09H20.5M21 8.5V17C21 20 19.5 22 16 22H8C4.5 22 3 20 3 17V8.5C3 5.5 4.5 3.5 8 3.5H16C19.5 3.5 21 5.5 21 8.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p className="text-sm font-semibold text-brown-800">No calendars connected yet</p>
          <p className="text-xs text-brown-700/50 mt-1 max-w-sm mx-auto">
            Connect Google, Outlook, or Apple calendars to bring everyone&apos;s schedule into one family view.
          </p>
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="mt-4 rounded-xl bg-brown-800 px-4 py-2 text-xs font-semibold text-cream-50 hover:bg-brown-900 transition-colors"
          >
            Connect First Calendar
          </button>
        </div>
      )}

      {/* Calendar List grouped by owner */}
      <div className="space-y-6">
        {Array.from(byOwner.entries()).map(([ownerName, cals]) => (
          <div key={ownerName} className="space-y-2.5">
            <div className="flex items-center gap-2 px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-brown-700/50">
                {ownerName}
              </span>
              <span className="h-px flex-1 bg-sand-200" />
            </div>
            <div className="space-y-2.5">
              {cals.map(cal => (
                <ConnectedCalendarCard
                  key={cal.id}
                  calendar={cal}
                  onUpdateColor={color =>
                    updateColor.mutate({ id: cal.id, color, calendar_id: cal.calendar_id })
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {addModalOpen && <AddCalendarModal onClose={() => setAddModalOpen(false)} />}
    </div>
  )
}

function ConnectedCalendarCard({
  calendar,
  onUpdateColor,
}: {
  calendar: ConnectedCalendar
  onUpdateColor: (color: string) => void
}) {
  const [editingColor, setEditingColor] = useState(false)
  const [selectedColor, setSelectedColor] = useState(calendar.color ?? '#C4714F')
  const deleteCal = useDeleteConnectedCalendar()
  const toggleQuickToggle = useToggleQuickToggle()
  const toggleVisibility = useToggleCalendarVisibility()

  const handleSaveColor = () => {
    onUpdateColor(selectedColor)
    setEditingColor(false)
  }

  const handleCancelColor = () => {
    setSelectedColor(calendar.color ?? '#C4714F')
    setEditingColor(false)
  }

  return (
    <div className="rounded-2xl border border-sand-200/80 bg-white p-4 shadow-2xs transition-all hover:border-sand-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left side: Swatch (the one color-edit affordance) + Title + Provider Info */}
        <div className="flex items-center gap-3.5 min-w-0">
          <button
            type="button"
            onClick={() => setEditingColor(prev => !prev)}
            title="Change calendar color"
            aria-label={`Change color for ${calendar.calendar_name ?? 'calendar'}`}
            className="group relative h-10 w-10 flex-shrink-0 rounded-xl transition-transform hover:scale-105 shadow-xs ring-1 ring-black/5 flex items-center justify-center"
            style={{ backgroundColor: calendar.color ?? '#C4714F' }}
          >
            <svg
              className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow"
              viewBox="0 0 16 16"
              fill="none"
            >
              <path d="M11 2L14 5L5 14H2V11L11 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-brown-800 truncate max-w-[220px]">
                {calendar.calendar_name ?? calendar.calendar_id}
              </span>
              {calendar.is_default && (
                <span className="text-[10px] font-bold uppercase tracking-wider bg-sand-100 text-brown-700/70 rounded-md px-1.5 py-0.5">
                  Default
                </span>
              )}
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-cream-100 text-brown-700/60 rounded-md px-1.5 py-0.5">
                {calendar.provider}
              </span>
            </div>
            {calendar.account_email && (
              <p className="text-xs text-brown-700/50 mt-0.5 truncate">{calendar.account_email}</p>
            )}
          </div>
        </div>

        {/* Right side controls: Visibility + Show-on-home + Delete */}
        <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
          {/* Visibility toggle */}
          <button
            type="button"
            onClick={() =>
              toggleVisibility.mutate({ id: calendar.id, is_visible: !calendar.is_visible })
            }
            title={
              calendar.is_visible
                ? 'Hide this calendar from the dashboard'
                : 'Show this calendar on the dashboard'
            }
            aria-pressed={calendar.is_visible}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all border ${
              calendar.is_visible
                ? 'bg-terracotta-50 border-terracotta-200 text-terracotta-600 hover:bg-terracotta-100'
                : 'bg-cream-50 border-sand-200 text-brown-700/60 hover:text-brown-800 hover:bg-sand-100/70'
            }`}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
              <path d="M2 8s2.2-3.5 6-3.5S14 8 14 8s-2.2 3.5-6 3.5S2 8 2 8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <circle cx="8" cy="8" r="1.5" fill="currentColor" />
              {!calendar.is_visible && (
                <path d="M3 3l10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              )}
            </svg>
            <span>{calendar.is_visible ? 'Shown' : 'Hidden'}</span>
          </button>

          {/* Home-screen shortcut pill — one label, one job */}
          <button
            type="button"
            onClick={() =>
              toggleQuickToggle.mutate({ id: calendar.id, is_quick_toggle: !calendar.is_quick_toggle })
            }
            title="Show a shortcut pill for this calendar on the home screen"
            aria-pressed={!!calendar.is_quick_toggle}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all border ${
              calendar.is_quick_toggle
                ? 'bg-terracotta-50 border-terracotta-200 text-terracotta-600 hover:bg-terracotta-100'
                : 'bg-cream-50 border-sand-200 text-brown-700/60 hover:text-brown-800 hover:bg-sand-100/70'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                calendar.is_quick_toggle ? 'bg-terracotta-500' : 'bg-brown-700/30'
              }`}
            />
            <span>Show on home</span>
          </button>

          {/* Delete Calendar Subscription */}
          {calendar.ics_url && (
            <button
              type="button"
              title="Remove calendar subscription"
              onClick={e => {
                e.preventDefault()
                if (
                  confirm(
                    `Remove "${
                      calendar.calendar_name ?? 'this calendar'
                    }" subscription? This will delete all synced events.`
                  )
                ) {
                  deleteCal.mutate({ id: calendar.id, calendar_id: calendar.calendar_id })
                }
              }}
              className="rounded-xl border border-sand-200 p-1.5 text-brown-700/40 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                <path
                  d="M3 4h10M6 4V3h4v1M5 4l.5 9h5l.5-9"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Expandable Color Picker Drawer within the Card (hex lives here, not on the card) */}
      {editingColor && (
        <div className="mt-3.5 border-t border-sand-150 pt-3.5 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brown-700">Select new theme color</span>
            <span className="text-[11px] font-mono text-brown-700/50">{selectedColor}</span>
          </div>
          <ColorSwatchPicker selectedColor={selectedColor} onSelectColor={setSelectedColor} />
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleSaveColor}
              className="rounded-xl bg-brown-800 px-4 py-1.5 text-xs font-semibold text-cream-50 hover:bg-brown-900 transition-colors shadow-2xs"
            >
              Apply Color
            </button>
            <button
              type="button"
              onClick={handleCancelColor}
              className="rounded-xl border border-sand-300 px-3 py-1.5 text-xs font-medium text-brown-700 hover:bg-cream-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── "Calendars" group, part 2: Color rules (plain words, not system words) ──
const MATCH_TYPE_LABELS: Record<EventColorRule['match_type'], string> = {
  contains: 'contains these words',
  starts_with: 'starts with these words',
  ends_with: 'ends with these words',
  exact: 'matches exactly',
}

function ColorRulesSection() {
  const { data: rules, isLoading } = useEventColorRules()
  const create = useCreateEventColorRule()
  const remove = useDeleteEventColorRule()
  const update = useUpdateEventColorRule()

  const [showAdd, setShowAdd] = useState(false)
  const [newKeyword, setNewKeyword] = useState('')
  const [newColor, setNewColor] = useState('#E91E8C')
  const [newMatchType, setNewMatchType] = useState<EventColorRule['match_type']>('contains')
  const [newLabel, setNewLabel] = useState('')

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newKeyword.trim()) return
    await create.mutateAsync({
      keyword: newKeyword.trim(),
      color: newColor,
      match_type: newMatchType,
      label: newLabel.trim() || null,
    })
    setNewKeyword('')
    setNewLabel('')
    setNewColor('#E91E8C')
    setNewMatchType('contains')
    setShowAdd(false)
  }

  return (
    <div className="space-y-6">
      {/* Section Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-white border border-sand-200/80 p-4 shadow-2xs">
        <div>
          <h3 className="text-sm font-semibold text-brown-800">Color rules</h3>
          <p className="text-xs text-brown-700/60 mt-0.5">
            Automatically recolor events — birthdays, game days, appointments — when the title matches words you choose.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(v => !v)}
          className={`flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all shadow-xs flex-shrink-0 ${
            showAdd
              ? 'bg-brown-800 text-cream-50 hover:bg-brown-900'
              : 'bg-terracotta-500 text-white hover:bg-terracotta-600'
          }`}
        >
          <svg className={`h-3.5 w-3.5 transition-transform ${showAdd ? 'rotate-45' : ''}`} viewBox="0 0 12 12" fill="none">
            <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          {showAdd ? 'Close form' : 'New color rule'}
        </button>
      </div>

      {/* New Rule Form Card */}
      {showAdd && (
        <form
          onSubmit={handleAdd}
          className="rounded-2xl border-2 border-terracotta-500/30 bg-white p-5 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="flex items-center justify-between border-b border-sand-150 pb-3">
            <span className="text-sm font-semibold text-brown-800">New color rule</span>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="text-xs font-semibold text-brown-700/40 hover:text-brown-700"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-brown-700">Words to look for</label>
              <input
                autoFocus
                type="text"
                value={newKeyword}
                onChange={e => setNewKeyword(e.target.value)}
                placeholder="e.g. birthday, soccer, dentist"
                className="w-full rounded-xl border border-sand-300 bg-cream-50/50 px-3.5 py-2 text-sm text-brown-800 placeholder:text-brown-700/35 focus:border-terracotta-500 focus:outline-none focus:ring-1 focus:ring-terracotta-500 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-brown-700">Category Label (optional)</label>
              <input
                type="text"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                placeholder="e.g. Celebrations & Parties"
                className="w-full rounded-xl border border-sand-300 bg-cream-50/50 px-3.5 py-2 text-sm text-brown-800 placeholder:text-brown-700/35 focus:border-terracotta-500 focus:outline-none focus:ring-1 focus:ring-terracotta-500 transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-brown-700">When the event title…</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {(['contains', 'starts_with', 'ends_with', 'exact'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setNewMatchType(m)}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                    newMatchType === m
                      ? 'bg-brown-800 text-cream-50 shadow-2xs'
                      : 'bg-cream-50 border border-sand-200 text-brown-700/70 hover:text-brown-800 hover:bg-cream-100'
                  }`}
                >
                  {MATCH_TYPE_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-brown-700">Color</label>
            <ColorSwatchPicker selectedColor={newColor} onSelectColor={setNewColor} />
          </div>

          {/* Live Preview Bar */}
          {newKeyword && (
            <div className="rounded-xl bg-cream-50 border border-sand-200 p-3.5 space-y-1.5">
              <p className="text-[11px] font-semibold text-brown-700/50 uppercase tracking-wider">
                Live Sample Event Preview
              </p>
              <div
                className="flex items-center gap-2 rounded-xl p-2 px-3 transition-colors shadow-2xs"
                style={{ backgroundColor: `${newColor}18`, borderLeft: `4px solid ${newColor}` }}
              >
                <span className="text-sm font-semibold truncate" style={{ color: newColor }}>
                  {(newKeyword.split(',')[0]?.trim() || newKeyword)}&apos;s party 🎉
                </span>
                <span className="ml-auto text-xs font-mono opacity-75" style={{ color: newColor }}>
                  9:00 AM
                </span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-sand-150">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="rounded-xl border border-sand-300 px-4 py-2 text-xs font-semibold text-brown-700 hover:bg-cream-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newKeyword.trim() || create.isPending}
              className="rounded-xl bg-terracotta-500 px-5 py-2 text-xs font-semibold text-white disabled:opacity-40 hover:bg-terracotta-600 transition-colors shadow-xs"
            >
              {create.isPending ? 'Saving…' : 'Save rule'}
            </button>
          </div>
        </form>
      )}

      {isLoading && (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-sand-100" />
          ))}
        </div>
      )}

      {!isLoading && (!rules || rules.length === 0) && !showAdd && (
        <div className="rounded-2xl border border-dashed border-sand-300 bg-white p-8 text-center">
          <svg className="mx-auto h-10 w-10 text-brown-700/30 mb-2" viewBox="0 0 24 24" fill="none">
            <path d="M7 21A4 4 0 013 17V7A4 4 0 017 3H17A4 4 0 0121 7V17A4 4 0 0117 21H7Z" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M9 10L11.5 12.5L15.5 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p className="text-sm font-semibold text-brown-800">No color rules yet</p>
          <p className="text-xs text-brown-700/50 mt-1 max-w-sm mx-auto">
            Create rules to give specific activities (like birthdays or school events) their own distinctive highlight across all calendars.
          </p>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="mt-4 rounded-xl bg-brown-800 px-4 py-2 text-xs font-semibold text-cream-50 hover:bg-brown-900 transition-colors"
          >
            Add your first rule
          </button>
        </div>
      )}

      {/* Rules list */}
      <div className="space-y-3">
        {rules?.map(rule => (
          <RuleCard
            key={rule.id}
            rule={rule}
            onDelete={() => remove.mutate(rule.id)}
            onUpdate={update.mutate}
          />
        ))}
      </div>
    </div>
  )
}

function RuleCard({
  rule,
  onDelete,
  onUpdate,
}: {
  rule: EventColorRule
  onDelete: () => void
  onUpdate: (r: Partial<EventColorRule> & { id: string }) => void
}) {
  const [editing, setEditing] = useState(false)
  const [keyword, setKeyword] = useState(rule.keyword)
  const [color, setColor] = useState(rule.color)
  const [matchType, setMatchType] = useState<EventColorRule['match_type']>(rule.match_type)
  const [label, setLabel] = useState(rule.label || '')

  const handleSave = () => {
    onUpdate({
      id: rule.id,
      color,
      keyword: keyword.trim(),
      match_type: matchType,
      label: label.trim() || null,
    })
    setEditing(false)
  }

  return (
    <div className="rounded-2xl border border-sand-200/80 bg-white p-4 shadow-2xs transition-all hover:border-sand-300 group">
      {!editing ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Left info & Swatch */}
          <div className="flex items-center gap-3.5 min-w-0">
            <button
              type="button"
              onClick={() => setEditing(true)}
              title="Click to edit rule"
              className="h-9 w-9 flex-shrink-0 rounded-xl transition-transform hover:scale-105 shadow-xs ring-1 ring-black/5"
              style={{ backgroundColor: rule.color }}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-brown-800 truncate">
                  &ldquo;{rule.keyword}&rdquo;
                </span>
                <span className="text-[10px] font-semibold bg-sand-100 text-brown-700/70 rounded-md px-1.5 py-0.5 tracking-wide">
                  title {MATCH_TYPE_LABELS[rule.match_type]}
                </span>
              </div>
              {rule.label && (
                <p className="text-xs text-brown-700/60 mt-0.5 truncate font-medium">{rule.label}</p>
              )}
            </div>
          </div>

          {/* Right side: sample badge + actions */}
          <div className="flex items-center gap-3 self-end sm:self-center">
            {/* Live miniature preview pill inside row */}
            <div
              className="hidden md:flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold shadow-2xs"
              style={{ backgroundColor: `${rule.color}15`, color: rule.color }}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: rule.color }} />
              <span>{(rule.keyword.split(',')[0]?.trim() || rule.keyword)} event</span>
            </div>

            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-xl border border-sand-200 px-3 py-1.5 text-xs font-semibold text-brown-700 hover:bg-cream-50 transition-colors"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={onDelete}
              title="Delete rule"
              className="rounded-xl border border-sand-200 p-1.5 text-brown-700/40 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                <path
                  d="M3 4h10M6 4V3h4v1M5 4l.5 9h5l.5-9"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      ) : (
        /* Inline Editing State */
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-sand-150 pb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-brown-700">Edit color rule</span>
            <span className="text-xs text-brown-700/50 font-mono">ID: {rule.id.slice(0, 8)}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-brown-700 block mb-1">Words to look for</label>
              <input
                type="text"
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                className="w-full rounded-xl border border-sand-300 bg-cream-50/50 px-3 py-1.5 text-sm text-brown-800 focus:border-terracotta-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-brown-700 block mb-1">When the event title…</label>
              <select
                value={matchType}
                onChange={e => setMatchType(e.target.value as EventColorRule['match_type'])}
                className="w-full rounded-xl border border-sand-300 bg-cream-50/50 px-3 py-1.5 text-sm text-brown-800 focus:border-terracotta-500 focus:outline-none"
              >
                {(['contains', 'starts_with', 'ends_with', 'exact'] as const).map(m => (
                  <option key={m} value={m}>
                    {MATCH_TYPE_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-brown-700 block mb-1">Category Label (optional)</label>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="e.g. Birthdays"
              className="w-full rounded-xl border border-sand-300 bg-cream-50/50 px-3 py-1.5 text-sm text-brown-800 focus:border-terracotta-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-brown-700 block mb-1.5">Color</label>
            <ColorSwatchPicker selectedColor={color} onSelectColor={setColor} />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-sand-150">
            <button
              type="button"
              onClick={() => {
                setColor(rule.color)
                setKeyword(rule.keyword)
                setMatchType(rule.match_type)
                setLabel(rule.label || '')
                setEditing(false)
              }}
              className="rounded-xl border border-sand-300 px-3.5 py-1.5 text-xs font-semibold text-brown-700 hover:bg-cream-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!keyword.trim()}
              className="rounded-xl bg-brown-800 px-4 py-1.5 text-xs font-semibold text-cream-50 hover:bg-brown-900 transition-colors shadow-2xs"
            >
              Save Changes
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── "Appearance" group ──────────────────────────────────────────────────────
function ColorThemeSection() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="rounded-2xl border border-sand-200/80 bg-white p-5 shadow-2xs space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-brown-800">Color Theme</h3>
        <p className="text-xs text-brown-700/60 mt-0.5">
          Select an overall color palette for your family planner.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {THEMES.map(t => {
          const isActive = theme === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              className={`flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all cursor-pointer relative overflow-hidden group select-none ${
                isActive
                  ? 'border-terracotta-500 bg-terracotta-500/5 shadow-sm ring-1 ring-terracotta-500'
                  : 'border-sand-200 bg-white hover:bg-cream-100/40 hover:border-sand-300'
              }`}
            >
              <div className="w-full">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-brown-800">{t.name}</span>
                  {isActive && (
                    <span className="rounded-full bg-terracotta-500 p-0.5 text-white flex items-center justify-center flex-shrink-0">
                      <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6l2.33 2.33L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  )}
                </div>
                <p className="text-xs text-brown-700/60 mt-1.5 leading-normal pr-1">
                  {t.description}
                </p>
              </div>

              {/* Swatch Previews */}
              <div className="flex items-center gap-1.5 mt-3.5 rounded-lg border border-sand-200/50 bg-cream-100/30 p-1.5 w-max">
                <div
                  className="h-4.5 w-4.5 rounded border border-sand-200/60 shadow-inner"
                  style={{ backgroundColor: t.previewColors.bg }}
                  title="Background Color"
                />
                <div
                  className="h-4.5 w-4.5 rounded border border-sand-200/60 shadow-inner"
                  style={{ backgroundColor: t.previewColors.text }}
                  title="Text Color"
                />
                <div
                  className="h-4.5 w-4.5 rounded border border-sand-200/60 shadow-inner"
                  style={{ backgroundColor: t.previewColors.accent }}
                  title="Accent Color"
                />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function TextSizeSection() {
  const [fontSize, setFontSize] = useState<FontSizeScale>(getSavedFontSize)

  const handleDecrease = () => {
    const currentIndex = FONT_SIZE_STEPS.findIndex(s => s.value === fontSize)
    if (currentIndex > 0) {
      const nextSize = FONT_SIZE_STEPS[currentIndex - 1].value
      setFontSize(nextSize)
      localStorage.setItem(LOCAL_STORAGE_KEY, nextSize)
      applyFontSize(nextSize)
    }
  }

  const handleIncrease = () => {
    const currentIndex = FONT_SIZE_STEPS.findIndex(s => s.value === fontSize)
    if (currentIndex < FONT_SIZE_STEPS.length - 1) {
      const nextSize = FONT_SIZE_STEPS[currentIndex + 1].value
      setFontSize(nextSize)
      localStorage.setItem(LOCAL_STORAGE_KEY, nextSize)
      applyFontSize(nextSize)
    }
  }

  const currentIndex = FONT_SIZE_STEPS.findIndex(s => s.value === fontSize)
  const currentStep = FONT_SIZE_STEPS[currentIndex] || FONT_SIZE_STEPS[1]

  return (
    <div className="rounded-2xl border border-sand-200/80 bg-white p-5 shadow-2xs space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-brown-800">Text size</h3>
        <p className="text-xs text-brown-700/60 mt-0.5">
          Make text and layout bigger or smaller on this display — handy for reading from across the kitchen.
        </p>
      </div>

      {/* Live Sample Preview Banner */}
      <div className="rounded-2xl bg-cream-50 border border-sand-200 p-4 flex items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-brown-700/40 block">
            Sample Dashboard View
          </span>
          <p className="font-serif text-lg text-brown-800 mt-1">Family Dinner at 6:30 PM</p>
          <p className="text-xs text-brown-700/60 font-sans mt-0.5">
            Sample family · Kitchen Counter Dashboard
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <span className="inline-block rounded-xl bg-terracotta-50 border border-terracotta-200 px-3 py-1 text-xs font-bold text-terracotta-600 shadow-2xs">
            {currentStep.scale} Scale
          </span>
        </div>
      </div>

      {/* Interactive Scale Adjuster */}
      <div className="flex items-center justify-between gap-4 rounded-xl bg-cream-50/60 border border-sand-200/60 p-3.5">
        <div className="flex flex-col">
          <span className="text-sm font-bold text-brown-800">{currentStep.label}</span>
          <span className="text-[11px] font-medium text-brown-700/50">
            Step {currentIndex + 1} of {FONT_SIZE_STEPS.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Decrease button */}
          <button
            type="button"
            onClick={handleDecrease}
            disabled={currentIndex <= 0}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-sand-300 bg-white text-brown-700 hover:bg-cream-100 active:bg-cream-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-2xs"
            title="Decrease text size"
            aria-label="Decrease text size"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          {/* Step Dots */}
          <div className="flex items-center gap-1.5 px-2">
            {FONT_SIZE_STEPS.map((step, idx) => (
              <button
                key={step.value}
                type="button"
                onClick={() => {
                  setFontSize(step.value)
                  localStorage.setItem(LOCAL_STORAGE_KEY, step.value)
                  applyFontSize(step.value)
                }}
                className={`h-2.5 rounded-full transition-all duration-200 ${
                  idx === currentIndex
                    ? 'w-6 bg-terracotta-500 shadow-2xs'
                    : 'w-2.5 bg-sand-200 hover:bg-sand-300'
                }`}
                title={`Set to ${step.label} (${step.scale})`}
                aria-label={`Set font size to ${step.label}`}
              />
            ))}
          </div>

          {/* Increase button */}
          <button
            type="button"
            onClick={handleIncrease}
            disabled={currentIndex >= FONT_SIZE_STEPS.length - 1}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-sand-300 bg-white text-brown-700 hover:bg-cream-100 active:bg-cream-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-2xs"
            title="Increase text size"
            aria-label="Increase text size"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── "This display" group: device-only settings, labeled as such ────────────
function ThisDisplaySection() {
  const [keepScreenOn, setKeepScreenOn] = useState(false)
  const [immersiveMode, setImmersiveMode] = useState(false)
  const [brightness, setBrightness] = useState<number>(-1.0) // -1.0 means default

  useEffect(() => {
    async function loadState() {
      const state = await SystemSettings.getSettingsState()
      setKeepScreenOn(state.keepScreenOn)
      setImmersiveMode(state.immersiveMode)
      setBrightness(state.brightness)
    }
    loadState()
  }, [])

  const handleToggleKeepScreen = async () => {
    const nextVal = !keepScreenOn
    setKeepScreenOn(nextVal)
    await SystemSettings.setKeepScreenOn(nextVal)
  }

  const handleToggleImmersive = async () => {
    const nextVal = !immersiveMode
    setImmersiveMode(nextVal)
    await SystemSettings.setImmersiveMode(nextVal)
  }

  const handleBrightnessChange = async (val: number) => {
    setBrightness(val)
    await SystemSettings.setBrightness(val)
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-sand-200/80 bg-white p-5 shadow-2xs space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-brown-800">This display</h3>
          <p className="text-xs text-brown-700/60 mt-0.5">
            Screen and hardware behavior for the display you&apos;re looking at right now —
            these never sync to the rest of the family.
          </p>
        </div>

        <div className="space-y-3">
          {/* Always-on display toggle */}
          <div className="flex items-center justify-between rounded-xl border border-sand-200/60 bg-cream-50/40 p-4">
            <div className="flex flex-col gap-0.5 pr-4">
              <span className="text-sm font-semibold text-brown-800">Always-on display</span>
              <span className="text-xs text-brown-700/60">
                Keep this screen awake — no sleep or dimming when nobody&apos;s touching it
              </span>
            </div>
            <button
              type="button"
              onClick={handleToggleKeepScreen}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                keepScreenOn ? 'bg-terracotta-500' : 'bg-sand-300'
              }`}
              role="switch"
              aria-checked={keepScreenOn}
              aria-label="Always-on display"
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  keepScreenOn ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Fullscreen toggle */}
          <div className="flex items-center justify-between rounded-xl border border-sand-200/60 bg-cream-50/40 p-4">
            <div className="flex flex-col gap-0.5 pr-4">
              <span className="text-sm font-semibold text-brown-800">Fullscreen</span>
              <span className="text-xs text-brown-700/60">
                Hide the system status bar and navigation lines for a clean frame
              </span>
            </div>
            <button
              type="button"
              onClick={handleToggleImmersive}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                immersiveMode ? 'bg-terracotta-500' : 'bg-sand-300'
              }`}
              role="switch"
              aria-checked={immersiveMode}
              aria-label="Fullscreen"
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  immersiveMode ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Brightness */}
          <div className="rounded-xl border border-sand-200/60 bg-cream-50/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-brown-800">Brightness</span>
                <span className="text-xs text-brown-700/60">
                  Set this display&apos;s brightness inside the app, or leave it on System Auto
                </span>
              </div>
              <span className="text-xs font-bold text-brown-800 uppercase tracking-wider bg-white border border-sand-200 px-2.5 py-1 rounded-lg shadow-2xs">
                {brightness === -1.0 ? 'System Auto' : `${Math.round(brightness * 100)}%`}
              </span>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => handleBrightnessChange(-1.0)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${
                  brightness === -1.0
                    ? 'bg-brown-800 border-brown-800 text-cream-50 shadow-2xs'
                    : 'bg-white border-sand-300 text-brown-700 hover:bg-cream-100'
                }`}
              >
                System Auto
              </button>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={brightness === -1.0 ? 1.0 : brightness}
                disabled={brightness === -1.0}
                onChange={e => handleBrightnessChange(parseFloat(e.target.value))}
                className="flex-1 h-2 bg-sand-200 rounded-lg appearance-none cursor-pointer accent-terracotta-500 disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Brightness"
              />
            </div>
          </div>

          {/* System Settings Shortcuts */}
          <div className="pt-2">
            <p className="text-xs font-semibold text-brown-700/60 uppercase tracking-wider mb-2 px-1">
              System shortcuts
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => SystemSettings.openSystemSettings('display')}
                className="flex items-center justify-center gap-2 rounded-xl border border-sand-200 bg-white px-4 py-3 text-xs font-semibold text-brown-700 hover:bg-cream-50 active:bg-cream-100 transition-all shadow-2xs"
              >
                <svg className="h-4 w-4 text-brown-700/50" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" />
                  <path
                    d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                Display Settings
              </button>
              <button
                type="button"
                onClick={() => SystemSettings.openSystemSettings('general')}
                className="flex items-center justify-center gap-2 rounded-xl border border-sand-200 bg-white px-4 py-3 text-xs font-semibold text-brown-700 hover:bg-cream-50 active:bg-cream-100 transition-all shadow-2xs"
              >
                <svg className="h-4 w-4 text-brown-700/50" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
                  <path
                    d="M8 2v1M8 13v1M2 8h1M13 8h1M3.5 3.5l.7.7M11.8 11.8l.7.7M3.5 12.5l.7-.7M11.8 4.2l.7-.7"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                Device Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── "About" group: What's new gets a real door ──────────────────────────────
function AboutSection({ onOpenNotes }: { onOpenNotes: () => void }) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-sand-200/80 bg-white p-2 shadow-2xs">
        {/* What's new — first-class labeled row */}
        <button
          type="button"
          onClick={onOpenNotes}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left hover:bg-cream-50 transition-colors"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-terracotta-100 text-terracotta-600 flex-shrink-0">
            <svg className="h-4.5 w-4.5" viewBox="0 0 18 18" fill="none">
              <path d="M9 1.5v3M9 13.5v3M1.5 9h3M13.5 9h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="9" cy="9" r="2.75" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold text-brown-800">What&apos;s new</span>
            <span className="block text-xs text-brown-700/50 mt-0.5">
              See what changed in the latest updates
            </span>
          </span>
          <span className="rounded-full bg-terracotta-100 px-2.5 py-0.5 font-mono text-[11px] font-bold text-terracotta-600 flex-shrink-0">
            {APP_VERSION}
          </span>
          <svg className="h-4 w-4 text-brown-700/30 flex-shrink-0" viewBox="0 0 16 16" fill="none">
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="mx-4 h-px bg-sand-100" />

        {/* Version — informational, not a tap target */}
        <div className="flex w-full items-center gap-3 px-4 py-3.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sand-100 text-brown-700/60 flex-shrink-0">
            <svg className="h-4.5 w-4.5" viewBox="0 0 18 18" fill="none">
              <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M9 8.4V12M9 6v.3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold text-brown-800">Version</span>
            <span className="block text-xs text-brown-700/50 mt-0.5 font-mono">
              {APP_VERSION} · {APP_UPDATE_DATE}
            </span>
          </span>
        </div>

        <div className="mx-4 h-px bg-sand-100" />

        {/* Contact support — discoverable path, alongside the floating bubble */}
        <button
          type="button"
          onClick={openSupportDialog}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left hover:bg-cream-50 transition-colors"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sand-100 text-brown-700/60 flex-shrink-0">
            <svg className="h-4.5 w-4.5" viewBox="0 0 18 18" fill="none">
              <path
                d="M15.75 9a6 6 0 0 1-6 6H3l1.7-2.2A6 6 0 1 1 15.75 9Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="7" cy="9" r="0.9" fill="currentColor" />
              <circle cx="10" cy="9" r="0.9" fill="currentColor" />
              <circle cx="13" cy="9" r="0.9" fill="currentColor" />
            </svg>
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold text-brown-800">Contact support</span>
            <span className="block text-xs text-brown-700/50 mt-0.5">
              Message us — we reply by email
            </span>
          </span>
          <svg className="h-4 w-4 text-brown-700/30 flex-shrink-0" viewBox="0 0 16 16" fill="none">
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ── "Notifications" group: reserved slot, nothing ships yet ────────────────
function NotificationsPlaceholder() {
  return (
    <div className="rounded-2xl border border-dashed border-sand-300 bg-white p-8 text-center">
      <svg className="mx-auto h-10 w-10 text-brown-700/30 mb-2" viewBox="0 0 16 16" fill="none">
        <path d="M8 2.5a3.5 3.5 0 0 1 3.5 3.5c0 2.5.8 3.5 1.5 4.5H3c.7-1 1.5-2 1.5-4.5A3.5 3.5 0 0 1 8 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M6.6 13a1.5 1.5 0 0 0 2.8 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <p className="text-sm font-semibold text-brown-800">Nothing here yet</p>
      <p className="text-xs text-brown-700/50 mt-1 max-w-sm mx-auto">
        When reminders and notifications arrive, this is where you&apos;ll manage them.
      </p>
    </div>
  )
}

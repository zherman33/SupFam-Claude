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

type SettingsTab = 'calendars' | 'rules' | 'device'

export function AdvancedSettings({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('calendars')
  const { data: calendars } = useConnectedCalendars()
  const { data: rules } = useEventColorRules()

  const calendarsCount = calendars?.length ?? 0
  const rulesCount = rules?.length ?? 0

  return (
    // Full-screen overlay
    <div className="fixed inset-0 z-50 flex items-stretch justify-end animate-in fade-in duration-200">
      {/* Backdrop — transparent overlay to allow viewing real-time background layout & font size changes */}
      <div
        className="absolute inset-0 bg-brown-950/15 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />

      {/* Panel — slides in from the right, generous max-w-2xl for spacious layout */}
      <div className="relative z-10 flex flex-col bg-cream-50 w-full max-w-2xl shadow-2xl border-l border-sand-200 animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex flex-col border-b border-sand-200/80 bg-white px-6 pt-5 pb-0 flex-shrink-0">
          <div className="flex items-start justify-between pb-4">
            <div>
              <h2 className="font-serif text-2xl font-normal text-brown-800">Settings & Customization</h2>
              <p className="text-xs text-brown-700/60 mt-1 font-sans">
                Tailor your family&apos;s ambient kitchen hub, calendars, and display behavior
              </p>
            </div>
            <button
              onClick={onClose}
              title="Close settings"
              className="rounded-xl p-2 text-brown-700/50 hover:bg-sand-100 hover:text-brown-800 transition-colors"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none">
                <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Segmented Tab Navigation */}
          <div className="flex items-center gap-2 -mb-px overflow-x-auto no-scrollbar">
            <TabButton
              active={activeTab === 'calendars'}
              onClick={() => setActiveTab('calendars')}
              icon={
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                  <path d="M3.5 2V3.5M12.5 2V3.5M2.5 5.5H13.5M3.5 3.5H12.5C13.0523 3.5 13.5 3.94772 13.5 4.5V13.5C13.5 14.0523 13.0523 14.5 12.5 14.5H3.5C2.94772 14.5 2.5 14.0523 2.5 13.5V4.5C2.5 3.94772 2.94772 3.5 3.5 3.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              }
              label="Connected Calendars"
              badge={calendarsCount > 0 ? calendarsCount : undefined}
            />
            <TabButton
              active={activeTab === 'rules'}
              onClick={() => setActiveTab('rules')}
              icon={
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2v12M2 8h12M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              }
              label="Keyword Rules"
              badge={rulesCount > 0 ? rulesCount : undefined}
            />
            <TabButton
              active={activeTab === 'device'}
              onClick={() => setActiveTab('device')}
              icon={
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                  <path d="M2.5 4C2.5 3.17157 3.17157 2.5 4 2.5H12C12.8284 2.5 13.5 3.17157 13.5 4V12C13.5 12.8284 12.8284 13.5 12 13.5H4C3.17157 13.5 2.5 12.8284 2.5 12V4Z" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M5.5 8H10.5M8 5.5V10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              }
              label="Display & Device"
            />
          </div>
        </div>

        {/* Scrollable Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'calendars' && <ConnectedCalendarsTab />}
          {activeTab === 'rules' && <EventColorRulesTab />}
          {activeTab === 'device' && <DisplayAndDeviceTab />}
        </div>
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  badge?: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-all whitespace-nowrap ${
        active
          ? 'border-terracotta-500 text-brown-800'
          : 'border-transparent text-brown-700/50 hover:text-brown-700 hover:border-sand-300'
      }`}
    >
      <span className={active ? 'text-terracotta-500' : 'text-brown-700/40'}>{icon}</span>
      <span>{label}</span>
      {badge !== undefined && (
        <span
          className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
            active
              ? 'bg-terracotta-100 text-terracotta-700'
              : 'bg-sand-100 text-brown-700/60'
          }`}
        >
          {badge}
        </span>
      )}
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

// ── Tab 1: Connected Calendars ──────────────────────────────────────────────
function ConnectedCalendarsTab() {
  const { data: calendars, isLoading } = useConnectedCalendars()
  const updateColor = useUpdateCalendarColor()
  const [addModalOpen, setAddModalOpen] = useState(false)

  // Group by owner
  const byOwner = new Map<string, ConnectedCalendar[]>()
  for (const cal of calendars ?? []) {
    const ownerName = cal.owner?.display_name ?? 'Unknown'
    if (!byOwner.has(ownerName)) byOwner.set(ownerName, [])
    byOwner.get(ownerName)!.push(cal)
  }

  return (
    <div className="space-y-6">
      {/* Tab Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-white border border-sand-200/80 p-4 shadow-2xs">
        <div>
          <h3 className="text-sm font-semibold text-brown-800">Connected Calendars</h3>
          <p className="text-xs text-brown-700/60 mt-0.5">
            Assign custom color themes per calendar and toggle shortcut pills on your home screen.
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
        {/* Left side: Swatch + Title + Provider Info */}
        <div className="flex items-center gap-3.5 min-w-0">
          <button
            type="button"
            onClick={() => setEditingColor(prev => !prev)}
            title="Click to change color"
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
            <p className="text-xs text-brown-700/50 mt-0.5 truncate">
              Color: <span className="font-mono">{calendar.color ?? '#C4714F'}</span>
            </p>
          </div>
        </div>

        {/* Right side controls: Quick Toggle pill + Edit Color + Delete */}
        <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
          {/* Quick Toggle Switch Pill */}
          <button
            type="button"
            onClick={() =>
              toggleQuickToggle.mutate({ id: calendar.id, is_quick_toggle: !calendar.is_quick_toggle })
            }
            title={
              calendar.is_quick_toggle
                ? 'Remove quick toggle from home screen'
                : 'Pin quick toggle button on home screen'
            }
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
            <span>{calendar.is_quick_toggle ? 'Quick toggle on' : 'Pin to home'}</span>
          </button>

          {/* Edit Color Button */}
          <button
            type="button"
            onClick={() => setEditingColor(prev => !prev)}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors border ${
              editingColor
                ? 'bg-brown-800 text-cream-50 border-brown-800'
                : 'bg-white border-sand-200 text-brown-700 hover:bg-cream-50'
            }`}
          >
            {editingColor ? 'Close' : 'Color'}
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

      {/* Expandable Color Picker Drawer within the Card */}
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

// ── Tab 2: Event Color Rules ────────────────────────────────────────────────
function EventColorRulesTab() {
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
      {/* Tab Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-white border border-sand-200/80 p-4 shadow-2xs">
        <div>
          <h3 className="text-sm font-semibold text-brown-800">Event Color Overrides</h3>
          <p className="text-xs text-brown-700/60 mt-0.5">
            Automatically highlight events (like birthdays, doctor visits, or sports) when keywords appear in the title.
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
          {showAdd ? 'Close form' : 'New Rule'}
        </button>
      </div>

      {/* New Rule Form Card */}
      {showAdd && (
        <form
          onSubmit={handleAdd}
          className="rounded-2xl border-2 border-terracotta-500/30 bg-white p-5 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="flex items-center justify-between border-b border-sand-150 pb-3">
            <span className="text-sm font-semibold text-brown-800">Create Keyword Rule</span>
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
              <label className="text-xs font-semibold text-brown-700">Keyword</label>
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
            <label className="text-xs font-semibold text-brown-700">Match Logic</label>
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
                  {m === 'contains'
                    ? 'Contains keyword'
                    : m === 'starts_with'
                    ? 'Starts with'
                    : m === 'ends_with'
                    ? 'Ends with'
                    : 'Exact match'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-brown-700">Override Color</label>
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
              {create.isPending ? 'Saving…' : 'Save Rule'}
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
          <p className="text-sm font-semibold text-brown-800">No color override rules yet</p>
          <p className="text-xs text-brown-700/50 mt-1 max-w-sm mx-auto">
            Create rules to give specific activities (like birthdays or school events) their own distinctive highlight across all calendars.
          </p>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="mt-4 rounded-xl bg-brown-800 px-4 py-2 text-xs font-semibold text-cream-50 hover:bg-brown-900 transition-colors"
          >
            Add First Rule
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
                <span className="text-[10px] font-semibold bg-sand-100 text-brown-700/70 rounded-md px-1.5 py-0.5 uppercase tracking-wider">
                  {rule.match_type === 'contains'
                    ? 'Contains'
                    : rule.match_type === 'starts_with'
                    ? 'Starts with'
                    : rule.match_type === 'ends_with'
                    ? 'Ends with'
                    : 'Exact'}
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
            <span className="text-xs font-bold uppercase tracking-wider text-brown-700">Edit Keyword Rule</span>
            <span className="text-xs text-brown-700/50 font-mono">ID: {rule.id.slice(0, 8)}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-brown-700 block mb-1">Keyword</label>
              <input
                type="text"
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                className="w-full rounded-xl border border-sand-300 bg-cream-50/50 px-3 py-1.5 text-sm text-brown-800 focus:border-terracotta-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-brown-700 block mb-1">Match Type</label>
              <select
                value={matchType}
                onChange={e => setMatchType(e.target.value as EventColorRule['match_type'])}
                className="w-full rounded-xl border border-sand-300 bg-cream-50/50 px-3 py-1.5 text-sm text-brown-800 focus:border-terracotta-500 focus:outline-none"
              >
                <option value="contains">Contains keyword</option>
                <option value="starts_with">Starts with keyword</option>
                <option value="ends_with">Ends with keyword</option>
                <option value="exact">Exact title match</option>
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
            <label className="text-[11px] font-semibold text-brown-700 block mb-1.5">Color Theme</label>
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

// ── Tab 3: Display & Device Settings ────────────────────────────────────────
function DisplayAndDeviceTab() {
  return (
    <div className="space-y-6">
      <ColorThemeSection />
      <FontSizeSection />
      <AmbientDeviceSection />
    </div>
  )
}

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

function FontSizeSection() {
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
        <h3 className="text-sm font-semibold text-brown-800">Interface Scale & Text Size</h3>
        <p className="text-xs text-brown-700/60 mt-0.5">
          Adjust layout proportions and typography for comfortable viewing from across the kitchen.
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
            Zac • Kitchen Counter Dashboard
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

function AmbientDeviceSection() {
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
    <div className="rounded-2xl border border-sand-200/80 bg-white p-5 shadow-2xs space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-brown-800">Ambient Display & Hardware</h3>
        <p className="text-xs text-brown-700/60 mt-0.5">
          Configure screen wake settings and status bar behavior for your dedicated home dashboard.
        </p>
      </div>

      <div className="space-y-3">
        {/* Always-on display toggle */}
        <div className="flex items-center justify-between rounded-xl border border-sand-200/60 bg-cream-50/40 p-4">
          <div className="flex flex-col gap-0.5 pr-4">
            <span className="text-sm font-semibold text-brown-800">Always-On Display</span>
            <span className="text-xs text-brown-700/60">
              Prevent the screen from going to sleep or dimming on inactivity
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
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                keepScreenOn ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Immersive fullscreen toggle */}
        <div className="flex items-center justify-between rounded-xl border border-sand-200/60 bg-cream-50/40 p-4">
          <div className="flex flex-col gap-0.5 pr-4">
            <span className="text-sm font-semibold text-brown-800">Immersive Fullscreen</span>
            <span className="text-xs text-brown-700/60">
              Hide system status bars and gesture navigation lines for a clean frame
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
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                immersiveMode ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* App Brightness */}
        <div className="rounded-xl border border-sand-200/60 bg-cream-50/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-brown-800">Screen Brightness Override</span>
              <span className="text-xs text-brown-700/60">
                Directly adjust brightness within the ambient dashboard
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
            />
          </div>
        </div>

        {/* System Settings Shortcuts */}
        <div className="pt-2">
          <p className="text-xs font-semibold text-brown-700/60 uppercase tracking-wider mb-2 px-1">
            Native System shortcuts
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
  )
}

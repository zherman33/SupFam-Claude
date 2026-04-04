import { useState } from 'react'
import {
  useEventColorRules,
  useCreateEventColorRule,
  useUpdateEventColorRule,
  useDeleteEventColorRule,
  type EventColorRule,
} from './use-event-color-rules'

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

export function AdvancedSettings({ onClose }: { onClose: () => void }) {
  return (
    // Full-screen overlay
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-brown-900/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel — slides in from the right */}
      <div className="relative z-10 flex flex-col bg-white w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-sand-100 px-6 py-4 bg-cream-50 flex-shrink-0">
          <div>
            <h2 className="font-semibold text-brown-800 text-base">Advanced Settings</h2>
            <p className="text-xs text-brown-700/50 mt-0.5">Customize how your family calendar looks</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-brown-700/40 hover:bg-sand-100 hover:text-brown-700 transition-colors"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none">
              <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <EventColorRulesSection />
        </div>
      </div>
    </div>
  )
}

function EventColorRulesSection() {
  // This section renders inside the full-screen panel — generous padding
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
    <div className="p-6">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-semibold text-brown-800">Event color overrides</p>
          <p className="text-xs text-brown-700/50 mt-0.5">
            Color any event whose title matches a keyword
          </p>
        </div>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1 rounded-lg bg-terracotta-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-terracotta-600"
        >
          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
            <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Add rule
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <form
          onSubmit={handleAdd}
          className="mb-4 rounded-xl border border-sand-200 bg-cream-50 p-3 space-y-3"
        >
          <div className="space-y-1">
            <label className="text-xs font-semibold text-brown-700">Keyword</label>
            <input
              autoFocus
              type="text"
              value={newKeyword}
              onChange={e => setNewKeyword(e.target.value)}
              placeholder="e.g. birthday, school, doctor"
              className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-sm text-brown-800 placeholder:text-brown-700/35 focus:border-terracotta-500 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-brown-700">Match type</label>
            <div className="flex gap-1">
              {(['contains', 'starts_with', 'ends_with', 'exact'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setNewMatchType(m)}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                    newMatchType === m
                      ? 'bg-terracotta-500 text-white'
                      : 'bg-white border border-sand-300 text-brown-700/60 hover:text-brown-800'
                  }`}
                >
                  {m === 'contains' ? 'Contains' : m === 'starts_with' ? 'Starts' : m === 'ends_with' ? 'Ends' : 'Exact'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-brown-700">Color</label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_COLORS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setNewColor(c.value)}
                  title={c.label}
                  className="h-7 w-7 rounded-lg transition-transform hover:scale-110 flex items-center justify-center"
                  style={{ backgroundColor: c.value }}
                >
                  {newColor === c.value && (
                    <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 14 14" fill="none">
                      <path d="M2 7l3.5 3.5 6.5-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              ))}
              {/* Custom color picker */}
              <label className="h-7 w-7 rounded-lg border-2 border-dashed border-sand-300 cursor-pointer flex items-center justify-center hover:border-sand-400 transition-colors" title="Custom color">
                <svg className="h-3 w-3 text-brown-700/40" viewBox="0 0 12 12" fill="none">
                  <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} className="sr-only"/>
              </label>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-brown-700">Label <span className="font-normal text-brown-700/40">(optional)</span></label>
            <input
              type="text"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="e.g. Birthdays"
              className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-sm text-brown-800 placeholder:text-brown-700/35 focus:border-terracotta-500 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
            />
          </div>

          {/* Preview */}
          {newKeyword && (
            <div className="rounded-lg bg-white border border-sand-200 p-2">
              <p className="text-[11px] text-brown-700/50 mb-1">Preview</p>
              <div className="flex items-stretch rounded overflow-hidden" style={{ backgroundColor: `${newColor}18` }}>
                <div className="w-[3px] rounded-l" style={{ backgroundColor: newColor }}/>
                <span className="px-1.5 py-px text-[13px] font-semibold" style={{ color: newColor }}>
                  {newKeyword}'s party 🎉
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!newKeyword.trim() || create.isPending}
              className="flex-1 rounded-lg bg-brown-800 py-2 text-sm font-semibold text-cream-50 disabled:opacity-40 hover:bg-brown-900 transition-colors"
            >
              {create.isPending ? 'Saving…' : 'Save rule'}
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="rounded-lg border border-sand-300 px-4 py-2 text-sm text-brown-700 hover:bg-cream-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Rules list */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2].map(i => <div key={i} className="h-12 animate-pulse rounded-xl bg-sand-100"/>)}
        </div>
      )}

      {!isLoading && (!rules || rules.length === 0) && !showAdd && (
        <div className="rounded-xl border border-dashed border-sand-200 px-4 py-6 text-center">
          <p className="text-sm text-brown-700/40">No rules yet</p>
          <p className="text-xs text-brown-700/30 mt-0.5">Add one to color-code events by keyword</p>
        </div>
      )}

      <div className="space-y-2">
        {rules?.map(rule => (
          <RuleRow key={rule.id} rule={rule} onDelete={() => remove.mutate(rule.id)} onUpdate={update.mutate} />
        ))}
      </div>
    </div>
  )
}

function RuleRow({
  rule,
  onDelete,
  onUpdate,
}: {
  rule: EventColorRule
  onDelete: () => void
  onUpdate: (r: Partial<EventColorRule> & { id: string }) => void
}) {
  const [editing, setEditing] = useState(false)
  const [color, setColor] = useState(rule.color)

  if (editing) {
    return (
      <div className="rounded-xl border border-sand-200 bg-cream-50 p-3 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {PRESET_COLORS.map(c => (
            <button
              key={c.value}
              type="button"
              onClick={() => setColor(c.value)}
              title={c.label}
              className="h-6 w-6 rounded-md flex items-center justify-center transition-transform hover:scale-110"
              style={{ backgroundColor: c.value }}
            >
              {color === c.value && (
                <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          ))}
          <label className="h-6 w-6 rounded-md border border-dashed border-sand-300 cursor-pointer flex items-center justify-center">
            <input type="color" value={color} onChange={e => setColor(e.target.value)} className="sr-only"/>
            <svg className="h-2.5 w-2.5 text-brown-700/40" viewBox="0 0 12 12" fill="none">
              <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </label>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { onUpdate({ id: rule.id, color }); setEditing(false) }}
            className="flex-1 rounded-lg bg-brown-800 py-1.5 text-xs font-semibold text-cream-50 hover:bg-brown-900 transition-colors"
          >
            Save
          </button>
          <button
            onClick={() => { setColor(rule.color); setEditing(false) }}
            className="rounded-lg border border-sand-300 px-3 py-1.5 text-xs text-brown-700 hover:bg-cream-100 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-sand-100 bg-white px-3 py-2.5 group">
      {/* Color swatch */}
      <button
        onClick={() => setEditing(true)}
        title="Change color"
        className="h-7 w-7 flex-shrink-0 rounded-lg transition-transform hover:scale-110"
        style={{ backgroundColor: rule.color }}
      />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-brown-800 truncate">"{rule.keyword}"</span>
          <span className="text-[11px] text-brown-700/40 bg-sand-100 rounded px-1.5 py-px flex-shrink-0">
            {rule.match_type === 'contains' ? 'contains' : rule.match_type === 'starts_with' ? 'starts with' : rule.match_type === 'ends_with' ? 'ends with' : 'exact'}
          </span>
        </div>
        {rule.label && <p className="text-xs text-brown-700/50 truncate">{rule.label}</p>}
      </div>

      {/* Delete */}
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 rounded-lg p-1.5 text-brown-700/40 hover:bg-red-50 hover:text-red-500 transition-all"
        title="Delete rule"
      >
        <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
          <path d="M3 4h10M6 4V3h4v1M5 4l.5 9h5l.5-9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  )
}

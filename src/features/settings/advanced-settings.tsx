import { useState } from 'react'
import {
  useEventColorRules,
  useCreateEventColorRule,
  useUpdateEventColorRule,
  useDeleteEventColorRule,
  type EventColorRule,
} from './use-event-color-rules'
import { useTheme, THEMES } from './theme-context'

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
          <ColorThemeSection />
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
                  {(newKeyword.split(',')[0]?.trim() || newKeyword)}'s party 🎉
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
  const [keyword, setKeyword] = useState(rule.keyword)
  const [color, setColor] = useState(rule.color)
  const [matchType, setMatchType] = useState<EventColorRule['match_type']>(rule.match_type)
  const [label, setLabel] = useState(rule.label || '')

  const [prevRule, setPrevRule] = useState(rule)
  if (rule !== prevRule) {
    setPrevRule(rule)
    setKeyword(rule.keyword)
    setColor(rule.color)
    setMatchType(rule.match_type)
    setLabel(rule.label || '')
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-sand-200 bg-cream-50 p-3 space-y-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-brown-700">Keyword(s)</label>
          <input
            autoFocus
            type="text"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
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
                onClick={() => setMatchType(m)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                  matchType === m
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
                onClick={() => setColor(c.value)}
                title={c.label}
                className="h-7 w-7 rounded-lg transition-transform hover:scale-110 flex items-center justify-center"
                style={{ backgroundColor: c.value }}
              >
                {color === c.value && (
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
              <input type="color" value={color} onChange={e => setColor(e.target.value)} className="sr-only"/>
            </label>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-brown-700">Label <span className="font-normal text-brown-700/40">(optional)</span></label>
          <input
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="e.g. Birthdays"
            className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-sm text-brown-800 placeholder:text-brown-700/35 focus:border-terracotta-500 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
          />
        </div>

        {/* Preview */}
        {keyword && (
          <div className="rounded-lg bg-white border border-sand-200 p-2">
            <p className="text-[11px] text-brown-700/50 mb-1">Preview</p>
            <div className="flex items-stretch rounded overflow-hidden" style={{ backgroundColor: `${color}18` }}>
              <div className="w-[3px] rounded-l" style={{ backgroundColor: color }}/>
              <span className="px-1.5 py-px text-[13px] font-semibold" style={{ color: color }}>
                {(keyword.split(',')[0]?.trim() || keyword)}'s party 🎉
              </span>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => {
              if (!keyword.trim()) return
              onUpdate({
                id: rule.id,
                keyword: keyword.trim(),
                match_type: matchType,
                color,
                label: label.trim() || null,
              })
              setEditing(false)
            }}
            disabled={!keyword.trim()}
            className="flex-1 rounded-lg bg-brown-800 py-2 text-sm font-semibold text-cream-50 hover:bg-brown-900 transition-colors disabled:opacity-40"
          >
            Save
          </button>
          <button
            onClick={() => {
              setKeyword(rule.keyword)
              setColor(rule.color)
              setMatchType(rule.match_type)
              setLabel(rule.label || '')
              setEditing(false)
            }}
            className="rounded-lg border border-sand-300 px-4 py-2 text-sm text-brown-700 hover:bg-cream-100 transition-colors"
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
        title="Edit rule"
        className="h-7 w-7 flex-shrink-0 rounded-lg transition-transform hover:scale-110"
        style={{ backgroundColor: rule.color }}
      />

      {/* Info */}
      <div 
        className="flex-1 min-w-0 cursor-pointer"
        onClick={() => setEditing(true)}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-brown-800 truncate">"{rule.keyword}"</span>
          <span className="text-[11px] text-brown-700/40 bg-sand-100 rounded px-1.5 py-px flex-shrink-0">
            {rule.match_type === 'contains' ? 'contains' : rule.match_type === 'starts_with' ? 'starts with' : rule.match_type === 'ends_with' ? 'ends with' : 'exact'}
          </span>
        </div>
        {rule.label && <p className="text-xs text-brown-700/50 truncate">{rule.label}</p>}
      </div>

      {/* Actions */}
      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all">
        <button
          onClick={() => setEditing(true)}
          className="rounded-lg p-1.5 text-brown-700/40 hover:bg-sand-100 hover:text-brown-800 transition-all"
          title="Edit rule"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
          </svg>
        </button>
        <button
          onClick={onDelete}
          className="rounded-lg p-1.5 text-brown-700/40 hover:bg-red-50 hover:text-red-500 transition-all"
          title="Delete rule"
        >
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
            <path d="M3 4h10M6 4V3h4v1M5 4l.5 9h5l.5-9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

function ColorThemeSection() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="p-6 border-b border-sand-100">
      <div className="mb-4">
        <p className="text-sm font-semibold text-brown-800">Color theme</p>
        <p className="text-xs text-brown-700/50 mt-0.5">
          Select an overall color palette for your family planner
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
                        <path d="M2.5 6l2.33 2.33L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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

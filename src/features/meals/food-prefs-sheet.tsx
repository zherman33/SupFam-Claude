import { useEffect, useState } from 'react'
import { useFoodPrefs, useSaveFoodPrefs } from './use-dinner-data'
import type { FoodPrefs } from './recommendations'

function TagEditor({
  label,
  hint,
  values,
  onChange,
  placeholder,
}: {
  label: string
  hint: string
  values: string[]
  onChange: (v: string[]) => void
  placeholder: string
}) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const t = draft.trim()
    if (t && !values.some((v) => v.toLowerCase() === t.toLowerCase())) {
      onChange([...values, t])
    }
    setDraft('')
  }
  return (
    <div>
      <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-brown-700/40">
        {label}
      </label>
      <p className="mb-2 text-xs text-brown-700/50">{hint}</p>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span
            key={v}
            className="flex items-center gap-1.5 rounded-full bg-white py-1.5 pl-3 pr-2 text-sm text-brown-800 ring-1 ring-sand-200"
          >
            {v}
            <button
              onClick={() => onChange(values.filter((x) => x !== v))}
              aria-label={`Remove ${v}`}
              className="flex h-6 w-6 items-center justify-center rounded-full text-brown-700/40 hover:bg-red-50 hover:text-red-500"
            >
              ✕
            </button>
          </span>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add()
          }}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-xl border border-sand-300 bg-white px-3 py-2 text-sm text-brown-800 placeholder:text-brown-700/35 focus:border-terracotta-500 focus:outline-none"
        />
        <button
          onClick={add}
          disabled={!draft.trim()}
          className="rounded-xl bg-sand-100 px-4 py-2 text-sm font-semibold text-brown-700 hover:bg-sand-200 disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  )
}

export function FoodPrefsSheet({ onClose }: { onClose: () => void }) {
  const { data: prefs, isLoading } = useFoodPrefs()
  const save = useSaveFoodPrefs()
  const [draft, setDraft] = useState<FoodPrefs | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (prefs && !draft) setDraft(prefs)
  }, [prefs, draft])

  const handleSave = async () => {
    if (!draft) return
    try {
      await save.mutateAsync(draft)
      setSaved(true)
      setTimeout(onClose, 700)
    } catch {
      // error shows via saved=false; keep it quiet and warm
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-brown-900/40 sm:items-center sm:p-6">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative flex max-h-[92%] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-cream-100 shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-sand-200 px-5 py-4">
          <div>
            <h2 className="font-display text-xl text-brown-800">How your family eats</h2>
            <p className="text-xs text-brown-700/50">
              This tunes every recommendation — the planner learns your tastes.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close preferences"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-brown-700/50 hover:bg-sand-100"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none">
              <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {isLoading || !draft ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-2xl bg-sand-100" />
              ))}
            </div>
          ) : (
            <>
              <TagEditor
                label="Dietary needs"
                hint="Never suggested: the planner treats these as hard rules."
                values={draft.dietary_restrictions}
                onChange={(v) => setDraft({ ...draft, dietary_restrictions: v })}
                placeholder="e.g. vegetarian, nut-free, gluten-free"
              />
              <TagEditor
                label="We don't love"
                hint="Dishes like these get skipped in recommendations."
                values={draft.dislikes}
                onChange={(v) => setDraft({ ...draft, dislikes: v })}
                placeholder="e.g. liver, spicy curry"
              />
              <TagEditor
                label="Family favorites"
                hint="These float to the top of every suggestion."
                values={draft.favorites}
                onChange={(v) => setDraft({ ...draft, favorites: v })}
                placeholder="e.g. taco night, spaghetti"
              />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-brown-700/40">
                    Usual servings
                  </p>
                  <p className="text-xs text-brown-700/50">Pre-filled on every new dinner.</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setDraft({ ...draft, default_servings: Math.max(1, draft.default_servings - 1) })}
                    aria-label="Fewer servings"
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-sand-300 bg-white text-lg text-brown-700"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-lg font-bold text-brown-800">
                    {draft.default_servings}
                  </span>
                  <button
                    onClick={() => setDraft({ ...draft, default_servings: Math.min(24, draft.default_servings + 1) })}
                    aria-label="More servings"
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-sand-300 bg-white text-lg text-brown-700"
                  >
                    +
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2.5 border-t border-sand-200 bg-white px-5 py-4">
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="rounded-xl border border-sand-300 bg-white px-5 py-2.5 text-sm font-semibold text-brown-700 hover:bg-cream-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={save.isPending || !draft}
            className="rounded-xl bg-terracotta-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-terracotta-600 disabled:opacity-40"
          >
            {saved ? 'Saved ✓' : save.isPending ? 'Saving…' : 'Save tastes'}
          </button>
        </div>
      </div>
    </div>
  )
}

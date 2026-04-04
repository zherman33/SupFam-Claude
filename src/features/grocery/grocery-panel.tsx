import { useState } from 'react'
import { useGroceryItems, useAddGroceryItem, useToggleGroceryItem, useClearCheckedItems } from './use-grocery'

const CATEGORIES = ['Produce', 'Dairy', 'Meat', 'Pantry', 'Frozen', 'Bakery', 'Drinks', 'Household', 'Other']

export function GroceryPanel() {
  const { data: items, isLoading } = useGroceryItems()
  const addItem = useAddGroceryItem()
  const toggleItem = useToggleGroceryItem()
  const clearChecked = useClearCheckedItems()

  const [newTitle, setNewTitle] = useState('')
  const [newCategory, setNewCategory] = useState('')

  const unchecked = items?.filter((i) => !i.is_checked) ?? []
  const checked = items?.filter((i) => i.is_checked) ?? []

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    await addItem.mutateAsync({ title: newTitle.trim(), category: newCategory || null })
    setNewTitle('')
    setNewCategory('')
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-9 animate-pulse rounded-lg bg-sand-100" />
        ))}
      </div>
    )
  }

  // Group unchecked by category
  const grouped = unchecked.reduce<Record<string, typeof unchecked>>((acc, item) => {
    const cat = item.category ?? 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {})

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-xl text-brown-800">Grocery</h2>
        {checked.length > 0 && (
          <button
            onClick={() => clearChecked.mutate()}
            className="text-xs text-brown-700/50 hover:text-red-400 transition-colors"
          >
            Clear {checked.length} done
          </button>
        )}
      </div>

      {/* Quick add form */}
      <form onSubmit={handleAdd} className="mb-4 flex gap-2">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add an item…"
          className="min-w-0 flex-1 rounded-lg border border-sand-300 bg-white px-3 py-2 text-sm text-brown-800 placeholder:text-brown-700/40 focus:border-terracotta-500 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
        />
        <select
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          className="rounded-lg border border-sand-300 bg-white px-2 py-2 text-xs text-brown-800 focus:border-terracotta-500 focus:outline-none"
        >
          <option value="">Category</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={!newTitle.trim() || addItem.isPending}
          className="rounded-lg bg-terracotta-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-terracotta-600 disabled:opacity-50"
        >
          +
        </button>
      </form>

      <div className="flex-1 overflow-y-auto">
        {unchecked.length === 0 ? (
          <p className="py-6 text-center font-display text-brown-700/50">
            Nothing on the list — you're all set!
          </p>
        ) : (
          Object.entries(grouped).map(([cat, catItems]) => (
            <div key={cat} className="mb-3">
              <p className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-brown-700/40">{cat}</p>
              <div className="space-y-0.5">
                {catItems.map((item) => (
                  <GroceryRow
                    key={item.id}
                    title={item.title}
                    checked={item.is_checked}
                    onToggle={() => toggleItem.mutate({ id: item.id, is_checked: !item.is_checked })}
                  />
                ))}
              </div>
            </div>
          ))
        )}

        {checked.length > 0 && (
          <div className="mt-3 border-t border-sand-200 pt-3">
            <p className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-brown-700/30">Got it</p>
            <div className="space-y-0.5">
              {checked.map((item) => (
                <GroceryRow
                  key={item.id}
                  title={item.title}
                  checked={item.is_checked}
                  onToggle={() => toggleItem.mutate({ id: item.id, is_checked: !item.is_checked })}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function GroceryRow({
  title,
  checked,
  onToggle,
}: {
  title: string
  checked: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-cream-100 ${
        checked ? 'opacity-50' : ''
      }`}
    >
      <span
        className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors ${
          checked
            ? 'border-terracotta-400 bg-terracotta-400'
            : 'border-sand-400 hover:border-terracotta-400'
        }`}
      >
        {checked && (
          <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className={`text-sm ${checked ? 'line-through text-brown-700/40' : 'text-brown-800'}`}>
        {title}
      </span>
    </button>
  )
}

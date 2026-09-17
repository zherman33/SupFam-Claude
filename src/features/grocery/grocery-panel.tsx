import { useState } from 'react'
import { useGroceryItems, useAddGroceryItem, useToggleGroceryItem, useClearCheckedItems } from './use-grocery'
import {
  ORDER_STORES,
  buildShareText,
  openStoreUrl,
  shareList,
  storeHomeUrl,
  storeSearchUrl,
  type OrderStore,
} from '@/features/meals/order-handoff'

export function GroceryPanel() {
  const { data: items, isLoading } = useGroceryItems()
  const addItem = useAddGroceryItem()
  const toggleItem = useToggleGroceryItem()
  const clearChecked = useClearCheckedItems()

  const [newTitle, setNewTitle] = useState('')
  const [orderStore, setOrderStore] = useState<OrderStore | null>(null)

  const unchecked = items?.filter((i) => !i.is_checked) ?? []
  const checked = items?.filter((i) => i.is_checked) ?? []

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    addItem.mutate({ title: newTitle.trim(), category: null })
    setNewTitle('')
  }

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-9 animate-pulse rounded-lg bg-sand-100" />
        ))}
      </div>
    )
  }

  return (
    <div className="relative flex h-full flex-col px-4 pb-4">
      {/* Title Header */}
      <div className="mb-2 flex flex-shrink-0 items-center justify-between">
        <h2 className="font-display text-xl text-brown-800">Grocery</h2>
        {checked.length > 0 && (
          <button
            onClick={() => clearChecked.mutate()}
            className="text-xs text-brown-700/50 transition-colors hover:text-red-400"
          >
            Clear {checked.length} done
          </button>
        )}
      </div>

      {/* Quick add form */}
      <form onSubmit={handleAdd} className="mb-3 flex flex-shrink-0 gap-2">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add an item…"
          className="min-w-0 flex-1 rounded-xl border border-sand-300 bg-white px-3 py-2 text-sm text-brown-800 placeholder:text-brown-700/40 focus:border-terracotta-500 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
        />
        <button
          type="submit"
          disabled={!newTitle.trim() || addItem.isPending}
          className="rounded-xl bg-terracotta-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-terracotta-600 disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {/* Order handoff */}
      {unchecked.length > 0 && (
        <div className="mb-3 flex-shrink-0 rounded-xl border border-sand-200 bg-cream-50/70 p-2.5">
          <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-widest text-brown-700/40">
            Order {unchecked.length} item{unchecked.length === 1 ? '' : 's'}
          </p>
          <div className="flex gap-2">
            {(['shipt', 'amazon-fresh'] as const).map((store) => (
              <button
                key={store}
                onClick={() => setOrderStore(store)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2.5 text-xs font-bold text-brown-800 shadow-sm ring-1 ring-sand-200 transition-all hover:ring-terracotta-400"
              >
                <span className="text-base">{store === 'shipt' ? '🛵' : '📦'}</span>
                {ORDER_STORES[store].label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 px-1 text-[10px] leading-snug text-brown-700/40">
            Opens the store with your list ready — you check out there.
          </p>
        </div>
      )}

      {/* Flat Grocery List */}
      <div className="flex-1 overflow-y-auto pr-1">
        {unchecked.length === 0 ? (
          <p className="py-10 text-center font-display text-lg italic text-brown-700/50">
            Nothing on the list — you’re all set!
          </p>
        ) : (
          <div className="space-y-1">
            {unchecked.map((item) => (
              <GroceryRow
                key={item.id}
                title={item.title}
                checked={item.is_checked}
                fromMealPlan={item.source === 'meal_plan'}
                onToggle={() => toggleItem.mutate({ id: item.id, is_checked: !item.is_checked })}
              />
            ))}
          </div>
        )}

        {checked.length > 0 && (
          <div className="mt-4 border-t border-sand-200 pt-3.5">
            <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-brown-700/30">
              Got it
            </p>
            <div className="space-y-1">
              {checked.map((item) => (
                <GroceryRow
                  key={item.id}
                  title={item.title}
                  checked={item.is_checked}
                  fromMealPlan={item.source === 'meal_plan'}
                  onToggle={() => toggleItem.mutate({ id: item.id, is_checked: !item.is_checked })}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Order sheet overlay */}
      {orderStore && (
        <OrderSheet
          store={orderStore}
          items={unchecked.map((i) => ({ title: i.title }))}
          onClose={() => setOrderStore(null)}
        />
      )}
    </div>
  )
}

/* ── Order sheet: hand the list to the real store ─────────────────────── */

function OrderSheet({
  store,
  items,
  onClose,
}: {
  store: OrderStore
  items: { title: string }[]
  onClose: () => void
}) {
  const meta = ORDER_STORES[store]
  const [feedback, setFeedback] = useState<string | null>(null)

  const handleCopy = async () => {
    const text = buildShareText(items)
    const how = await shareList(text)
    setFeedback(how === 'shared' ? 'List shared — paste it into the store.' : 'List copied — paste it into the store.')
    setTimeout(() => setFeedback(null), 2500)
  }

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-brown-900/40">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 flex max-h-[88%] flex-col overflow-hidden rounded-t-3xl bg-cream-100 shadow-2xl">
        <div className="border-b border-sand-200 px-5 pb-3 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">{store === 'shipt' ? '🛵' : '📦'}</span>
              <div>
                <h3 className="font-display text-lg text-brown-800">Order with {meta.label}</h3>
                <p className="text-[11px] text-brown-700/50">{meta.blurb}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-brown-700/50 hover:bg-sand-100"
            >
              ✕
            </button>
          </div>
          {store === 'shipt' && (
            <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-[11px] leading-snug text-brown-700/60">
              Tip: copy the list below, then paste it into Shipt’s <em>Ask Shipt</em> assistant —
              it builds the whole cart for you.
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          <div className="space-y-1">
            {items.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-2 rounded-lg bg-white/60 px-3 py-1.5"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-brown-800">{item.title}</span>
                {store === 'amazon-fresh' && (
                  <button
                    onClick={() => openStoreUrl(storeSearchUrl(store, item.title))}
                    className="flex-shrink-0 rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-terracotta-600 ring-1 ring-sand-200 hover:ring-terracotta-400"
                  >
                    Find ↗
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-sand-200 bg-white px-5 py-4">
          {feedback && (
            <p className="mb-2 text-center text-xs font-semibold text-sage-600">{feedback}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => openStoreUrl(storeHomeUrl(store))}
              className="flex-1 rounded-xl bg-terracotta-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-terracotta-600"
            >
              Open {meta.short} ↗
            </button>
            <button
              onClick={handleCopy}
              className="rounded-xl border border-sand-300 bg-white px-4 py-2.5 text-sm font-semibold text-brown-700 hover:bg-cream-100"
            >
              Copy list
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-brown-700/40">
            You’ll sign in and check out in {meta.label} — Sup Fam never sees your password.
          </p>
        </div>
      </div>
    </div>
  )
}

/* ── Row ──────────────────────────────────────────────────────────────── */

function GroceryRow({
  title,
  checked,
  fromMealPlan,
  onToggle,
}: {
  title: string
  checked: boolean
  fromMealPlan: boolean
  onToggle: () => void
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-xl border border-transparent bg-cream-50/50 p-2 transition-all hover:border-sand-200/50 hover:bg-cream-100/70 ${
        checked ? 'opacity-55' : ''
      }`}
    >
      <button onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
        <span
          className={`flex h-4.5 w-4.5 flex-shrink-0 items-center justify-center rounded border transition-colors ${
            checked ? 'border-terracotta-400 bg-terracotta-400 text-white' : 'border-sand-400 hover:border-terracotta-400'
          }`}
        >
          {checked && (
            <svg className="h-3 w-3" viewBox="0 0 10 10" fill="none">
              <path
                d="M1.5 5l2.5 2.5 4.5-4.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
        <span
          className={`truncate text-sm font-medium ${
            checked ? 'text-brown-700/40 line-through' : 'text-brown-800'
          }`}
        >
          {title}
        </span>
        {fromMealPlan && !checked && (
          <span
            title="Added from the dinner board"
            className="flex-shrink-0 rounded-full bg-terracotta-100 px-1.5 py-0.5 text-[9px] font-bold text-terracotta-600"
          >
            board
          </span>
        )}
      </button>
    </div>
  )
}

import { useState } from 'react'
import { useGroceryItems, useAddGroceryItem, useToggleGroceryItem, useClearCheckedItems } from './use-grocery'
import { useFamilyMember } from '@/features/auth/use-family-member'
import {
  useStoreIntegration,
  matchItemsWithHistory,
  matchStoreItem,
  type StoreItem,
  type CartItem,
  type HistoricalPurchase
} from './store-integration'

interface ActiveSuggestion {
  title: string
  store: 'amazon' | 'target'
  items: { item: StoreItem; quantity: number }[]
  isFromHistory: boolean
}

export function GroceryPanel() {
  const { data: member } = useFamilyMember()
  const familyId = member?.family_id ?? 'default'

  const { data: items, isLoading } = useGroceryItems()
  const addItem = useAddGroceryItem()
  const toggleItem = useToggleGroceryItem()
  const clearChecked = useClearCheckedItems()

  const [newTitle, setNewTitle] = useState('')
  const [activeSuggestion, setActiveSuggestion] = useState<ActiveSuggestion | null>(null)
  
  // Store Cart Integrations
  const amazon = useStoreIntegration('amazon')
  const target = useStoreIntegration('target')

  // Expanded review states for cart contents
  const [expandedCart, setExpandedCart] = useState<'amazon' | 'target' | null>(null)

  // Account Linking Modal Overlay States
  const [linkingStore, setLinkingStore] = useState<'amazon' | 'target' | null>(null)
  const [linkEmail, setLinkEmail] = useState('')
  const [linkPassword, setLinkPassword] = useState('')
  const [isLinkVerifying, setIsLinkVerifying] = useState(false)

  const unchecked = items?.filter((i) => !i.is_checked) ?? []
  const checked = items?.filter((i) => i.is_checked) ?? []

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return

    const title = newTitle.trim()
    
    // 1. Generate shop suggestion based on history
    const matchResult = matchItemsWithHistory(title, familyId)
    
    // 2. Add item(s) to the family offline list (Supabase)
    if (matchResult.isFromHistory && matchResult.items.length > 0) {
      // Add multiple items if they were part of the last purchase event
      // Run sequentially to prevent concurrent invalidates and Supabase race conditions
      for (const m of matchResult.items) {
        await addItem.mutateAsync({
          title: `${m.quantity}x ${m.item.name}`,
          category: null,
        })
      }
    } else {
      // Add the single typed item as fallback
      await addItem.mutateAsync({ title, category: null })
    }
    
    // 3. Set the active suggestion banner
    setActiveSuggestion({
      title,
      store: matchResult.store,
      items: matchResult.items,
      isFromHistory: matchResult.isFromHistory,
    })

    setNewTitle('')
  }

  // Handle swapping store suggestions
  const handleSwapStore = () => {
    if (!activeSuggestion) return
    const currentStore = activeSuggestion.store
    const nextStore = currentStore === 'amazon' ? 'target' : 'amazon'
    
    // Check history for the other store
    const historyKey = `supfam:history:${familyId}`
    const saved = localStorage.getItem(historyKey)
    const history: HistoricalPurchase[] = saved ? JSON.parse(saved) : []

    const matchingHistory = history.filter(
      (item) =>
        item.store === nextStore &&
        (item.name.toLowerCase().includes(activeSuggestion.title.toLowerCase()) ||
          activeSuggestion.title.toLowerCase().includes(item.name.toLowerCase()))
    )

    let itemsToSuggest: { item: StoreItem; quantity: number }[] = []
    let isFromHistory = false

    if (matchingHistory.length > 0) {
      // Find the most recent date in history for this store and term
      let mostRecentDate = matchingHistory[0].purchasedAt
      matchingHistory.forEach((item) => {
        if (new Date(item.purchasedAt) > new Date(mostRecentDate)) {
          mostRecentDate = item.purchasedAt
        }
      })

      const recentMatches = matchingHistory.filter(
        (item) => Math.abs(new Date(item.purchasedAt).getTime() - new Date(mostRecentDate).getTime()) < 10000
      )

      itemsToSuggest = recentMatches.map((m) => ({
        item: {
          id: m.id,
          name: m.name,
          brand: m.brand,
          price: m.price,
          category: m.category,
          emoji: m.emoji,
        },
        quantity: m.lastQuantity,
      }))
      isFromHistory = true
    } else {
      // Fallback to catalog direct matching
      const matched = matchStoreItem(activeSuggestion.title, nextStore)
      itemsToSuggest = [{ item: matched, quantity: 1 }]
      isFromHistory = false
    }

    setActiveSuggestion({
      ...activeSuggestion,
      store: nextStore,
      items: itemsToSuggest,
      isFromHistory,
    })
  }

  // Add all suggested items and quantities to the respective store cart
  const handleAddSuggestionToCart = () => {
    if (!activeSuggestion) return
    const { store, items } = activeSuggestion
    const integration = store === 'amazon' ? amazon : target
    
    items.forEach((m) => {
      for (let i = 0; i < m.quantity; i++) {
        integration.addToCart(m.item)
      }
    })
    
    setActiveSuggestion(null)
  }

  const amazonCartCount = amazon.cart.reduce((sum, i) => sum + i.quantity, 0)
  const targetCartCount = target.cart.reduce((sum, i) => sum + i.quantity, 0)
  
  const amazonSubtotal = amazon.cart.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const targetSubtotal = target.cart.reduce((sum, i) => sum + i.price * i.quantity, 0)

  // Determine if checkouts are actively simulating
  const activeCheckoutStore =
    amazon.checkoutStatus !== 'idle'
      ? 'amazon'
      : target.checkoutStatus !== 'idle'
      ? 'target'
      : null

  const activeCheckout =
    activeCheckoutStore === 'amazon' ? amazon : target

  // Check suggestion connection state
  const isSuggestionConnected =
    activeSuggestion &&
    (activeSuggestion.store === 'amazon'
      ? !!amazon.connectedEmail
      : !!target.connectedEmail)

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
    <div className="flex h-full flex-col px-4 pb-4 relative">
      {/* Title Header */}
      <div className="mb-2 flex items-center justify-between flex-shrink-0">
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

      {/* Store Connections Pill Bar */}
      <div className="mb-3.5 flex items-center gap-1.5 flex-shrink-0">
        <ConnectionPill
          storeName="Amazon Fresh"
          themeColor="green"
          connectedEmail={amazon.connectedEmail}
          onConnect={() => setLinkingStore('amazon')}
          onDisconnect={amazon.disconnect}
        />
        <ConnectionPill
          storeName="Target"
          themeColor="red"
          connectedEmail={target.connectedEmail}
          onConnect={() => setLinkingStore('target')}
          onDisconnect={target.disconnect}
        />
      </div>

      {/* Quick add form */}
      <form onSubmit={handleAdd} className="mb-4 flex gap-2 flex-shrink-0">
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

      {/* Suggestion Card */}
      {activeSuggestion && activeSuggestion.items.length > 0 && (
        <div
          className={`mb-4 rounded-xl border p-3 flex flex-col gap-2.5 animate-fadeIn transition-all duration-200 ${
            activeSuggestion.store === 'amazon'
              ? 'border-green-200 bg-green-50/70'
              : 'border-red-200 bg-red-50/70'
          }`}
        >
          <div className="flex justify-between items-start gap-2">
            <div className="flex gap-2">
              <span className="text-xl mt-0.5">
                {activeSuggestion.store === 'amazon' ? '📦' : '🎯'}
              </span>
              <div>
                <h4 className="text-xs font-bold text-brown-800">
                  Shop on {activeSuggestion.store === 'amazon' ? 'Amazon Fresh' : 'Target'}?
                </h4>
                <div className="text-xs text-brown-700/70 mt-1 leading-tight space-y-1">
                  <p>
                    {activeSuggestion.isFromHistory
                      ? `Found your last purchase from ${activeSuggestion.store === 'amazon' ? 'Amazon' : 'Target'}:`
                      : `We found a matching item:`}
                  </p>
                  <ul className="list-disc pl-3.5 mt-0.5 space-y-0.5">
                    {activeSuggestion.items.map((m, idx) => (
                      <li key={idx} className="font-medium text-brown-850">
                        {m.quantity}x {m.item.name} (${m.item.price.toFixed(2)})
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            <button
              onClick={() => setActiveSuggestion(null)}
              className="text-brown-700/35 hover:text-brown-800 transition-colors p-0.5"
            >
              ✕
            </button>
          </div>

          <div className="flex gap-2 text-xs">
            {isSuggestionConnected ? (
              <button
                onClick={handleAddSuggestionToCart}
                className={`flex-1 rounded-lg py-1.5 font-semibold text-white transition-colors shadow-sm ${
                  activeSuggestion.store === 'amazon'
                    ? 'bg-green-700 hover:bg-green-800'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                Add {activeSuggestion.items.length > 1 ? 'all' : 'item'} to{' '}
                {activeSuggestion.store === 'amazon' ? 'Fresh' : 'Target'} Cart
              </button>
            ) : (
              <button
                onClick={() => setLinkingStore(activeSuggestion.store)}
                className={`flex-1 rounded-lg py-1.5 font-semibold text-white transition-colors shadow-sm ${
                  activeSuggestion.store === 'amazon'
                    ? 'bg-green-700 hover:bg-green-800'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                Link {activeSuggestion.store === 'amazon' ? 'Fresh' : 'Target'} to Shop
              </button>
            )}
            <button
              onClick={handleSwapStore}
              className="rounded-lg border border-sand-300 bg-white px-3 py-1.5 font-semibold text-brown-700 hover:bg-cream-100 transition-colors"
            >
              Search {activeSuggestion.store === 'amazon' ? 'Target' : 'Amazon'} instead
            </button>
          </div>
        </div>
      )}

      {/* Flat Grocery List */}
      <div className="flex-1 overflow-y-auto pr-1">
        {unchecked.length === 0 ? (
          <p className="py-10 text-center font-display text-lg text-brown-700/50 italic">
            Nothing on the list — you're all set!
          </p>
        ) : (
          <div className="space-y-1">
            {unchecked.map((item) => {
              const matchedAmazon = matchStoreItem(item.title, 'amazon')
              const amazonCartItem = amazon.cart.find((i) => i.id === matchedAmazon.id)
              const matchedTarget = matchStoreItem(item.title, 'target')
              const targetCartItem = target.cart.find((i) => i.id === matchedTarget.id)

              return (
                <GroceryRow
                  key={item.id}
                  title={item.title}
                  checked={item.is_checked}
                  onToggle={() => toggleItem.mutate({ id: item.id, is_checked: !item.is_checked })}
                  amazonCartQty={amazonCartItem?.quantity ?? 0}
                  targetCartQty={targetCartItem?.quantity ?? 0}
                  onAddToAmazon={() => amazon.addToCart(matchedAmazon)}
                  onAddToTarget={() => target.addToCart(matchedTarget)}
                  isAmazonConnected={!!amazon.connectedEmail}
                  isTargetConnected={!!target.connectedEmail}
                  onLinkStore={setLinkingStore}
                />
              )
            })}
          </div>
        )}

        {checked.length > 0 && (
          <div className="mt-4 border-t border-sand-200 pt-3.5">
            <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-brown-700/30">
              Got it
            </p>
            <div className="space-y-1">
              {checked.map((item) => {
                const matchedAmazon = matchStoreItem(item.title, 'amazon')
                const amazonCartItem = amazon.cart.find((i) => i.id === matchedAmazon.id)
                const matchedTarget = matchStoreItem(item.title, 'target')
                const targetCartItem = target.cart.find((i) => i.id === matchedTarget.id)

                return (
                  <GroceryRow
                    key={item.id}
                    title={item.title}
                    checked={item.is_checked}
                    onToggle={() => toggleItem.mutate({ id: item.id, is_checked: !item.is_checked })}
                    amazonCartQty={amazonCartItem?.quantity ?? 0}
                    targetCartQty={targetCartItem?.quantity ?? 0}
                    onAddToAmazon={() => amazon.addToCart(matchedAmazon)}
                    onAddToTarget={() => target.addToCart(matchedTarget)}
                    isAmazonConnected={!!amazon.connectedEmail}
                    isTargetConnected={!!target.connectedEmail}
                    onLinkStore={setLinkingStore}
                  />
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Cart Footers */}
      <div className="mt-3 space-y-1.5 flex-shrink-0">
        {/* Amazon Fresh Cart Summary */}
        {amazonCartCount > 0 && (
          <CartSummaryBar
            storeName="Amazon Fresh"
            themeColor="green"
            count={amazonCartCount}
            subtotal={amazonSubtotal}
            cartItems={amazon.cart}
            onCheckout={amazon.checkout}
            onUpdateQty={amazon.updateQuantity}
            onRemove={amazon.removeFromCart}
            isExpanded={expandedCart === 'amazon'}
            onToggleExpand={() => setExpandedCart(expandedCart === 'amazon' ? null : 'amazon')}
          />
        )}

        {/* Target Cart Summary */}
        {targetCartCount > 0 && (
          <CartSummaryBar
            storeName="Target"
            themeColor="red"
            count={targetCartCount}
            subtotal={targetSubtotal}
            cartItems={target.cart}
            onCheckout={target.checkout}
            onUpdateQty={target.updateQuantity}
            onRemove={target.removeFromCart}
            isExpanded={expandedCart === 'target'}
            onToggleExpand={() => setExpandedCart(expandedCart === 'target' ? null : 'target')}
          />
        )}
      </div>

      {/* Simulated Checkout Modal Overlay */}
      {activeCheckoutStore && activeCheckout && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-white/95 p-6 text-center animate-fadeIn">
          {activeCheckout.checkoutStatus === 'submitting' && (
            <div className="space-y-4">
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-sand-200 border-t-terracotta-500" />
              <p className="font-semibold text-brown-800 text-sm">Connecting to secure gateway…</p>
              <p className="text-xs text-brown-700/40">Submitting your {activeCheckoutStore === 'amazon' ? 'Amazon Fresh' : 'Target'} cart</p>
            </div>
          )}

          {activeCheckout.checkoutStatus === 'applying_discounts' && (
            <div className="space-y-4">
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-sand-200 border-t-sage-400" />
              <p className="font-semibold text-brown-800 text-sm">Applying loyalty savings…</p>
              <p className="text-xs text-brown-700/40">
                {activeCheckoutStore === 'amazon' ? 'Checking Prime savings…' : 'Checking Target Circle offers…'}
              </p>
            </div>
          )}

          {activeCheckout.checkoutStatus === 'finalizing' && (
            <div className="space-y-4">
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-sand-200 border-t-brown-800" />
              <p className="font-semibold text-brown-800 text-sm">Reserving delivery slot…</p>
              <p className="text-xs text-brown-700/40">Securing closest open window</p>
            </div>
          )}

          {activeCheckout.checkoutStatus === 'success' && (
            <div className="space-y-5 animate-scaleIn">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sage-300 text-white shadow-md">
                <svg className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-display text-2xl font-bold text-brown-800">Order Placed!</h3>
                <p className="mt-1.5 text-xs text-brown-700/70">
                  Simulating delivery to home:
                </p>
                <p className="mt-1.5 text-sm font-bold text-brown-850 bg-cream-100 rounded-lg py-1 px-3 inline-block">
                  Tomorrow, 8:00 AM – 10:00 AM
                </p>
              </div>
              <button
                onClick={() => {
                  activeCheckout.resetCheckout()
                  setExpandedCart(null)
                }}
                className="rounded-xl bg-brown-800 px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-brown-900 shadow-sm"
              >
                Done
              </button>
            </div>
          )}
        </div>
      )}

      {/* Account Linking Modal Overlay */}
      {linkingStore && (
        <div className="absolute inset-0 z-35 flex flex-col justify-end bg-brown-900/40 animate-fadeIn">
          {!isLinkVerifying && (
            <div
              className="absolute inset-0"
              onClick={() => {
                setLinkingStore(null)
                setLinkEmail('')
                setLinkPassword('')
              }}
            />
          )}

          <div className="relative rounded-t-2xl bg-white border-t border-sand-200 p-5 shadow-2xl space-y-4 animate-slideUp z-40 max-h-[85%] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">
                  {linkingStore === 'amazon' ? '📦' : '🎯'}
                </span>
                <h3 className="font-display text-lg font-bold text-brown-850">
                  Link {linkingStore === 'amazon' ? 'Amazon Fresh' : 'Target'} Account
                </h3>
              </div>
              {!isLinkVerifying && (
                <button
                  onClick={() => {
                    setLinkingStore(null)
                    setLinkEmail('')
                    setLinkPassword('')
                  }}
                  className="rounded-lg p-1 text-brown-750/30 hover:bg-cream-100 hover:text-brown-700"
                >
                  ✕
                </button>
              )}
            </div>

            {isLinkVerifying ? (
              <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
                <div
                  className={`h-10 w-10 animate-spin rounded-full border-4 border-sand-200 ${
                    linkingStore === 'amazon' ? 'border-t-green-600' : 'border-t-red-600'
                  }`}
                />
                <div>
                  <p className="font-semibold text-brown-800 text-sm">Linking your account…</p>
                  <p className="text-[10px] text-brown-700/50 mt-1">
                    Establishing secure handshake with {linkingStore === 'amazon' ? 'Amazon Fresh' : 'Target'} gateway
                  </p>
                </div>
              </div>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!linkEmail.trim()) return

                  setIsLinkVerifying(true)

                  // Simulate API handshake latency
                  await new Promise((resolve) => setTimeout(resolve, 1500))

                  const integration = linkingStore === 'amazon' ? amazon : target
                  integration.connect(linkEmail.trim())

                  setIsLinkVerifying(false)
                  setLinkingStore(null)
                  setLinkEmail('')
                  setLinkPassword('')
                }}
                className="space-y-3.5"
              >
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brown-700/40 mb-1">
                    Store Email Address
                  </label>
                  <input
                    type="email"
                    value={linkEmail}
                    onChange={(e) => setLinkEmail(e.target.value)}
                    placeholder={linkingStore === 'amazon' ? 'zac@amazon.com' : 'zac@target.com'}
                    required
                    className="w-full rounded-xl border border-sand-300 bg-white px-3.5 py-2 text-xs text-brown-805 focus:outline-none focus:ring-1 focus:ring-terracotta-500 focus:border-terracotta-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brown-700/40 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={linkPassword}
                    onChange={(e) => setLinkPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full rounded-xl border border-sand-300 bg-white px-3.5 py-2 text-xs text-brown-805 focus:outline-none focus:ring-1 focus:ring-terracotta-500 focus:border-terracotta-500"
                  />
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="submit"
                    className={`flex-1 rounded-xl py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:scale-[1.01] ${
                      linkingStore === 'amazon'
                        ? 'bg-green-700 hover:bg-green-800'
                        : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    Link Account
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLinkingStore(null)
                      setLinkEmail('')
                      setLinkPassword('')
                    }}
                    className="rounded-xl border border-sand-300 bg-white px-4 py-2.5 text-xs font-semibold text-brown-700 hover:bg-cream-100"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────── */

interface ConnectionPillProps {
  storeName: string
  themeColor: 'green' | 'red'
  connectedEmail: string | null
  onConnect: () => void
  onDisconnect: () => void
}

function ConnectionPill({
  storeName,
  themeColor,
  connectedEmail,
  onConnect,
  onDisconnect,
}: ConnectionPillProps) {
  const isConnected = !!connectedEmail
  
  return (
    <div className="relative group">
      {isConnected ? (
        <button
          onClick={onDisconnect}
          title={`Connected as ${connectedEmail}. Tap to disconnect.`}
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold border transition-all ${
            themeColor === 'green'
              ? 'bg-green-50 border-green-200 text-green-700 hover:bg-red-50 hover:border-red-200 hover:text-red-600'
              : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
          }`}
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
              themeColor === 'green' ? 'bg-green-400' : 'bg-red-400'
            }`} />
            <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
              themeColor === 'green' ? 'bg-green-500' : 'bg-red-500'
            }`} />
          </span>
          <span className="truncate max-w-[80px]">
            {storeName === 'Amazon Fresh' ? 'Fresh linked' : 'Target linked'}
          </span>
        </button>
      ) : (
        <button
          onClick={onConnect}
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold border border-sand-300 bg-cream-50 text-brown-700/60 hover:bg-cream-100 hover:text-brown-800 transition-all focus:outline-none"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-sand-400" />
          Link {storeName === 'Amazon Fresh' ? 'Fresh' : 'Target'}
        </button>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────── */

interface GroceryRowProps {
  title: string
  checked: boolean
  onToggle: () => void
  amazonCartQty: number
  targetCartQty: number
  onAddToAmazon: () => void
  onAddToTarget: () => void
  isAmazonConnected: boolean
  isTargetConnected: boolean
  onLinkStore: (store: 'amazon' | 'target') => void
}

function GroceryRow({
  title,
  checked,
  onToggle,
  amazonCartQty,
  targetCartQty,
  onAddToAmazon,
  onAddToTarget,
  isAmazonConnected,
  isTargetConnected,
  onLinkStore,
}: GroceryRowProps) {
  return (
    <div
      className={`group flex items-center justify-between gap-2 rounded-xl border border-transparent bg-cream-50/50 p-2 transition-all hover:bg-cream-100/70 hover:border-sand-200/50 ${
        checked ? 'opacity-55' : ''
      }`}
    >
      {/* Checkbox and Text */}
      <button
        onClick={onToggle}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left focus:outline-none"
      >
        <span
          className={`flex h-4.5 w-4.5 flex-shrink-0 items-center justify-center rounded border transition-colors ${
            checked
              ? 'border-terracotta-400 bg-terracotta-400 text-white'
              : 'border-sand-400 hover:border-terracotta-400'
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
            checked ? 'line-through text-brown-700/40' : 'text-brown-800'
          }`}
        >
          {title}
        </span>
      </button>

      {/* Store Badges and actions */}
      {!checked && (
        <div className="flex items-center gap-1 flex-shrink-0 opacity-45 group-hover:opacity-100 transition-opacity">
          {/* Amazon Quick Action */}
          {amazonCartQty > 0 ? (
            <button
              onClick={onAddToAmazon}
              title={`In Amazon Fresh Cart (${amazonCartQty})`}
              className="flex h-5.5 items-center gap-0.5 rounded bg-green-50 px-1 text-[9px] font-bold text-green-700 border border-green-200 hover:bg-green-100"
            >
              <span>a</span>
              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-green-700 text-[8px] text-white px-0.5 font-bold">
                {amazonCartQty}
              </span>
            </button>
          ) : (
            <button
              onClick={isAmazonConnected ? onAddToAmazon : () => onLinkStore('amazon')}
              title={isAmazonConnected ? "Add to Amazon Fresh" : "Link Amazon Fresh to Add"}
              className="flex h-5.5 w-5.5 items-center justify-center rounded border border-sand-200 hover:border-green-300 text-brown-700/35 hover:text-green-700 hover:bg-green-50 transition-colors"
            >
              <span className="text-[9px] font-bold">a</span>
            </button>
          )}

          {/* Target Quick Action */}
          {targetCartQty > 0 ? (
            <button
              onClick={onAddToTarget}
              title={`In Target Cart (${targetCartQty})`}
              className="flex h-5.5 items-center gap-0.5 rounded bg-red-50 px-1 text-[9px] font-bold text-red-600 border border-red-200 hover:bg-red-100"
            >
              <span>🎯</span>
              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-600 text-[8px] text-white px-0.5 font-bold">
                {targetCartQty}
              </span>
            </button>
          ) : (
            <button
              onClick={isTargetConnected ? onAddToTarget : () => onLinkStore('target')}
              title={isTargetConnected ? "Add to Target" : "Link Target to Add"}
              className="flex h-5.5 w-5.5 items-center justify-center rounded border border-sand-200 hover:border-red-300 text-brown-700/35 hover:text-red-650 hover:bg-red-50 transition-colors"
            >
              <span className="text-[8px]">🎯</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────── */

interface CartSummaryBarProps {
  storeName: string
  themeColor: 'green' | 'red'
  count: number
  subtotal: number
  cartItems: CartItem[]
  onCheckout: () => void
  onUpdateQty: (id: string, qty: number) => void
  onRemove: (id: string) => void
  isExpanded: boolean
  onToggleExpand: () => void
}

function CartSummaryBar({
  storeName,
  themeColor,
  count,
  subtotal,
  cartItems,
  onCheckout,
  onUpdateQty,
  onRemove,
  isExpanded,
  onToggleExpand,
}: CartSummaryBarProps) {
  const colorClasses = {
    bgLight: themeColor === 'green' ? 'bg-green-50' : 'bg-red-50',
    borderCol: themeColor === 'green' ? 'border-green-200' : 'border-red-200',
    btnCol:
      themeColor === 'green'
        ? 'bg-green-700 hover:bg-green-800 text-white'
        : 'bg-red-600 hover:bg-red-700 text-white',
    textMain: themeColor === 'green' ? 'text-green-700' : 'text-red-600',
  }

  return (
    <div
      className={`rounded-xl border p-2 flex flex-col gap-2 transition-all duration-300 animate-scaleIn ${colorClasses.borderCol} ${colorClasses.bgLight}`}
    >
      {/* Header bar summary */}
      <div className="flex items-center justify-between">
        <button
          onClick={onToggleExpand}
          className="flex items-center gap-2 text-left focus:outline-none min-w-0 flex-1"
        >
          <span className="text-base flex-shrink-0">
            {themeColor === 'green' ? '📦' : '🎯'}
          </span>
          <div className="min-w-0">
            <span className="text-xs font-bold text-brown-850">
              {storeName} Cart
            </span>
            <span className="text-[10px] text-brown-700/50 block font-medium leading-none">
              {count} items • ${subtotal.toFixed(2)}
            </span>
          </div>
          <svg
            className={`h-3.5 w-3.5 text-brown-700/40 ml-1.5 transition-transform duration-200 flex-shrink-0 ${
              isExpanded ? 'rotate-180' : ''
            }`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        <button
          onClick={onCheckout}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-colors ${colorClasses.btnCol} flex-shrink-0`}
        >
          Checkout
        </button>
      </div>

      {/* Expanded item details */}
      {isExpanded && (
        <div className="border-t border-sand-200/50 mt-1 pt-2 space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
          {cartItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-1.5 rounded-lg bg-white/70 p-1.5 border border-sand-100/50"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-base flex-shrink-0">{item.emoji}</span>
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold text-brown-800 leading-tight">
                    {item.name}
                  </p>
                  <p className="text-[9px] text-brown-700/40">
                    ${item.price.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Quantity Editor */}
                <div className="flex items-center border border-sand-200/60 rounded bg-white text-[10px]">
                  <button
                    onClick={() => onUpdateQty(item.id, item.quantity - 1)}
                    className="px-1 py-0.5 text-brown-700/60 font-bold hover:bg-cream-50"
                  >
                    -
                  </button>
                  <span className="w-3.5 text-center font-bold text-brown-800">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => onUpdateQty(item.id, item.quantity + 1)}
                    className="px-1 py-0.5 text-brown-700/60 font-bold hover:bg-cream-50"
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={() => onRemove(item.id)}
                  className="text-brown-700/30 hover:text-red-500 transition-colors"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

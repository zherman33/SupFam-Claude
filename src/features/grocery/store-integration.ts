import { useState, useEffect } from 'react'
import { useFamilyMember } from '@/features/auth/use-family-member'

export interface StoreItem {
  id: string
  name: string
  brand: string
  price: number
  category: string
  emoji: string
}

export interface CartItem extends StoreItem {
  quantity: number
}

export type CheckoutStatus = 'idle' | 'submitting' | 'applying_discounts' | 'finalizing' | 'success'

export interface HistoricalPurchase {
  id: string
  name: string
  brand: string
  price: number
  category: string
  emoji: string
  store: 'amazon' | 'target'
  lastQuantity: number
  purchasedAt: string // ISO timestamp
}

export interface HistoryMatchResult {
  store: 'amazon' | 'target'
  items: { item: StoreItem; quantity: number }[]
  isFromHistory: boolean
}

// Mock catalogs for Amazon Fresh
export const AMAZON_FRESH_CATALOG: StoreItem[] = [
  { id: 'af-1', name: 'Organic Whole Milk', brand: '365 Whole Foods', price: 3.89, category: 'Dairy', emoji: '🥛' },
  { id: 'af-2', name: 'Organic Bananas', brand: 'Fresh Brand', price: 1.99, category: 'Produce', emoji: '🍌' },
  { id: 'af-3', name: 'Hass Avocados (4-Pack)', brand: 'Fresh Brand', price: 4.50, category: 'Produce', emoji: '🥑' },
  { id: 'af-4', name: 'Grade A Large Brown Eggs', brand: 'Happy Belly', price: 4.29, category: 'Dairy', emoji: '🥚' },
  { id: 'af-5', name: 'Boneless Chicken Breast', brand: 'Fresh Brand', price: 9.99, category: 'Meat', emoji: '🍗' },
  { id: 'af-6', name: 'Organic Honey Wheat Bread', brand: '365 Whole Foods', price: 3.49, category: 'Pantry', emoji: '🍞' },
  { id: 'af-7', name: 'La Croix Lime Sparkling Water (12-Pack)', brand: 'La Croix', price: 5.49, category: 'Drinks', emoji: '🥤' },
  { id: 'af-8', name: 'Pike Place Ground Coffee', brand: 'Starbucks', price: 8.99, category: 'Pantry', emoji: '☕' },
  { id: 'af-9', name: 'Honeycrisp Apples (3lb Bag)', brand: 'Fresh Brand', price: 4.99, category: 'Produce', emoji: '🍎' },
  { id: 'af-10', name: 'Organic Baby Spinach (16oz)', brand: '365 Whole Foods', price: 3.29, category: 'Produce', emoji: '🥬' },
  { id: 'af-11', name: 'Original Liquid Detergent (92oz)', brand: 'Tide', price: 12.99, category: 'Household', emoji: '🧼' },
  { id: 'af-12', name: 'Oreo Chocolate Sandwich Cookies', brand: 'Nabisco', price: 4.19, category: 'Pantry', emoji: '🍪' },
  { id: 'af-13', name: 'Organic Strawberries (1lb)', brand: 'Driscolls', price: 4.49, category: 'Produce', emoji: '🍓' },
  { id: 'af-14', name: 'Baby Carrots (1lb)', brand: 'Grimmway Farms', price: 1.49, category: 'Produce', emoji: '🥕' },
  { id: 'af-15', name: 'Atlantic Salmon Fillet (1lb)', brand: 'Fresh Brand', price: 12.99, category: 'Meat', emoji: '🐟' },
  { id: 'af-16', name: 'Ritz Original Crackers', brand: 'Nabisco', price: 3.99, category: 'Pantry', emoji: '🍘' },
  { id: 'af-17', name: 'Ultra Soft Toilet Paper (12 Rolls)', brand: 'Presto!', price: 14.99, category: 'Household', emoji: '🧻' },
  { id: 'af-18', name: 'Organic Whole Milk Plain Yogurt (32oz)', brand: '365 Whole Foods', price: 3.99, category: 'Dairy', emoji: '🥛' },
  { id: 'af-19', name: 'Yellow Onions (3lb Bag)', brand: 'Fresh Brand', price: 2.49, category: 'Produce', emoji: '🧅' },
  { id: 'af-20', name: 'Salted Butter (4 Sticks)', brand: 'Happy Belly', price: 3.79, category: 'Dairy', emoji: '🧈' },
]

// Mock catalogs for Target
export const TARGET_CATALOG: StoreItem[] = [
  { id: 't-1', name: 'Whole Milk (1 gal)', brand: 'Good & Gather', price: 3.49, category: 'Dairy', emoji: '🥛' },
  { id: 't-2', name: 'Large White Eggs (12ct)', brand: 'Market Pantry', price: 3.19, category: 'Dairy', emoji: '🥚' },
  { id: 't-3', name: 'Organic Bananas', brand: 'Good & Gather', price: 2.29, category: 'Produce', emoji: '🍌' },
  { id: 't-4', name: 'Organic Yellow Tortilla Chips', brand: 'Good & Gather', price: 2.99, category: 'Pantry', emoji: '🍿' },
  { id: 't-5', name: 'Make-A-Size Paper Towels (6-Roll)', brand: 'Up & Up', price: 6.49, category: 'Household', emoji: '🧻' },
  { id: 't-6', name: 'Fresh scent Flushable Wipes (3-Pack)', brand: 'Up & Up', price: 3.29, category: 'Household', emoji: '🧼' },
  { id: 't-7', name: 'House Blend Medium Roast Coffee (12oz)', brand: 'Archer Farms', price: 7.99, category: 'Pantry', emoji: '☕' },
  { id: 't-8', name: 'Frozen Whole Strawberries (16oz)', brand: 'Good & Gather', price: 3.89, category: 'Frozen', emoji: '🍓' },
  { id: 't-9', name: 'Strawberry Greek Yogurt (5.3oz)', brand: 'Chobani', price: 1.49, category: 'Dairy', emoji: '🥛' },
  { id: 't-10', name: 'Shredded Cheddar Cheese (8oz)', brand: 'Good & Gather', price: 2.79, category: 'Dairy', emoji: '🧀' },
  { id: 't-11', name: 'Macaroni & Cheese Dinner (7.25oz)', brand: 'Market Pantry', price: 0.99, category: 'Pantry', emoji: '🧀' },
  { id: 't-12', name: 'Heavy Duty Trash Bags (30 gal, 40ct)', brand: 'Up & Up', price: 8.99, category: 'Household', emoji: '🗑️' },
  { id: 't-13', name: 'Soft Bake Chocolate Chip Cookies', brand: 'Market Pantry', price: 2.49, category: 'Pantry', emoji: '🍪' },
  { id: 't-14', name: 'Baby Cut Carrots (1lb)', brand: 'Good & Gather', price: 1.29, category: 'Produce', emoji: '🥕' },
  { id: 't-15', name: 'Organic Spring Mix Salad (16oz)', brand: 'Good & Gather', price: 3.49, category: 'Produce', emoji: '🥬' },
  { id: 't-16', name: 'Boneless Skinless Chicken Breasts (3lb)', brand: 'Market Pantry', price: 11.99, category: 'Meat', emoji: '🍗' },
  { id: 't-17', name: 'Sweet Cream Butter (4 Sticks)', brand: 'Good & Gather', price: 3.99, category: 'Dairy', emoji: '🧈' },
  { id: 't-18', name: 'Tomato Ketchup (20oz)', brand: 'Heinz', price: 2.99, category: 'Pantry', emoji: '🥫' },
  { id: 't-19', name: 'Ibuprofen Tablets (200ct)', brand: 'Up & Up', price: 4.49, category: 'Household', emoji: '💊' },
  { id: 't-20', name: '$25 Target Gift Card', brand: 'Target', price: 25.00, category: 'Other', emoji: '🎁' },
  { id: 't-21', name: 'Fairlife Whole Milk (52 fl oz)', brand: 'Fairlife', price: 4.49, category: 'Dairy', emoji: '🥛' },
  { id: 't-22', name: 'Fairlife Fat Free Milk (52 fl oz)', brand: 'Fairlife', price: 4.49, category: 'Dairy', emoji: '🥛' },
]

export function useStoreIntegration(store: 'amazon' | 'target') {
  const { data: member } = useFamilyMember()
  const familyId = member?.family_id ?? 'default'

  const cartKey = `supfam:cart:${familyId}:${store}`
  const emailKey = `supfam:conn:${familyId}:${store}`
  const historyKey = `supfam:history:${familyId}`

  // Seed default history on mount if empty so suggestions match automatically
  useEffect(() => {
    const saved = localStorage.getItem(historyKey)
    if (!saved) {
      const initialHistory: HistoricalPurchase[] = [
        {
          id: 't-21',
          name: 'Fairlife Whole Milk (52 fl oz)',
          brand: 'Fairlife',
          price: 4.49,
          category: 'Dairy',
          emoji: '🥛',
          store: 'target',
          lastQuantity: 2,
          purchasedAt: '2026-06-01T10:00:00Z',
        },
        {
          id: 't-22',
          name: 'Fairlife Fat Free Milk (52 fl oz)',
          brand: 'Fairlife',
          price: 4.49,
          category: 'Dairy',
          emoji: '🥛',
          store: 'target',
          lastQuantity: 1,
          purchasedAt: '2026-06-01T10:00:00Z',
        },
        {
          id: 'af-2',
          name: 'Organic Bananas',
          brand: 'Fresh Brand',
          price: 1.99,
          category: 'Produce',
          emoji: '🍌',
          store: 'amazon',
          lastQuantity: 3,
          purchasedAt: '2026-05-30T15:00:00Z',
        },
      ]
      localStorage.setItem(historyKey, JSON.stringify(initialHistory))
    }
  }, [historyKey])

  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem(cartKey)
    return saved ? JSON.parse(saved) : []
  })

  const [connectedEmail, setConnectedEmail] = useState<string | null>(() => {
    return localStorage.getItem(emailKey)
  })

  const [checkoutStatus, setCheckoutStatus] = useState<CheckoutStatus>('idle')

  useEffect(() => {
    localStorage.setItem(cartKey, JSON.stringify(cart))
  }, [cart, cartKey])

  useEffect(() => {
    if (connectedEmail) {
      localStorage.setItem(emailKey, connectedEmail)
    } else {
      localStorage.removeItem(emailKey)
    }
  }, [connectedEmail, emailKey])

  const addToCart = (item: StoreItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id)
      if (existing) {
        return prev.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i))
      }
      return [...prev, { ...item, quantity: 1 }]
    })
  }

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((i) => i.id !== itemId))
  }

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId)
      return
    }
    setCart((prev) => prev.map((i) => (i.id === itemId ? { ...i, quantity } : i)))
  }

  const clearCart = () => {
    setCart([])
  }

  const connect = (email: string) => {
    setConnectedEmail(email)
  }

  const disconnect = () => {
    setConnectedEmail(null)
    clearCart()
  }

  const checkout = () => {
    if (cart.length === 0) return

    setCheckoutStatus('submitting')

    // Append to past purchases history with timestamp
    const timestamp = new Date().toISOString()
    const saved = localStorage.getItem(historyKey)
    const history: HistoricalPurchase[] = saved ? JSON.parse(saved) : []
    const updatedHistory = [...history]
    cart.forEach((cartItem) => {
      // Remove old entries for the same product id to keep the last purchase fresh
      const existingIdx = updatedHistory.findIndex((h) => h.id === cartItem.id)
      if (existingIdx !== -1) {
        updatedHistory.splice(existingIdx, 1)
      }
      updatedHistory.push({
        id: cartItem.id,
        name: cartItem.name,
        brand: cartItem.brand,
        price: cartItem.price,
        category: cartItem.category,
        emoji: cartItem.emoji,
        store: store,
        lastQuantity: cartItem.quantity,
        purchasedAt: timestamp,
      })
    })
    localStorage.setItem(historyKey, JSON.stringify(updatedHistory))

    setTimeout(() => {
      setCheckoutStatus('applying_discounts')
      setTimeout(() => {
        setCheckoutStatus('finalizing')
        setTimeout(() => {
          setCheckoutStatus('success')
          clearCart()
        }, 1200)
      }, 1000)
    }, 1000)
  }

  const resetCheckout = () => {
    setCheckoutStatus('idle')
  }

  return {
    cart,
    connectedEmail,
    checkoutStatus,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    connect,
    disconnect,
    checkout,
    resetCheckout,
  }
}

// Function to find the best match checking purchase history first
export function matchItemsWithHistory(title: string, familyId: string): HistoryMatchResult {
  const lowerTitle = title.toLowerCase().trim()
  if (!lowerTitle) {
    return { store: 'target', items: [{ item: TARGET_CATALOG[0], quantity: 1 }], isFromHistory: false }
  }

  // 1. Search past purchases history
  const historyKey = `supfam:history:${familyId}`
  const saved = localStorage.getItem(historyKey)
  const history: HistoricalPurchase[] = saved ? JSON.parse(saved) : []

  // Filter history for items containing the title text
  const matchingHistoryItems = history.filter(
    (item) =>
      item.name.toLowerCase().includes(lowerTitle) ||
      lowerTitle.includes(item.name.toLowerCase()) ||
      item.brand.toLowerCase().includes(lowerTitle)
  )

  if (matchingHistoryItems.length > 0) {
    // Find the most recent purchasedAt date among these matches
    let mostRecentDate = matchingHistoryItems[0].purchasedAt
    matchingHistoryItems.forEach((item) => {
      if (new Date(item.purchasedAt) > new Date(mostRecentDate)) {
        mostRecentDate = item.purchasedAt
      }
    })

    // Collect all matches from that exact last purchase event (same store, within 10 seconds checkout tolerance)
    const targetStore = matchingHistoryItems.find((i) => i.purchasedAt === mostRecentDate)!.store
    const recentMatches = matchingHistoryItems.filter(
      (item) =>
        item.store === targetStore &&
        Math.abs(new Date(item.purchasedAt).getTime() - new Date(mostRecentDate).getTime()) < 10000
    )

    return {
      store: targetStore,
      items: recentMatches.map((m) => ({
        item: {
          id: m.id,
          name: m.name,
          brand: m.brand,
          price: m.price,
          category: m.category,
          emoji: m.emoji,
        },
        quantity: m.lastQuantity,
      })),
      isFromHistory: true,
    }
  }

  // 2. Fallback: Search catalogs directly (prioritize Target then Amazon)
  let matched = TARGET_CATALOG.find(
    (item) =>
      item.name.toLowerCase().includes(lowerTitle) ||
      lowerTitle.includes(item.name.toLowerCase())
  )
  if (matched) {
    return { store: 'target', items: [{ item: matched, quantity: 1 }], isFromHistory: false }
  }

  matched = AMAZON_FRESH_CATALOG.find(
    (item) =>
      item.name.toLowerCase().includes(lowerTitle) ||
      lowerTitle.includes(item.name.toLowerCase())
  )
  if (matched) {
    return { store: 'amazon', items: [{ item: matched, quantity: 1 }], isFromHistory: false }
  }

  // 3. Keyword matching across both stores
  const keywordsMap: Record<string, { id: string; store: 'amazon' | 'target' }> = {
    milk: { id: 't-1', store: 'target' }, // Whole Milk (Target)
    egg: { id: 't-2', store: 'target' },  // Eggs (Target)
    banana: { id: 'af-2', store: 'amazon' }, // Organic Bananas (Amazon)
    avocado: { id: 'af-3', store: 'amazon' },
    chicken: { id: 't-16', store: 'target' },
    bread: { id: 'af-6', store: 'amazon' },
    water: { id: 'af-7', store: 'amazon' },
    coffee: { id: 't-7', store: 'target' },
    apple: { id: 'af-9', store: 'amazon' },
    spinach: { id: 't-15', store: 'target' },
    salad: { id: 't-15', store: 'target' },
    detergent: { id: 'af-11', store: 'amazon' },
    tide: { id: 'af-11', store: 'amazon' },
    paper: { id: 't-5', store: 'target' }, // Paper Towels
    cookie: { id: 'af-12', store: 'amazon' },
    oreo: { id: 'af-12', store: 'amazon' },
    strawberry: { id: 't-8', store: 'target' },
    carrot: { id: 't-14', store: 'target' },
    salmon: { id: 'af-15', store: 'amazon' },
    butter: { id: 't-17', store: 'target' },
    cheese: { id: 't-10', store: 'target' },
    yogurt: { id: 't-9', store: 'target' },
  }

  for (const [kw, targetInfo] of Object.entries(keywordsMap)) {
    if (lowerTitle.includes(kw)) {
      const catalog = targetInfo.store === 'amazon' ? AMAZON_FRESH_CATALOG : TARGET_CATALOG
      const found = catalog.find((i) => i.id === targetInfo.id)
      if (found) {
        return { store: targetInfo.store, items: [{ item: found, quantity: 1 }], isFromHistory: false }
      }
    }
  }

  // 4. Default Fallback
  return {
    store: 'target',
    items: [
      {
        item: {
          id: `fallback-target-${encodeURIComponent(lowerTitle)}`,
          name: title,
          brand: 'Market Pantry',
          price: 3.49,
          category: 'Other',
          emoji: '🛒',
        },
        quantity: 1,
      },
    ],
    isFromHistory: false,
  }
}

// Helper to match store item directly from the store catalog (ignores quantity prefix)
export function matchStoreItem(title: string, store: 'amazon' | 'target'): StoreItem {
  const catalog = store === 'amazon' ? AMAZON_FRESH_CATALOG : TARGET_CATALOG
  // Clean prefix like "2x " or "10x "
  const cleanedTitle = title.replace(/^\d+x\s+/, '').toLowerCase().trim()

  const matched = catalog.find(
    (item) =>
      item.name.toLowerCase().includes(cleanedTitle) ||
      cleanedTitle.includes(item.name.toLowerCase())
  )

  if (matched) return matched

  // Fallback keyword map (using cleanedTitle)
  const keywordsMap: Record<string, string> = {
    milk: store === 'amazon' ? 'af-1' : 't-1',
    egg: store === 'amazon' ? 'af-4' : 't-2',
    banana: store === 'amazon' ? 'af-2' : 't-3',
    avocado: store === 'amazon' ? 'af-3' : 't-3',
    chicken: store === 'amazon' ? 'af-5' : 't-16',
    bread: store === 'amazon' ? 'af-6' : 't-7',
    water: store === 'amazon' ? 'af-7' : 't-4',
    coffee: store === 'amazon' ? 'af-8' : 't-7',
    apple: store === 'amazon' ? 'af-9' : 't-3',
    spinach: store === 'amazon' ? 'af-10' : 't-15',
    salad: store === 'amazon' ? 'af-10' : 't-15',
    detergent: store === 'amazon' ? 'af-11' : 't-5',
    tide: store === 'amazon' ? 'af-11' : 't-5',
    paper: store === 'amazon' ? 'af-17' : 't-5',
    cookie: store === 'amazon' ? 'af-12' : 't-13',
    oreo: store === 'amazon' ? 'af-12' : 't-13',
    strawberry: store === 'amazon' ? 'af-13' : 't-8',
    carrot: store === 'amazon' ? 'af-14' : 't-14',
    salmon: store === 'amazon' ? 'af-15' : 't-16',
    butter: store === 'amazon' ? 'af-20' : 't-17',
    cheese: store === 'amazon' ? 'af-18' : 't-10',
    yogurt: store === 'amazon' ? 'af-18' : 't-9',
  }

  for (const [kw, id] of Object.entries(keywordsMap)) {
    if (cleanedTitle.includes(kw)) {
      const found = catalog.find((i) => i.id === id)
      if (found) return found
    }
  }

  return {
    id: `fallback-${store}-${encodeURIComponent(cleanedTitle)}`,
    name: cleanedTitle,
    brand: store === 'amazon' ? 'Fresh Brand' : 'Market Pantry',
    price: 3.49,
    category: 'Other',
    emoji: '🛒',
  }
}

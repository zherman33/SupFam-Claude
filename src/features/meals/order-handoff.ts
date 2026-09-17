/**
 * Grocery ordering handoff.
 *
 * Feasibility (verified Sep 2026):
 * - Shipt offers NO public API for third-party developers (no list/cart
 *   handoff endpoint, no developer program). Their affiliate program
 *   (FlexOffers/Impact) pays for membership referrals only.
 * - Amazon offers NO ordering API. The Product Advertising API returns product
 *   data for affiliates — it cannot add to cart or check out. The old
 *   `gp/aws/cart/add.html?ASIN.1=…` URL trick is undocumented, needs ASINs
 *   (unresolvable from plain item names), and is fragile — not used.
 *
 * So true one-tap ordering is impossible without the user's own credentials,
 * which we deliberately do not collect. The honest, robust mechanism:
 * deep-link into each store's native search (opens their app on mobile via
 * universal links, falls back to the browser) with the list in hand, plus
 * copy/share the list as text for pasting into Shipt's "Ask Shipt" assistant
 * or any store search box.
 */

export type OrderStore = 'shipt' | 'amazon-fresh'

export const ORDER_STORES: Record<
  OrderStore,
  { label: string; short: string; blurb: string }
> = {
  shipt: {
    label: 'Shipt',
    short: 'Shipt',
    blurb: 'Same-day delivery from your local stores',
  },
  'amazon-fresh': {
    label: 'Amazon Fresh',
    short: 'Fresh',
    blurb: 'Groceries from Amazon, delivered',
  },
}

/** Amazon Fresh storefront — verified live Sep 2026. */
const AMAZON_FRESH_STOREFRONT =
  'https://www.amazon.com/alm/storefront?almBrandId=QW1hem9uIEZyZXNo'

/** Shipt storefront home — verified live Sep 2026. */
const SHIPT_HOME = 'https://shop.shipt.com/'

/** Deep link to search for one item inside the store. Opens the store's app when installed. */
export function storeSearchUrl(store: OrderStore, query: string): string {
  const q = query.trim()
  if (store === 'amazon-fresh') {
    // Amazon's universal search; on mobile this opens the Amazon app where the
    // user can filter to Fresh. Scoped Fresh search params are unverified, so
    // we link the plain search rather than guess.
    return `https://www.amazon.com/s?k=${encodeURIComponent(q)}`
  }
  // Shipt publishes no documented search URL scheme; the storefront home is
  // the verified entry point (universal link → app when installed).
  void q
  return SHIPT_HOME
}

/** Entry point for starting an order at the store (whole-list flow). */
export function storeHomeUrl(store: OrderStore): string {
  return store === 'amazon-fresh' ? AMAZON_FRESH_STOREFRONT : SHIPT_HOME
}

export interface HandoffItem {
  title: string
  quantity?: number | null
  unit?: string | null
}

function formatLine(item: HandoffItem): string {
  const qty =
    item.quantity != null && item.quantity > 0
      ? `${item.quantity}${item.unit ? ` ${item.unit}` : '×'} `
      : ''
  return `• ${qty}${item.title}`
}

/** Plain-text list, ready to paste into Shipt search / Ask Shipt / Notes. */
export function buildShareText(items: HandoffItem[], heading?: string): string {
  const lines = items.map(formatLine)
  return `${heading ?? "This week's groceries"} (${items.length} items)\n${lines.join('\n')}`
}

/** Open a URL in a way that lets the OS hand off to the store's app when installed. */
export function openStoreUrl(url: string): void {
  // A plain anchor navigation (not an in-app webview) lets iOS/Android
  // universal links jump straight into the Shipt / Amazon app.
  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** System share sheet when available, clipboard fallback otherwise. Returns how it was shared. */
export async function shareList(text: string): Promise<'shared' | 'copied'> {
  if (navigator.share) {
    try {
      await navigator.share({ text })
      return 'shared'
    } catch {
      // User dismissed the sheet — fall through to clipboard quietly
    }
  }
  await navigator.clipboard.writeText(text)
  return 'copied'
}

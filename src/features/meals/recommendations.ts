/**
 * Dinner recommendation engine — deterministic, runs fully client-side.
 *
 * Scores dishes from the family's own meal history so the "3 recommendations"
 * the board (and the voice planner) offers are grounded in what this household
 * actually cooks and likes. No AI call needed: ratings, recency, frequency,
 * favorites, and dietary filters do the work.
 */

export interface MealHistoryEntry {
  /** Display title as cooked, e.g. "Taco Tuesday" */
  title: string
  /** yyyy-MM-dd the meal was planned for */
  date: string
  dayIndex: number
}

export interface RatingSummary {
  /** Normalized (lowercased, trimmed) title */
  title: string
  avg: number
  count: number
}

export interface FoodPrefs {
  dietary_restrictions: string[]
  dislikes: string[]
  favorites: string[]
  default_servings: number
}

export interface Recommendation {
  /** Display title (most recent casing the family used) */
  title: string
  score: number
  /** Human reason, e.g. "5★ from the family · last had 3 weeks ago" */
  reason: string
  daysSince: number | null
  avgRating: number | null
}

/** Normalize a dish title so "Tacos", "tacos " and "TACOS" match across weeks. */
export function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Does a dish hit a dislike? Matches whole words with simple plural handling,
 * so a "mushrooms" dislike filters "Mushroom risotto" but not "mushroom soup
 * enthusiasts" — still just a heuristic, not a dietary-safety system.
 */
function dislikeHit(titleKey: string, dislikes: Set<string>): boolean {
  const words = (s: string) =>
    new Set(
      s
        .split(/[^a-z0-9]+/)
        .filter(Boolean)
        .map((w) => (w.endsWith('s') && w.length > 3 ? w.slice(0, -1) : w))
    )
  const titleWords = words(titleKey)
  for (const d of dislikes) {
    if (!d) continue
    if (titleKey.includes(d) || d.includes(titleKey)) return true
    for (const w of words(d)) {
      if (titleWords.has(w)) return true
    }
  }
  return false
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  const ms = Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)
  return Math.round(ms / 86_400_000)
}

function weeksAgoLabel(days: number): string {
  if (days < 7) return 'this week'
  if (days < 14) return 'last week'
  const w = Math.round(days / 7)
  return `${w} week${w === 1 ? '' : 's'} ago`
}

interface ScoredDish {
  title: string
  display: string
  score: number
  lastDate: string | null
  daysSince: number | null
  timesCooked90d: number
  avgRating: number | null
  ratingCount: number
  isFavorite: boolean
  reasons: { text: string; weight: number }[]
}

/**
 * Score every dish the family has cooked. `today` and `plannedTitles` keep
 * this week's board from recommending itself.
 */
export function scoreDishes(
  history: MealHistoryEntry[],
  ratings: RatingSummary[],
  prefs: FoodPrefs,
  today: string,
  plannedTitles: string[] = []
): Recommendation[] {
  const ratingByTitle = new Map(ratings.map((r) => [r.title, r]))
  const planned = new Set(plannedTitles.map(normalizeTitle))
  const dislikeSet = new Set(prefs.dislikes.map(normalizeTitle))
  const favoriteSet = new Set(prefs.favorites.map(normalizeTitle))
  const restrictionSet = new Set(prefs.dietary_restrictions.map(normalizeTitle))

  // Group history by dish
  const byDish = new Map<string, { display: string; dates: string[] }>()
  for (const h of history) {
    const key = normalizeTitle(h.title)
    if (!key) continue
    const cur = byDish.get(key) ?? { display: h.title.trim(), dates: [] }
    cur.dates.push(h.date)
    byDish.set(key, cur)
  }

  const scored: ScoredDish[] = []
  for (const [key, { display, dates }] of byDish) {
    // Hard filters: already on this week's board, disliked, or restricted out
    if (planned.has(key)) continue
    if (dislikeHit(key, dislikeSet)) continue
    if ([...restrictionSet].some((r) => r && key.includes(r))) continue

    const sorted = [...dates].sort()
    const lastDate = sorted[sorted.length - 1]
    const daysSince = daysBetween(lastDate, today)
    const timesCooked90d = sorted.filter((d) => daysBetween(d, today) <= 90).length
    const rating = ratingByTitle.get(key)
    const avgRating = rating ? rating.avg : null
    const isFavorite = favoriteSet.has(key)

    let score = 1
    const reasons: { text: string; weight: number }[] = []

    // Ratings: loved dishes float up, disliked ones sink
    if (avgRating != null && rating!.count > 0) {
      const w = (avgRating - 3) * 2
      score += w
      if (avgRating >= 4.5) reasons.push({ text: 'loved by the family', weight: 3 })
      else if (avgRating >= 4) reasons.push({ text: 'rated highly', weight: 2 })
      else if (avgRating <= 2) reasons.push({ text: 'rated poorly before', weight: -3 })
    }

    // Recency: penalize "we just had this", reward the sweet spot
    if (daysSince < 7) {
      score -= 6
      reasons.push({ text: 'had it this week', weight: -4 })
    } else if (daysSince < 14) {
      score -= 3
      reasons.push({ text: 'had it last week', weight: -2 })
    } else if (daysSince < 21) {
      score -= 1
    } else if (daysSince <= 45) {
      score += 2
      reasons.push({ text: `last had ${weeksAgoLabel(daysSince)} — due for a comeback`, weight: 2 })
    } else {
      score += 1
      reasons.push({ text: `haven't had it in a while`, weight: 1 })
    }

    // Frequency: proven staples get a nudge, overplayed ones cool off
    if (timesCooked90d >= 2 && timesCooked90d <= 4) {
      score += 1
      reasons.push({ text: 'a regular in your rotation', weight: 1 })
    } else if (timesCooked90d >= 6) {
      score -= 1.5
    }

    if (isFavorite) {
      score += 3
      reasons.push({ text: 'a family favorite', weight: 3 })
    }

    scored.push({
      title: key,
      display,
      score,
      lastDate,
      daysSince,
      timesCooked90d,
      avgRating,
      ratingCount: rating?.count ?? 0,
      isFavorite,
      reasons,
    })
  }

  scored.sort((a, b) => b.score - a.score)

  return scored.slice(0, 3).map((d) => {
    const top = [...d.reasons].sort((a, b) => b.weight - a.weight).slice(0, 2)
    const bits: string[] = []
    const avg = d.avgRating
    const praised = avg != null && avg >= 4 && d.ratingCount > 0
    if (praised) {
      const stars = avg >= 4.5 ? '★★★★★' : '★★★★'
      const verdict = avg >= 4.5 ? 'loved by the family' : 'rated highly'
      bits.push(`${stars} · ${verdict}`)
    }
    for (const r of top) {
      // Skip the praise reason — it's already in the star verdict above.
      if (praised && (r.text === 'loved by the family' || r.text === 'rated highly')) continue
      if (bits.join(' ').includes(r.text)) continue
      bits.push(r.text)
    }
    return {
      title: d.display,
      score: Math.round(d.score * 10) / 10,
      reason: bits.slice(0, 2).join(' · ') || 'from your history',
      daysSince: d.daysSince,
      avgRating: d.avgRating,
    }
  })
}

/**
 * Builds the system prompt + parses structured proposals for dinner-planning
 * conversations. Shared by both AI paths (Supabase edge function for cloud,
 * direct browser→Ollama call for the home server), so the conversation behaves
 * identically wherever the model runs.
 */

import { DAY_NAMES_FULL, dateForDay } from './types'
import { normalizeTitle, type FoodPrefs, type MealHistoryEntry, type RatingSummary, type Recommendation } from './recommendations'
import { format } from 'date-fns'

export interface Proposal {
  dayIndex: number // 0 = Monday … 6 = Sunday
  title: string
  servings: number
  notes?: string
}

export interface DinnerContextInput {
  scope: 'day' | 'week'
  weekStart: string
  dayIndex?: number
  recommendations: Recommendation[]
  history: MealHistoryEntry[]
  ratings: RatingSummary[]
  prefs: FoodPrefs
  plannedMeals: { dayIndex: number; title: string }[]
  memberName?: string
}

const PROPOSAL_CONTRACT = `
When the family agrees on a dish (they say yes, "let's do it", "sounds good", pick one of your suggestions, or name their own), put it on the board by ending your reply with a fenced block like this — and ONLY like this:

\`\`\`proposals
[{"dayIndex": 4, "title": "Chicken tacos", "servings": 4}]
\`\`\`

Rules for the block:
- dayIndex is 0=Monday … 6=Sunday. Use the day you're discussing (day scope) or each day you're filling (week scope).
- title is the dish name, plain and short.
- servings defaults to the family's usual unless they say otherwise.
- Emit the block only when they've clearly agreed — never for a mere suggestion. You can propose several days at once in week scope.
- The block is invisible to the family; your visible reply should just confirm warmly ("Taco Friday it is — I've put it on the board.")`

function recentHistoryLine(history: MealHistoryEntry[]): string {
  const seen = new Map<string, string>()
  for (const h of [...history].sort((a, b) => (a.date < b.date ? 1 : -1))) {
    const key = normalizeTitle(h.title)
    if (!seen.has(key) && seen.size < 15) seen.set(key, h.date)
  }
  if (seen.size === 0) return 'No meal history yet — this is a fresh start.'
  return [...seen.entries()]
    .map(([t, d]) => {
      const pretty = format(new Date(d + 'T12:00:00'), 'MMM d')
      return `${t} (last ${pretty})`
    })
    .join('; ')
}

function ratingsLine(ratings: RatingSummary[]): string {
  if (ratings.length === 0) return 'No ratings yet.'
  const loved = ratings.filter((r) => r.avg >= 4).sort((a, b) => b.avg - a.avg).slice(0, 6)
  const disliked = ratings.filter((r) => r.avg <= 2).sort((a, b) => a.avg - b.avg).slice(0, 4)
  const bits: string[] = []
  if (loved.length > 0) bits.push(`Loved: ${loved.map((r) => r.title).join(', ')}`)
  if (disliked.length > 0) bits.push(`Avoid suggesting: ${disliked.map((r) => r.title).join(', ')}`)
  return bits.join('. ') || 'No strong ratings yet.'
}

export function buildDinnerSystemPrompt(input: DinnerContextInput): string {
  const { scope, weekStart, dayIndex, recommendations, history, ratings, prefs, plannedMeals, memberName } = input

  const weekLabel = `${format(dateForDay(weekStart, 0), 'MMM d')} – ${format(dateForDay(weekStart, 6), 'MMM d, yyyy')}`

  const plannedLines = plannedMeals.length > 0
    ? plannedMeals.map((m) => `- ${DAY_NAMES_FULL[m.dayIndex]}: ${m.title}`).join('\n')
    : 'Nothing planned yet this week.'

  const recLines = recommendations.length > 0
    ? recommendations.map((r, i) => `${i + 1}. ${r.title} — ${r.reason}`).join('\n')
    : 'No history-based recommendations available.'

  const restrictions = prefs.dietary_restrictions.length > 0
    ? prefs.dietary_restrictions.join(', ')
    : 'none noted'
  const dislikes = prefs.dislikes.length > 0 ? prefs.dislikes.join(', ') : 'none noted'
  const favorites = prefs.favorites.length > 0 ? prefs.favorites.join(', ') : 'none noted'

  const scopeBrief = scope === 'day' && dayIndex != null
    ? `You're helping decide dinner for ${DAY_NAMES_FULL[dayIndex]}, ${format(dateForDay(weekStart, dayIndex), 'MMMM d')}.
Open the conversation by offering these 3 recommendations from their own history, each with its one-line reason, then ask which sounds good — or invite them to tell you what they're craving instead. Keep it to a couple of sentences; they'll hear this spoken aloud.`
    : `You're helping plan dinners for the week of ${weekLabel}.
Start by noting which days are still empty, then suggest filling them from their history and favorites — walk through the empty days a couple at a time rather than dumping seven ideas at once. If they say "just fill the week" or "plan a few days", go ahead and propose the lot. Keep replies short and speakable.`

  return `You are the Sup Fam dinner planner — a warm, concise family assistant helping ${memberName ?? 'the family'} decide what's for dinner. Today is ${format(new Date(), 'EEEE, MMMM d')}.

${scopeBrief}

FAMILY CONTEXT
- Dietary restrictions (never suggest dishes violating these): ${restrictions}
- Dislikes (never suggest): ${dislikes}
- Favorites (lean toward): ${favorites}
- Usual servings: ${prefs.default_servings}
- Recent meals: ${recentHistoryLine(history)}
- Ratings: ${ratingsLine(ratings)}

THIS WEEK'S BOARD (${weekLabel})
${plannedLines}

HISTORY-BASED RECOMMENDATIONS
${recLines}

STYLE
- Warm and brief, like a note on the fridge. 1–3 sentences per reply — this is a voice conversation.
- If they describe what they're thinking ("something with chicken", "tacos"), run with it: suggest a concrete dish, don't interrogate.
- Respect restrictions absolutely. If a pick conflicts, say so kindly and offer the closest alternative.
- Don't list ingredients or recipes unless asked. Don't moralize about nutrition.
${PROPOSAL_CONTRACT}`
}

/** Split a model reply into speakable text + structured board proposals. */
export function extractProposals(reply: string): { text: string; proposals: Proposal[] } {
  const proposals: Proposal[] = []
  const text = reply.replace(/```proposals\s*([\s\S]*?)```/g, (_m, block) => {
    try {
      const parsed = JSON.parse(block.trim())
      const list = Array.isArray(parsed) ? parsed : [parsed]
      for (const p of list) {
        const dayIndex = Number(p?.dayIndex)
        const title = typeof p?.title === 'string' ? p.title.trim() : ''
        if (Number.isInteger(dayIndex) && dayIndex >= 0 && dayIndex <= 6 && title) {
          const servings = Math.min(24, Math.max(1, Number(p?.servings) || 4))
          proposals.push({
            dayIndex,
            title,
            servings,
            notes: typeof p?.notes === 'string' && p.notes.trim() ? p.notes.trim().slice(0, 500) : undefined,
          })
        }
      }
    } catch {
      // Malformed block — ignore it, keep the conversational text.
    }
    return ''
  }).trim()

  return { text, proposals }
}

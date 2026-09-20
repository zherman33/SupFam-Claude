import { supabase } from './supabase'

/**
 * Product telemetry for the embedded UX admin dashboard.
 *
 * Best-effort by design: every call is fire-and-forget and can never
 * throw or block the UI. If the product_events table (or its RLS
 * policies) isn't deployed yet, inserts fail silently and nothing breaks.
 */

export interface TelemetryIds {
  userId?: string | null
  familyId?: string | null
  memberId?: string | null
}

const SESSION_KEY = 'supfam_telemetry_session'

/** Stable per-tab session id so heartbeats and funnels can be grouped. */
export function telemetrySessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY)
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`
      sessionStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    return `sess-${Date.now()}`
  }
}

/**
 * Record a product event. Fire-and-forget — returns immediately and
 * swallows all errors.
 */
export function track(
  event: string,
  properties: Record<string, unknown> = {},
  ids: TelemetryIds = {},
): void {
  try {
    const row = {
      family_id: ids.familyId ?? null,
      user_id: ids.userId ?? null,
      member_id: ids.memberId ?? null,
      session_id: telemetrySessionId(),
      event,
      properties,
      occurred_at: new Date().toISOString(),
    }
    // Don't await: telemetry must never delay the app.
    void supabase
      .from('product_events')
      .insert(row as never)
      .then(({ error }) => {
        if (error && import.meta.env.DEV) {
          console.debug('[telemetry] insert failed:', error.message)
        }
      })
  } catch {
    /* never break the app for analytics */
  }
}

/** Small helper for measuring time-on-step in the onboarding flow. */
export function stopwatch(): () => number {
  const start = Date.now()
  return () => Date.now() - start
}

/**
 * Track an event attributed to a user, resolving their current
 * family_member row first so the event carries family_id/member_id.
 * Fire-and-forget — never throws.
 */
export async function trackForUser(
  event: string,
  properties: Record<string, unknown>,
  userId: string,
): Promise<void> {
  try {
    const { data } = await supabase
      .from('family_members')
      .select('id, family_id')
      .eq('user_id', userId)
      .maybeSingle()
    track(
      event,
      properties,
      {
        userId,
        memberId: (data as { id: string } | null)?.id ?? null,
        familyId: (data as { family_id: string } | null)?.family_id ?? null,
      },
    )
  } catch {
    track(event, properties, { userId })
  }
}

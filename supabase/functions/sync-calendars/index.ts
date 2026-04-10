import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const GOOGLE_CALENDAR_BASE = "https://www.googleapis.com/calendar/v3"

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    })
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // Parse optional body: { family_member_id?: string } to sync one member
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {}
    const targetMemberId: string | null = body.family_member_id ?? null

    // Get all google_tokens (or just one if targeted)
    const query = supabase.from("google_tokens").select(`
      id,
      family_member_id,
      access_token,
      refresh_token,
      token_expires_at,
      family_members!inner(id, display_name, avatar_color, family_id)
    `)
    if (targetMemberId) query.eq("family_member_id", targetMemberId)
    const { data: tokens, error: tokErr } = await query

    if (tokErr) throw tokErr
    if (!tokens || tokens.length === 0) {
      return jsonResp({ synced: 0, message: "No Google tokens found" })
    }

    const results = []

    for (const tok of tokens) {
      const member = Array.isArray(tok.family_members)
        ? tok.family_members[0]
        : tok.family_members as any

      let accessToken = tok.access_token

      // Refresh token if expired or expiring within 5 minutes
      if (tok.token_expires_at) {
        const expiresAt = new Date(tok.token_expires_at).getTime()
        if (expiresAt < Date.now() + 5 * 60 * 1000 && tok.refresh_token) {
          accessToken = await refreshAccessToken(
            tok.refresh_token,
            tok.family_member_id,
            supabase
          )
        }
      }

      // 1. Fetch calendar list
      const calListRes = await fetch(
        `${GOOGLE_CALENDAR_BASE}/users/me/calendarList?maxResults=50`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )

      if (!calListRes.ok) {
        results.push({ member: member.display_name, error: `calendarList ${calListRes.status}` })
        continue
      }

      const calList = await calListRes.json()
      const calendars: any[] = calList.items ?? []

      // Upsert each calendar into connected_calendars
      for (const cal of calendars) {
        await supabase.from("connected_calendars").upsert(
          {
            family_member_id: tok.family_member_id,
            provider: "google",
            calendar_id: cal.id,
            calendar_name: cal.summary,
            color: cal.backgroundColor ?? null,
            is_visible: cal.selected ?? true,
            google_account_email: cal.id === "primary" ? cal.summary : null,
          },
          { onConflict: "family_member_id,calendar_id" }
        )
      }

      // 2. Fetch events for visible calendars (next 5 weeks + 1 week back)
      const now = new Date()
      const timeMin = new Date(now)
      timeMin.setDate(now.getDate() - 7)
      const timeMax = new Date(now)
      timeMax.setDate(now.getDate() + 35)

      let eventsCount = 0

      for (const cal of calendars) {
        // Skip declined, hidden, or junk calendars
        if (cal.accessRole === "freeBusyReader") continue

        const eventsRes = await fetch(
          `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(cal.id)}/events?` +
            new URLSearchParams({
              timeMin: timeMin.toISOString(),
              timeMax: timeMax.toISOString(),
              singleEvents: "true",
              orderBy: "startTime",
              maxResults: "500",
            }),
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )

        if (!eventsRes.ok) continue

        const eventsData = await eventsRes.json()
        const events: any[] = eventsData.items ?? []

        // Upsert events into calendar_events
        const fetchedIds: string[] = []
        for (const ev of events) {
          if (ev.status === "cancelled") continue

          const startAt = ev.start?.dateTime ?? ev.start?.date
          const endAt = ev.end?.dateTime ?? ev.end?.date
          if (!startAt) continue

          const allDay = !ev.start?.dateTime

          await supabase.from("calendar_events").upsert(
            {
              family_id: member.family_id,
              source_calendar_id: cal.id,
              external_event_id: ev.id,
              title: ev.summary ?? "(No title)",
              description: ev.description ?? null,
              location: ev.location ?? null,
              start_at: allDay ? `${startAt}T00:00:00Z` : startAt,
              end_at: endAt
                ? allDay
                  ? `${endAt}T00:00:00Z`
                  : endAt
                : null,
              all_day: allDay,
              color: cal.backgroundColor ?? null,
              created_by: tok.family_member_id,
            },
            { onConflict: "family_id,external_event_id" }
          )

          fetchedIds.push(ev.id)
          eventsCount++
        }

        // Delete events that were removed from Google Calendar.
        // Query the DB for all events for this calendar in the sync window,
        // then delete any whose external_event_id is no longer in Google's response.
        const { data: dbEvents } = await supabase
          .from("calendar_events")
          .select("id, external_event_id")
          .eq("family_id", member.family_id)
          .eq("source_calendar_id", cal.id)
          .gte("start_at", timeMin.toISOString())
          .lte("start_at", timeMax.toISOString())
          .not("external_event_id", "is", null)

        const toDelete = (dbEvents ?? [])
          .filter((e: any) => e.external_event_id && !fetchedIds.includes(e.external_event_id))
          .map((e: any) => e.id)

        if (toDelete.length > 0) {
          await supabase.from("calendar_events").delete().in("id", toDelete)
        }
      }

      // Update last_synced_at
      await supabase
        .from("connected_calendars")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("family_member_id", tok.family_member_id)

      results.push({
        member: member.display_name,
        calendars: calendars.length,
        events: eventsCount,
      })
    }

    return jsonResp({ synced: results.length, results })
  } catch (err) {
    console.error(err)
    return jsonResp({ error: String(err) }, 500)
  }
})

async function refreshAccessToken(
  refreshToken: string,
  familyMemberId: string,
  supabase: any
): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  })

  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`)

  const data = await res.json()
  const newToken = data.access_token
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString()

  await supabase
    .from("google_tokens")
    .update({ access_token: newToken, token_expires_at: expiresAt })
    .eq("family_member_id", familyMemberId)

  return newToken
}

function jsonResp(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  })
}

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const GCAL = "https://www.googleapis.com/calendar/v3/calendars"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } })
  }

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
    const body = await req.json()
    const { action, family_member_id, calendar_id, event } = body

    if (!action || !family_member_id || !calendar_id) {
      return jsonResp({ error: "Missing: action, family_member_id, calendar_id" }, 400)
    }

    // Get all family tokens (needed for auto-accept)
    const { data: allTokens } = await supabase
      .from("google_tokens")
      .select("family_member_id, access_token, refresh_token, token_expires_at, family_members!inner(family_id)")

    const tokMap = new Map<string, { access: string; refresh: string | null; expires: string | null }>()
    for (const t of allTokens ?? []) {
      tokMap.set(t.family_member_id, { access: t.access_token, refresh: t.refresh_token, expires: t.token_expires_at })
    }

    // Get + refresh token for the acting member
    const actingTok = tokMap.get(family_member_id)
    if (!actingTok) return jsonResp({ error: "No token for member" }, 403)
    const accessToken = await freshToken(actingTok, family_member_id, supabase)

    const calEncoded = encodeURIComponent(calendar_id)
    const authHeaders = (tok: string) => ({ Authorization: `Bearer ${tok}`, "Content-Type": "application/json" })

    // ── DELETE ────────────────────────────────────────────────────────────
    if (action === "delete") {
      if (!event?.id) return jsonResp({ error: "event.id required" }, 400)
      const res = await fetch(`${GCAL}/${calEncoded}/events/${event.id}`, { method: "DELETE", headers: authHeaders(accessToken) })
      if (!res.ok && res.status !== 404) return jsonResp({ error: `Google ${res.status}: ${await res.text()}` }, 502)
      await supabase.from("calendar_events").delete().eq("external_event_id", event.id)
      return jsonResp({ success: true })
    }

    // ── Build Google event body ──────────────────────────────────────────
    const gEvent: any = {
      summary: event.title,
      description: event.description ?? undefined,
      location: event.location ?? undefined,
    }
    if (event.all_day) {
      gEvent.start = {
        date: event.start.slice(0, 10),
        ...(action === "update" ? { dateTime: null } : {})
      }
      gEvent.end = {
        date: event.end ? event.end.slice(0, 10) : event.start.slice(0, 10),
        ...(action === "update" ? { dateTime: null } : {})
      }
    } else {
      gEvent.start = {
        dateTime: event.start,
        timeZone: event.timezone ?? "America/New_York",
        ...(action === "update" ? { date: null } : {})
      }
      gEvent.end = {
        dateTime: event.end,
        timeZone: event.timezone ?? "America/New_York",
        ...(action === "update" ? { date: null } : {})
      }
    }
    if (event.attendee_emails?.length) {
      gEvent.attendees = event.attendee_emails.map((email: string) => ({ email }))
    }

    // ── CREATE ────────────────────────────────────────────────────────────
    if (action === "create") {
      const res = await fetch(`${GCAL}/${calEncoded}/events?sendUpdates=none`, {
        method: "POST", headers: authHeaders(accessToken), body: JSON.stringify(gEvent)
      })
      if (!res.ok) return jsonResp({ error: `Google ${res.status}: ${await res.text()}` }, 502)
      const created = await res.json()

      // Auto-accept for all family members who were invited and have tokens
      // We patch each attendee's copy of the event to mark them as accepted
      if (event.attendee_emails?.length) {
        // Build map: email -> family_member_id
        const emailToMember = await getEmailToMemberMap(supabase)

        for (const email of event.attendee_emails) {
          const invitedMemberId = emailToMember.get(email.toLowerCase())
          if (!invitedMemberId || invitedMemberId === family_member_id) continue

          const inviteeTok = tokMap.get(invitedMemberId)
          if (!inviteeTok) continue

          const inviteeToken = await freshToken(inviteeTok, invitedMemberId, supabase)

          // The event appears on the invitee's primary calendar — accept it there
          // We need to find it first by listing events with the same iCalUID or just patch by ID
          // Google propagates the event to invitee's calendar with the same event ID
          const acceptRes = await fetch(
            `${GCAL}/${encodeURIComponent(email)}/events/${created.id}`,
            {
              method: "PATCH",
              headers: authHeaders(inviteeToken),
              body: JSON.stringify({
                attendees: created.attendees?.map((a: any) =>
                  a.email.toLowerCase() === email.toLowerCase()
                    ? { ...a, responseStatus: "accepted" }
                    : a
                ) ?? [],
              }),
            }
          )
          // Log but don't fail if auto-accept doesn't work
          if (!acceptRes.ok) {
            console.log(`Auto-accept for ${email} failed: ${acceptRes.status} ${await acceptRes.text()}`)
          }
        }
      }

      // Sync to our DB
      const { data: member } = await supabase.from("family_members").select("family_id").eq("id", family_member_id).single()
      if (member) {
        const startAtRaw = created.start?.dateTime ?? created.start?.date ?? event.start
        const endAtRaw = created.end?.dateTime ?? created.end?.date ?? event.end
        const allDay = created.start?.dateTime ? false : (created.start?.date ? true : event.all_day)
        const start_at = allDay ? `${startAtRaw.slice(0, 10)}T00:00:00+00:00` : startAtRaw
        const end_at = endAtRaw ? (allDay ? `${endAtRaw.slice(0, 10)}T00:00:00+00:00` : endAtRaw) : null

        await supabase.from("calendar_events").upsert({
          family_id: member.family_id,
          source_calendar_id: calendar_id,
          external_event_id: created.id,
          title: event.title,
          description: event.description ?? null,
          location: event.location ?? null,
          start_at,
          end_at,
          all_day: allDay,
          color: null,
          created_by: family_member_id,
        }, { onConflict: "family_id,external_event_id" })
      }
      return jsonResp({ success: true, event_id: created.id })
    }

    // ── UPDATE ────────────────────────────────────────────────────────────
    if (action === "update") {
      if (!event?.id) return jsonResp({ error: "event.id required" }, 400)
      const res = await fetch(`${GCAL}/${calEncoded}/events/${event.id}?sendUpdates=none`, {
        method: "PATCH", headers: authHeaders(accessToken), body: JSON.stringify(gEvent)
      })
      if (!res.ok) return jsonResp({ error: `Google ${res.status}: ${await res.text()}` }, 502)
      const updated = await res.json()

      const startAtRaw = updated.start?.dateTime ?? updated.start?.date ?? event.start
      const endAtRaw = updated.end?.dateTime ?? updated.end?.date ?? event.end
      const allDay = updated.start?.dateTime ? false : (updated.start?.date ? true : event.all_day)
      const start_at = allDay ? `${startAtRaw.slice(0, 10)}T00:00:00+00:00` : startAtRaw
      const end_at = endAtRaw ? (allDay ? `${endAtRaw.slice(0, 10)}T00:00:00+00:00` : endAtRaw) : null

      await supabase.from("calendar_events").update({
        title: event.title,
        description: event.description ?? null,
        location: event.location ?? null,
        start_at,
        end_at,
        all_day: allDay,
      }).eq("external_event_id", event.id)

      return jsonResp({ success: true })
    }

    return jsonResp({ error: "Unknown action" }, 400)
  } catch (err) {
    console.error(err)
    return jsonResp({ error: String(err) }, 500)
  }
})

// Get map of Google account email -> family_member_id from connected_calendars
async function getEmailToMemberMap(supabase: any): Promise<Map<string, string>> {
  const { data } = await supabase
    .from("connected_calendars")
    .select("family_member_id, calendar_id")
    .eq("provider", "google")
  const map = new Map<string, string>()
  for (const row of data ?? []) {
    // Google personal calendar IDs are the user's email address
    if (row.calendar_id.includes("@")) {
      map.set(row.calendar_id.toLowerCase(), row.family_member_id)
    }
  }
  return map
}

async function freshToken(
  tok: { access: string; refresh: string | null; expires: string | null },
  memberId: string,
  supabase: any
): Promise<string> {
  if (tok.expires && new Date(tok.expires).getTime() < Date.now() + 60 * 1000 && tok.refresh) {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
        client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
        refresh_token: tok.refresh,
        grant_type: "refresh_token",
      }),
    })
    if (r.ok) {
      const d = await r.json()
      await supabase.from("google_tokens")
        .update({ access_token: d.access_token, token_expires_at: new Date(Date.now() + d.expires_in * 1000).toISOString() })
        .eq("family_member_id", memberId)
      return d.access_token
    }
  }
  return tok.access
}

function jsonResp(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  })
}

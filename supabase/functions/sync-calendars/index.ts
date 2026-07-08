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

    const results: any[] = []

    // ─── 1. GOOGLE CALENDAR SYNC ───
    const googleQuery = supabase.from("google_tokens").select(`
      id,
      family_member_id,
      access_token,
      refresh_token,
      token_expires_at,
      family_members!inner(id, display_name, avatar_color, family_id)
    `)
    if (targetMemberId) googleQuery.eq("family_member_id", targetMemberId)
    const { data: googleTokens, error: tokErr } = await googleQuery

    if (tokErr) console.error("Error fetching Google tokens:", tokErr)

    if (googleTokens && googleTokens.length > 0) {
      for (const tok of googleTokens) {
        const member = Array.isArray(tok.family_members)
          ? tok.family_members[0]
          : tok.family_members as any

        let accessToken = tok.access_token

        // Refresh token if expired or expiring within 5 minutes
        if (tok.token_expires_at) {
          const expiresAt = new Date(tok.token_expires_at).getTime()
          if (expiresAt < Date.now() + 5 * 60 * 1000 && tok.refresh_token) {
            try {
              accessToken = await refreshAccessToken(
                tok.refresh_token,
                tok.family_member_id,
                supabase
              )
            } catch (refErr: any) {
              console.error(`Token refresh failed for ${member.display_name}:`, refErr)
              results.push({ member: member.display_name, error: refErr.message || String(refErr) })
              continue
            }
          }
        }

        // Fetch calendar list
        let calListRes = await fetch(
          `${GOOGLE_CALENDAR_BASE}/users/me/calendarList?maxResults=50`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )

        // If 401 Unauthorized, try refreshing the token once and retry
        if (calListRes.status === 401 && tok.refresh_token) {
          try {
            accessToken = await refreshAccessToken(
              tok.refresh_token,
              tok.family_member_id,
              supabase
            )
            calListRes = await fetch(
              `${GOOGLE_CALENDAR_BASE}/users/me/calendarList?maxResults=50`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            )
          } catch (refErr: any) {
            console.error(`Token refresh failed after 401 for ${member.display_name}:`, refErr)
            results.push({ member: member.display_name, error: refErr.message || String(refErr) })
            continue
          }
        }

        if (!calListRes.ok) {
          results.push({ member: member.display_name, error: `Google calendarList API returned ${calListRes.status}` })
          continue
        }

        const calList = await calListRes.json()
        const calendars: any[] = calList.items ?? []

        // Fetch existing connected calendars to preserve user customizations (color and visibility)
        const { data: existingCals } = await supabase
          .from("connected_calendars")
          .select("calendar_id, color, is_visible")
          .eq("family_member_id", tok.family_member_id)

        const existingMap = new Map<string, { color: string | null; is_visible: boolean }>(
          (existingCals ?? []).map((c: any) => [c.calendar_id, c])
        )

        // Upsert each calendar into connected_calendars
        for (const cal of calendars) {
          const existing = existingMap.get(cal.id)
          const colorToUse = existing?.color ?? cal.backgroundColor ?? null
          const isVisibleToUse = existing !== undefined ? existing.is_visible : (cal.selected ?? true)
          const calendarName = cal.summaryOverride || cal.summary || "(No title)"

          await supabase.from("connected_calendars").upsert(
            {
              family_member_id: tok.family_member_id,
              provider: "google",
              calendar_id: cal.id,
              calendar_name: calendarName,
              color: colorToUse,
              is_visible: isVisibleToUse,
              google_account_email: cal.primary ? cal.id : (cal.id === "primary" ? calendarName : null),
            },
            { onConflict: "family_member_id,calendar_id" }
          )
        }

        // Fetch events for visible calendars (-4 weeks to +12 weeks to match dashboard window)
        const now = new Date()
        const timeMin = new Date(now)
        timeMin.setDate(now.getDate() - 28)
        const timeMax = new Date(now)
        timeMax.setDate(now.getDate() + 84)

        let eventsCount = 0

        for (const cal of calendars) {
          if (cal.accessRole === "freeBusyReader") continue

          const existing = existingMap.get(cal.id)
          const colorToUse = existing?.color ?? cal.backgroundColor ?? null

          let eventsRes = await fetch(
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

          if (eventsRes.status === 401 && tok.refresh_token) {
            try {
              accessToken = await refreshAccessToken(
                tok.refresh_token,
                tok.family_member_id,
                supabase
              )
              eventsRes = await fetch(
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
            } catch (refErr: any) {
              console.error(`Token refresh failed on events fetch for ${member.display_name}:`, refErr)
              continue
            }
          }

          if (!eventsRes.ok) continue

          const eventsData = await eventsRes.json()
          const events: any[] = eventsData.items ?? []

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
                color: colorToUse,
                created_by: tok.family_member_id,
              },
              { onConflict: "family_id,external_event_id" }
            )

            fetchedIds.push(ev.id)
            eventsCount++
          }

          // Clean up deleted events
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

        // Update last_synced_at for the owner's calendars
        await supabase
          .from("connected_calendars")
          .update({ last_synced_at: new Date().toISOString() })
          .eq("family_member_id", tok.family_member_id)
          .eq("provider", "google")

        results.push({
          member: member.display_name,
          provider: "google",
          calendars: calendars.length,
          events: eventsCount,
        })
      }
    }

    // ─── 2. ICS / ICAL SUBSCRIPTION SYNC ───
    const icsQuery = supabase.from("connected_calendars").select(`
      id,
      calendar_id,
      calendar_name,
      color,
      ics_url,
      provider,
      family_member_id,
      family_members!inner(id, display_name, family_id)
    `).not("ics_url", "is", null)

    if (targetMemberId) icsQuery.eq("family_member_id", targetMemberId)
    const { data: icsCalendars, error: icsErr } = await icsQuery

    if (icsErr) console.error("Error fetching ICS calendars:", icsErr)

    if (icsCalendars && icsCalendars.length > 0) {
      const now = new Date()
      const timeMin = new Date(now)
      timeMin.setDate(now.getDate() - 28)
      const timeMax = new Date(now)
      timeMax.setDate(now.getDate() + 84)

      for (const cal of icsCalendars) {
        const member = Array.isArray(cal.family_members)
          ? cal.family_members[0]
          : cal.family_members as any

        if (!member) continue

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 8000)

        try {
          if (!cal.ics_url) continue

          // Ensure https protocol and add cache-busting parameter/headers so CDNs/proxies don't return stale ICS feeds
          let targetUrl = cal.ics_url.replace(/^(webcal|ical)s?:/i, "https:")
          try {
            const urlObj = new URL(targetUrl)
            urlObj.searchParams.set("_cb", Date.now().toString())
            targetUrl = urlObj.toString()
          } catch {
            // Fallback if URL parsing fails
          }

          const icsRes = await fetch(targetUrl, {
            headers: {
              "Cache-Control": "no-cache, no-store, must-revalidate",
              "Pragma": "no-cache",
              "Expires": "0",
            },
            signal: controller.signal,
          })
          clearTimeout(timeoutId)

          if (!icsRes.ok) throw new Error(`HTTP ${icsRes.status}`)
          const icsText = await icsRes.text()

          const rawEvents = parseIcs(icsText)
          const fetchedIds: string[] = []

          for (const ev of rawEvents) {
            const title = unescapeIcsText(ev.SUMMARY) || "(No title)"
            const description = unescapeIcsText(ev.DESCRIPTION) || null
            const location = unescapeIcsText(ev.LOCATION) || null

            const isAllDay = ev.DTSTART_ALLDAY === "true" || ev.DTEND_ALLDAY === "true"
            const startInfo = parseIcsDate(ev.DTSTART)
            const endInfo = parseIcsDate(ev.DTEND)

            if (!startInfo) continue

            const startAt = startInfo.iso
            const endAt = endInfo ? endInfo.iso : startAt
            const allDay = startInfo.allDay || isAllDay

            // Check for recurring rule (RRULE) or single event within active window
            const occurrences = ev.RRULE
              ? expandIcsRRule(startAt, endAt, ev.RRULE, timeMin, timeMax)
              : []

            if (occurrences.length === 0) {
              const eventStartDate = new Date(startAt)
              if (eventStartDate >= timeMin && eventStartDate <= timeMax) {
                occurrences.push({ startAt, endAt, instanceIdSuffix: "" })
              }
            }

            for (const occ of occurrences) {
              const baseId = ev.UID ? ev.UID.trim() : `ics_gen_${btoa(startAt + title).slice(0, 32)}`
              const externalId = baseId + occ.instanceIdSuffix

              await supabase.from("calendar_events").upsert(
                {
                  family_id: member.family_id,
                  source_calendar_id: cal.calendar_id,
                  external_event_id: externalId,
                  title,
                  description,
                  location,
                  start_at: occ.startAt,
                  end_at: occ.endAt,
                  all_day: allDay,
                  color: cal.color ?? "#C4714F",
                  created_by: cal.family_member_id,
                },
                { onConflict: "family_id,external_event_id" }
              )

              fetchedIds.push(externalId)
            }
          }

          // Clean up events in this calendar that are no longer in the ICS feed
          const { data: dbEvents } = await supabase
            .from("calendar_events")
            .select("id, external_event_id")
            .eq("family_id", member.family_id)
            .eq("source_calendar_id", cal.calendar_id)
            .gte("start_at", timeMin.toISOString())
            .lte("start_at", timeMax.toISOString())
            .not("external_event_id", "is", null)

          const toDelete = (dbEvents ?? [])
            .filter((e: any) => e.external_event_id && !fetchedIds.includes(e.external_event_id))
            .map((e: any) => e.id)

          if (toDelete.length > 0) {
            await supabase.from("calendar_events").delete().in("id", toDelete)
          }

          // Update last_synced_at
          await supabase
            .from("connected_calendars")
            .update({ last_synced_at: new Date().toISOString() })
            .eq("id", cal.id)

          results.push({
            member: member.display_name,
            calendar: cal.calendar_name,
            provider: cal.provider,
            events: fetchedIds.length,
          })
        } catch (err) {
          clearTimeout(timeoutId)
          console.error(`Error syncing ICS calendar "${cal.calendar_name}":`, err)
          results.push({
            member: member.display_name,
            calendar: cal.calendar_name,
            provider: cal.provider,
            error: String(err),
          })
        }
      }
    }

    return jsonResp({ synced: results.length, results })
  } catch (err) {
    console.error(err)
    return jsonResp({ error: String(err) }, 500)
  }
})

// ─── ICS PARSING HELPERS ───

function parseIcs(icsText: string): any[] {
  const lines = icsText.replace(/\r\n/g, "\n").split("\n")
  const unfolded: string[] = []
  
  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += line.slice(1)
    } else {
      unfolded.push(line)
    }
  }

  const events: any[] = []
  let currentEvent: any = null

  for (const line of unfolded) {
    const trimmed = line.trim()
    if (trimmed === "BEGIN:VEVENT") {
      currentEvent = {}
    } else if (trimmed === "END:VEVENT" && currentEvent) {
      events.push(currentEvent)
      currentEvent = null
    } else if (currentEvent) {
      const colonIdx = line.indexOf(":")
      if (colonIdx !== -1) {
        let key = line.slice(0, colonIdx)
        const value = line.slice(colonIdx + 1)
        const semiIdx = key.indexOf(";")
        let params = ""
        if (semiIdx !== -1) {
          params = key.slice(semiIdx + 1)
          key = key.slice(0, semiIdx)
        }
        currentEvent[key] = value
        if (params.includes("VALUE=DATE")) {
          currentEvent[`${key}_ALLDAY`] = "true"
        }
      }
    }
  }
  return events
}

function expandIcsRRule(
  startIso: string,
  endIso: string,
  rruleStr: string,
  timeMin: Date,
  timeMax: Date
): Array<{ startAt: string; endAt: string; instanceIdSuffix: string }> {
  const instances: Array<{ startAt: string; endAt: string; instanceIdSuffix: string }> = []
  const startDate = new Date(startIso)
  const endDate = new Date(endIso)
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return instances

  const durationMs = endDate.getTime() - startDate.getTime()

  const parts: Record<string, string> = {}
  for (const part of rruleStr.split(";")) {
    const [k, v] = part.split("=")
    if (k && v) parts[k.trim().toUpperCase()] = v.trim().toUpperCase()
  }

  const freq = parts["FREQ"]
  if (!freq) return instances

  const interval = parts["INTERVAL"] ? parseInt(parts["INTERVAL"], 10) || 1 : 1
  const count = parts["COUNT"] ? parseInt(parts["COUNT"], 10) : Infinity
  const until = parts["UNTIL"] ? (parseIcsDate(parts["UNTIL"]) ? new Date(parseIcsDate(parts["UNTIL"])!.iso) : null) : null
  const bydayStr = parts["BYDAY"]
  const bydayList = bydayStr ? bydayStr.split(",") : null
  const dayMap: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 }

  let current = new Date(startDate)
  let occurrencesFound = 0
  const maxIterations = 3650

  for (let i = 0; i < maxIterations; i++) {
    if (occurrencesFound >= count) break
    if (until && current > until) break
    if (current > timeMax) break

    let include = false
    if (freq === "DAILY") {
      if (i % interval === 0) include = true
    } else if (freq === "WEEKLY") {
      const daysDiff = Math.floor((current.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      const weeksDiff = Math.floor(daysDiff / 7)
      if (weeksDiff % interval === 0) {
        if (bydayList) {
          const dow = current.getUTCDay()
          if (bydayList.some((d) => dayMap[d.replace(/^[+-]?\d+/, "")] === dow)) {
            include = true
          }
        } else {
          if (current.getUTCDay() === startDate.getUTCDay()) include = true
        }
      }
    } else if (freq === "MONTHLY") {
      const monthsDiff = (current.getUTCFullYear() - startDate.getUTCFullYear()) * 12 + (current.getUTCMonth() - startDate.getUTCMonth())
      if (monthsDiff % interval === 0 && current.getUTCDate() === startDate.getUTCDate()) {
        include = true
      }
    } else if (freq === "YEARLY") {
      const yearsDiff = current.getUTCFullYear() - startDate.getUTCFullYear()
      if (yearsDiff % interval === 0 && current.getUTCMonth() === startDate.getUTCMonth() && current.getUTCDate() === startDate.getUTCDate()) {
        include = true
      }
    }

    if (include) {
      occurrencesFound++
      if (current >= timeMin && current <= timeMax) {
        const instStart = new Date(current)
        const instEnd = new Date(current.getTime() + durationMs)
        instances.push({
          startAt: instStart.toISOString(),
          endAt: instEnd.toISOString(),
          instanceIdSuffix: `_${instStart.toISOString().slice(0, 10)}`,
        })
      }
    }

    current.setUTCDate(current.getUTCDate() + 1)
  }

  return instances
}

function parseIcsDate(str: string | undefined): { iso: string; allDay: boolean } | null {
  if (!str) return null
  const clean = str.trim()
  
  // 8 digits: YYYYMMDD
  if (/^\d{8}$/.test(clean)) {
    const y = clean.slice(0, 4)
    const m = clean.slice(4, 6)
    const d = clean.slice(6, 8)
    return { iso: `${y}-${m}-${d}T00:00:00Z`, allDay: true }
  }

  // YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?/.exec(clean)
  if (match) {
    const [_, y, m, d, hr, mn, sc, z] = match
    return { iso: `${y}-${m}-${d}T${hr}:${mn}:${sc}Z`, allDay: false }
  }

  const parsed = new Date(clean)
  if (!isNaN(parsed.getTime())) {
    return { iso: parsed.toISOString(), allDay: false }
  }
  return null
}

function unescapeIcsText(str: string | undefined): string {
  if (!str) return ""
  return str
    .replace(/\\n/gi, "\n")
    .replace(/\\r/gi, "\r")
    .replace(/\\([,;\\])/g, "$1")
    .trim()
}

// ─── GOOGLE TOKEN HELPERS ───

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

  if (!res.ok) {
    const errText = await res.text().catch(() => "unknown error")
    throw new Error(`Token refresh failed (${res.status}): ${errText}`)
  }

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

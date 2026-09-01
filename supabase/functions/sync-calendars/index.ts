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

    // Parse optional body: { family_member_id?: string, family_id?: string, timeMin?: string, timeMax?: string } to sync one member/family/range
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {}
    const targetMemberId: string | null = body.family_member_id ?? null
    const targetFamilyId: string | null = body.family_id ?? null
    const customTimeMin: string | null = body.timeMin ?? null
    const customTimeMax: string | null = body.timeMax ?? null

    const results: any[] = []

    // ─── 1. GOOGLE CALENDAR SYNC ───
    let googleQuery = supabase.from("google_tokens").select(`
      id,
      family_member_id,
      access_token,
      refresh_token,
      token_expires_at,
      family_members!inner(id, display_name, avatar_color, family_id)
    `)
    if (targetMemberId) googleQuery = googleQuery.eq("family_member_id", targetMemberId)
    if (targetFamilyId) googleQuery = googleQuery.eq("family_members.family_id", targetFamilyId)
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

        // Fetch events for visible calendars (-4 weeks to +22 weeks to match dashboard window, or custom range if provided)
        const now = new Date()
        const timeMin = customTimeMin ? new Date(customTimeMin) : new Date(now)
        if (!customTimeMin) {
          timeMin.setDate(now.getDate() - 28)
        }
        const timeMax = customTimeMax ? new Date(customTimeMax) : new Date(now)
        if (!customTimeMax) {
          timeMax.setDate(now.getDate() + 154)
        }

        let eventsCount = 0

        for (const cal of calendars) {
          if (cal.accessRole === "freeBusyReader") continue

          const existing = existingMap.get(cal.id)
          const colorToUse = existing?.color ?? cal.backgroundColor ?? null

          let pageToken: string | undefined = undefined
          const events: any[] = []

          do {
            const queryParams = new URLSearchParams({
              timeMin: timeMin.toISOString(),
              timeMax: timeMax.toISOString(),
              singleEvents: "true",
              orderBy: "startTime",
              maxResults: "2500", // Max allowed by Google
            })
            if (pageToken) {
              queryParams.set("pageToken", pageToken)
            }

            const eventsRes = await fetch(
              `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(cal.id)}/events?` + queryParams,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            )

            if (!eventsRes.ok) break

            const eventsData = await eventsRes.json()
            if (eventsData.items) {
              events.push(...eventsData.items)
            }
            pageToken = eventsData.nextPageToken
          } while (pageToken)

          // Pre-fetch existing DB events for this calendar inside the sync window
          const { data: existingEvents } = await supabase
            .from("calendar_events")
            .select("id, external_event_id, title, description, location, start_at, end_at, all_day, color")
            .eq("family_id", member.family_id)
            .eq("source_calendar_id", cal.id)
            .gte("start_at", timeMin.toISOString())
            .lte("start_at", timeMax.toISOString())
            .not("external_event_id", "is", null)

          const existingEventMap = new Map(
            (existingEvents ?? []).map((e: any) => [e.external_event_id, e])
          )

          const fetchedIds: string[] = []
          const toUpsert: any[] = []

          for (const ev of events) {
            if (ev.status === "cancelled") continue

            const startAtRaw = ev.start?.dateTime ?? ev.start?.date
            const endAtRaw = ev.end?.dateTime ?? ev.end?.date
            if (!startAtRaw) continue

            const allDay = !ev.start?.dateTime
            const start_at = allDay ? `${startAtRaw}T00:00:00Z` : startAtRaw
            const end_at = endAtRaw
              ? allDay
                ? `${endAtRaw}T00:00:00Z`
                : endAtRaw
              : null
            const title = ev.summary ?? "(No title)"
            const description = ev.description ?? null
            const location = ev.location ?? null

            fetchedIds.push(ev.id)
            eventsCount++

            // Memory diff: check if existing record matches exact values
            const existing = existingEventMap.get(ev.id)
            if (
              existing &&
              existing.title === title &&
              (existing.description ?? null) === description &&
              (existing.location ?? null) === location &&
              existing.start_at === start_at &&
              (existing.end_at ?? null) === end_at &&
              existing.all_day === allDay &&
              (existing.color ?? null) === (colorToUse ?? null)
            ) {
              continue
            }

            toUpsert.push({
              family_id: member.family_id,
              source_calendar_id: cal.id,
              external_event_id: ev.id,
              title,
              description,
              location,
              start_at,
              end_at,
              all_day: allDay,
              color: colorToUse,
              created_by: tok.family_member_id,
            })
          }

          // Batch upsert in chunks of 200 ONLY for changed/new events
          for (let i = 0; i < toUpsert.length; i += 200) {
            await supabase
              .from("calendar_events")
              .upsert(toUpsert.slice(i, i + 200), { onConflict: "family_id,external_event_id" })
          }

          // Clean up deleted events
          const toDelete = (existingEvents ?? [])
            .filter((e: any) => e.external_event_id && !fetchedIds.includes(e.external_event_id))
            .map((e: any) => e.id)

          if (toDelete.length > 0) {
            for (let i = 0; i < toDelete.length; i += 200) {
              await supabase.from("calendar_events").delete().in("id", toDelete.slice(i, i + 200))
            }
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
    let icsQuery = supabase.from("connected_calendars").select(`
      id,
      calendar_id,
      calendar_name,
      color,
      ics_url,
      provider,
      family_member_id,
      family_members!inner(id, display_name, family_id)
    `).not("ics_url", "is", null)

    if (targetMemberId) icsQuery = icsQuery.eq("family_member_id", targetMemberId)
    if (targetFamilyId) icsQuery = icsQuery.eq("family_members.family_id", targetFamilyId)
    const { data: icsCalendars, error: icsErr } = await icsQuery

    if (icsErr) console.error("Error fetching ICS calendars:", icsErr)

    if (icsCalendars && icsCalendars.length > 0) {
      const now = new Date()
      const timeMin = customTimeMin ? new Date(customTimeMin) : new Date(now)
      if (!customTimeMin) {
        timeMin.setDate(now.getDate() - 28)
      }
      const timeMax = customTimeMax ? new Date(customTimeMax) : new Date(now)
      if (!customTimeMax) {
        timeMax.setDate(now.getDate() + 154)
      }

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
          const toUpsert: any[] = []

          // Pre-fetch existing DB events for this calendar inside the sync window
          const { data: existingEvents } = await supabase
            .from("calendar_events")
            .select("id, external_event_id, title, description, location, start_at, end_at, all_day, color")
            .eq("family_id", member.family_id)
            .eq("source_calendar_id", cal.calendar_id)
            .gte("start_at", timeMin.toISOString())
            .lte("start_at", timeMax.toISOString())
            .not("external_event_id", "is", null)

          const existingEventMap = new Map(
            (existingEvents ?? []).map((e: any) => [e.external_event_id, e])
          )

          // Group VEVENTs by UID to associate recurring master events with their exceptions
          const eventsByUid = new Map<string, any[]>()
          for (const ev of rawEvents) {
            let uid = ev.UID?.trim()
            if (!uid) {
              const title = unescapeIcsText(ev.SUMMARY) || "(No title)"
              const startInfo = parseIcsDate(ev.DTSTART, ev.DTSTART_TZID)
              const startAt = startInfo ? startInfo.iso : ""
              uid = `ics_gen_${btoa(startAt + title).slice(0, 32)}`
            }
            if (!eventsByUid.has(uid)) {
              eventsByUid.set(uid, [])
            }
            eventsByUid.get(uid)!.push(ev)
          }

          for (const [uid, group] of eventsByUid.entries()) {
            const masterEvent = group.find((ev) => ev.RRULE || !ev["RECURRENCE-ID"]) || group[0]
            const exceptions = group.filter((ev) => ev !== masterEvent && ev["RECURRENCE-ID"])

            const masterStatus = masterEvent.STATUS?.trim().toUpperCase()
            const isMasterCancelled = masterStatus === "CANCELLED" || masterStatus === "CANCELED"

            // Gather exclusion dates from master's EXDATE and exceptions' RECURRENCE-ID
            const exDates = parseExDates(masterEvent.EXDATE)
            for (const exc of exceptions) {
              const recIdInfo = parseIcsDate(exc["RECURRENCE-ID"], exc["RECURRENCE-ID_TZID"])
              if (recIdInfo) {
                exDates.add(recIdInfo.iso.slice(0, 10))
              }
            }

            // Process master event (recurring expansion or single event)
            if (!isMasterCancelled) {
              const startInfo = parseIcsDate(masterEvent.DTSTART, masterEvent.DTSTART_TZID)
              const endInfo = parseIcsDate(masterEvent.DTEND, masterEvent.DTEND_TZID)

              if (startInfo) {
                const startAt = startInfo.iso
                const endAt = endInfo ? endInfo.iso : startAt
                const isAllDay = masterEvent.DTSTART_ALLDAY === "true" || masterEvent.DTEND_ALLDAY === "true"
                const allDay = startInfo.allDay || isAllDay

                const occurrences = masterEvent.RRULE
                  ? expandIcsRRule(startAt, endAt, masterEvent.RRULE, timeMin, timeMax, exDates)
                  : []

                if (!masterEvent.RRULE) {
                  const eventStartDate = new Date(startAt)
                  if (eventStartDate >= timeMin && eventStartDate <= timeMax) {
                    const dateStr = startAt.slice(0, 10)
                    if (!exDates.has(dateStr)) {
                      occurrences.push({ startAt, endAt, instanceIdSuffix: "" })
                    }
                  }
                }

                for (const occ of occurrences) {
                  const title = unescapeIcsText(masterEvent.SUMMARY) || "(No title)"
                  const description = unescapeIcsText(masterEvent.DESCRIPTION) || null
                  const location = unescapeIcsText(masterEvent.LOCATION) || null
                  const externalId = uid + occ.instanceIdSuffix
                  const colorToUse = cal.color ?? "#C4714F"

                  fetchedIds.push(externalId)

                  const existing = existingEventMap.get(externalId)
                  if (
                    existing &&
                    existing.title === title &&
                    (existing.description ?? null) === description &&
                    (existing.location ?? null) === location &&
                    existing.start_at === occ.startAt &&
                    (existing.end_at ?? null) === occ.endAt &&
                    existing.all_day === allDay &&
                    (existing.color ?? null) === colorToUse
                  ) {
                    continue
                  }

                  toUpsert.push({
                    family_id: member.family_id,
                    source_calendar_id: cal.calendar_id,
                    external_event_id: externalId,
                    title,
                    description,
                    location,
                    start_at: occ.startAt,
                    end_at: occ.endAt,
                    all_day: allDay,
                    color: colorToUse,
                    created_by: cal.family_member_id,
                  })
                }
              }
            }

            // Process exceptions (modified instances)
            for (const exc of exceptions) {
              const excStatus = exc.STATUS?.trim().toUpperCase()
              const isExcCancelled = excStatus === "CANCELLED" || excStatus === "CANCELED"
              if (isExcCancelled) continue

              const startInfo = parseIcsDate(exc.DTSTART, exc.DTSTART_TZID)
              const endInfo = parseIcsDate(exc.DTEND, exc.DTEND_TZID)
              if (!startInfo) continue

              const startAt = startInfo.iso
              const endAt = endInfo ? endInfo.iso : startAt
              const isAllDay = exc.DTSTART_ALLDAY === "true" || exc.DTEND_ALLDAY === "true"
              const allDay = startInfo.allDay || isAllDay

              const title = unescapeIcsText(exc.SUMMARY) || unescapeIcsText(masterEvent.SUMMARY) || "(No title)"
              const description = unescapeIcsText(exc.DESCRIPTION) || unescapeIcsText(masterEvent.DESCRIPTION) || null
              const location = unescapeIcsText(exc.LOCATION) || unescapeIcsText(masterEvent.LOCATION) || null

              const recIdInfo = parseIcsDate(exc["RECURRENCE-ID"], exc["RECURRENCE-ID_TZID"])
              if (!recIdInfo) continue
              const excDateStr = recIdInfo.iso.slice(0, 10)
              const externalId = `${uid}_${excDateStr}`
              const colorToUse = cal.color ?? "#C4714F"

              const eventStartDate = new Date(startAt)
              if (eventStartDate >= timeMin && eventStartDate <= timeMax) {
                fetchedIds.push(externalId)

                const existing = existingEventMap.get(externalId)
                if (
                  existing &&
                  existing.title === title &&
                  (existing.description ?? null) === description &&
                  (existing.location ?? null) === location &&
                  existing.start_at === startAt &&
                  (existing.end_at ?? null) === endAt &&
                  existing.all_day === allDay &&
                  (existing.color ?? null) === colorToUse
                ) {
                  continue
                }

                toUpsert.push({
                  family_id: member.family_id,
                  source_calendar_id: cal.calendar_id,
                  external_event_id: externalId,
                  title,
                  description,
                  location,
                  start_at,
                  end_at,
                  all_day: allDay,
                  color: colorToUse,
                  created_by: cal.family_member_id,
                })
              }
            }
          }

          // Batch upsert in chunks of 200 ONLY for changed/new events
          for (let i = 0; i < toUpsert.length; i += 200) {
            await supabase
              .from("calendar_events")
              .upsert(toUpsert.slice(i, i + 200), { onConflict: "family_id,external_event_id" })
          }

          // Clean up events in this calendar that are no longer in the ICS feed
          const toDelete = (existingEvents ?? [])
            .filter((e: any) => e.external_event_id && !fetchedIds.includes(e.external_event_id))
            .map((e: any) => e.id)

          if (toDelete.length > 0) {
            for (let i = 0; i < toDelete.length; i += 200) {
              await supabase.from("calendar_events").delete().in("id", toDelete.slice(i, i + 200))
            }
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
        
        if (key === "EXDATE") {
          if (!currentEvent[key]) {
            currentEvent[key] = []
          }
          currentEvent[key].push(value)
        } else {
          currentEvent[key] = value
        }

        if (params.includes("VALUE=DATE")) {
          currentEvent[`${key}_ALLDAY`] = "true"
        }

        if (params) {
          const tzidMatch = /TZID=([^;]+)/i.exec(params)
          if (tzidMatch) {
            currentEvent[`${key}_TZID`] = tzidMatch[1].trim()
          }
        }
      }
    }
  }
  return events
}

function parseExDates(exdateProp: any): Set<string> {
  const dates = new Set<string>()
  if (!exdateProp) return dates
  
  const propArray = Array.isArray(exdateProp) ? exdateProp : [exdateProp]
  for (const propValue of propArray) {
    const parts = propValue.split(",")
    for (const part of parts) {
      const clean = part.trim()
      if (!clean) continue
      const dateMatch = /^(\d{4})(\d{2})(\d{2})/.exec(clean)
      if (dateMatch) {
        const [_, y, m, d] = dateMatch
        dates.add(`${y}-${m}-${d}`)
      }
    }
  }
  return dates
}

function expandIcsRRule(
  startIso: string,
  endIso: string,
  rruleStr: string,
  timeMin: Date,
  timeMax: Date,
  exDates?: Set<string>
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
        const dateStr = instStart.toISOString().slice(0, 10)
        if (!exDates || !exDates.has(dateStr)) {
          const instEnd = new Date(current.getTime() + durationMs)
          instances.push({
            startAt: instStart.toISOString(),
            endAt: instEnd.toISOString(),
            instanceIdSuffix: `_${dateStr}`,
          })
        }
      }
    }

    current.setUTCDate(current.getUTCDate() + 1)
  }

  return instances
}

const WINDOWS_TO_IANA: Record<string, string> = {
  "Eastern Standard Time": "America/New_York",
  "Eastern Daylight Time": "America/New_York",
  "EST": "America/New_York",
  "EDT": "America/New_York",
  "Central Standard Time": "America/Chicago",
  "Central Daylight Time": "America/Chicago",
  "CST": "America/Chicago",
  "CDT": "America/Chicago",
  "Mountain Standard Time": "America/Denver",
  "Mountain Daylight Time": "America/Denver",
  "MST": "America/Denver",
  "MDT": "America/Denver",
  "Pacific Standard Time": "America/Los_Angeles",
  "Pacific Daylight Time": "America/Los_Angeles",
  "PST": "America/Los_Angeles",
  "PDT": "America/Los_Angeles",
  "Alaskan Standard Time": "America/Anchorage",
  "Hawaiian Standard Time": "America/Adak",
  "Hawaii Standard Time": "America/Honolulu",
  "GMT Standard Time": "Europe/London",
  "Greenwich Standard Time": "Europe/London",
  "W. Europe Standard Time": "Europe/Berlin",
  "Central Europe Standard Time": "Europe/Belgrade",
  "Romance Standard Time": "Europe/Paris",
  "UTC": "UTC",
  "GMT": "GMT",
}

function normalizeTimeZone(tz: string): string {
  const trimmed = tz.trim()
  if (WINDOWS_TO_IANA[trimmed]) {
    return WINDOWS_TO_IANA[trimmed]
  }
  const lower = trimmed.toLowerCase()
  for (const [win, iana] of Object.entries(WINDOWS_TO_IANA)) {
    if (win.toLowerCase() === lower) {
      return iana
    }
  }
  return trimmed
}

function convertLocalToUtc(localIso: string, timeZone: string): string {
  // localIso is "YYYY-MM-DDTHH:mm:ss"
  const d = new Date(localIso + "Z")
  
  // Format elements explicitly to ensure en-US format
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false
  })
  
  const parts = formatter.formatToParts(d)
  const map: Record<string, string> = {}
  for (const part of parts) {
    map[part.type] = part.value
  }
  
  const year = map.year
  const month = map.month.padStart(2, "0")
  const day = map.day.padStart(2, "0")
  const hour = map.hour === "24" ? "00" : map.hour.padStart(2, "0")
  const minute = map.minute.padStart(2, "0")
  const second = map.second.padStart(2, "0")
  
  const localTzIso = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`
  const localDate = new Date(localTzIso)
  
  const offset = localDate.getTime() - d.getTime()
  const utcDate = new Date(d.getTime() - offset)
  return utcDate.toISOString()
}

function parseIcsDate(str: string | undefined, tzId?: string): { iso: string; allDay: boolean } | null {
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
    const localIso = `${y}-${m}-${d}T${hr}:${mn}:${sc}`
    if (z) {
      return { iso: `${localIso}Z`, allDay: false }
    }
    
    // Normalize timeZone name (e.g. convert "Eastern Standard Time" to "America/New_York")
    const targetTz = tzId ? normalizeTimeZone(tzId) : "America/New_York"
    
    try {
      const utcIso = convertLocalToUtc(localIso, targetTz)
      return { iso: utcIso, allDay: false }
    } catch (err) {
      console.error(`Error converting timezone ${targetTz} for ${localIso}:`, err)
      // Fallback: Try converting using the family's default timezone "America/New_York"
      try {
        const utcIso = convertLocalToUtc(localIso, "America/New_York")
        return { iso: utcIso, allDay: false }
      } catch {
        return { iso: `${localIso}Z`, allDay: false }
      }
    }
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

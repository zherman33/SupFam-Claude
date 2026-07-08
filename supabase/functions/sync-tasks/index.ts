import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const GOOGLE_TASKS_BASE = "https://tasks.googleapis.com/tasks/v1"

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

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {}
    const action = body.action || "sync"
    const targetMemberId: string | null = body.family_member_id ?? null

    // Helper to get a valid access token for a family member
    async function getValidTokenForMember(memberId: string): Promise<string | null> {
      const { data: tok } = await supabase
        .from("google_tokens")
        .select("*")
        .eq("family_member_id", memberId)
        .maybeSingle()

      if (!tok || !tok.access_token) return null

      let accessToken = tok.access_token
      if (tok.token_expires_at) {
        const expiresAt = new Date(tok.token_expires_at).getTime()
        if (expiresAt < Date.now() + 5 * 60 * 1000 && tok.refresh_token) {
          accessToken = await refreshAccessToken(tok.refresh_token, tok.family_member_id, supabase)
        }
      }
      return accessToken
    }

    // ── Action: Create single task in Google Tasks ──────────────────────────
    if (action === "create" && body.task_id) {
      const { data: task } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", body.task_id)
        .maybeSingle()

      if (!task) return jsonResp({ error: "Task not found" }, 404)

      const memberId = task.assigned_to || task.created_by
      if (!memberId) return jsonResp({ error: "No member associated with task" }, 400)

      const token = await getValidTokenForMember(memberId)
      if (!token) return jsonResp({ error: "No valid Google token found for member" }, 400)

      const defaultListId = await getDefaultTasklist(token)
      const payload: any = { title: task.title }
      if (task.notes) payload.notes = task.notes
      if (task.due_date) payload.due = `${task.due_date}T00:00:00.000Z`

      const res = await fetch(`${GOOGLE_TASKS_BASE}/lists/${encodeURIComponent(defaultListId)}/tasks`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) return jsonResp({ error: `Google Tasks API error: ${res.status}` }, res.status)
      const created = await res.json()

      await supabase
        .from("tasks")
        .update({ google_task_id: created.id, google_tasklist_id: defaultListId })
        .eq("id", task.id)

      return jsonResp({ success: true, google_task_id: created.id })
    }

    // ── Action: Complete/uncomplete task in Google Tasks ────────────────────
    if (action === "complete" && body.google_task_id && body.google_tasklist_id) {
      // Find a token that can update this task (either specified member or any member in family)
      const query = supabase.from("google_tokens").select("*")
      if (targetMemberId) query.eq("family_member_id", targetMemberId)
      const { data: tokens } = await query
      if (!tokens || tokens.length === 0) return jsonResp({ error: "No Google tokens found" }, 400)

      for (const tok of tokens) {
        let accessToken = tok.access_token
        if (tok.token_expires_at && new Date(tok.token_expires_at).getTime() < Date.now() + 5 * 60 * 1000 && tok.refresh_token) {
          accessToken = await refreshAccessToken(tok.refresh_token, tok.family_member_id, supabase)
        }
        const res = await fetch(
          `${GOOGLE_TASKS_BASE}/lists/${encodeURIComponent(body.google_tasklist_id)}/tasks/${encodeURIComponent(body.google_task_id)}`,
          {
            method: "PATCH",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ status: body.is_complete ? "completed" : "needsAction" }),
          }
        )
        if (res.ok) return jsonResp({ success: true })
      }
      return jsonResp({ error: "Failed to update Google Task across available tokens" }, 500)
    }

    // ── Action: Delete task in Google Tasks ─────────────────────────────────
    if (action === "delete" && body.google_task_id && body.google_tasklist_id) {
      const query = supabase.from("google_tokens").select("*")
      if (targetMemberId) query.eq("family_member_id", targetMemberId)
      const { data: tokens } = await query
      if (!tokens || tokens.length === 0) return jsonResp({ error: "No Google tokens found" }, 400)

      for (const tok of tokens) {
        let accessToken = tok.access_token
        if (tok.token_expires_at && new Date(tok.token_expires_at).getTime() < Date.now() + 5 * 60 * 1000 && tok.refresh_token) {
          accessToken = await refreshAccessToken(tok.refresh_token, tok.family_member_id, supabase)
        }
        const res = await fetch(
          `${GOOGLE_TASKS_BASE}/lists/${encodeURIComponent(body.google_tasklist_id)}/tasks/${encodeURIComponent(body.google_task_id)}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        )
        if (res.ok || res.status === 404) return jsonResp({ success: true })
      }
      return jsonResp({ error: "Failed to delete Google Task across available tokens" }, 500)
    }

    // ── Action: Full bidirectional sync ─────────────────────────────────────
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
        : (tok.family_members as any)

      let accessToken = tok.access_token
      if (tok.token_expires_at) {
        const expiresAt = new Date(tok.token_expires_at).getTime()
        if (expiresAt < Date.now() + 5 * 60 * 1000 && tok.refresh_token) {
          accessToken = await refreshAccessToken(tok.refresh_token, tok.family_member_id, supabase)
        }
      }

      // 1. Push unlinked local tasks to Google Tasks
      const { data: unlinkedTasks } = await supabase
        .from("tasks")
        .select("*")
        .eq("family_id", member.family_id)
        .is("google_task_id", null)
        .eq("is_complete", false)

      const memberUnlinked = (unlinkedTasks ?? []).filter(
        (t: any) => t.created_by === tok.family_member_id || t.assigned_to === tok.family_member_id
      )

      if (memberUnlinked.length > 0) {
        const defaultListId = await getDefaultTasklist(accessToken)
        for (const localTask of memberUnlinked) {
          const payload: any = { title: localTask.title }
          if (localTask.notes) payload.notes = localTask.notes
          if (localTask.due_date) payload.due = `${localTask.due_date}T00:00:00.000Z`

          const createRes = await fetch(`${GOOGLE_TASKS_BASE}/lists/${encodeURIComponent(defaultListId)}/tasks`, {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
          if (createRes.ok) {
            const created = await createRes.json()
            await supabase
              .from("tasks")
              .update({ google_task_id: created.id, google_tasklist_id: defaultListId })
              .eq("id", localTask.id)
          }
        }
      }

      // 2. Pull tasklists from Google Tasks
      const listsRes = await fetch(`${GOOGLE_TASKS_BASE}/users/@me/lists?maxResults=20`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (!listsRes.ok) {
        results.push({ member: member.display_name, error: `lists ${listsRes.status}` })
        continue
      }

      const listsData = await listsRes.json()
      const tasklists: any[] = listsData.items ?? []
      let syncedCount = 0

      for (const list of tasklists) {
        const tasksRes = await fetch(
          `${GOOGLE_TASKS_BASE}/lists/${encodeURIComponent(list.id)}/tasks?` +
            new URLSearchParams({
              showCompleted: "true",
              showHidden: "true",
              maxResults: "250",
            }),
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )

        if (!tasksRes.ok) continue

        const tasksData = await tasksRes.json()
        const gTasks: any[] = tasksData.items ?? []

        for (const gTask of gTasks) {
          if (gTask.deleted === true) {
            await supabase.from("tasks").delete().eq("google_task_id", gTask.id)
            continue
          }

          if (!gTask.title || gTask.title.trim() === "") continue

          const dueDate = gTask.due ? gTask.due.substring(0, 10) : null
          const isComplete = gTask.status === "completed"

          const { data: existingById } = await supabase
            .from("tasks")
            .select("id")
            .eq("family_id", member.family_id)
            .eq("google_task_id", gTask.id)
            .maybeSingle()

          if (existingById) {
            await supabase
              .from("tasks")
              .update({
                title: gTask.title,
                notes: gTask.notes ?? null,
                due_date: dueDate,
                is_complete: isComplete,
                google_tasklist_id: list.id,
              })
              .eq("id", existingById.id)
            syncedCount++
          } else {
            // Check if there's an unlinked local task with exact title
            let queryByTitle = supabase
              .from("tasks")
              .select("id")
              .eq("family_id", member.family_id)
              .is("google_task_id", null)
              .eq("title", gTask.title)

            if (dueDate) {
              queryByTitle = queryByTitle.eq("due_date", dueDate)
            }

            const { data: existingByTitle } = await queryByTitle.maybeSingle()

            if (existingByTitle) {
              await supabase
                .from("tasks")
                .update({
                  google_task_id: gTask.id,
                  google_tasklist_id: list.id,
                  notes: gTask.notes ?? null,
                  is_complete: isComplete,
                })
                .eq("id", existingByTitle.id)
              syncedCount++
            } else {
              await supabase.from("tasks").insert({
                family_id: member.family_id,
                created_by: tok.family_member_id,
                assigned_to: tok.family_member_id,
                title: gTask.title,
                notes: gTask.notes ?? null,
                due_date: dueDate,
                is_complete: isComplete,
                google_task_id: gTask.id,
                google_tasklist_id: list.id,
              })
              syncedCount++
            }
          }
        }
      }

      results.push({
        member: member.display_name,
        lists: tasklists.length,
        tasks: syncedCount,
      })
    }

    return jsonResp({ synced: results.length, results })
  } catch (err) {
    console.error(err)
    return jsonResp({ error: String(err) }, 500)
  }
})

async function getDefaultTasklist(accessToken: string): Promise<string> {
  const res = await fetch(`${GOOGLE_TASKS_BASE}/users/@me/lists?maxResults=1`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return "@default"
  const data = await res.json()
  return data.items?.[0]?.id ?? "@default"
}

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

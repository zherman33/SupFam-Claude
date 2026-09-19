import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

// ─── support-chat ───
// In-app async support form. Writes a row to support_tickets and forwards
// the message to support@supfam.app via Resend.
// The Resend key arrives later as the RESEND_API_KEY Supabase secret —
// until then the ticket is still saved and the email step is skipped
// with a clear log line (never a failed request for the user).

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  })
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return json({ error: "Please sign in first." }, 401)

    const { name, email, message } = await req.json().catch(() => ({}))
    const cleanName = typeof name === "string" ? name.trim().slice(0, 120) : ""
    const cleanEmail = typeof email === "string" ? email.trim().slice(0, 320) : ""
    const cleanMessage = typeof message === "string" ? message.trim().slice(0, 5000) : ""

    if (!cleanName) return json({ error: "Tell us your name?" }, 400)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return json({ error: "That email doesn't look right — mind checking it?" }, 400)
    }
    if (cleanMessage.length < 3) return json({ error: "Tell us a little more?" }, 400)

    // Service-role client for the ticket insert (bypasses RLS safely —
    // family_id comes from the verified member row, not the client).
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )
    const { data: member } = await admin
      .from("family_members")
      .select("id, family_id, families(name)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle()

    const { data: ticket, error: insertError } = await admin
      .from("support_tickets")
      .insert({
        family_id: member?.family_id ?? null,
        user_id: user.id,
        name: cleanName,
        email: cleanEmail,
        message: cleanMessage,
        status: "open",
      })
      .select("id")
      .single()

    if (insertError || !ticket) {
      console.error("[support-chat] ticket insert failed:", insertError?.message)
      return json({ error: "Hmm, that didn't go through — try again?" }, 500)
    }

    // ── Forward to support@supfam.app via Resend ──
    const resendKey = Deno.env.get("RESEND_API_KEY")
    let emailSent = false
    if (!resendKey) {
      console.warn(
        `[support-chat] RESEND_API_KEY is not set — ticket ${ticket.id} saved, email to support@supfam.app skipped.`
      )
    } else {
      try {
        const familyName = (member?.families as { name?: string } | null)?.name ?? "Unknown family"
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Sup Fam Support <support@supfam.app>",
            to: ["support@supfam.app"],
            reply_to: cleanEmail,
            subject: `[Sup Fam] ${cleanName} — ${familyName}`,
            text:
              `From: ${cleanName} <${cleanEmail}>\n` +
              `Family: ${familyName}\n` +
              `Ticket: ${ticket.id}\n\n${cleanMessage}`,
            html:
              `<p><strong>From:</strong> ${esc(cleanName)} &lt;${esc(cleanEmail)}&gt;<br/>` +
              `<strong>Family:</strong> ${esc(familyName)}<br/>` +
              `<strong>Ticket:</strong> ${esc(ticket.id)}</p>` +
              `<p>${esc(cleanMessage).replace(/\n/g, "<br/>")}</p>`,
          }),
        })
        if (!res.ok) {
          const errText = await res.text()
          console.error(`[support-chat] Resend failed (${res.status}) for ticket ${ticket.id}:`, errText.slice(0, 500))
        } else {
          emailSent = true
        }
      } catch (e) {
        console.error(`[support-chat] Resend error for ticket ${ticket.id}:`, e instanceof Error ? e.message : e)
      }
    }

    return json({ ok: true, ticket_id: ticket.id, email_sent: emailSent })
  } catch (e) {
    console.error("[support-chat]", e instanceof Error ? e.message : e)
    return json({ error: "Hmm, that didn't go through — try again?" }, 500)
  }
})

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

// ─── Stripe Billing Portal ───
// Lets the family admin update their card, change plan, or cancel —
// all inside Stripe's hosted portal. No card data touches our app.

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")
  if (!stripeKey) {
    return json({ error: "billing_not_configured", message: "Stripe is not configured yet." }, 503)
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
    )
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return json({ error: "Unauthorized" }, 401)

    const { data: member } = await supabase
      .from("family_members")
      .select("role, families(id, stripe_customer_id)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle()

    if (!member || member.role !== "admin" || !member.families?.stripe_customer_id) {
      return json({ error: "No billing account found for this family yet." }, 404)
    }

    const appUrl =
      Deno.env.get("APP_URL") ?? req.headers.get("origin") ?? "https://app.supfam.app"

    const body = new URLSearchParams({
      customer: member.families.stripe_customer_id,
      return_url: `${appUrl}/settings?billing=returned`,
    })
    const res = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error?.message ?? "Portal failed")

    return json({ url: data.url })
  } catch (e) {
    console.error("[create-portal-session]", e instanceof Error ? e.message : e)
    return json({ error: "Hmm, that didn't work — try again?" }, 500)
  }
})

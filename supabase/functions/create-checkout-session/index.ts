import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

// ─── Shared Stripe REST helper (no SDK — plain fetch, form-encoded) ───

function stripeKey(): string | null {
  return Deno.env.get("STRIPE_SECRET_KEY") ?? null
}

async function stripePost(path: string, params: Record<string, string>) {
  const key = stripeKey()
  if (!key) throw new Error("billing_not_configured")
  const body = new URLSearchParams(params)
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.error?.message ?? `Stripe error: ${res.status}`)
  }
  return data
}

const PLANS = ["founding", "annual", "monthly"] as const
type Plan = (typeof PLANS)[number]

function priceFor(plan: Plan): string | null {
  const map: Record<Plan, string | undefined> = {
    founding: Deno.env.get("STRIPE_PRICE_FOUNDING"),
    annual: Deno.env.get("STRIPE_PRICE_ANNUAL"),
    monthly: Deno.env.get("STRIPE_PRICE_MONTHLY"),
  }
  return map[plan] ?? null
}

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

// ─── Authed supabase client (validates the caller's JWT) ───

async function authedClient(req: Request) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
  )
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { supabase: null, user: null }
  return { supabase, user }
}

async function adminFamily(supabase: any, userId: string) {
  const { data: member } = await supabase
    .from("family_members")
    .select("id, family_id, role, families(id, name, stripe_customer_id, subscription_status)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle()
  if (!member || member.role !== "admin") return null
  return member
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)

  try {
    if (!stripeKey()) {
      return json(
        { error: "billing_not_configured", message: "Stripe is not configured yet. Add STRIPE_SECRET_KEY to enable checkout." },
        503
      )
    }

    const { supabase, user } = await authedClient(req)
    if (!supabase || !user) return json({ error: "Unauthorized" }, 401)

    const member = await adminFamily(supabase, user.id)
    if (!member) return json({ error: "Only the family admin can manage billing." }, 403)
    const family = member.families

    const { plan } = await req.json().catch(() => ({}))
    if (!PLANS.includes(plan)) return json({ error: "Choose a plan to continue." }, 400)

    const priceId = priceFor(plan as Plan)
    if (!priceId) {
      return json(
        { error: "billing_not_configured", message: `No Stripe price configured for plan "${plan}".` },
        503
      )
    }

    // Founding plan is only offered while the founding window is open.
    if (plan === "founding" && Deno.env.get("FOUNDING_ENABLED") === "false") {
      return json({ error: "The founding rate is no longer available." }, 400)
    }

    // Reuse or create the Stripe customer, tagged to this family.
    let customerId: string | null = family.stripe_customer_id
    if (!customerId) {
      const customer = await stripePost("customers", {
        name: family.name ?? "Sup Fam family",
        email: user.email ?? "",
        "metadata[family_id]": family.id,
      })
      customerId = customer.id
      // Service-role update: the caller is admin but RLS update policy is
      // scoped to own family anyway; use the authed client.
      await supabase.from("families").update({ stripe_customer_id: customerId }).eq("id", family.id)
    }

    const appUrl =
      Deno.env.get("APP_URL") ?? req.headers.get("origin") ?? "https://app.supfam.app"

    const session = await stripePost("checkout/sessions", {
      mode: "subscription",
      customer: customerId!,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      "subscription_data[trial_period_days]": "30",
      "subscription_data[metadata][family_id]": family.id,
      "metadata[family_id]": family.id,
      "metadata[plan]": plan,
      success_url: `${appUrl}/onboarding?checkout=success`,
      cancel_url: `${appUrl}/onboarding?checkout=cancelled`,
      allow_promotion_codes: "true",
    })

    // Tentatively record the chosen plan; the webhook confirms on
    // checkout.session.completed and flips status to trialing.
    await supabase.from("families").update({ plan_id: plan }).eq("id", family.id)

    return json({ url: session.url })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Checkout failed"
    if (message === "billing_not_configured") {
      return json({ error: message, message: "Stripe is not configured yet." }, 503)
    }
    console.error("[create-checkout-session]", message)
    return json({ error: "Hmm, that didn't work — try again?" }, 500)
  }
})

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

// ─── Stripe webhook → Supabase billing state ───
// Verifies the Stripe signature (WebCrypto, no SDK), then persists
// subscription state onto families. Idempotent via subscription_events.

const SIGNATURE_TOLERANCE_SEC = 300

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

async function verifySignature(rawBody: string, header: string | null, secret: string): Promise<boolean> {
  if (!header) return false
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]))
  const t = parts["t"]
  const v1 = parts["v1"]
  if (!t || !v1) return false
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - parseInt(t, 10)) > SIGNATURE_TOLERANCE_SEC) return false

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${rawBody}`))
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("")
  // v1 may contain multiple signatures; accept if any match
  return header.split(",").some((p) => p === `v1=${hex}`)
}

function planFromPrice(priceId: string | null | undefined): string {
  if (!priceId) return "none"
  if (priceId === Deno.env.get("STRIPE_PRICE_FOUNDING")) return "founding"
  if (priceId === Deno.env.get("STRIPE_PRICE_ANNUAL")) return "annual"
  if (priceId === Deno.env.get("STRIPE_PRICE_MONTHLY")) return "monthly"
  return "annual" // unknown price → treat as paid annual rather than locking out
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 })
  }

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")
  if (!webhookSecret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET is not set")
    return new Response(JSON.stringify({ error: "billing_not_configured" }), { status: 503 })
  }

  const rawBody = await req.text()
  const ok = await verifySignature(rawBody, req.headers.get("stripe-signature"), webhookSecret)
  if (!ok) {
    console.error("[stripe-webhook] signature verification failed")
    return new Response(JSON.stringify({ error: "Bad signature" }), { status: 400 })
  }

  const event = JSON.parse(rawBody)
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  // Idempotency: never process the same Stripe event twice.
  const { data: existing } = await supabase
    .from("subscription_events")
    .select("id")
    .eq("stripe_event_id", event.id)
    .maybeSingle()
  if (existing) {
    return new Response(JSON.stringify({ received: true, deduped: true }), { status: 200 })
  }

  const obj = event.data?.object ?? {}
  const type: string = event.type ?? ""

  // Resolve the family: prefer explicit metadata, fall back to customer id.
  async function familyIdFor(): Promise<string | null> {
    const metaFam = obj.metadata?.family_id ?? obj.subscription_data?.metadata?.family_id
    if (metaFam) return metaFam
    const customerId: string | undefined = obj.customer
    if (customerId) {
      const { data } = await supabase
        .from("families")
        .select("id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle()
      return data?.id ?? null
    }
    return null
  }

  const familyId = await familyIdFor()
  if (!familyId) {
    console.error("[stripe-webhook] no family for event", event.id, type)
    return new Response(JSON.stringify({ error: "Unknown family" }), { status: 200 })
  }

  const patch: Record<string, unknown> = {}
  const priceId: string | undefined =
    obj.items?.data?.[0]?.price?.id ?? obj.plan?.id ?? obj.lines?.data?.[0]?.price?.id

  switch (type) {
    case "checkout.session.completed": {
      // We stamp metadata.plan at checkout creation — trust it first,
      // fall back to matching the price id.
      const metaPlan = obj.metadata?.plan
      patch.stripe_customer_id = obj.customer
      patch.stripe_subscription_id = obj.subscription
      patch.subscription_status = "trialing"
      patch.plan_id = ["founding", "annual", "monthly"].includes(metaPlan)
        ? metaPlan
        : planFromPrice(priceId)
      if (patch.plan_id === "founding") patch.is_founding = true
      break
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      patch.stripe_subscription_id = obj.id
      patch.subscription_status = obj.status // trialing|active|past_due|canceled|unpaid|incomplete_expired
      if (obj.status === "incomplete_expired") patch.subscription_status = "expired"
      patch.plan_id = planFromPrice(priceId)
      if (patch.plan_id === "founding") patch.is_founding = true
      patch.trial_ends_at = obj.trial_end ? new Date(obj.trial_end * 1000).toISOString() : null
      patch.current_period_end = obj.current_period_end
        ? new Date(obj.current_period_end * 1000).toISOString()
        : null
      patch.cancel_at_period_end = !!obj.cancel_at_period_end
      break
    }
    case "customer.subscription.deleted": {
      patch.subscription_status = "canceled"
      patch.current_period_end = obj.current_period_end
        ? new Date(obj.current_period_end * 1000).toISOString()
        : null
      break
    }
    case "invoice.payment_succeeded": {
      patch.subscription_status = "active"
      if (obj.lines?.data?.[0]?.period?.end) {
        patch.current_period_end = new Date(obj.lines.data[0].period.end * 1000).toISOString()
      }
      break
    }
    case "invoice.payment_failed": {
      // Grace: the app keeps working on past_due (see useSubscription);
      // the billing page prompts to update the card.
      patch.subscription_status = "past_due"
      break
    }
    default:
      break
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from("families").update(patch).eq("id", familyId)
    if (error) console.error("[stripe-webhook] family update failed", error.message)
  }

  await supabase.from("subscription_events").insert({
    family_id: familyId,
    stripe_event_id: event.id,
    event_type: type,
    payload: obj,
  })

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
})

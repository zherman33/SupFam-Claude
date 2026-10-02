import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

// ─── dinner-ai ───
// Thin, authenticated proxy from the Sup Fam app to a chat-completions LLM.
//
// Why a proxy instead of calling the LLM from the browser? The cloud API key
// must never ship to clients. The function holds AI_API_KEY as a Supabase
// secret and forwards {system, messages} to any OpenAI-compatible endpoint.
//
// Provider is configurable via secrets (no redeploy):
//   AI_API_KEY        – required for cloud mode (e.g. a free Groq key)
//   AI_BASE_URL       – default https://api.groq.com/openai/v1
//   AI_MODEL          – default openai/gpt-oss-120b
//   AI_FALLBACK_MODELS – comma-separated fallbacks, tried in order when the
//                       primary model 404s/400s (free-tier catalogs churn)
//
// Home-server mode ("free AI on your own box") does NOT go through here:
// the app talks to the household's Ollama-compatible endpoint directly from
// the browser (the edge runtime can't reach a home LAN anyway).

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

const DEFAULT_BASE = "https://api.groq.com/openai/v1"
const DEFAULT_MODEL = "openai/gpt-oss-120b"
const DEFAULT_FALLBACKS = ["llama-3.3-70b-versatile", "qwen/qwen3-32b"]

interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

async function callModel(
  base: string,
  key: string,
  model: string,
  system: string,
  messages: ChatMessage[]
): Promise<{ ok: true; reply: string } | { ok: false; status: number; retriable: boolean; detail: string }> {
  const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, ...messages],
      temperature: 0.7,
      max_tokens: 700,
    }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = typeof body?.error?.message === "string" ? body.error.message : `HTTP ${res.status}`
    // 400/404 usually means "unknown model" on free-tier catalogs → try next
    const retriable = res.status === 400 || res.status === 404
    return { ok: false, status: res.status, retriable, detail }
  }
  const reply = body?.choices?.[0]?.message?.content
  if (typeof reply !== "string" || !reply.trim()) {
    return { ok: false, status: 502, retriable: false, detail: "Empty reply from model" }
  }
  return { ok: true, reply: reply.trim() }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors })

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return json({ error: "Please sign in first." }, 401)

    // Read the body once, then branch: health check vs. chat.
    const body = await req.json().catch(() => ({}))
    if (body && body.health === true) {
      return json({ configured: !!Deno.env.get("AI_API_KEY") })
    }

    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)

    const apiKey = Deno.env.get("AI_API_KEY")
    if (!apiKey) {
      return json({
        error:
          "Dinner AI isn't connected yet — add a free API key in Supabase secrets (AI_API_KEY), or point the app at your home AI server in Settings.",
        code: "not_configured",
      }, 503)
    }

    const { system, messages } = body as { system?: unknown; messages?: unknown }
    if (typeof system !== "string" || !system.trim()) {
      return json({ error: "Missing conversation context." }, 400)
    }
    const cleanMessages: ChatMessage[] = Array.isArray(messages)
      ? messages
          .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
          .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
          .slice(-20)
      : []
    if (cleanMessages.length === 0) {
      return json({ error: "Say something first?" }, 400)
    }

    const base = Deno.env.get("AI_BASE_URL") || DEFAULT_BASE
    const primary = Deno.env.get("AI_MODEL") || DEFAULT_MODEL
    const fallbacks = (Deno.env.get("AI_FALLBACK_MODELS") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    const chain = [primary, ...fallbacks.filter((m) => m !== primary), ...DEFAULT_FALLBACKS.filter((m) => m !== primary && !fallbacks.includes(m))]

    let lastDetail = "No models responded"
    for (const model of chain) {
      const result = await callModel(base, apiKey, model, system.slice(0, 12000), cleanMessages)
      if (result.ok) return json({ reply: result.reply, model })
      console.warn(`[dinner-ai] model ${model} failed (${result.status}): ${result.detail}`)
      lastDetail = result.detail
      if (!result.retriable) break
    }

    return json({
      error: "Hmm, the AI didn't answer — try again in a moment?",
      code: "model_error",
      detail: lastDetail.slice(0, 200),
    }, 502)
  } catch (e) {
    console.error("[dinner-ai] unexpected:", e)
    return json({ error: "Hmm, that didn't work — try again?" }, 500)
  }
})

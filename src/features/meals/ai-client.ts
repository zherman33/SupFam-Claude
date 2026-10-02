/**
 * AI provider dispatch for dinner conversations.
 *
 * Two paths, one conversation shape:
 * - "cloud": the app POSTs {system, messages} to the Supabase `dinner-ai` edge
 *   function, which holds the API key server-side (free-tier key by default).
 * - "home": the browser talks straight to the household's Ollama-compatible
 *   endpoint (the AI workstation) — fully free, nothing leaves the house.
 *
 * Choice is per-device (localStorage): the kitchen iPad can point at the home
 * server while a phone on the road uses cloud.
 */

import { supabase } from '@/lib/supabase'
import { extractProposals, type Proposal } from './dinner-context'

export type AiMode = 'cloud' | 'home'

const MODE_KEY = 'supfam-ai-mode'
const HOME_URL_KEY = 'supfam-ai-home-url'
const HOME_MODEL_KEY = 'supfam-ai-home-model'

export interface AiSettings {
  mode: AiMode
  homeUrl: string
  homeModel: string
}

export function loadAiSettings(): AiSettings {
  let mode: AiMode = 'cloud'
  try {
    if (localStorage.getItem(MODE_KEY) === 'home') mode = 'home'
  } catch { /* private mode — fall back to cloud */ }
  return {
    mode,
    homeUrl: readLS(HOME_URL_KEY),
    homeModel: readLS(HOME_MODEL_KEY) || 'qwen3:8b',
  }
}

function readLS(key: string): string {
  try {
    return localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

export function saveAiSettings(s: AiSettings) {
  try {
    localStorage.setItem(MODE_KEY, s.mode)
    localStorage.setItem(HOME_URL_KEY, s.homeUrl.trim())
    localStorage.setItem(HOME_MODEL_KEY, s.homeModel.trim() || 'qwen3:8b')
  } catch { /* ignore */ }
}

/** Is the cloud path wired up (edge function has an API key)? */
export async function checkCloudAi(): Promise<'ready' | 'missing-key' | 'unreachable'> {
  try {
    const { data, error } = await supabase.functions.invoke('dinner-ai', {
      body: { health: true },
    })
    if (error) return 'unreachable'
    return data?.configured ? 'ready' : 'missing-key'
  } catch {
    return 'unreachable'
  }
}

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatResult {
  text: string
  proposals: Proposal[]
  model: string
}

/** Friendly error with a `code` the UI can switch on. */
export class AiError extends Error {
  code: 'not_configured' | 'unreachable' | 'model_error'
  constructor(code: AiError['code'], message: string) {
    super(message)
    this.code = code
  }
}

export async function sendDinnerChat(system: string, turns: ChatTurn[]): Promise<ChatResult> {
  const settings = loadAiSettings()
  const trimmed = turns
    .filter((t) => t.content.trim())
    .map((t) => ({ role: t.role, content: t.content.slice(0, 4000) }))
    .slice(-20)
  if (trimmed.length === 0) throw new AiError('model_error', 'Say something first?')

  if (settings.mode === 'home') return sendViaHome(settings, system, trimmed)
  return sendViaCloud(system, trimmed)
}

async function sendViaCloud(system: string, turns: ChatTurn[]): Promise<ChatResult> {
  const { data, error } = await supabase.functions.invoke('dinner-ai', {
    body: { system, messages: turns },
  })
  if (error) {
    throw new AiError('unreachable', "Hmm, I couldn't reach the AI — check your connection and try again?")
  }
  if (data?.error) {
    const code = data.code === 'not_configured' ? 'not_configured' : 'model_error'
    throw new AiError(code, data.error as string)
  }
  if (typeof data?.reply !== 'string') {
    throw new AiError('model_error', "Hmm, the AI didn't answer — try again in a moment?")
  }
  const { text, proposals } = extractProposals(data.reply)
  return { text, proposals, model: data.model ?? 'cloud' }
}

async function sendViaHome(settings: AiSettings, system: string, turns: ChatTurn[]): Promise<ChatResult> {
  const base = settings.homeUrl.trim().replace(/\/$/, '')
  if (!base) {
    throw new AiError('not_configured', 'Point the app at your home AI server in Settings first.')
  }
  let res: Response
  try {
    res = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: settings.homeModel,
        messages: [{ role: 'system', content: system }, ...turns],
        temperature: 0.7,
        max_tokens: 700,
      }),
    })
  } catch {
    throw new AiError(
      'unreachable',
      "I can't reach your home AI server — is it running and on the same network?"
    )
  }
  if (!res.ok) {
    throw new AiError('model_error', `Your home server answered ${res.status} — is the model loaded?`)
  }
  const body = await res.json().catch(() => null)
  const reply = body?.choices?.[0]?.message?.content
  if (typeof reply !== 'string' || !reply.trim()) {
    throw new AiError('model_error', "Hmm, your home server didn't answer — try again?")
  }
  const { text, proposals } = extractProposals(reply.trim())
  return { text, proposals, model: settings.homeModel }
}

import { useEffect, useState } from 'react'
import {
  loadAiSettings,
  saveAiSettings,
  checkCloudAi,
  type AiMode,
} from '@/features/meals/ai-client'

/**
 * Settings → Dinner AI tab.
 * Picks where the dinner-planning conversation thinks:
 * - Cloud: Sup Fam's edge function + a free-tier API key (AI_API_KEY secret).
 * - Home server: this device talks straight to your Ollama box — free forever,
 *   nothing leaves the house. (The kitchen iPad is the natural home-server device.)
 */
export function DinnerAiTab() {
  const [mode, setMode] = useState<AiMode>('cloud')
  const [homeUrl, setHomeUrl] = useState('')
  const [homeModel, setHomeModel] = useState('qwen3:8b')
  const [cloudStatus, setCloudStatus] = useState<'checking' | 'ready' | 'missing-key' | 'unreachable'>('checking')
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [testMsg, setTestMsg] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const s = loadAiSettings()
    setMode(s.mode)
    setHomeUrl(s.homeUrl)
    setHomeModel(s.homeModel)
    checkCloudAi().then(setCloudStatus)
  }, [])

  const pickMode = (m: AiMode) => {
    setMode(m)
    setSaved(false)
  }

  const handleSave = () => {
    saveAiSettings({ mode, homeUrl, homeModel })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const testHome = async () => {
    setTestState('testing')
    setTestMsg(null)
    const base = homeUrl.trim().replace(/\/$/, '')
    if (!base) {
      setTestState('fail')
      setTestMsg('Enter your server address first.')
      return
    }
    try {
      const res = await fetch(`${base}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: homeModel.trim() || 'qwen3:8b',
          messages: [{ role: 'user', content: 'Reply with exactly: ok' }],
          max_tokens: 10,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = await res.json().catch(() => null)
      const reply = body?.choices?.[0]?.message?.content
      if (typeof reply !== 'string') throw new Error('empty reply')
      setTestState('ok')
      setTestMsg('Connected — your server answered.')
    } catch {
      setTestState('fail')
      setTestMsg("Can't reach it — is Ollama running, and is this device on the same network (or Tailscale)?")
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-brown-800">Dinner AI</h3>
        <p className="mt-1 text-xs leading-relaxed text-brown-700/60">
          The voice that talks dinner through with you. Pick where it thinks — this is
          per-device, so the kitchen iPad can use your home server while your phone uses the cloud.
        </p>
      </div>

      {/* Mode picker */}
      <div className="space-y-2">
        <ModeCard
          active={mode === 'cloud'}
          onClick={() => pickMode('cloud')}
          title="Sup Fam cloud"
          blurb="Hands-free — we host the AI on a free tier. Nothing for you to run."
          status={
            cloudStatus === 'checking' ? 'checking…' :
            cloudStatus === 'ready' ? 'connected ✓' :
            cloudStatus === 'missing-key' ? 'not connected yet' : 'unreachable'
          }
          statusTone={cloudStatus === 'ready' ? 'good' : 'warn'}
        />
        <ModeCard
          active={mode === 'home'}
          onClick={() => pickMode('home')}
          title="Home AI server"
          blurb="Your own box (Ollama) on your network. Free forever, fully private — dinner talk never leaves the house."
          status={homeUrl.trim() ? 'configured' : 'needs your server address'}
          statusTone={homeUrl.trim() ? 'good' : 'warn'}
        />
      </div>

      {/* Cloud detail */}
      {mode === 'cloud' && (
        <div className="rounded-2xl bg-cream-100 px-4 py-3 text-xs leading-relaxed text-brown-700/70 ring-1 ring-sand-200">
          {cloudStatus === 'ready' ? (
            <p><span className="font-semibold text-brown-800">Cloud AI is connected.</span> Dinner conversations just work — on this device and every other one set to cloud.</p>
          ) : (
            <p>
              <span className="font-semibold text-brown-800">Not connected yet.</span> The 3
              history-based recommendations still work everywhere; the full conversation unlocks
              once a free API key is added as the <span className="font-mono">AI_API_KEY</span> Supabase
              secret. Two-minute signup, no card.
            </p>
          )}
        </div>
      )}

      {/* Home server detail */}
      {mode === 'home' && (
        <div className="space-y-3 rounded-2xl bg-cream-100 px-4 py-4 ring-1 ring-sand-200">
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-brown-700/40">
              Server address
            </label>
            <input
              value={homeUrl}
              onChange={(e) => { setHomeUrl(e.target.value); setSaved(false); setTestState('idle') }}
              placeholder="http://100.x.y.z:11434"
              inputMode="url"
              className="w-full rounded-xl border border-sand-300 bg-white px-3 py-2 text-sm text-brown-800 placeholder:text-brown-700/35 focus:border-terracotta-500 focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-brown-700/50">
              Your Ollama address on the home network — a Tailscale IP works from anywhere.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-brown-700/40">
              Model
            </label>
            <input
              value={homeModel}
              onChange={(e) => { setHomeModel(e.target.value); setSaved(false); setTestState('idle') }}
              placeholder="qwen3:8b"
              className="w-full rounded-xl border border-sand-300 bg-white px-3 py-2 text-sm text-brown-800 placeholder:text-brown-700/35 focus:border-terracotta-500 focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-brown-700/50">
              Any model you’ve pulled — Qwen3 8B is the sweet spot for dinner chat.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={testHome}
              disabled={testState === 'testing'}
              className="rounded-xl border border-sand-300 bg-white px-4 py-2 text-sm font-semibold text-brown-700 hover:bg-cream-100 disabled:opacity-40"
            >
              {testState === 'testing' ? 'Testing…' : 'Test connection'}
            </button>
            {testState === 'ok' && <span className="text-xs font-semibold text-sage-700">✓ {testMsg}</span>}
            {testState === 'fail' && <span className="text-xs text-red-500">{testMsg}</span>}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          className="rounded-xl bg-terracotta-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-terracotta-600"
        >
          {saved ? 'Saved ✓' : 'Save'}
        </button>
        <p className="text-[11px] text-brown-700/50">
          Voice input and spoken replies are always free and on-device.
        </p>
      </div>

      <div className="rounded-2xl bg-sage-100/50 px-4 py-3 text-xs leading-relaxed text-brown-700/70 ring-1 ring-sage-300/40">
        <p className="font-semibold text-brown-800">Coming: Sup Fam inside ChatGPT.</p>
        <p className="mt-0.5">
          Soon you’ll be able to plan dinners by talking to ChatGPT itself — on your own
          ChatGPT subscription. We’ll announce it here when it’s live.
        </p>
      </div>
    </div>
  )
}

function ModeCard({
  active,
  onClick,
  title,
  blurb,
  status,
  statusTone,
}: {
  active: boolean
  onClick: () => void
  title: string
  blurb: string
  status: string
  statusTone: 'good' | 'warn'
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left ring-2 transition-all ${
        active ? 'bg-white ring-terracotta-400 shadow-sm' : 'bg-white/60 ring-sand-200 hover:ring-sand-300'
      }`}
    >
      <span
        className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ring-2 ${
          active ? 'ring-terracotta-500' : 'ring-sand-300'
        }`}
      >
        {active && <span className="h-2.5 w-2.5 rounded-full bg-terracotta-500" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-brown-800">{title}</span>
        <span className="block text-xs text-brown-700/55">{blurb}</span>
      </span>
      <span
        className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
          statusTone === 'good' ? 'bg-sage-100 text-sage-700' : 'bg-sand-100 text-brown-700/60'
        }`}
      >
        {status}
      </span>
    </button>
  )
}

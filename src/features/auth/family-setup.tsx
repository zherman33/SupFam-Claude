import { useState, useRef, useEffect } from 'react'
import { useAuth } from './auth-context'
import { supabase } from '@/lib/supabase'

interface FamilySetupProps {
  onComplete: () => void
}

export function FamilySetup({ onComplete }: FamilySetupProps) {
  const { user } = useAuth()
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose')
  const [familyName, setFamilyName] = useState('')
  const [displayName, setDisplayName] = useState(
    user?.user_metadata?.full_name?.split(' ')[0] ?? ''
  )
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Refs for the invite code letter inputs (6 chars)
  const codeRefs = useRef<(HTMLInputElement | null)[]>([])
  const [codeChars, setCodeChars] = useState(['', '', '', '', '', ''])

  // Sync codeChars → inviteCode
  useEffect(() => {
    setInviteCode(codeChars.join(''))
  }, [codeChars])

  const handleCodeInput = (i: number, val: string) => {
    const char = val.replace(/[^a-zA-Z0-9]/g, '').slice(-1).toUpperCase()
    const next = [...codeChars]
    next[i] = char
    setCodeChars(next)
    if (char && i < 5) codeRefs.current[i + 1]?.focus()
  }

  const handleCodeKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !codeChars[i] && i > 0) {
      codeRefs.current[i - 1]?.focus()
    }
  }

  const handleCodePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6)
    const next = [...codeChars]
    pasted.split('').forEach((c, i) => { if (i < 6) next[i] = c })
    setCodeChars(next)
    const focusIdx = Math.min(pasted.length, 5)
    codeRefs.current[focusIdx]?.focus()
  }

  const createFamily = async () => {
    if (!user || !familyName.trim() || !displayName.trim()) return
    setLoading(true)
    setError('')
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()
    const { data: family, error: familyError } = await supabase
      .from('families')
      .insert({ name: familyName.trim(), invite_code: code })
      .select()
      .single()
    if (familyError || !family) {
      setError("That didn't work — try again?")
      setLoading(false)
      return
    }
    const { error: memberError } = await supabase
      .from('family_members')
      .insert({
        family_id: family.id,
        user_id: user.id,
        display_name: displayName.trim(),
        role: 'admin',
        avatar_color: '#5B8C5A',
      })
    if (memberError) {
      setError("That didn't work — try again?")
      setLoading(false)
      return
    }
    onComplete()
  }

  const joinFamily = async () => {
    if (!user || inviteCode.length < 6 || !displayName.trim()) return
    setLoading(true)
    setError('')
    const { data: family } = await supabase
      .from('families')
      .select('id')
      .eq('invite_code', inviteCode.toUpperCase())
      .maybeSingle()
    if (!family) {
      setError("Couldn't find that code — double-check it?")
      setLoading(false)
      return
    }
    const { error: memberError } = await supabase
      .from('family_members')
      .insert({
        family_id: family.id,
        user_id: user.id,
        display_name: displayName.trim(),
        role: 'member',
        avatar_color: '#5B7FB5',
      })
    if (memberError) {
      setError("That didn't work — try again?")
      setLoading(false)
      return
    }
    onComplete()
  }

  return (
    <div className="flex min-h-svh flex-col bg-cream-100">

      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-14 pb-6">
        <h1 className="font-handwritten text-5xl text-terracotta-500 leading-none">
          {mode === 'choose' && 'Welcome!'}
          {mode === 'create' && 'New family'}
          {mode === 'join'   && 'Join family'}
        </h1>
        <p className="mt-2 font-display text-base text-brown-700/60">
          {mode === 'choose' && "Let's get you set up."}
          {mode === 'create' && "You'll be the admin."}
          {mode === 'join'   && 'Enter the code from your partner.'}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 px-6">

        {/* ── Choose ── */}
        {mode === 'choose' && (
          <div className="space-y-3 pt-2">
            <button
              onClick={() => setMode('create')}
              className="flex w-full items-center gap-4 rounded-2xl bg-white px-5 py-5 text-left shadow-sm ring-1 ring-sand-200/60 active:bg-cream-50 transition-colors"
              style={{ minHeight: 72 }}
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-terracotta-500/10">
                <svg className="h-5 w-5 text-terracotta-500" viewBox="0 0 20 20" fill="none">
                  <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <p className="font-semibold text-brown-800">Start a new family</p>
                <p className="text-sm text-brown-700/50">You'll get an invite code to share</p>
              </div>
              <svg className="ml-auto h-4 w-4 text-brown-700/30" viewBox="0 0 16 16" fill="none">
                <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            <button
              onClick={() => setMode('join')}
              className="flex w-full items-center gap-4 rounded-2xl bg-white px-5 py-5 text-left shadow-sm ring-1 ring-sand-200/60 active:bg-cream-50 transition-colors"
              style={{ minHeight: 72 }}
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
                <svg className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="none">
                  <path d="M13 10H3m0 0l4-4m-4 4l4 4M17 4v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <p className="font-semibold text-brown-800">Join with a code</p>
                <p className="text-sm text-brown-700/50">Your partner already set this up</p>
              </div>
              <svg className="ml-auto h-4 w-4 text-brown-700/30" viewBox="0 0 16 16" fill="none">
                <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        )}

        {/* ── Create ── */}
        {mode === 'create' && (
          <form
            onSubmit={e => { e.preventDefault(); createFamily() }}
            className="space-y-4 pt-2"
          >
            <Field label="Your name">
              <input
                autoFocus
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Zac"
                autoComplete="given-name"
                className={inputClass}
              />
            </Field>
            <Field label="Family name">
              <input
                type="text"
                value={familyName}
                onChange={e => setFamilyName(e.target.value)}
                placeholder="The Hermans"
                autoComplete="off"
                className={inputClass}
              />
            </Field>
            {error && <ErrorMsg msg={error} />}
            <SubmitButton loading={loading} disabled={!familyName.trim() || !displayName.trim()}>
              {loading ? 'Creating…' : 'Create family'}
            </SubmitButton>
          </form>
        )}

        {/* ── Join ── */}
        {mode === 'join' && (
          <form
            onSubmit={e => { e.preventDefault(); joinFamily() }}
            className="space-y-5 pt-2"
          >
            <Field label="Your name">
              <input
                autoFocus
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Alex"
                autoComplete="given-name"
                className={inputClass}
              />
            </Field>

            {/* 6-box invite code entry */}
            <Field label="Invite code">
              <div className="flex gap-2 justify-between" onPaste={handleCodePaste}>
                {codeChars.map((char, i) => (
                  <input
                    key={i}
                    ref={el => { codeRefs.current[i] = el }}
                    type="text"
                    inputMode="text"
                    maxLength={1}
                    value={char}
                    onChange={e => handleCodeInput(i, e.target.value)}
                    onKeyDown={e => handleCodeKeyDown(i, e)}
                    className={`
                      flex-1 h-14 rounded-xl border text-center font-mono text-xl font-bold uppercase
                      text-brown-800 bg-cream-50 border-sand-300
                      focus:border-terracotta-500 focus:ring-1 focus:ring-terracotta-500 focus:outline-none
                      transition-colors
                      ${char ? 'border-terracotta-400 bg-white' : ''}
                    `}
                  />
                ))}
              </div>
              <p className="mt-2 text-xs text-brown-700/40 text-center">
                6-character code from your partner
              </p>
            </Field>

            {error && <ErrorMsg msg={error} />}
            <SubmitButton loading={loading} disabled={inviteCode.length < 6 || !displayName.trim()}>
              {loading ? 'Joining…' : 'Join family'}
            </SubmitButton>
          </form>
        )}
      </div>

      {/* Back button — always at bottom */}
      {mode !== 'choose' && (
        <div className="px-6 pb-12 pt-4 flex-shrink-0">
          <button
            type="button"
            onClick={() => { setMode('choose'); setError('') }}
            className="flex w-full items-center justify-center gap-1.5 text-sm text-brown-700/50 hover:text-brown-700 py-2"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
              <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back
          </button>
        </div>
      )}
    </div>
  )
}

// ── Small helpers ──────────────────────────────────────────────────────────

const inputClass = `
  w-full rounded-xl border border-sand-300 bg-cream-50 px-4 py-3.5 text-base
  text-brown-800 placeholder:text-brown-700/35
  focus:border-terracotta-500 focus:outline-none focus:ring-1 focus:ring-terracotta-500
  transition-colors
`.trim()

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-brown-700">{label}</label>
      {children}
    </div>
  )
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3">
      <svg className="h-4 w-4 flex-shrink-0 text-red-400" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M8 5v3.5M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      <p className="text-sm text-red-600">{msg}</p>
    </div>
  )
}

function SubmitButton({
  loading,
  disabled,
  children,
}: {
  loading: boolean
  disabled: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="w-full rounded-2xl bg-brown-800 py-4 text-base font-semibold text-cream-50 transition-colors active:bg-brown-900 hover:bg-brown-900 disabled:opacity-40 shadow-sm"
      style={{ minHeight: 56 }}
    >
      {children}
    </button>
  )
}

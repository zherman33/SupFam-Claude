import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/auth-context'
import { useFamilyMember } from '@/features/auth/use-family-member'

/**
 * Async support widget — a floating button that opens a simple
 * name/email/message form. Messages go to the `support-chat` Edge
 * Function, which saves a support_tickets row and forwards to
 * support@supfam.app via Resend. No live chat, no bots.
 */
export function SupportWidget() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)

  if (!user) return null

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Contact support"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brown-800 text-cream-50 shadow-lg transition-transform hover:scale-105 active:scale-95"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none">
          <path
            d="M21 12a8 8 0 0 1-8 8H4l2.3-2.9A8 8 0 1 1 21 12Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="9" cy="12" r="1.1" fill="currentColor" />
          <circle cx="13" cy="12" r="1.1" fill="currentColor" />
          <circle cx="17" cy="12" r="1.1" fill="currentColor" />
        </svg>
      </button>

      {open && <SupportDialog onClose={() => setOpen(false)} />}
    </>
  )
}

function SupportDialog({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const { data: member } = useFamilyMember()
  const [name, setName] = useState(
    member?.display_name ?? user?.user_metadata?.full_name ?? ''
  )
  const [email, setEmail] = useState(user?.email ?? '')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  // Member data can arrive after the dialog mounts — sync the prefill then.
  useEffect(() => {
    const prefill = member?.display_name ?? user?.user_metadata?.full_name ?? ''
    if (prefill && !name) setName(prefill)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member?.display_name])

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (sending) return
    setSending(true)
    setError('')
    try {
      // Read from the form itself: browser autofill can fill inputs without
      // firing React onChange, leaving state empty while text is visible.
      const fd = new FormData(e.currentTarget)
      const finalName = ((fd.get('name') as string) || name).trim()
      const finalEmail = ((fd.get('email') as string) || email).trim()
      const finalMessage = ((fd.get('message') as string) || message).trim()
      const { data, error: fnError } = await supabase.functions.invoke('support-chat', {
        body: { name: finalName, email: finalEmail, message: finalMessage },
      })
      if (fnError) throw new Error("Hmm, that didn't go through — try again?")
      if (data?.error) throw new Error(data.error)
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hmm, that didn't go through — try again?")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-brown-900/35 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-sand-200/50">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="font-handwritten text-3xl text-terracotta-500">Need a hand?</h2>
            <p className="mt-1 text-sm text-brown-700/60">
              Send us a note — a real person reads every message.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-xl p-2 text-brown-700/50 hover:bg-sand-100"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none">
              <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {sent ? (
          <div className="py-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <svg className="h-7 w-7 text-green-700" viewBox="0 0 24 24" fill="none">
                <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="mt-4 font-display text-lg text-brown-800">Message sent</p>
            <p className="mt-1 text-sm text-brown-700/60">
              We'll get back to you at {email || 'your email'} soon.
            </p>
            <button
              onClick={onClose}
              className="mt-6 w-full rounded-2xl bg-brown-800 py-3.5 text-base font-semibold text-cream-50 hover:bg-brown-900"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-brown-700">Your name</label>
              <input
                type="text"
                name="name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Alex"
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-brown-700">Email</label>
              <input
                type="email"
                name="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-brown-700">What's up?</label>
              <textarea
                name="message"
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Tell us what's going on…"
                rows={4}
                className={`${inputClass} resize-none`}
              />
            </div>
            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
            )}
            <button
              type="submit"
              disabled={sending || !name.trim() || !email.trim() || message.trim().length < 3}
              className="w-full rounded-2xl bg-brown-800 py-4 text-base font-semibold text-cream-50 transition-colors hover:bg-brown-900 disabled:opacity-40"
              style={{ minHeight: 56 }}
            >
              {sending ? 'Sending…' : 'Send message'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

const inputClass = `
  w-full rounded-xl border border-sand-300 bg-cream-50 px-4 py-3.5 text-base
  text-brown-800 placeholder:text-brown-700/35
  focus:border-terracotta-500 focus:outline-none focus:ring-1 focus:ring-terracotta-500
  transition-colors
`.trim()

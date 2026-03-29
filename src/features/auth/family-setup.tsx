import { useState } from 'react'
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
    user?.user_metadata?.full_name ?? ''
  )
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const createFamily = async () => {
    if (!user || !familyName.trim() || !displayName.trim()) return
    setLoading(true)
    setError('')

    // Generate a short invite code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()

    const { data: family, error: familyError } = await supabase
      .from('families')
      .insert({ name: familyName.trim(), invite_code: code })
      .select()
      .single()

    if (familyError || !family) {
      setError("Hmm, that didn't work — try again?")
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
        avatar_color: '#5B8C5A', // Zac = green
      })

    if (memberError) {
      setError("Hmm, that didn't work — try again?")
      setLoading(false)
      return
    }

    onComplete()
  }

  const joinFamily = async () => {
    if (!user || !inviteCode.trim() || !displayName.trim()) return
    setLoading(true)
    setError('')

    const { data: family } = await supabase
      .from('families')
      .select('id')
      .eq('invite_code', inviteCode.trim().toUpperCase())
      .single()

    if (!family) {
      setError("Couldn't find a family with that code. Double-check it?")
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
        avatar_color: '#5B7FB5', // Partner = blue
      })

    if (memberError) {
      setError("Hmm, that didn't work — try again?")
      setLoading(false)
      return
    }

    onComplete()
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-cream-100">
      <div className="mx-auto w-full max-w-md rounded-xl bg-white p-10 shadow-md">
        <h1 className="font-handwritten text-4xl text-terracotta-500">
          Welcome!
        </h1>

        {mode === 'choose' && (
          <div className="mt-6 space-y-4">
            <p className="text-brown-700">
              Let's get your family set up. Are you starting fresh or joining
              someone?
            </p>
            <button
              onClick={() => setMode('create')}
              className="w-full rounded-lg bg-brown-800 px-4 py-3 text-sm font-medium text-cream-50 transition-colors hover:bg-brown-900"
            >
              Start a new family
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full rounded-lg border border-sand-300 px-4 py-3 text-sm font-medium text-brown-800 transition-colors hover:bg-cream-200"
            >
              Join with an invite code
            </button>
          </div>
        )}

        {mode === 'create' && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              createFamily()
            }}
            className="mt-6 space-y-4"
          >
            <div>
              <label className="mb-1 block text-sm font-medium text-brown-700">
                Your name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Zac"
                className="w-full rounded-lg border border-sand-300 bg-cream-50 px-3 py-2 text-sm text-brown-800 placeholder:text-brown-700/40 focus:border-terracotta-500 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-brown-700">
                Family name
              </label>
              <input
                type="text"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                placeholder="The Johnsons"
                className="w-full rounded-lg border border-sand-300 bg-cream-50 px-3 py-2 text-sm text-brown-800 placeholder:text-brown-700/40 focus:border-terracotta-500 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
              />
            </div>
            {error && <p className="text-sm text-terracotta-600">{error}</p>}
            <button
              type="submit"
              disabled={loading || !familyName.trim() || !displayName.trim()}
              className="w-full rounded-lg bg-brown-800 px-4 py-3 text-sm font-medium text-cream-50 transition-colors hover:bg-brown-900 disabled:opacity-50"
            >
              {loading ? 'Setting up...' : 'Create family'}
            </button>
            <button
              type="button"
              onClick={() => setMode('choose')}
              className="w-full text-sm text-brown-700/60 hover:text-brown-700"
            >
              Back
            </button>
          </form>
        )}

        {mode === 'join' && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              joinFamily()
            }}
            className="mt-6 space-y-4"
          >
            <div>
              <label className="mb-1 block text-sm font-medium text-brown-700">
                Your name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Alex"
                className="w-full rounded-lg border border-sand-300 bg-cream-50 px-3 py-2 text-sm text-brown-800 placeholder:text-brown-700/40 focus:border-terracotta-500 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-brown-700">
                Invite code
              </label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="ABC123"
                className="w-full rounded-lg border border-sand-300 bg-cream-50 px-3 py-2 text-center font-mono text-lg uppercase tracking-widest text-brown-800 placeholder:text-brown-700/40 focus:border-terracotta-500 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
              />
            </div>
            {error && <p className="text-sm text-terracotta-600">{error}</p>}
            <button
              type="submit"
              disabled={loading || !inviteCode.trim() || !displayName.trim()}
              className="w-full rounded-lg bg-brown-800 px-4 py-3 text-sm font-medium text-cream-50 transition-colors hover:bg-brown-900 disabled:opacity-50"
            >
              {loading ? 'Joining...' : 'Join family'}
            </button>
            <button
              type="button"
              onClick={() => setMode('choose')}
              className="w-full text-sm text-brown-700/60 hover:text-brown-700"
            >
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

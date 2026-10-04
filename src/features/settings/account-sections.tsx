import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/auth-context'
import { useFamilyMember, useFamilyMembers } from '@/features/auth/use-family-member'

const AVATAR_COLORS = [
  '#C4704F', // terracotta
  '#5B8C5A', // green
  '#5B7FB5', // blue
  '#8C5B7E', // plum
  '#C4A24F', // gold
  '#7D8C6F', // sage
  '#B55B5B', // brick
  '#4F9D9D', // teal
]

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no ambiguous 0/O/1/I/L

function generateInviteCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return code
}

// ── Mutations ─────────────────────────────────────────────────────────────

function useUpdateProfile() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { data: member } = useFamilyMember()

  return useMutation({
    mutationFn: async (patch: { display_name?: string; avatar_color?: string }) => {
      if (!member) throw new Error('Not signed in')
      const { error } = await supabase
        .from('family_members')
        .update(patch)
        .eq('id', member.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family-member', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['family-members', member?.family_id] })
    },
  })
}

function useRemoveFamilyMember() {
  const queryClient = useQueryClient()
  const { data: member } = useFamilyMember()

  return useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.from('family_members').delete().eq('id', memberId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family-members', member?.family_id] })
    },
  })
}

function useRegenerateInviteCode() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { data: member } = useFamilyMember()

  return useMutation({
    mutationFn: async (): Promise<string> => {
      const familyId = member?.families?.id
      if (!familyId) throw new Error('Not signed in')
      // Try twice in the (very unlikely) event of a code collision.
      let lastError: unknown = null
      for (let attempt = 0; attempt < 2; attempt++) {
        const code = generateInviteCode()
        const { error } = await supabase
          .from('families')
          .update({ invite_code: code })
          .eq('id', familyId)
        if (!error) return code
        lastError = error
      }
      throw lastError instanceof Error ? lastError : new Error('Could not regenerate the code')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family-member', user?.id] })
    },
  })
}

// ── Shared bits ───────────────────────────────────────────────────────────

function SectionCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-sand-200/80 bg-white p-5 shadow-2xs space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-brown-800">{title}</h3>
        {description && <p className="text-xs text-brown-700/60 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  )
}

// ── "You" group ───────────────────────────────────────────────────────────

export function YouSection() {
  const { user, signOut } = useAuth()
  const { data: member } = useFamilyMember()
  const updateProfile = useUpdateProfile()

  const [name, setName] = useState<string | null>(null)
  const [avatarColor, setAvatarColor] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const currentName = name ?? member?.display_name ?? ''
  const currentColor = avatarColor ?? member?.avatar_color ?? AVATAR_COLORS[0]
  const dirty =
    name !== null || avatarColor !== null

  const handleSave = async () => {
    const patch: { display_name?: string; avatar_color?: string } = {}
    if (name !== null && name.trim() && name.trim() !== member?.display_name) {
      patch.display_name = name.trim()
    }
    if (avatarColor !== null && avatarColor !== member?.avatar_color) {
      patch.avatar_color = avatarColor
    }
    if (Object.keys(patch).length === 0) {
      setName(null)
      setAvatarColor(null)
      return
    }
    try {
      await updateProfile.mutateAsync(patch)
      setName(null)
      setAvatarColor(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      // error surfaced below via updateProfile.isError
    }
  }

  const provider = (user?.app_metadata?.provider as string | undefined) ?? 'google'
  const providerLabel =
    provider === 'google' ? 'Google' : provider.charAt(0).toUpperCase() + provider.slice(1)

  return (
    <div className="space-y-6">
      <SectionCard
        title="Profile"
        description="This is how the rest of the family sees you across the dashboard."
      >
        <div className="flex items-center gap-4">
          <div
            className="h-14 w-14 rounded-full ring-2 ring-sand-200 shadow-xs flex-shrink-0"
            style={{ backgroundColor: currentColor }}
          />
          <div className="flex-1 min-w-0">
            <label className="text-xs font-semibold text-brown-700 block mb-1">Display name</label>
            <input
              type="text"
              value={currentName}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-xl border border-sand-300 bg-cream-50/50 px-3.5 py-2 text-sm text-brown-800 placeholder:text-brown-700/35 focus:border-terracotta-500 focus:outline-none focus:ring-1 focus:ring-terracotta-500 transition-colors"
            />
          </div>
        </div>

        <div>
          <span className="text-xs font-semibold text-brown-700 block mb-2">Avatar color</span>
          <div className="flex flex-wrap items-center gap-2">
            {AVATAR_COLORS.map(c => {
              const selected = currentColor.toLowerCase() === c.toLowerCase()
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setAvatarColor(c)}
                  title={c}
                  aria-label={`Avatar color ${c}`}
                  className={`h-8 w-8 rounded-full transition-all ${
                    selected
                      ? 'ring-2 ring-brown-800 ring-offset-2 ring-offset-white scale-105'
                      : 'hover:scale-110 opacity-90 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                />
              )
            })}
          </div>
        </div>

        {updateProfile.isError && (
          <p className="text-xs text-red-600">Hmm, that didn&apos;t save — try again?</p>
        )}
        {saved && !updateProfile.isError && (
          <p className="text-xs font-medium text-green-700">Saved ✓</p>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || updateProfile.isPending || !currentName.trim()}
            className="rounded-xl bg-brown-800 px-5 py-2 text-xs font-semibold text-cream-50 hover:bg-brown-900 transition-colors disabled:opacity-40 shadow-2xs"
          >
            {updateProfile.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Sign-in & email">
        <div className="flex items-center justify-between rounded-xl border border-sand-200/60 bg-cream-50/40 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-brown-800 truncate">{user?.email ?? '—'}</p>
            <p className="text-xs text-brown-700/50 mt-0.5">Signed in with {providerLabel}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Sign out">
        <p className="text-xs text-brown-700/60 -mt-2">
          You&apos;ll stay signed in on the family&apos;s other devices.
        </p>
        <button
          type="button"
          onClick={async () => {
            setSigningOut(true)
            await signOut()
          }}
          disabled={signingOut}
          className="w-full rounded-xl border border-sand-300 bg-white px-4 py-2.5 text-sm font-semibold text-brown-700 hover:bg-cream-50 transition-colors disabled:opacity-40"
        >
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </SectionCard>
    </div>
  )
}

// ── "Family" group ────────────────────────────────────────────────────────

export function FamilySection() {
  const { data: member } = useFamilyMember()
  const { data: members } = useFamilyMembers()
  const removeMember = useRemoveFamilyMember()
  const regenerate = useRegenerateInviteCode()

  const [copied, setCopied] = useState(false)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)
  const [confirmRegen, setConfirmRegen] = useState(false)

  const isAdmin = member?.role === 'admin'
  const inviteCode = member?.families?.invite_code
  const familyName = member?.families?.name ?? 'Your family'

  const copy = async () => {
    if (!inviteCode) return
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable — code is visible */
    }
  }

  const handleRegenerate = async () => {
    setConfirmRegen(false)
    try {
      await regenerate.mutateAsync()
    } catch {
      /* error surfaced via regenerate.isError */
    }
  }

  const handleRemove = async (id: string) => {
    setConfirmRemoveId(null)
    try {
      await removeMember.mutateAsync(id)
    } catch {
      /* error surfaced via removeMember.isError */
    }
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Members"
        description={`${familyName} · ${members?.length ?? 0} ${(members?.length ?? 0) === 1 ? 'person' : 'people'}`}
      >
        <div className="space-y-2">
          {members?.map(m => {
            const isSelf = m.id === member?.id
            const confirming = confirmRemoveId === m.id
            return (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-xl border border-sand-200/60 bg-cream-50/40 px-3.5 py-2.5"
              >
                <div
                  className="h-8 w-8 rounded-full flex-shrink-0 ring-1 ring-sand-200"
                  style={{ backgroundColor: m.avatar_color ?? '#5B8C5A' }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-brown-800 truncate">
                    {m.display_name}
                    {isSelf && (
                      <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider text-terracotta-600">
                        You
                      </span>
                    )}
                  </p>
                </div>
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    m.role === 'admin'
                      ? 'bg-terracotta-100 text-terracotta-700'
                      : 'bg-sand-100 text-brown-700/60'
                  }`}
                >
                  {m.role === 'admin' ? 'Admin' : 'Member'}
                </span>
                {isAdmin && !isSelf && (
                  confirming ? (
                    <span className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleRemove(m.id)}
                        disabled={removeMember.isPending}
                        className="rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-red-700 transition-colors disabled:opacity-40"
                      >
                        Remove?
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmRemoveId(null)}
                        className="rounded-lg px-2 py-1 text-[11px] font-semibold text-brown-700/60 hover:text-brown-800"
                      >
                        Keep
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmRemoveId(m.id)}
                      title={`Remove ${m.display_name} from the family`}
                      className="rounded-lg p-1.5 text-brown-700/40 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                        <path
                          d="M3 4h10M6 4V3h4v1M5 4l.5 9h5l.5-9"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  )
                )}
              </div>
            )
          })}
        </div>
        {removeMember.isError && (
          <p className="text-xs text-red-600">Hmm, that didn&apos;t work — try again?</p>
        )}
        {!isAdmin && (
          <p className="text-xs text-brown-700/50">
            Only the family admin can remove members or regenerate the invite code.
          </p>
        )}
      </SectionCard>

      <SectionCard
        title="Invite code"
        description="Share this code so family members can join from their own device."
      >
        {inviteCode ? (
          <div className="flex items-center gap-2 rounded-xl border border-sand-200 bg-cream-50 px-4 py-3">
            <span className="flex-1 font-mono text-lg font-bold tracking-[0.25em] text-brown-800">
              {inviteCode}
            </span>
            <button
              type="button"
              onClick={copy}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-terracotta-600 hover:bg-terracotta-50 transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        ) : (
          <p className="text-sm text-brown-700/50">No invite code yet.</p>
        )}

        {isAdmin && (
          <div>
            {confirmRegen ? (
              <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                <p className="flex-1 text-xs text-amber-900">
                  The old code will stop working immediately.
                </p>
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={regenerate.isPending}
                  className="rounded-lg bg-brown-800 px-3 py-1.5 text-xs font-semibold text-cream-50 hover:bg-brown-900 disabled:opacity-40"
                >
                  {regenerate.isPending ? 'Working…' : 'Yes, new code'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRegen(false)}
                  className="rounded-lg px-2 py-1.5 text-xs font-semibold text-brown-700/60 hover:text-brown-800"
                >
                  Keep old
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmRegen(true)}
                className="text-xs font-semibold text-brown-700/60 hover:text-brown-800 transition-colors"
              >
                Regenerate code
              </button>
            )}
          </div>
        )}
        {regenerate.isError && (
          <p className="text-xs text-red-600">Hmm, that didn&apos;t work — try again?</p>
        )}
      </SectionCard>
    </div>
  )
}

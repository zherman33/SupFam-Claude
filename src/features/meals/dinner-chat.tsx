import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { useFamilyMember } from '@/features/auth/use-family-member'
import { useMealPlan, useEnsureMealPlan, useSaveMeal } from './use-meals'
import { useMealHistory, useMealRatings, useFoodPrefs, useRecommendations } from './use-dinner-data'
import { buildDinnerSystemPrompt, type Proposal } from './dinner-context'
import { sendDinnerChat, AiError } from './ai-client'
import { listenOnce, speak, stopSpeaking, micSupported, type Listener } from './voice'
import { DAY_NAMES_FULL, dateForDay } from './types'

interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  text: string
  proposals?: Proposal[]
}

interface DinnerChatProps {
  scope: 'day' | 'week'
  weekStart: string
  dayIndex?: number
  /** Start listening automatically (tap-a-day flow). */
  autoListen?: boolean
  onClose: () => void
}

let msgId = 1

export function DinnerChat({ scope, weekStart, dayIndex, autoListen, onClose }: DinnerChatProps) {
  const { data: member } = useFamilyMember()
  const { data: history } = useMealHistory()
  const { data: ratings } = useMealRatings()
  const { data: prefs } = useFoodPrefs()
  const { data: planData } = useMealPlan(weekStart)
  const ensurePlan = useEnsureMealPlan()
  const saveMeal = useSaveMeal()

  const plannedTitles = useMemo(() => (planData?.meals ?? []).map((m) => m.title), [planData])
  const { recommendations, hasHistory } = useRecommendations(weekStart, plannedTitles)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [thinking, setThinking] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [voiceOn, setVoiceOn] = useState(() => !!autoListen && micSupported())
  const [assigned, setAssigned] = useState<Proposal[]>([])

  const messagesRef = useRef<ChatMessage[]>([])
  const voiceOnRef = useRef(voiceOn)
  const busyRef = useRef(false)
  const listenerRef = useRef<Listener | null>(null)
  const convoIdRef = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const openedAtRef = useRef(false)

  voiceOnRef.current = voiceOn
  messagesRef.current = messages

  const system = useMemo(() => {
    if (!history || !prefs) return null
    return buildDinnerSystemPrompt({
      scope,
      weekStart,
      dayIndex,
      recommendations,
      history,
      ratings: ratings ?? [],
      prefs,
      plannedMeals: (planData?.meals ?? []).map((m) => ({ dayIndex: m.day_index, title: m.title })),
      memberName: member?.display_name ?? undefined,
    })
  }, [scope, weekStart, dayIndex, recommendations, history, ratings, prefs, planData, member])

  const title = scope === 'day' && dayIndex != null
    ? `${DAY_NAMES_FULL[dayIndex]} dinner`
    : 'Plan the week'
  const subtitle = scope === 'day' && dayIndex != null
    ? format(dateForDay(weekStart, dayIndex), 'MMMM d')
    : `${format(dateForDay(weekStart, 0), 'MMM d')} – ${format(dateForDay(weekStart, 6), 'MMM d')}`

  // Opening message: deterministic, works with no AI connected.
  const openingText = useMemo(() => {
    if (!history) return null
    if (scope === 'day' && dayIndex != null) {
      const day = DAY_NAMES_FULL[dayIndex]
      if (recommendations.length > 0) {
        const lines = recommendations.map((r, i) => `${i + 1}. ${r.title} — ${r.reason}`).join('\n')
        return `For ${day} I've got three ideas from your history:\n${lines}\n\nTap one to put it on the board — or tell me what you're craving and we'll go from there.`
      }
      return `Let's figure out ${day} dinner — what are you in the mood for?`
    }
    const empty = [0, 1, 2, 3, 4, 5, 6].filter(
      (d) => !(planData?.meals ?? []).some((m) => m.day_index === d)
    )
    if (empty.length === 0) return `This week is fully planned — nice. Want to swap anything out?`
    const names = empty.map((d) => DAY_NAMES_FULL[d]).join(', ')
    return `Let's plan the week. Still open: ${names}.\n\nWant me to fill them from your favorites and history, or talk through them one by one?`
  }, [history, scope, dayIndex, recommendations, planData])

  // Create the persisted conversation row once.
  useEffect(() => {
    if (openedAtRef.current || !member) return
    openedAtRef.current = true
    supabase
      .from('dinner_conversations')
      .insert({
        family_id: member.family_id,
        family_member_id: member.id,
        scope,
        week_start: weekStart,
        day_index: scope === 'day' ? dayIndex ?? null : null,
        status: 'open',
        messages: [],
      })
      .select('id')
      .single()
      .then(({ data }) => {
        if (data) convoIdRef.current = data.id
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member])

  // Seed the opening message once data is ready. In the tap-a-day voice flow,
  // speak the opening recommendations first, then open the mic.
  useEffect(() => {
    if (!openingText || messagesRef.current.length > 0) return
    const m = { id: msgId++, role: 'assistant' as const, text: openingText }
    messagesRef.current = [m]
    setMessages([m])
    if (autoListen && voiceOnRef.current && micSupported()) {
      busyRef.current = true
      speak(openingText, () => {
        busyRef.current = false
        if (voiceOnRef.current) startListeningRef.current()
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openingText])

  // Auto-scroll to the latest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, interim, thinking])

  // Persist messages on unmount.
  useEffect(() => {
    return () => {
      stopSpeaking()
      listenerRef.current?.stop()
      const id = convoIdRef.current
      const msgs = messagesRef.current
      if (id && msgs.length > 0) {
        supabase
          .from('dinner_conversations')
          .update({
            messages: msgs.map((m) => ({ role: m.role, text: m.text, ts: Date.now() })),
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .then(() => {})
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addMessage = useCallback((role: 'user' | 'assistant', text: string, proposals?: Proposal[]) => {
    const m: ChatMessage = { id: msgId++, role, text, proposals }
    messagesRef.current = [...messagesRef.current, m]
    setMessages(messagesRef.current)
  }, [])

  const stopListening = useCallback(() => {
    listenerRef.current?.stop()
    listenerRef.current = null
    setListening(false)
    setInterim('')
  }, [])

  const handleUserText = useCallback(
    async (text: string) => {
      const clean = text.trim()
      if (!clean || busyRef.current) return
      busyRef.current = true
      stopSpeaking()
      stopListening()
      setNotice(null)
      addMessage('user', clean)
      setThinking(true)
      try {
        if (!system) throw new AiError('model_error', "Give me a moment — still loading your history…")
        const turns = messagesRef.current.map((m) => ({ role: m.role, content: m.text }))
        const result = await sendDinnerChat(system, turns)
        addMessage('assistant', result.text, result.proposals.length > 0 ? result.proposals : undefined)
        if (voiceOnRef.current) {
          speak(result.text, () => {
            busyRef.current = false
            if (voiceOnRef.current) startListeningRef.current()
          })
        } else {
          busyRef.current = false
        }
      } catch (e) {
        const msg =
          e instanceof AiError
            ? e.message
            : "Hmm, that didn't go through — try again?"
        addMessage('assistant', msg)
        setNotice(e instanceof AiError && e.code === 'not_configured' ? 'not_configured' : null)
        busyRef.current = false
      } finally {
        setThinking(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [system, addMessage, stopListening]
  )

  const startListening = useCallback(() => {
    if (!micSupported() || busyRef.current || !voiceOnRef.current) return
    setNotice(null)
    setInterim('')
    setListening(true)
    listenerRef.current = listenOnce({
      onInterim: (t) => setInterim(t),
      onFinal: (t) => {
        setListening(false)
        setInterim('')
        handleUserText(t)
      },
      onError: (msg) => {
        setListening(false)
        setInterim('')
        setNotice(msg)
      },
    })
  }, [handleUserText])

  const startListeningRef = useRef(startListening)
  startListeningRef.current = startListening

  // Fallback: if voice was requested but the opening message never seeded
  // (e.g. history failed to load), still open the mic shortly after mount.
  useEffect(() => {
    if (!autoListen || !micSupported()) return
    const t = setTimeout(() => {
      if (voiceOnRef.current && !busyRef.current && messagesRef.current.length === 0) {
        startListeningRef.current()
      }
    }, 2500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleVoice = () => {
    if (voiceOn) {
      setVoiceOn(false)
      stopListening()
      stopSpeaking()
      busyRef.current = false
    } else {
      if (!micSupported()) {
        setNotice("This browser doesn't do voice input — type instead?")
        return
      }
      setVoiceOn(true)
      setTimeout(() => startListeningRef.current(), 100)
    }
  }

  const acceptProposal = async (p: Proposal) => {
    try {
      const plan = await ensurePlan.mutateAsync(weekStart)
      await saveMeal.mutateAsync({
        planId: plan.id,
        dayIndex: p.dayIndex,
        title: p.title,
        servings: p.servings,
        notes: p.notes ?? null,
        ingredients: [],
      })
      setAssigned((prev) => [...prev, p])
      // Remove the accepted proposal from its message
      setMessages((prev) =>
        prev.map((m) =>
          m.proposals
            ? { ...m, proposals: m.proposals.filter((x) => x !== p) }
            : m
        )
      )
      messagesRef.current = messagesRef.current.map((m) =>
        m.proposals ? { ...m, proposals: m.proposals.filter((x) => x !== p) } : m
      )
      const confirm = `${p.title} is on the board for ${DAY_NAMES_FULL[p.dayIndex]}.`
      addMessage('assistant', scope === 'week' ? `${confirm} What else?` : confirm)
      if (voiceOnRef.current) speak(confirm)
    } catch {
      setNotice("Hmm, that didn't save — try again?")
    }
  }

  const quickAssign = async (dishTitle: string) => {
    if (scope !== 'day' || dayIndex == null) return
    await acceptProposal({ dayIndex, title: dishTitle, servings: prefs?.default_servings ?? 4 })
  }

  const handleSubmit = () => {
    if (input.trim()) {
      handleUserText(input)
      setInput('')
    }
  }

  const showRecCards =
    scope === 'day' && dayIndex != null && recommendations.length > 0 && hasHistory

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-brown-900/40 sm:items-center sm:p-6">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative flex max-h-[92%] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-cream-100 shadow-2xl sm:rounded-3xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-sand-200 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl text-brown-800">{title}</h2>
            <p className="text-xs text-brown-700/50">{subtitle}</p>
          </div>
          <button
            onClick={toggleVoice}
            aria-label={voiceOn ? 'Turn voice off' : 'Turn voice on'}
            className={`flex h-11 min-w-[11rem] items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors ${
              voiceOn
                ? 'bg-terracotta-500 text-white'
                : 'border border-sand-300 bg-white text-brown-700'
            }`}
          >
            <span aria-hidden>{voiceOn ? '🎙' : '🔇'}</span>
            {voiceOn ? 'Voice on' : 'Voice off'}
          </button>
          <button
            onClick={onClose}
            aria-label="Close conversation"
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-brown-700/50 hover:bg-sand-100"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none">
              <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {messages.map((m) => (
            <div key={m.id}>
              <div
                className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'ml-auto bg-terracotta-500 text-white'
                    : 'bg-white text-brown-800 shadow-sm ring-1 ring-sand-200/60'
                }`}
              >
                {m.text}
              </div>
              {m.proposals && m.proposals.length > 0 && (
                <div className="mt-2 space-y-2">
                  {m.proposals.map((p, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-2xl bg-sage-100/60 px-4 py-3 ring-1 ring-sage-300/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-base text-brown-800">{p.title}</p>
                        <p className="text-xs text-brown-700/50">
                          {DAY_NAMES_FULL[p.dayIndex]} · {p.servings} servings
                        </p>
                      </div>
                      <button
                        onClick={() => acceptProposal(p)}
                        disabled={ensurePlan.isPending || saveMeal.isPending}
                        className="flex-shrink-0 rounded-xl bg-terracotta-500 px-4 py-2 text-sm font-semibold text-white hover:bg-terracotta-600 disabled:opacity-40"
                      >
                        Put it on the board
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Tappable recommendation cards (day scope) */}
          {showRecCards && messages.length <= 1 && (
            <div className="space-y-2 pt-1">
              {recommendations.map((r) => (
                <button
                  key={r.title}
                  onClick={() => quickAssign(r.title)}
                  disabled={ensurePlan.isPending || saveMeal.isPending}
                  className="flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left shadow-sm ring-1 ring-sand-200/60 transition-all hover:shadow-md disabled:opacity-40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-base text-brown-800">{r.title}</p>
                    <p className="text-xs text-brown-700/50">{r.reason}</p>
                  </div>
                  <span className="flex-shrink-0 rounded-full bg-terracotta-100 px-3 py-1.5 text-xs font-bold text-terracotta-600">
                    + {scope === 'day' && dayIndex != null ? DAY_NAMES_FULL[dayIndex].slice(0, 3) : ''}
                  </span>
                </button>
              ))}
            </div>
          )}

          {thinking && (
            <div className="flex items-center gap-2 text-sm text-brown-700/50">
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-terracotta-400" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-terracotta-400 [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-terracotta-400 [animation-delay:300ms]" />
              </span>
              thinking…
            </div>
          )}
          {listening && (
            <div className="rounded-2xl bg-terracotta-100/70 px-4 py-3 ring-1 ring-terracotta-300/50">
              <p className="text-xs font-bold uppercase tracking-widest text-terracotta-600">
                listening…
              </p>
              <p className="mt-1 text-sm text-brown-800">{interim || '…'}</p>
            </div>
          )}
          {notice && notice !== 'not_configured' && (
            <p className="rounded-xl bg-sand-100 px-4 py-2.5 text-sm text-brown-700">{notice}</p>
          )}
          {notice === 'not_configured' && (
            <div className="rounded-2xl bg-sand-100 px-4 py-3 text-sm text-brown-700">
              <p className="font-semibold text-brown-800">The chat brain isn't connected yet.</p>
              <p className="mt-1">
                Your 3 recommendations above still work — tap one to plan it. To unlock the
                full conversation, add a free API key or point the app at your home AI server
                in Settings.
              </p>
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="border-t border-sand-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            {micSupported() && (
              <button
                onClick={() => (listening ? stopListening() : toggleVoice())}
                aria-label={listening ? 'Stop listening' : 'Start talking'}
                className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-xl transition-colors ${
                  listening
                    ? 'animate-pulse bg-red-500 text-white'
                    : 'bg-terracotta-100 text-terracotta-600 hover:bg-terracotta-200'
                }`}
              >
                {listening ? '⏹' : '🎙'}
              </button>
            )}
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit()
              }}
              placeholder={voiceOn ? 'Talk or type…' : 'Type what you’re thinking…'}
              className="min-w-0 flex-1 rounded-xl border border-sand-300 bg-cream-100 px-3.5 py-3 text-sm text-brown-800 placeholder:text-brown-700/35 focus:border-terracotta-500 focus:outline-none"
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || thinking}
              aria-label="Send"
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-terracotta-500 text-white disabled:opacity-40"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none">
                <path d="M3 10l14-6-6 14-2.5-5.5L3 10z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          {assigned.length > 0 && (
            <p className="mt-2 text-center text-xs text-sage-700">
              {assigned.length} dinner{assigned.length === 1 ? '' : 's'} put on the board ✓
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

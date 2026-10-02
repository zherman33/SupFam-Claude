/**
 * Browser voice I/O for dinner conversations. Both are free and on-device:
 * the Web Speech API for mic input, speechSynthesis for spoken replies.
 */

type RecCtor = new () => SpeechRecognitionLike

interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>
  resultIndex: number
}

declare global {
  interface Window {
    SpeechRecognition?: RecCtor
    webkitSpeechRecognition?: RecCtor
  }
}

export function micSupported(): boolean {
  return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)
}

export function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export interface Listener {
  stop: () => void
}

/**
 * Start one listening pass. Calls onFinal once with the transcript when the
 * speaker pauses; onInterim streams partial text for the UI.
 */
export function listenOnce(opts: {
  onInterim: (text: string) => void
  onFinal: (text: string) => void
  onError: (message: string) => void
}): Listener {
  const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition
  if (!Ctor) {
    opts.onError("This browser doesn't do voice input — type instead?")
    return { stop: () => {} }
  }
  const rec = new Ctor()
  rec.lang = 'en-US'
  rec.interimResults = true
  rec.maxAlternatives = 1

  let settled = false
  rec.onresult = (e) => {
    let interim = ''
    let final = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i]
      if (r.isFinal) final += r[0].transcript
      else interim += r[0].transcript
    }
    if (interim) opts.onInterim(interim)
    if (final.trim() && !settled) {
      settled = true
      opts.onFinal(final.trim())
      try { rec.stop() } catch { /* already stopped */ }
    }
  }
  rec.onerror = (e) => {
    if (settled) return
    settled = true
    const friendly =
      e.error === 'not-allowed' || e.error === 'service-not-allowed'
        ? 'The mic is blocked — allow microphone access and try again?'
        : e.error === 'no-speech'
          ? "I didn't catch that — try again?"
          : 'Voice input hiccuped — try again?'
    opts.onError(friendly)
  }
  rec.onend = () => {
    // Natural pause without a final result: just end quietly.
  }
  try {
    rec.start()
  } catch {
    opts.onError('Voice input hiccuped — try again?')
    return { stop: () => {} }
  }
  return {
    stop: () => {
      try { rec.abort() } catch { /* noop */ }
    },
  }
}

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return null
  // Prefer a natural en-US voice; fall back to the default.
  return (
    voices.find((v) => v.lang.startsWith('en-US') && /natural|neural|samantha|aria|jenny/i.test(v.name)) ??
    voices.find((v) => v.lang.startsWith('en')) ??
    voices[0]
  )
}

let speechGen = 0

/** Speak a reply aloud. Strips anything that isn't speakable prose. */
export function speak(text: string, onend?: () => void) {
  if (!ttsSupported()) {
    onend?.()
    return
  }
  const gen = ++speechGen
  const done = () => {
    if (gen === speechGen) onend?.()
  }
  window.speechSynthesis.cancel()
  const clean = text.replace(/[*_#>`]/g, '').replace(/\s+/g, ' ').trim()
  if (!clean) {
    done()
    return
  }
  const utter = new SpeechSynthesisUtterance(clean)
  utter.rate = 1
  utter.pitch = 1
  const voice = pickVoice()
  if (voice) utter.voice = voice
  utter.onend = done
  utter.onerror = done
  window.speechSynthesis.speak(utter)
}

export function stopSpeaking() {
  // Invalidate any pending onend callback — cancel() doesn't reliably fire it.
  speechGen++
  if (ttsSupported()) window.speechSynthesis.cancel()
}

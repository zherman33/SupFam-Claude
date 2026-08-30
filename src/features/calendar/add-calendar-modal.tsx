import { useState } from 'react'
import { useAddIcsCalendar, useSyncCalendars } from './use-calendar'

interface AddCalendarModalProps {
  onClose: () => void
}

const PRESET_COLORS = [
  { label: 'Outlook Blue', value: '#0078D4' },
  { label: 'Terracotta', value: '#C4714F' },
  { label: 'Warm Sand', value: '#E6DFD5' },
  { label: 'Muted Sage', value: '#8A9A86' },
  { label: 'Zac Green', value: '#5B8C5A' },
  { label: 'Partner Blue', value: '#4A90E2' },
  { label: 'Child Purple', value: '#9B59B6' },
  { label: 'Rose Gold', value: '#D4A373' },
]

export function AddCalendarModal({ onClose }: AddCalendarModalProps) {
  const addCalendar = useAddIcsCalendar()
  const syncCalendars = useSyncCalendars()

  const [provider, setProvider] = useState<'outlook' | 'ical'>('outlook')
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [color, setColor] = useState('#0078D4')
  const [errorMsg, setErrorMsg] = useState('')

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!name.trim()) {
      setErrorMsg('Please enter a calendar name')
      return
    }

    if (!url.trim()) {
      setErrorMsg('Please enter the ICS URL')
      return
    }

    let cleanUrl = url.trim()
    // Convert webcal:// to https://
    if (cleanUrl.startsWith('webcal://')) {
      cleanUrl = 'https://' + cleanUrl.slice(9)
    }

    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      setErrorMsg('Invalid URL. It should start with https://')
      return
    }

    try {
      await addCalendar.mutateAsync({
        name: name.trim(),
        url: cleanUrl,
        color,
        provider,
      })
      
      // Auto-trigger sync
      syncCalendars.mutate()
      onClose()
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || 'Hmm, that didn\'t work — try again?')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-brown-900/35 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-sand-200/50 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-sand-100">
          <div>
            <h3 className="text-lg font-bold text-brown-800 font-serif">Add Calendar</h3>
            <p className="text-xs text-brown-700/50">Add a shared or work calendar via a subscription link</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-brown-700/40 hover:bg-sand-100 hover:text-brown-700 transition-colors"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none">
              <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleAdd} className="flex-1 overflow-y-auto pr-1 space-y-4">
          {/* Tabs */}
          <div className="flex rounded-xl bg-cream-100 p-1">
            <button
              type="button"
              onClick={() => {
                setProvider('outlook')
                setColor('#0078D4')
              }}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                provider === 'outlook'
                  ? 'bg-white text-brown-800 shadow-sm'
                  : 'text-brown-700/60 hover:text-brown-800'
              }`}
            >
              Outlook Calendar
            </button>
            <button
              type="button"
              onClick={() => {
                setProvider('ical')
                setColor('#C4714F')
              }}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                provider === 'ical'
                  ? 'bg-white text-brown-800 shadow-sm'
                  : 'text-brown-700/60 hover:text-brown-800'
              }`}
            >
              Other iCal Feed (iCloud/Google)
            </button>
          </div>

          {/* Guide Box */}
          <div className="rounded-xl border border-sand-200 bg-cream-50 p-3.5 text-xs text-brown-700 space-y-2">
            <p className="font-semibold text-brown-800">
              {provider === 'outlook' ? 'How to publish your Outlook calendar link:' : 'How to get your public calendar link:'}
            </p>
            {provider === 'outlook' ? (
              <ol className="list-decimal pl-4 space-y-1 text-[11px] text-brown-700/80">
                <li>Go to Outlook Web → <b>Settings (Gear icon)</b>.</li>
                <li>Navigate to <b>Calendar</b> → <b>Shared Calendars</b>.</li>
                <li>Under "Publish a calendar", choose your calendar and select <b>"Can view all details"</b>.</li>
                <li>Click <b>Publish</b>, then copy the <b>ICS link</b> (the one ending in .ics).</li>
              </ol>
            ) : (
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-brown-700/80">
                <li><b>iCloud:</b> Share calendar → check "Public Calendar" → copy link. Change prefix to <code className="bg-sand-200 px-1 rounded">https://</code>.</li>
                <li><b>Google:</b> Calendar settings → Integrate calendar → copy "Secret address in iCal format".</li>
              </ul>
            )}
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="rounded-lg bg-red-50 border border-red-200/50 p-2.5 text-xs text-red-600">
              {errorMsg}
            </div>
          )}

          {/* Calendar Name */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-brown-700">Calendar Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={provider === 'outlook' ? 'e.g. Work Outlook' : 'e.g. Kids School Schedule'}
              className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-sm text-brown-800 placeholder:text-brown-700/35 focus:border-terracotta-500 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
            />
          </div>

          {/* Calendar URL */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-brown-700">ICS Link URL</label>
            <input
              type="text"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://outlook.office365.com/owa/calendar/.../reachcalendar.ics"
              className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-sm text-brown-800 placeholder:text-brown-700/35 focus:border-terracotta-500 focus:outline-none focus:ring-1 focus:ring-terracotta-500 font-mono text-xs"
            />
          </div>

          {/* Colors */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-brown-700">Color Label</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  title={c.label}
                  className="h-7 w-7 rounded-lg transition-transform hover:scale-110 flex items-center justify-center border border-black/5"
                  style={{ backgroundColor: c.value }}
                >
                  {color === c.value && (
                    <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M2 7l3.5 3.5 6.5-7"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="pt-2 flex gap-3">
            <button
              type="submit"
              disabled={addCalendar.isPending}
              className="flex-1 rounded-lg bg-terracotta-500 py-2.5 text-sm font-semibold text-white hover:bg-terracotta-600 transition-colors disabled:opacity-50"
            >
              {addCalendar.isPending ? 'Adding…' : 'Add & Sync Calendar'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-sand-300 bg-white px-4 py-2.5 text-sm font-semibold text-brown-700 hover:bg-cream-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

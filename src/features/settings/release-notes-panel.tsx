import { useState } from 'react'
import { createPortal } from 'react-dom'
import { RELEASE_NOTES, type ReleaseNote } from '@/lib/release-notes'

interface ReleaseGroup {
  /** Calendar date — one card per date, no matter how many entries share it. */
  key: string
  version: string
  date: string
  headline: string
  notes: string[]
}

function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/i, '').split('.').map(Number)
  const pb = b.replace(/^v/i, '').split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

// Merge entries that share a calendar date into a single release.
// The pill shows the highest version of the day; the headline comes
// from the newest entry (first seen, since notes are newest → oldest).
function groupByDate(notes: ReleaseNote[]): ReleaseGroup[] {
  const groups: ReleaseGroup[] = []
  for (const n of notes) {
    const g = groups.find((x) => x.key === n.date)
    if (!g) {
      groups.push({
        key: n.date,
        version: n.version,
        date: n.date,
        headline: n.headline,
        notes: [...n.notes],
      })
    } else {
      if (compareVersions(n.version, g.version) > 0) {
        g.version = n.version
      }
      for (const note of n.notes) {
        if (!g.notes.includes(note)) g.notes.push(note)
      }
    }
  }
  return groups
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 flex-shrink-0 text-brown-700/40 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ReleaseNotesPanel({ onClose }: { onClose: () => void }) {
  const groups = groupByDate(RELEASE_NOTES)
  const [openKey, setOpenKey] = useState<string | null>(groups[0]?.key ?? null)

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-brown-950/40"
        onClick={onClose}
      />

      {/* Card */}
      <div className="relative z-10 flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-3xl bg-cream-50 shadow-2xl sm:max-w-lg sm:rounded-3xl">
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-sand-200 bg-white px-5 py-4">
          <div>
            <h2 className="font-body text-lg font-bold text-brown-800">
              What&apos;s new
            </h2>
            <p className="text-xs text-brown-700/50">
              One release per day, newest first — tap one for details
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close release notes"
            className="flex h-8 w-8 items-center justify-center rounded-full text-brown-700/50 hover:bg-sand-100 hover:text-brown-800 active:bg-sand-200 transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Releases — newest first */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3">
            {groups.map((release, idx) => {
              const open = openKey === release.key
              return (
                <section
                  key={release.key}
                  className="overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm"
                >
                  <button
                    onClick={() => setOpenKey(open ? null : release.key)}
                    aria-expanded={open}
                    className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-cream-50 active:bg-sand-100"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-terracotta-100 px-2.5 py-0.5 font-mono text-[11px] font-bold text-terracotta-600">
                          {release.version}
                        </span>
                        <span className="text-xs font-medium text-brown-700/40">
                          {release.date}
                        </span>
                        {idx === 0 && (
                          <span className="rounded-full bg-terracotta-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cream-50">
                            Latest
                          </span>
                        )}
                      </div>
                      <p className="font-display text-[17px] leading-snug text-brown-800">
                        {release.headline}
                      </p>
                    </div>
                    <span className="mt-1">
                      <Chevron open={open} />
                    </span>
                  </button>
                  {open && (
                    <div className="border-t border-sand-100 px-4 pb-4 pt-3">
                      <ul className="flex flex-col gap-1.5">
                        {release.notes.map((note, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm leading-relaxed text-brown-700"
                          >
                            <span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-terracotta-400" />
                            <span>{note}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

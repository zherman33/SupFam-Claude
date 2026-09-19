import { createPortal } from 'react-dom'
import { RELEASE_NOTES } from '@/lib/release-notes'

export function ReleaseNotesPanel({ onClose }: { onClose: () => void }) {
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
              Every Sup Fam update, newest first
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

        {/* Notes — newest first */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-6">
            {RELEASE_NOTES.map((release) => (
              <section key={release.version}>
                <div className="mb-2 flex items-baseline gap-2">
                  <span className="rounded-full bg-terracotta-100 px-2.5 py-0.5 font-mono text-[11px] font-bold text-terracotta-600">
                    {release.version}
                  </span>
                  <span className="text-xs font-medium text-brown-700/40">
                    {release.date}
                  </span>
                </div>
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
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

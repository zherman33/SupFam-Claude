import { useState } from 'react'
import { format } from 'date-fns'
import { useNotes, useCreateNote, useUpdateNote, useDeleteNote, type Note } from './use-notes'

export function NotesPanel() {
  const { data: notes, isLoading } = useNotes()
  const createNote = useCreateNote()
  const [activeNote, setActiveNote] = useState<Note | null>(null)
  const [showNew, setShowNew] = useState(false)

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-sand-100" />
        ))}
      </div>
    )
  }

  if (activeNote) {
    return (
      <NoteEditor
        note={activeNote}
        onClose={() => setActiveNote(null)}
      />
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-xl text-brown-800">Notes</h2>
        <button
          onClick={() => setShowNew(true)}
          className="rounded-lg bg-terracotta-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-terracotta-600"
        >
          + New
        </button>
      </div>

      {showNew && (
        <NewNoteForm
          onSave={async (title, content) => {
            await createNote.mutateAsync({ title, content })
            setShowNew(false)
          }}
          onCancel={() => setShowNew(false)}
          isPending={createNote.isPending}
        />
      )}

      <div className="flex-1 overflow-y-auto space-y-2">
        {notes?.length === 0 && !showNew && (
          <div className="py-8 text-center">
            <p className="font-display text-brown-700/60">No notes yet.</p>
            <button
              onClick={() => setShowNew(true)}
              className="mt-2 text-sm text-terracotta-500 hover:text-terracotta-600"
            >
              Write something
            </button>
          </div>
        )}

        {notes?.map((note) => (
          <button
            key={note.id}
            onClick={() => setActiveNote(note)}
            className="w-full rounded-xl bg-cream-50 border border-sand-200 p-4 text-left transition-colors hover:bg-cream-100 hover:border-sand-300"
          >
            {note.title && (
              <p className="mb-1 font-display text-sm font-medium text-brown-800 truncate">{note.title}</p>
            )}
            <p className="text-sm text-brown-700/70 line-clamp-2">{note.content || 'Empty note…'}</p>
            <p className="mt-2 text-xs text-brown-700/40">
              {format(new Date(note.updated_at), 'MMM d')}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}

function NewNoteForm({
  onSave,
  onCancel,
  isPending,
}: {
  onSave: (title: string, content: string) => Promise<void>
  onCancel: () => void
  isPending: boolean
}) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  return (
    <div className="mb-4 rounded-xl border border-sand-200 bg-cream-50 p-4 space-y-3">
      <input
        autoFocus
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (optional)"
        className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-sm text-brown-800 placeholder:text-brown-700/40 focus:border-terracotta-500 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What's on your mind?"
        rows={4}
        className="w-full resize-none rounded-lg border border-sand-300 bg-white px-3 py-2 text-sm text-brown-800 placeholder:text-brown-700/40 focus:border-terracotta-500 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
      />
      <div className="flex gap-2">
        <button
          onClick={() => onSave(title, content)}
          disabled={isPending || !content.trim()}
          className="flex-1 rounded-lg bg-brown-800 py-2 text-sm font-medium text-cream-50 transition-colors hover:bg-brown-900 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save note'}
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg border border-sand-300 px-4 py-2 text-sm text-brown-700 hover:bg-cream-100"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function NoteEditor({ note, onClose }: { note: Note; onClose: () => void }) {
  const updateNote = useUpdateNote()
  const deleteNote = useDeleteNote()
  const [title, setTitle] = useState(note.title ?? '')
  const [content, setContent] = useState(note.content)
  const [dirty, setDirty] = useState(false)

  const handleSave = async () => {
    await updateNote.mutateAsync({ id: note.id, title: title || null, content })
    setDirty(false)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center gap-2">
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-brown-700/50 hover:bg-cream-100 hover:text-brown-700"
        >
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <input
          type="text"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setDirty(true) }}
          placeholder="Title"
          className="flex-1 bg-transparent text-lg font-display text-brown-800 placeholder:text-brown-700/30 focus:outline-none"
        />
        <button
          onClick={() => { deleteNote.mutate(note.id); onClose() }}
          className="rounded-lg p-1.5 text-brown-700/30 hover:text-red-400"
        >
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
            <path d="M3 4h10M6 4V2h4v2M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <textarea
        value={content}
        onChange={(e) => { setContent(e.target.value); setDirty(true) }}
        placeholder="Write here…"
        className="flex-1 resize-none bg-transparent text-sm text-brown-800 placeholder:text-brown-700/30 focus:outline-none"
      />

      {dirty && (
        <button
          onClick={handleSave}
          disabled={updateNote.isPending}
          className="mt-3 w-full rounded-lg bg-brown-800 py-2 text-sm font-medium text-cream-50 transition-colors hover:bg-brown-900 disabled:opacity-50"
        >
          {updateNote.isPending ? 'Saving…' : 'Save changes'}
        </button>
      )}
    </div>
  )
}

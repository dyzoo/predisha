'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bookmark, BookmarkCheck, Loader2 } from 'lucide-react'

interface SaveMatchButtonProps {
  fixtureId: string
  initialSaved: boolean
  signedIn: boolean
  authConfigured: boolean
}

export function SaveMatchButton({
  fixtureId,
  initialSaved,
  signedIn,
  authConfigured,
}: SaveMatchButtonProps) {
  const router = useRouter()
  const [saved, setSaved] = useState(initialSaved)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggle() {
    if (!signedIn) {
      router.push(`/sign-in?next=/matches/${fixtureId}`)
      return
    }
    if (!authConfigured || pending) return

    setPending(true)
    setError(null)
    try {
      const response = await fetch(
        saved ? `/api/saved-fixtures/${encodeURIComponent(fixtureId)}` : '/api/saved-fixtures',
        {
          method: saved ? 'DELETE' : 'POST',
          credentials: 'include',
          headers: saved ? undefined : { 'Content-Type': 'application/json' },
          body: saved ? undefined : JSON.stringify({ fixtureId }),
        },
      )
      const payload = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        setError(payload.error ?? 'Could not update saved matches.')
        return
      }
      setSaved(!saved)
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={!authConfigured || pending}
        title={authConfigured ? undefined : 'Accounts are not configured'}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-text transition-colors hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : saved ? (
          <BookmarkCheck className="h-3.5 w-3.5 text-accent" />
        ) : (
          <Bookmark className="h-3.5 w-3.5" />
        )}
        {saved ? 'Saved' : signedIn ? 'Save match' : 'Sign in to save'}
      </button>
      {error ? <span className="text-[10px] text-red-300">{error}</span> : null}
    </div>
  )
}

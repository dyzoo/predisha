'use client'

import Link from 'next/link'
import { Bookmark } from 'lucide-react'
import { useViewer } from '@/components/ui/viewer-provider'

interface MatchBookmarkLinkProps {
  matchId: string
  homeName: string
  awayName: string
}

export function MatchBookmarkLink({ matchId, homeName, awayName }: MatchBookmarkLinkProps) {
  const { viewer, loading } = useViewer()
  const signedIn = Boolean(viewer?.userId)

  if (loading) {
    return (
      <span
        aria-hidden
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-text/40"
      >
        <Bookmark className="h-3.5 w-3.5" />
      </span>
    )
  }

  const href = signedIn ? `/matches/${matchId}` : `/sign-in?next=/matches/${matchId}`
  const label = signedIn
    ? `Open ${homeName} versus ${awayName} to save this match`
    : `Sign in to save ${homeName} versus ${awayName}`

  return (
    <Link
      href={href}
      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-text transition-colors hover:text-accent"
      aria-label={label}
      title={signedIn ? 'Open match to save' : 'Sign in to save this match'}
    >
      <Bookmark className="h-3.5 w-3.5" />
    </Link>
  )
}

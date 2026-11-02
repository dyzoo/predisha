'use client'

import { motion } from 'framer-motion'
import { TeamBadge } from '@/components/teams/team-badge'
import type { MatchView } from '@/lib/sports/view-model'

export function LiveTicker({ liveMatches }: { liveMatches: MatchView[] }) {
  const live = liveMatches.filter(match => match.effectiveStatus === 'LIVE')
  if (live.length === 0) return null

  const items = [...live, ...live]

  return (
    <div className="border-y border-border bg-surface/40">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <span className="inline-flex shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-red-300">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          Live now
        </span>
        <motion.div
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: 60, ease: 'linear', repeat: Infinity }}
          className="flex w-max items-center gap-3"
        >
          {items.map((match, index) => (
            <div
              key={`${match.id}-${index}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-background/60 px-3.5 py-2"
            >
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-text">
                {match.competition}
              </span>
              <span className="flex items-center gap-1.5">
                <TeamBadge team={match.home} size="xs" />
                <TeamBadge team={match.away} size="xs" />
                <span className="text-xs font-semibold">
                  {match.home.short} vs {match.away.short}
                </span>
              </span>
              <span className="font-display text-sm font-bold tabular-nums">
                {match.score ? `${match.score.home}:${match.score.away}` : 'vs'}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}

import type { Metadata } from 'next'
import { GameCard } from '@/components/bet/game-card'
import { BET_GAMES } from '@/components/bet/games-catalog'
import { SectionHeading } from '@/components/bet/section-heading'
import { betModeCopy, getBetMode } from '@/lib/bet/mode'
import type { BetMode } from '@/lib/bet/mode'

export const metadata: Metadata = {
  title: 'Games',
  description: 'Arcade games with server-side randomness and betting wallet stakes.',
}

export default async function BetGamesPage() {
  const mode: BetMode = await getBetMode()
  const copy = betModeCopy(mode)

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Arcade"
        title={copy.gamesTitle}
        description={copy.gamesDescription}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {BET_GAMES.map(game => (
          <GameCard key={game.href} game={game} mode={mode} />
        ))}
      </div>
      <div className="rounded-2xl border border-border bg-surface/60 p-4 text-xs leading-relaxed text-muted-text">
        {mode === 'SANDBOX'
          ? 'These games use your game balance. Every round is resolved on the server and the result is recorded in your wallet history.'
          : 'These games settle with the betting wallet. Stakes are collected before the round and payouts are credited after a server-side result.'}
      </div>
    </div>
  )
}

export const instant = false
import type { Metadata } from 'next'
import { GameCard } from '@/components/bet/game-card'
import { BET_GAMES } from '@/components/bet/games-catalog'
import { SectionHeading } from '@/components/bet/section-heading'

export const metadata: Metadata = {
  title: 'Games',
  description: 'Sandbox arcade games with server-side randomness and play-money stakes.',
}

export default function BetGamesPage() {
  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Arcade"
        title="Sandbox games"
        description="Every round is settled by the server. Stakes and payouts use your play-money wallet."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {BET_GAMES.map(game => (
          <GameCard key={game.href} game={game} />
        ))}
      </div>
      <div className="rounded-2xl border border-border bg-surface/60 p-4 text-xs leading-relaxed text-muted-text">
        These games are for demonstration only. They use play money, have no cash value and are not
        connected to a real casino or wagering operator.
      </div>
    </div>
  )
}

export const instant = false

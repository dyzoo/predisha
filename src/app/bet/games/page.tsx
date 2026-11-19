import type { Metadata } from 'next'
import { GameCard } from '@/components/bet/game-card'
import { BET_GAMES } from '@/components/bet/games-catalog'
import { SectionHeading } from '@/components/bet/section-heading'
import { betModeCopy, getBetMode } from '@/lib/bet/mode'

export const metadata: Metadata = {
  title: 'Games',
  description: 'Arcade games with server-side randomness and betting wallet stakes.',
}

export default async function BetGamesPage() {
  const mode = await getBetMode()
  const copy = betModeCopy(mode)

  return (
    <section className="space-y-4">
      <SectionHeading
        title={copy.gamesTitle}
        description={copy.gamesDescription}
        eyebrow={copy.badge}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {BET_GAMES.map(game => (
          <GameCard key={game.href} game={game} />
        ))}
      </div>
      <p className="text-xs text-muted-text">
        Bets settle from your wallet. Every round is resolved on the server and recorded in your wallet history.
      </p>
    </section>
  )
}

export const instant = false
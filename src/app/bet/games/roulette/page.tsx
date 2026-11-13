import type { Metadata } from 'next'
import { connection } from 'next/server'
import { AuthRequired } from '@/components/bet/auth-required'
import { RouletteGame } from '@/components/bet/roulette-game'
import { getViewer } from '@/lib/auth/session'
import { betModeCopy, getBetMode } from '@/lib/bet/mode'
import type { BetMode } from '@/lib/bet/mode'

export const metadata: Metadata = {
  title: 'Roulette',
  description: 'A live single-zero roulette table with server-side settlement.',
}

export default async function RoulettePage() {
  await connection()
  const viewer = await getViewer()
  const mode: BetMode = await getBetMode()
  const copy = betModeCopy(mode)
  if (!viewer.userId) {
    return (
      <AuthRequired
        mode={mode}
        title="Sign in to play Roulette"
        description={copy.gamesDescription}
        nextPath="/bet/games/roulette"
      />
    )
  }
  return <RouletteGame />
}

export const instant = false
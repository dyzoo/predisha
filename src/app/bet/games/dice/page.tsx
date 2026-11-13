import type { Metadata } from 'next'
import { connection } from 'next/server'
import { AuthRequired } from '@/components/bet/auth-required'
import { DiceGame } from '@/components/bet/dice-game'
import { getViewer } from '@/lib/auth/session'
import { betModeCopy, getBetMode } from '@/lib/bet/mode'
import type { BetMode } from '@/lib/bet/mode'

export const metadata: Metadata = {
  title: 'Dice',
  description: 'A live over/under dice game with transparent win chances.',
}

export default async function DicePage() {
  await connection()
  const viewer = await getViewer()
  const mode: BetMode = await getBetMode()
  const copy = betModeCopy(mode)
  if (!viewer.userId) {
    return (
      <AuthRequired
        mode={mode}
        title="Sign in to play Dice"
        description={copy.gamesDescription}
        nextPath="/bet/games/dice"
      />
    )
  }
  return <DiceGame />
}

export const instant = false
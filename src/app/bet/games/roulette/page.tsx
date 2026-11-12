import type { Metadata } from 'next'
import { connection } from 'next/server'
import { AuthRequired } from '@/components/bet/auth-required'
import { RouletteGame } from '@/components/bet/roulette-game'
import { getViewer } from '@/lib/auth/session'

export const metadata: Metadata = {
  title: 'Roulette',
  description: 'Single-zero sandbox roulette with play-money stakes.',
}

export default async function RoulettePage() {
  await connection()
  const viewer = await getViewer()
  if (!viewer.userId) {
    return (
      <AuthRequired
        title="Sign in to play Roulette"
        description="Roulette rounds use your sandbox wallet and are settled by the server."
        nextPath="/bet/games/roulette"
      />
    )
  }
  return <RouletteGame />
}

export const instant = false

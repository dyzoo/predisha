import type { Metadata } from 'next'
import { connection } from 'next/server'
import { AuthRequired } from '@/components/bet/auth-required'
import { DiceGame } from '@/components/bet/dice-game'
import { getViewer } from '@/lib/auth/session'

export const metadata: Metadata = {
  title: 'Dice',
  description: 'A sandbox over/under dice game with transparent win chances.',
}

export default async function DicePage() {
  await connection()
  const viewer = await getViewer()
  if (!viewer.userId) {
    return (
      <AuthRequired
        title="Sign in to play Dice"
        description="Dice rounds debit and credit your sandbox wallet, so you need an account."
        nextPath="/bet/games/dice"
      />
    )
  }
  return <DiceGame />
}

export const instant = false

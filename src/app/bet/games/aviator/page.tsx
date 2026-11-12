import type { Metadata } from 'next'
import { connection } from 'next/server'
import { AuthRequired } from '@/components/bet/auth-required'
import { AviatorGame } from '@/components/bet/aviator-game'
import { getViewer } from '@/lib/auth/session'

export const metadata: Metadata = {
  title: 'Aviator',
  description: 'A sandbox multiplier game with server-side crash points.',
}

export default async function AviatorPage() {
  await connection()
  const viewer = await getViewer()
  if (!viewer.userId) {
    return (
      <AuthRequired
        title="Sign in to play Aviator"
        description="Aviator uses your sandbox wallet. Sign in so the server can settle each round against your account."
        nextPath="/bet/games/aviator"
      />
    )
  }
  return <AviatorGame />
}

export const instant = false

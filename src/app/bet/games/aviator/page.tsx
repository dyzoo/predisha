import type { Metadata } from 'next'
import { connection } from 'next/server'
import { AuthRequired } from '@/components/bet/auth-required'
import { AviatorGame } from '@/components/bet/aviator-game'
import { getViewer } from '@/lib/auth/session'
import { betModeCopy, getBetMode } from '@/lib/bet/mode'
import type { BetMode } from '@/lib/bet/mode'

export const metadata: Metadata = {
  title: 'Aviator',
  description: 'A live multiplier game with server-side crash points.',
}

export default async function AviatorPage() {
  await connection()
  const viewer = await getViewer()
  const mode: BetMode = await getBetMode()
  const copy = betModeCopy(mode)
  if (!viewer.userId) {
    return (
      <AuthRequired
        mode={mode}
        title={copy.gamesTitle}
        description={copy.gamesDescription}
        nextPath="/bet/games/aviator"
      />
    )
  }
  return <AviatorGame />
}

export const instant = false
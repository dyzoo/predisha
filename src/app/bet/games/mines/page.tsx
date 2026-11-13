import type { Metadata } from 'next'
import { connection } from 'next/server'
import { AuthRequired } from '@/components/bet/auth-required'
import { MinesGame } from '@/components/bet/mines-game'
import { getViewer } from '@/lib/auth/session'
import { betModeCopy, getBetMode } from '@/lib/bet/mode'
import type { BetMode } from '@/lib/bet/mode'

export const metadata: Metadata = {
  title: 'Mines',
  description: 'A live 5x5 mines game with server-stored mine positions.',
}

export default async function MinesPage() {
  await connection()
  const viewer = await getViewer()
  const mode: BetMode = await getBetMode()
  const copy = betModeCopy(mode)
  if (!viewer.userId) {
    return (
      <AuthRequired
        mode={mode}
        title="Sign in to play Mines"
        description={copy.gamesDescription}
        nextPath="/bet/games/mines"
      />
    )
  }
  return <MinesGame />
}

export const instant = false
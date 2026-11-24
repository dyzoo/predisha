import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { connection } from 'next/server'
import { getDepositMinMinor } from '@/lib/bet/deposit-settings'
import { getBetMode } from '@/lib/bet/mode'
import { getMinStakeMinor } from '@/lib/bet/stake-settings'
import { toClientViewer } from '@/lib/auth/entitlements'
import { getViewer } from '@/lib/auth/session'
import { BetShell } from '@/components/bet/bet-shell'

export const metadata: Metadata = {
  title: {
    default: 'Predisha Bet',
    template: '%s | Predisha Bet',
  },
  description:
    'Sportsbook and arcade with live odds, betting wallets and server-side settlement.',
}

export default async function BetLayout({ children }: { children: ReactNode }) {
  await connection()
  const [mode, depositMinMinor, minStakeMinor, viewer] = await Promise.all([
    getBetMode(),
    getDepositMinMinor(),
    getMinStakeMinor(),
    getViewer(),
  ])
  return (
    <BetShell
      viewer={toClientViewer(viewer)}
      mode={mode}
      depositMinMinor={depositMinMinor}
      minStakeMinor={minStakeMinor}
    >
      {children}
    </BetShell>
  )
}

export const instant = false

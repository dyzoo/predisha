import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { WinnerReceipt } from '@/components/bet/winner-receipt'
import { canUseSpecialBetTools } from '@/lib/auth/entitlements'
import { getViewer } from '@/lib/auth/session'
import { BetError } from '@/lib/bet/errors'
import {
  getWinnerSlipByCode,
  toPublicWinnerView,
  type WinnerSlipView,
} from '@/lib/bet/winners'

type Params = Promise<{ code: string }>

export const metadata: Metadata = {
  title: 'Winner slip',
  description: 'A winning bet slip with the net payout after VAT.',
}

export default async function WinnerSlipPage({ params }: { params: Params }) {
  await connection()
  const { code } = await params

  let winner: WinnerSlipView
  try {
    winner = await getWinnerSlipByCode(code)
  } catch (error) {
    if (error instanceof BetError && error.status === 404) notFound()
    throw error
  }

  const viewer = await getViewer()
  const canWithdraw =
    viewer.userId === winner.userId && canUseSpecialBetTools(viewer)

  return <WinnerReceipt winner={toPublicWinnerView(winner)} canWithdraw={canWithdraw} />
}

export const instant = false

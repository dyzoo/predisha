import type { Metadata } from 'next'
import { AviatorPromoBanner } from '@/components/bet/aviator-promo-banner'
import { ShareLoader } from '@/components/bet/share-loader'

type Params = Promise<{ code: string }>

export const metadata: Metadata = {
  title: 'Shared slip',
  description: 'Load a shared bet slip into your PredishaBet bet slip.',
}

export default async function BetSharePage({ params }: { params: Params }) {
  const { code } = await params
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <AviatorPromoBanner />
      <ShareLoader code={code.toUpperCase()} />
    </div>
  )
}

export const instant = false

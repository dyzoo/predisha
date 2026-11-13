import type { Metadata } from 'next'
import { ShareLoader } from '@/components/bet/share-loader'

type Params = Promise<{ code: string }>

export const metadata: Metadata = {
  title: 'Shared slip',
  description: 'Load a shared bet slip into your PredishaBet bet slip.',
}

export default async function BetSharePage({ params }: { params: Params }) {
  const { code } = await params
  return <ShareLoader code={code.toUpperCase()} />
}

export const instant = false

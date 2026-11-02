import type { Metadata } from 'next'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { PricingPreview } from '@/components/landing/pricing-preview'

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Free preview and configurable premium plans.',
}

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-main-text">
      <SiteHeader />
      <main className="flex-1 pt-6 sm:pt-10">
        <PricingPreview />
      </main>
      <SiteFooter />
    </div>
  )
}

export const instant = false

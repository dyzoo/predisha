import type { Metadata } from 'next'
import { MatchDetailsView } from '@/components/bet/match-details-view'

export const metadata: Metadata = {
  title: 'Match details',
  description: 'Football match details and betting markets.',
}

export default function MatchDetailsPage() {
  return <MatchDetailsView />
}

export const instant = false

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getMatchAnalyses } from '@/lib/sports/service'

export const metadata: Metadata = {
  title: 'Match details',
  description: 'Redirects to the source-backed match centre.',
}

export default async function MatchDetailsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const requested = params.fixture ?? params.match ?? params.id
  const fixtureId = Array.isArray(requested) ? requested[0] : requested

  if (fixtureId) {
    const { dataset } = await getMatchAnalyses()
    if (dataset.fixtures.some(fixture => fixture.id === fixtureId)) {
      redirect(`/matches/${encodeURIComponent(fixtureId)}`)
    }
  }

  redirect('/matches')
}

export const instant = false

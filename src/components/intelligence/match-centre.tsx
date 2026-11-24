'use client'

import { useState, type ReactNode } from 'react'
import { TabPanel, Tabs } from '@/components/intelligence/tabs'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'analysis', label: 'Spotibet analysis' },
  { id: 'statistics', label: 'Statistics' },
  { id: 'history', label: 'Form & history' },
  { id: 'context', label: 'League context' },
] as const

type TabId = (typeof TABS)[number]['id']

export function MatchCentre({
  overview,
  analysis,
  statistics,
  history,
  context,
}: {
  overview: ReactNode
  analysis: ReactNode
  statistics: ReactNode
  history: ReactNode
  context: ReactNode
}) {
  const [active, setActive] = useState<TabId>('overview')

  const panels: Record<TabId, ReactNode> = {
    overview,
    analysis,
    statistics,
    history,
    context,
  }

  return (
    <section className="mt-6">
      <Tabs
        idPrefix="match-centre"
        tabs={TABS}
        active={active}
        onChange={setActive}
        label="Match analysis sections"
      />
      {TABS.map(tab => (
        <TabPanel key={tab.id} idPrefix="match-centre" id={tab.id} active={active}>
          {panels[tab.id]}
        </TabPanel>
      ))}
    </section>
  )
}

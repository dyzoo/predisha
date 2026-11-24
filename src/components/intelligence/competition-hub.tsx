'use client'

import { useState, type ReactNode } from 'react'
import { TabPanel, Tabs } from '@/components/intelligence/tabs'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'standings', label: 'Standings' },
  { id: 'fixtures', label: 'Fixtures' },
] as const

type TabId = (typeof TABS)[number]['id']

export function CompetitionHub({
  overview,
  standings,
  fixtures,
  initialTab = 'overview',
}: {
  overview: ReactNode
  standings: ReactNode
  fixtures: ReactNode
  initialTab?: TabId
}) {
  const [active, setActive] = useState<TabId>(initialTab)
  const panels: Record<TabId, ReactNode> = { overview, standings, fixtures }

  return (
    <section className="mt-8">
      <Tabs
        idPrefix="competition-hub"
        tabs={TABS}
        active={active}
        onChange={setActive}
        label="Competition sections"
      />
      {TABS.map(tab => (
        <TabPanel key={tab.id} idPrefix="competition-hub" id={tab.id} active={active}>
          {panels[tab.id]}
        </TabPanel>
      ))}
    </section>
  )
}

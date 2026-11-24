'use client'

import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type TabItem<T extends string> = {
  id: T
  label: string
}

export function Tabs<T extends string>({
  idPrefix,
  tabs,
  active,
  onChange,
  label,
  className,
}: {
  idPrefix: string
  tabs: readonly TabItem<T>[]
  active: T
  onChange: (id: T) => void
  label: string
  className?: string
}) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([])

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number | null = null
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
    if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = tabs.length - 1
    if (next === null) return

    event.preventDefault()
    const target = tabs[next]
    if (!target) return
    onChange(target.id)
    buttons.current[next]?.focus()
  }

  return (
    <div className={cn('intel-scroll -mx-1 px-1 pb-2', className)}>
      <div role="tablist" aria-label={label} className="flex min-w-max items-center gap-2">
        {tabs.map((tab, index) => {
          const selected = tab.id === active
          return (
            <button
              key={tab.id}
              ref={element => {
                buttons.current[index] = element
              }}
              type="button"
              role="tab"
              id={`${idPrefix}-tab-${tab.id}`}
              aria-controls={`${idPrefix}-panel-${tab.id}`}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              data-active={selected}
              onClick={() => onChange(tab.id)}
              onKeyDown={event => handleKeyDown(event, index)}
              className="intel-tab"
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function TabPanel<T extends string>({
  idPrefix,
  id,
  active,
  children,
}: {
  idPrefix: string
  id: T
  active: T
  children: ReactNode
}) {
  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel-${id}`}
      aria-labelledby={`${idPrefix}-tab-${id}`}
      hidden={active !== id}
      tabIndex={0}
      className="intel-fade mt-4"
    >
      {children}
    </div>
  )
}

'use client'

import { useState } from 'react'

type TeamBadgeSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const SIZE_CLASSES: Record<TeamBadgeSize, string> = {
  xs: 'h-7 w-7 rounded-lg text-[9px]',
  sm: 'h-8 w-8 rounded-lg text-[10px]',
  md: 'h-9 w-9 rounded-xl text-[11px]',
  lg: 'h-11 w-11 rounded-2xl text-sm',
  xl: 'h-14 w-14 rounded-2xl text-sm sm:h-16 sm:w-16',
}

export function TeamBadge({
  team,
  size = 'md',
  className = '',
}: {
  team: { id?: string; name: string; short: string; color: string; logoUrl?: string | null }
  size?: TeamBadgeSize
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const showLogo = Boolean(team.logoUrl) && !failed

  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center overflow-hidden border border-white/10 ${SIZE_CLASSES[size]} ${className}`}
      style={showLogo ? undefined : { backgroundColor: team.color }}
      title={team.name}
    >
      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={team.logoUrl ?? ''}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full object-contain p-1"
        />
      ) : (
        <span className="font-bold leading-none text-background">{team.short}</span>
      )}
    </span>
  )
}

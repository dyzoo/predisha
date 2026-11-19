import type { TicketSimulationMeta } from './types'

export type MatchPhase =
  | 'FIRST_HALF'
  | 'FIRST_HALF_STOPPAGE'
  | 'HALF_TIME'
  | 'SECOND_HALF'
  | 'SECOND_HALF_STOPPAGE'
  | 'FULL_TIME'

export interface MatchSegments {
  duration: number
  half: number
  secondHalf: number
  firstStoppage: number
  halfTime: number
  secondStoppage: number
  firstHalfEnd: number
  firstStoppageEnd: number
  halfTimeEnd: number
  secondHalfEnd: number
  fullTime: number
}

export interface MatchClockState {
  phase: MatchPhase
  minute: number
  label: string
  elapsedMinutes: number
  progress: number
  started: boolean
  live: boolean
  finished: boolean
}

function stoppageFor(minutes: number): number {
  return Math.max(1, Math.round(minutes / 15))
}

export function matchSegments(clock: Pick<TicketSimulationMeta, 'durationMinutes'>): MatchSegments {
  const duration = Math.max(1, Math.floor(clock.durationMinutes || 90))
  const half = Math.max(1, Math.floor(duration / 2))
  const secondHalf = Math.max(1, duration - half)
  const firstStoppage = stoppageFor(half)
  const halfTime = Math.max(1, Math.round(half / 15))
  const secondStoppage = stoppageFor(secondHalf) + (duration >= 90 ? 1 : 0)
  const firstHalfEnd = half
  const firstStoppageEnd = firstHalfEnd + firstStoppage
  const halfTimeEnd = firstStoppageEnd + halfTime
  const secondHalfEnd = halfTimeEnd + secondHalf
  return {
    duration,
    half,
    secondHalf,
    firstStoppage,
    halfTime,
    secondStoppage,
    firstHalfEnd,
    firstStoppageEnd,
    halfTimeEnd,
    secondHalfEnd,
    fullTime: secondHalfEnd + secondStoppage,
  }
}

export function matchClock(
  clock: Pick<TicketSimulationMeta, 'liveStartedAt' | 'durationMinutes'>,
  now: number = Date.now(),
): MatchClockState {
  const segments = matchSegments(clock)
  const startedAt = new Date(clock.liveStartedAt).getTime()
  const elapsedRaw = Number.isNaN(startedAt) ? -1 : (now - startedAt) / 60_000
  const elapsedMinutes = Math.max(0, elapsedRaw)

  let phase: MatchPhase = 'FIRST_HALF'
  let minute = 1
  let label = "1'"

  if (elapsedMinutes >= segments.fullTime) {
    phase = 'FULL_TIME'
    minute = segments.duration
    label = 'FT'
  } else if (elapsedMinutes >= segments.secondHalfEnd) {
    phase = 'SECOND_HALF_STOPPAGE'
    minute = segments.duration
    label = `${segments.duration}+${Math.floor(elapsedMinutes - segments.secondHalfEnd) + 1}'`
  } else if (elapsedMinutes >= segments.halfTimeEnd) {
    phase = 'SECOND_HALF'
    minute = Math.min(
      segments.duration,
      segments.half + 1 + Math.floor(elapsedMinutes - segments.halfTimeEnd),
    )
    label = `${minute}'`
  } else if (elapsedMinutes >= segments.firstStoppageEnd) {
    phase = 'HALF_TIME'
    minute = segments.half
    label = 'HT'
  } else if (elapsedMinutes >= segments.firstHalfEnd) {
    phase = 'FIRST_HALF_STOPPAGE'
    minute = segments.half
    label = `${segments.half}+${Math.floor(elapsedMinutes - segments.firstHalfEnd) + 1}'`
  } else {
    phase = 'FIRST_HALF'
    minute = Math.min(segments.half, Math.floor(elapsedMinutes) + 1)
    label = `${minute}'`
  }

  const started = elapsedRaw >= 0
  return {
    phase,
    minute,
    label,
    elapsedMinutes,
    progress: Math.min(1, Math.max(0, minute / segments.duration)),
    started,
    live: started && phase !== 'FULL_TIME',
    finished: phase === 'FULL_TIME',
  }
}

export function formatMatchMinuteFromElapsed(
  elapsedMinutes: number,
  durationMinutes = 90,
): string {
  return matchClock(
    {
      liveStartedAt: new Date(0).toISOString(),
      durationMinutes,
    },
    elapsedMinutes * 60_000,
  ).label
}

export function matchClockFromKickoff(
  kickoffIso: string,
  durationMinutes = 90,
  now: number = Date.now(),
): MatchClockState {
  return matchClock(
    { liveStartedAt: kickoffIso, durationMinutes },
    now,
  )
}

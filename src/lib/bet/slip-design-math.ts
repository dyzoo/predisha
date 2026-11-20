export interface SlipTotals {
  totalOdds: number
  winningsMinor: number
  taxMinor: number
  payoutMinor: number
}

export function calculateSlipTotals(
  odds: number[],
  stakeMinor: number,
  bonusMinor: number,
  taxPercent: number,
): SlipTotals {
  const rawOdds = odds.reduce(
    (product, value) => product * (Number.isFinite(value) && value > 0 ? value : 1),
    1,
  )
  const winningsMinor = Math.max(0, Math.round(stakeMinor * Math.max(rawOdds - 1, 0)))
  const taxMinor = Math.round(((winningsMinor + bonusMinor) * taxPercent) / 100)
  return {
    totalOdds: Number(rawOdds.toFixed(2)),
    winningsMinor,
    taxMinor,
    payoutMinor: stakeMinor + winningsMinor + bonusMinor - taxMinor,
  }
}

export const VAT_PERCENT = 10
export const VAT_BASIS_POINTS = VAT_PERCENT * 100

export interface VatBreakdown {
  grossMinor: number
  vatMinor: number
  netPayoutMinor: number
}

export function applyVat(grossMinor: number, basisPoints = VAT_BASIS_POINTS): VatBreakdown {
  const gross = Math.max(0, Math.floor(Number.isFinite(grossMinor) ? grossMinor : 0))
  const vatMinor = Math.floor((gross * basisPoints) / 10_000)
  return { grossMinor: gross, vatMinor, netPayoutMinor: gross - vatMinor }
}

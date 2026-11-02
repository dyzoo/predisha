import type { MarketKey, MarketRisk, OutcomeKey } from './engine'

export type BuilderRisk = 'conservative' | 'balanced' | 'aggressive'

export const SUPPORTED_CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'TZS',
  'KES',
  'UGX',
  'NGN',
  'ZAR',
  'INR',
  'AED',
  'CAD',
  'AUD',
  'BRL',
  'JPY',
  'CHF',
  'SEK',
  'NOK',
  'DKK',
  'PLN',
  'TRY',
  'MXN',
  'EGP',
  'GHS',
  'RWF',
  'ZMW',
  'BWP',
] as const

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number]

const ZERO_DECIMAL_CURRENCIES = new Set<string>([
  'TZS',
  'KES',
  'UGX',
  'JPY',
  'RWF',
  'ZMW',
  'BWP',
])

const HIGH_DENOMINATION_CURRENCIES = new Set<string>([
  'TZS',
  'KES',
  'UGX',
  'NGN',
  'JPY',
  'RWF',
  'ZMW',
  'BWP',
])

const MID_DENOMINATION_CURRENCIES = new Set<string>(['INR', 'ZAR', 'TRY', 'MXN', 'GHS', 'EGP'])

export const CURRENCY_OPTIONS: Array<{ code: SupportedCurrency; label: string }> = [
  { code: 'USD', label: 'US Dollar' },
  { code: 'EUR', label: 'Euro' },
  { code: 'GBP', label: 'British Pound' },
  { code: 'TZS', label: 'Tanzanian Shilling' },
  { code: 'KES', label: 'Kenyan Shilling' },
  { code: 'UGX', label: 'Ugandan Shilling' },
  { code: 'NGN', label: 'Nigerian Naira' },
  { code: 'ZAR', label: 'South African Rand' },
  { code: 'INR', label: 'Indian Rupee' },
  { code: 'AED', label: 'UAE Dirham' },
  { code: 'CAD', label: 'Canadian Dollar' },
  { code: 'AUD', label: 'Australian Dollar' },
  { code: 'BRL', label: 'Brazilian Real' },
  { code: 'JPY', label: 'Japanese Yen' },
  { code: 'CHF', label: 'Swiss Franc' },
  { code: 'SEK', label: 'Swedish Krona' },
  { code: 'NOK', label: 'Norwegian Krone' },
  { code: 'DKK', label: 'Danish Krone' },
  { code: 'PLN', label: 'Polish Zloty' },
  { code: 'TRY', label: 'Turkish Lira' },
  { code: 'MXN', label: 'Mexican Peso' },
  { code: 'EGP', label: 'Egyptian Pound' },
  { code: 'GHS', label: 'Ghanaian Cedi' },
  { code: 'RWF', label: 'Rwandan Franc' },
  { code: 'ZMW', label: 'Zambian Kwacha' },
  { code: 'BWP', label: 'Botswana Pula' },
]

export function normalizeCurrency(value?: string | null, fallback = 'USD'): SupportedCurrency {
  const code = (value ?? '').trim().toUpperCase()
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(code)
    ? (code as SupportedCurrency)
    : (fallback as SupportedCurrency)
}

export function defaultCurrency(): SupportedCurrency {
  return normalizeCurrency(process.env.BILLING_CURRENCY)
}

export function stakeChips(currency: string): string[] {
  const code = normalizeCurrency(currency)
  if (HIGH_DENOMINATION_CURRENCIES.has(code)) {
    return ['1000', '5000', '10000', '25000', '50000']
  }
  if (MID_DENOMINATION_CURRENCIES.has(code)) {
    return ['100', '250', '500', '1000', '2500']
  }
  return ['10', '25', '50', '100', '250']
}

export const BUILDER_RISKS: BuilderRisk[] = ['conservative', 'balanced', 'aggressive']

export const BUILDER_TARGETS = [
  { key: 'short', label: 'Short', range: [2, 4], defaultCount: 3 },
  { key: 'standard', label: 'Standard', range: [5, 8], defaultCount: 6 },
  { key: 'extended', label: 'Extended', range: [9, 12], defaultCount: 10 },
  { key: 'custom', label: 'Custom', range: [1, 20], defaultCount: 8 },
] as const

export type BuilderTarget = (typeof BUILDER_TARGETS)[number]['key']

export const BUILDER_RISK_CONFIG: Record<
  BuilderRisk,
  { label: string; selections: number; description: string }
> = {
  conservative: {
    label: 'Conservative',
    selections: 4,
    description: 'Fewer selections with the highest model probabilities.',
  },
  balanced: {
    label: 'Balanced',
    selections: 6,
    description: 'A middle ground between probability and the number of selections.',
  },
  aggressive: {
    label: 'Aggressive',
    selections: 10,
    description: 'Up to 10 selections for wider model picks.',
  },
}

export interface BuilderAlternative {
  label: string
  market: string
  probability: number
}

export interface BuilderSelection {
  fixtureId: string
  competition: string
  kickoffIso: string
  kickoffLabel: string
  homeName: string
  awayName: string
  homeShort: string
  awayShort: string
  homeColor: string
  awayColor: string
  homeLogoUrl: string | null
  awayLogoUrl: string | null
  modelVersion: string | null
  market: string
  outcomeKey: MarketKey
  outcomeLabel: string
  riskLevel: MarketRisk
  reason: string
  alternatives: BuilderAlternative[]
  probability: number
  impliedOdds: number
  homeProbability: number
  drawProbability: number
  awayProbability: number
  dataAsOf: string | null
  dataAsOfIso: string | null
  qualityFlags: string[]
}

export interface BuilderResult {
  stake: number
  currency: string
  risk: BuilderRisk
  selections: BuilderSelection[]
  impliedCombinedOdds: number
  usedOdds: number
  oddsSource: 'user' | 'model-implied'
  combinedProbability: number
  potentialReturn: number
  netProfit: number
  generatedAt: string
  dataAsOf: string | null
  dataAsOfIso: string | null
  demo: boolean
  premium: boolean
  limited: boolean
  maxSelections: number
  correlationWarning?: string
  slipId?: string
}

export function outcomeLabelFor(key: OutcomeKey): string {
  if (key === 'HOME') return 'Home win'
  if (key === 'AWAY') return 'Away win'
  return 'Draw'
}

const MARKET_LABELS: Record<MarketKey, string> = {
  HOME: 'Home win',
  DRAW: 'Draw',
  AWAY: 'Away win',
  DC_HOME_DRAW: 'Home or draw',
  DC_DRAW_AWAY: 'Draw or away',
  DC_HOME_AWAY: 'Home or away',
  OVER_1_5: 'Over 1.5 goals',
  OVER_2_5: 'Over 2.5 goals',
  UNDER_3_5: 'Under 3.5 goals',
  BTTS_YES: 'Both teams to score',
  BTTS_NO: 'Both teams not to score',
}

export function marketLabelFor(key: string): string {
  return MARKET_LABELS[key as MarketKey] ?? key
}

export function formatMoney(value: number, currency: string): string {
  const code = normalizeCurrency(currency)
  const fractionDigits = ZERO_DECIMAL_CURRENCIES.has(code) ? 0 : 2
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value)
  } catch {
    return `${code} ${value.toFixed(fractionDigits)}`
  }
}

export function formatDecimal(value: number, digits = 2): string {
  return new Intl.NumberFormat('en', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

export function percent(value: number): string {
  return `${Math.round(value * 100)}%`
}

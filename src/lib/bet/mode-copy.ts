export type BetMode = 'LIVE' | 'SANDBOX'

export interface BetModeCopy {
  mode: BetMode
  label: string
  badge: string
  isLive: boolean
  walletName: string
  walletHint: string
  addFunds: string
  depositTitle: string
  depositDescription: string
  withdrawTitle: string
  withdrawDescription: string
  banner: string | null
  footer: string
  gamesTitle: string
  gamesDescription: string
  promosTitle: string
  promosDescription: string
  shareNote: string
  paymentNote: string
  safetyNote: string
  homeEyebrow: string
  homeAccent: string
  homeDescription: string
  walletsTitle: string
  walletsBody: string
  oddsTitle: string
  oddsBody: string
  frozenTitle: string
  frozenBody: string
  serverTitle: string
  serverBody: string
  ticketTitle: string
  ticketBody: string
  gameTitle: string
  gameBody: string
}

export const BET_MODE_COPY: Record<BetMode, BetModeCopy> = {
  LIVE: {
    mode: 'LIVE',
    label: 'Live',
    badge: 'Live mode',
    isLive: true,
    walletName: 'Betting wallet',
    walletHint: 'Funds are credited after a confirmed mobile-money payment.',
    addFunds: 'Deposit funds',
    depositTitle: 'Deposit funds',
    depositDescription:
      'Enter your mobile-money number. HarakaPay sends a USSD prompt and credits your wallet after you approve it.',
    withdrawTitle: 'Withdraw funds',
    withdrawDescription:
      'Submit a withdrawal request. The operator reviews and settles approved payouts to your mobile-money number.',
    banner: null,
    footer:
      'PredishaBet live sportsbook. Odds are generated from the Predisha model and confirmed server-side when you place a bet.',
    gamesTitle: 'Games',
    gamesDescription: 'Every round is settled server-side against your betting wallet.',
    promosTitle: 'Bonuses',
    promosDescription: 'Claim available bonuses. One claim per promo per account.',
    shareNote: 'Share codes expire after 24 hours.',
    paymentNote: 'Payments are collected securely with HarakaPay.',
    safetyNote:
      'Never share your mobile-money PIN. PredishaBet only sends a USSD approval prompt and never asks for your PIN.',
    homeEyebrow: 'Live sportsbook',
    homeAccent: 'Betting stakes.',
    homeDescription:
      'PredishaBet turns the Predisha model into a transparent book. Prices are simulated, settlements are server-side and wallet funding runs through HarakaPay.',
    walletsTitle: 'Server-owned wallets',
    walletsBody:
      'Betting wallets hold stakes and payouts. Balances, debits and credits live in PostgreSQL behind authenticated, rate-limited endpoints.',
    oddsTitle: 'Simulated odds',
    oddsBody:
      'Prices are derived from model probabilities. Each outcome probability is converted to decimal odds and a book margin is applied.',
    frozenTitle: 'Frozen prices',
    frozenBody:
      'A selection is frozen at the price shown when you place the bet; the API rechecks it at placement and rejects stale prices.',
    serverTitle: 'Server-owned ledgers',
    serverBody:
      'Debits use conditional updates so a balance cannot go negative, and every mutation carries an idempotency reference.',
    ticketTitle: 'Ticket settlement',
    ticketBody:
      'Tickets settle when the fixture feed reports a final score. Postponed, cancelled and abandoned fixtures void affected selections.',
    gameTitle: 'Game fairness',
    gameBody:
      'Game outcomes are settled by the server with stored round details for review.',
  },
  SANDBOX: {
    mode: 'SANDBOX',
    label: 'Sandbox',
    badge: 'Sandbox mode',
    isLive: false,
    walletName: 'Sandbox wallet',
    walletHint: 'Play money only — no real deposits or withdrawals.',
    addFunds: 'Add sandbox funds',
    depositTitle: 'Add sandbox funds',
    depositDescription:
      'Credit play money to your sandbox wallet instantly. No phone number, PIN or payment is requested.',
    withdrawTitle: 'Sandbox withdrawal',
    withdrawDescription:
      'Move play money out of your sandbox balance. No external payout is triggered.',
    banner:
      'Sandbox mode is active: balances, bets and payouts are play money. An administrator can switch the platform to live mode.',
    footer:
      'PredishaBet sandbox is a practice sportsbook. Odds are simulated from the Predisha model and are not live market prices.',
    gamesTitle: 'Sandbox games',
    gamesDescription:
      'Fast rounds with server-side randomness and play-money stakes. No real-money wagering.',
    promosTitle: 'Sandbox bonuses',
    promosDescription: 'One claim per promo per account. Bonuses are play money with no cash value.',
    shareNote: 'Share codes expire after 24 hours.',
    paymentNote: 'Sandbox mode does not collect payments.',
    safetyNote:
      'Sandbox balances have no cash value and cannot be withdrawn. Never share a mobile-money PIN with anyone.',
    homeEyebrow: 'Sandbox sportsbook',
    homeAccent: 'Play-money stakes.',
    homeDescription:
      'PredishaBet turns the Predisha model into a transparent book. Prices are simulated, settlements are server-side and every balance is play money.',
    walletsTitle: 'Play-money wallets',
    walletsBody:
      'Every balance, stake, promo and payout is play money. Deposits and withdrawals are ledger entries inside the app.',
    oddsTitle: 'Simulated odds',
    oddsBody:
      'Prices are derived from model probabilities and are simulated for practice. They carry no cash value.',
    frozenTitle: 'Frozen prices',
    frozenBody:
      'A selection is frozen at the price shown when you place the bet; odds are simulated for practice.',
    serverTitle: 'Play-money ledgers',
    serverBody:
      'Every balance change is a stored, idempotent transaction against the play-money wallet.',
    ticketTitle: 'Play-money settlement',
    ticketBody:
      'Tickets settle against simulated results. Demo fixtures can be resolved with the demo resolver.',
    gameTitle: 'Game fairness',
    gameBody:
      'Game outcomes use server-side randomness and stored round details for review.',
  },
}

export function normalizeBetMode(value: unknown): BetMode {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return normalized === 'SANDBOX' ? 'SANDBOX' : 'LIVE'
}

export function betModeCopy(mode: BetMode): BetModeCopy {
  return BET_MODE_COPY[mode]
}
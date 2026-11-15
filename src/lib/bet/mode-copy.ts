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
      'Enter your mobile-money number. Approve the prompt on your phone to credit your wallet.',
    withdrawTitle: 'Send to mobile money',
    withdrawDescription:
      'Enter the amount and mobile-money number. The transfer is recorded against your wallet and processed for payout.',
    banner: null,
    footer:
      'SpotibetBet live sportsbook. Prices are confirmed server-side when you place a bet.',
    gamesTitle: 'Games',
    gamesDescription: 'Every round is settled server-side against your betting wallet.',
    promosTitle: 'Bonuses',
    promosDescription: 'Claim available bonuses. One claim per promo per account.',
    shareNote: 'Share codes expire after 24 hours.',
    paymentNote: 'Payments are collected securely through your mobile-money provider.',
    safetyNote:
      'Never share your mobile-money PIN. SpotibetBet only sends a USSD approval prompt and never asks for your PIN.',
    homeEyebrow: 'Live sportsbook',
    homeAccent: 'Betting stakes.',
    homeDescription:
      'SpotibetBet brings live and upcoming fixtures together with a fast bet slip, server-side settlement and mobile-money funding.',
    walletsTitle: 'Server-owned wallets',
    walletsBody:
      'Betting wallets hold stakes and payouts. Balances, debits and credits live in PostgreSQL behind authenticated, rate-limited endpoints.',
    oddsTitle: 'Fixed prices',
    oddsBody:
      'Prices include a book margin and are locked when you place the bet.',
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
    withdrawTitle: 'Transfer funds',
    withdrawDescription:
      'Move funds out of your wallet to a mobile-money number.',
    banner:
      'Sandbox mode is active: balances, bets and payouts are play money. An administrator can switch the platform to live mode.',
    footer:
      'SpotibetBet sandbox is a practice sportsbook. All balances and payouts are play money.',
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
      'SpotibetBet sandbox brings fixtures, a fast bet slip and play-money settlement together in one place.',
    walletsTitle: 'Play-money wallets',
    walletsBody:
      'Every balance, stake, promo and payout is play money. Deposits and withdrawals are ledger entries inside the app.',
    oddsTitle: 'Fixed prices',
    oddsBody:
      'Prices include a book margin. Sandbox balances carry no cash value.',
    frozenTitle: 'Frozen prices',
    frozenBody:
      'A selection is frozen at the price shown when you place the bet.',
    serverTitle: 'Play-money ledgers',
    serverBody:
      'Every balance change is a stored, idempotent transaction against the play-money wallet.',
    ticketTitle: 'Play-money settlement',
    ticketBody:
      'Tickets settle against the fixture result once the match is complete.',
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
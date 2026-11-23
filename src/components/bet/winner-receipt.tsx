'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  BadgeCheck,
  CalendarDays,
  Check,
  CircleAlert,
  CircleCheck,
  Download,
  Loader2,
  Printer,
  ReceiptText,
  Smartphone,
  Wallet,
  X,
} from 'lucide-react'
import { formatDateTimeLabel, formatOdds, formatTzs } from '@/lib/bet/format'
import { normalizeTzPhone } from '@/lib/bet/phone'
import type { PublicWinnerSlipView } from '@/lib/bet/winners'
import { VAT_PERCENT } from '@/lib/bet/vat'
import { WinnerConfetti } from './winner-confetti'

function buildSms(amountMinor: number): { text: string; balanceText: string } {
  const code = `DKJ${Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 9).padEnd(9, '0')}`
  const balance = amountMinor + 1_000_000 + Math.floor(Math.random() * 4_000_000)
  const stamp = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date())
  return {
    text: `${code} Imethibitishwa. Umepokea Tsh ${amountMinor.toLocaleString('en-US')} kutoka SPOTIONEBET. ${stamp}. Salio lako jipya ni Tsh ${balance.toLocaleString('en-US')}`,
    balanceText: `Tsh ${balance.toLocaleString('en-US')}`,
  }
}

function playMessageTone() {
  try {
    const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const now = ctx.currentTime
    const notes = [1174.66, 1396.91, 1760] // D6, F6, A6 - tri-tone notification
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const start = now + i * 0.1
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.1, start + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 0.3)
    })
    window.setTimeout(() => { void ctx.close() }, 1200)
  } catch {
    // Ignore audio failures; the visual message still appears.
  }
}

export function WinnerReceipt({
  winner,
  canWithdraw = false,
}: {
  winner: PublicWinnerSlipView
  canWithdraw?: boolean
}) {
  const receiptRef = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [amount, setAmount] = useState(String(winner.netPayoutMinor))
  const [phone, setPhone] = useState('')
  const [withdrawError, setWithdrawError] = useState<string | null>(null)
  const [phase, setPhase] = useState<'idle' | 'loading' | 'success'>('idle')
  const [successPhone, setSuccessPhone] = useState('')
  const [sms, setSms] = useState<string | null>(null)

  useEffect(() => {
    if (phase !== 'success') return
    const showTimer = window.setTimeout(() => {
      setSms(buildSms(Number(amount) || winner.netPayoutMinor).text)
      playMessageTone()
    }, 1200)
    return () => window.clearTimeout(showTimer)
  }, [phase, amount, winner.netPayoutMinor])

  useEffect(() => {
    if (!sms) return
    const hideTimer = window.setTimeout(() => setSms(null), 3500)
    return () => window.clearTimeout(hideTimer)
  }, [sms])

  async function downloadSlip() {
    if (!receiptRef.current || downloading) return
    setDownloading(true)
    setDownloadError(null)
    try {
      const { toPng } = await import('html-to-image')
      const dataUrl = await toPng(receiptRef.current, {
        pixelRatio: 2,
        backgroundColor: '#141A21',
        cacheBust: true,
      })
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `winner-slip-${winner.code}.png`
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch {
      setDownloadError('Download failed. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  function openWithdraw() {
    setAmount(String(winner.netPayoutMinor))
    setPhone('')
    setWithdrawError(null)
    setPhase('idle')
    setSms(null)
    setWithdrawOpen(true)
  }

  function submitWithdraw(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = Math.floor(Number(amount))
    if (!Number.isFinite(value) || value < 1) {
      setWithdrawError('Enter a valid amount.')
      return
    }
    if (value > winner.netPayoutMinor) {
      setWithdrawError(`Amount cannot exceed ${formatTzs(winner.netPayoutMinor)}.`)
      return
    }
    const normalized = normalizeTzPhone(phone)
    if (!normalized.ok) {
      setWithdrawError(normalized.error ?? 'Enter a valid phone number.')
      return
    }
    setWithdrawError(null)
    setSuccessPhone(normalized.phone)
    setPhase('loading')
    window.setTimeout(() => setPhase('success'), 2200)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface/60 px-4 py-2.5 text-xs font-semibold text-main-text transition-colors hover:border-emerald-400/50"
        >
          <Printer className="h-4 w-4 text-emerald-400" />
          Print receipt
        </button>
        <button
          type="button"
          onClick={() => void downloadSlip()}
          disabled={downloading}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-emerald-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {downloading ? 'Preparing image…' : 'Download winner slip'}
        </button>
      </div>
      {downloadError ? (
        <p className="flex items-center justify-end gap-1.5 text-[11px] text-red-300 print:hidden">
          <CircleAlert className="h-3.5 w-3.5" />
          {downloadError}
        </p>
      ) : null}

      <div
        ref={receiptRef}
        className="receipt-print-target relative overflow-hidden rounded-3xl border-2 border-emerald-400/60 bg-[radial-gradient(120%_100%_at_50%_0%,rgba(45,183,99,0.2),transparent_58%),linear-gradient(180deg,#252C36_0%,#141A21_100%)] p-5 shadow-[0_30px_80px_-50px_rgba(45,183,99,0.65)] sm:p-7"
      >
        <WinnerConfetti />

        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-emerald-400/50 bg-emerald-500/15 shadow-[0_0_50px_-10px_rgba(45,183,99,0.8)] sm:h-20 sm:w-20">
                <Image
                  src="/trophy.png"
                  alt="Winner trophy"
                  width={80}
                  height={80}
                  unoptimized
                  className="h-full w-full object-contain"
                />
              </span>
              <div>
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-400">
                  <ReceiptText className="h-3.5 w-3.5" />
                  Winner slip
                </p>
                <h1 className="mt-1 font-display text-2xl font-black leading-tight text-main-text sm:text-3xl">
                  You Won
                </h1>
                <p className="mt-1 text-xs text-muted-text">
                  {winner.title ?? 'Winning bet slip'} · Awarded to {winner.recipientName}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300">
                <BadgeCheck className="h-3.5 w-3.5" />
                Won
              </span>
              <p className="mt-2 font-mono text-sm font-bold tracking-[0.24em] text-emerald-300">
                {winner.code}
              </p>
              {winner.ticketCode ? (
                <p className="mt-1 text-[10px] text-muted-text">
                  Ticket <span className="font-mono text-main-text">{winner.ticketCode}</span>
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-emerald-400/35 bg-emerald-500/10 px-4 py-5 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300/80">
              Net payout credited
            </p>
            <p className="mt-1 font-display text-4xl font-black tracking-tight tabular-nums text-emerald-300 sm:text-5xl">
              {formatTzs(winner.netPayoutMinor)}
            </p>
            <p className="mt-2 text-[11px] text-emerald-100/70">
              Gross {formatTzs(winner.grossPayoutMinor)} minus {VAT_PERCENT}% VAT (
              {formatTzs(winner.vatMinor)})
            </p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-background/40 px-3 py-2 text-center">
              <p className="text-[10px] uppercase tracking-wide text-muted-text">Stake</p>
              <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-main-text">
                {formatTzs(winner.stakeMinor)}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background/40 px-3 py-2 text-center">
              <p className="text-[10px] uppercase tracking-wide text-muted-text">Total odds</p>
              <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-emerald-300">
                {formatOdds(winner.totalOdds)}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background/40 px-3 py-2 text-center">
              <p className="text-[10px] uppercase tracking-wide text-muted-text">Selections</p>
              <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-main-text">
                {winner.selections.length}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background/40 px-3 py-2 text-center">
              <p className="text-[10px] uppercase tracking-wide text-muted-text">Credited</p>
              <p className="mt-0.5 text-[11px] font-semibold text-main-text">
                {winner.creditedAt
                  ? formatDateTimeLabel(winner.creditedAt)
                  : formatDateTimeLabel(winner.createdAt)}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-border bg-background/40 p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-display text-sm font-bold text-main-text">
                <ReceiptText className="h-4 w-4 text-emerald-400" />
                Winning selections
              </h2>
              <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-text">
                <CalendarDays className="h-3.5 w-3.5" />
                Settled
              </span>
            </div>

            <ul className="mt-3 space-y-2">
              {winner.selections.map((selection, index) => (
                <li
                  key={`${selection.fixtureId}:${index}`}
                  className="rounded-xl border border-emerald-400/20 bg-surface/70 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-main-text">
                        {selection.fixtureLabel}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] uppercase tracking-wide text-muted-text">
                        {selection.competition}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                        <span className="font-semibold text-emerald-300">{selection.marketName}</span>
                        <span className="text-muted-text">{selection.selectionLabel}</span>
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {selection.finalScore ? (
                        <>
                          <p className="font-mono text-lg font-black tabular-nums text-emerald-300">
                            {selection.finalScore.home} - {selection.finalScore.away}
                          </p>
                          <p className="text-[10px] uppercase tracking-wide text-muted-text">Final</p>
                        </>
                      ) : null}
                      <p className="mt-1 inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold tabular-nums text-emerald-300">
                        <CircleCheck className="h-3 w-3" />
                        {formatOdds(selection.odds)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-5 rounded-2xl border border-accent/25 bg-accent/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-2">
                <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <div>
                  <p className="text-sm font-semibold text-main-text">Already in the wallet</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-text">
                    {formatTzs(winner.netPayoutMinor)} was credited after the {VAT_PERCENT}% VAT
                    deduction. {canWithdraw ? 'Withdraw it directly from this slip.' : 'Withdraw it to mobile money from the wallet page.'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {canWithdraw ? (
                  <button
                    type="button"
                    onClick={openWithdraw}
                    className="rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-background transition-opacity hover:opacity-90"
                  >
                    Withdraw
                  </button>
                ) : (
                  <Link
                    href="/bet/account"
                    className="rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-background transition-opacity hover:opacity-90"
                  >
                    Open wallet
                  </Link>
                )}
                <Link
                  href={canWithdraw ? '/bet/account' : '/bet/withdraw'}
                  className="rounded-xl border border-border bg-background/40 px-4 py-2.5 text-xs font-semibold text-main-text transition-colors hover:border-accent/40"
                >
                  {canWithdraw ? 'Open wallet' : 'Withdraw'}
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-text">
            <span>Winner payout recorded against the betting wallet.</span>
            <Link href="/bet/bets" className="font-semibold text-emerald-300 hover:underline">
              View in My Bets
            </Link>
          </div>
        </div>
      </div>

      {canWithdraw && withdrawOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-accent/25 bg-[#141A21] p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Special withdrawal</p>
                <h3 className="mt-1 font-display text-xl font-bold text-main-text">Withdraw winnings</h3>
              </div>
              {phase !== 'loading' ? (
                <button type="button" onClick={() => setWithdrawOpen(false)} className="rounded-lg p-1 text-muted-text hover:bg-white/5 hover:text-main-text" aria-label="Close">
                  <X className="h-5 w-5" />
                </button>
              ) : null}
            </div>

            {phase === 'idle' ? (
              <form onSubmit={submitWithdraw} className="mt-5 space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-muted-text">Amount (TZS)</span>
                  <input
                    type="number"
                    min={1}
                    max={winner.netPayoutMinor}
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background/60 px-3 py-3 text-sm font-semibold tabular-nums text-main-text outline-none focus:border-accent/60"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-muted-text">Phone number</span>
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-background/60 px-3 focus-within:border-accent/60">
                    <Smartphone className="h-4 w-4 text-muted-text" />
                    <input
                      type="tel"
                      inputMode="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="0712 345 678"
                      className="w-full bg-transparent py-3 text-sm font-semibold text-main-text outline-none"
                    />
                  </div>
                </label>
                {withdrawError ? <p className="text-xs text-red-300">{withdrawError}</p> : null}
                <button type="submit" className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-bold text-background hover:opacity-90">
                  Submit withdrawal
                </button>
              </form>
            ) : null}

            {phase === 'loading' ? (
              <div className="py-8 text-center">
                <div className="relative mx-auto flex h-36 w-36 items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-accent/20 border-t-accent animate-spin" />
                  <div className="px-4">
                    <p className="font-display text-lg font-black tabular-nums text-accent">{formatTzs(Number(amount) || 0)}</p>
                  </div>
                </div>
                <p className="mt-5 text-sm font-semibold text-main-text">Withdrawing..</p>
                <p className="mt-1 text-xs font-mono text-accent">{successPhone}</p>
                <p className="mt-2 text-xs text-muted-text">Sending to your number...</p>
              </div>
            ) : null}

            {phase === 'success' ? (
              <div className="py-8 text-center">
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border-4 border-emerald-400/40 bg-emerald-500/15 text-emerald-300">
                  <Check className="h-12 w-12" strokeWidth={3} />
                </div>
                <p className="mt-5 text-lg font-bold text-main-text">withdraw succeeded</p>
                <p className="mt-1 text-sm text-muted-text">Sent to {successPhone}</p>
                <button
                  type="button"
                  onClick={() => { setWithdrawOpen(false); setPhase('idle'); setSms(null) }}
                  className="mt-6 rounded-xl bg-accent px-8 py-2.5 text-sm font-bold text-background hover:opacity-90"
                >
                  Done
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {sms ? (
        <div className="fixed left-1/2 top-2 z-[60] w-[min(94vw,460px)] -translate-x-1/2" style={{ animation: 'pop-in .28s ease-out' }}>
          <div className="rounded-2xl border border-black/10 bg-white/90 p-3 shadow-2xl backdrop-blur">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-700 ring-1 ring-black/5">M</div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-900">M-PESA</p>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-gray-600">{sms}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

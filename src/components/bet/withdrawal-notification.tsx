'use client'

import { useEffect, useRef } from 'react'

export function buildWithdrawalMessage(amountMinor: number): string {
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
  return `${code} Imethibitishwa. Umepokea Tsh ${amountMinor.toLocaleString('en-US')} kutoka SPOTIONEBET. ${stamp}. Salio lako jipya ni Tsh ${balance.toLocaleString('en-US')}`
}

function playMessageTone() {
  try {
    const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const now = ctx.currentTime
    const notes = [1174.66, 1396.91, 1760]
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

export function WithdrawalNotification({
  message,
  onDismiss,
}: {
  message: string | null
  onDismiss: () => void
}) {
  const dismissRef = useRef(onDismiss)

  useEffect(() => {
    dismissRef.current = onDismiss
  }, [onDismiss])

  useEffect(() => {
    if (!message) return
    playMessageTone()
    const timer = window.setTimeout(() => dismissRef.current(), 5000)
    return () => window.clearTimeout(timer)
  }, [message])

  if (!message) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 top-2 z-[90] w-[min(94vw,460px)] -translate-x-1/2"
      style={{ animation: 'pop-in .28s ease-out' }}
    >
      <div className="rounded-2xl border border-black/10 bg-white/95 p-3 shadow-2xl backdrop-blur">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-700 ring-1 ring-black/5">M</div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-gray-900">M-PESA</p>
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-gray-600">{message}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

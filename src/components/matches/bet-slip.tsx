'use client'

import { useState } from 'react'
import { CircleAlert, Download, Lock, Sparkles } from 'lucide-react'
import type { MatchView } from '@/lib/sports/view-model'
import { useLanguage, type Language } from '@/components/ui/language-provider'

const ACCENT = '#C8FF43'
const INK = '#F5F7FA'
const MUTED = '#A5AFBD'
const BG = '#101318'
const SURFACE = '#1D232C'

interface BestOutcome {
  key: string
  label: string
  probability: number
}

function labelFor(key: string, lang: Language): string {
  if (key === 'HOME') return lang === 'sw' ? 'Ushindi wa nyumbani' : 'Home win'
  if (key === 'AWAY') return lang === 'sw' ? 'Ushindi wa peiwani' : 'Away win'
  return lang === 'sw' ? 'Mgongesho' : 'Draw'
}

function bestOutcome(match: MatchView, lang: Language): BestOutcome | null {
  const outcomes: BestOutcome[] = []
  if (match.topOutcome) {
    outcomes.push({
      key: match.topOutcome.key,
      label: labelFor(match.topOutcome.key, lang),
      probability: match.topOutcome.probability,
    })
  }
  if (match.probability) {
    outcomes.push({ key: 'HOME', label: labelFor('HOME', lang), probability: match.probability.home })
    outcomes.push({ key: 'DRAW', label: labelFor('DRAW', lang), probability: match.probability.draw })
    outcomes.push({ key: 'AWAY', label: labelFor('AWAY', lang), probability: match.probability.away })
  }
  if (outcomes.length === 0) return null
  return outcomes.reduce((best, current) => (current.probability > best.probability ? current : best))
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  fontSize: number,
  weight: string,
): string[] {
  ctx.font = `${weight} ${fontSize}px Inter, Arial, sans-serif`
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if (ctx.measureText(word).width > maxWidth) {
      if (current) {
        lines.push(current)
        current = ''
      }
      let chunk = ''
      for (const char of word) {
        const next = chunk + char
        if (chunk && ctx.measureText(next).width > maxWidth) {
          lines.push(chunk)
          chunk = char
        } else {
          chunk = next
        }
      }
      current = chunk
      continue
    }
    const candidate = current ? `${current} ${word}` : word
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)
  return lines.length > 0 ? lines : ['']
}

interface ReceiptParams {
  match: MatchView
  outcome: BestOutcome
  lang: Language
}

function layoutReceipt(
  ctx: CanvasRenderingContext2D,
  params: ReceiptParams,
  height: number,
  draw: boolean,
): number {
  const { match, outcome, lang } = params
  const outcomeLabel = lang === 'sw' ? labelFor(outcome.key, lang) : outcome.label
  const receiptSubtitle = lang === 'sw' ? 'RISITI YA TADHIMINI' : 'AI PREDICTION RECEIPT'
  const recommendedHeading = lang === 'sw' ? 'Mapendekezo' : 'Recommended outcome'
  const probabilityText =
    lang === 'sw' ? `${percent(outcome.probability)} wa uwezekano` : `${percent(outcome.probability)} probability`
  const disclaimerText = lang === 'sw'
    ? 'Risiti hii inatumia matokeo ya modeli yaliyoonyeshwa kwenye ukurasa. Uwezekano ni makadirio, si uhakika au ushauri wa kamari. Predisha haipokei, haihifadhi, wala kuweka bet. Tumia risiti kwa mtoa huduma yoyote unayemwamini.'
    : 'Receipts use the same transparent model outputs shown on the page. Probabilities are estimates, not odds, guarantees, or betting advice. No bet is placed and no funds are held by Predisha. Use the receipt with any provider you trust.'

  const maxWidth = 936
  let cursor = 96

  if (draw) {
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, 1080, height)
    ctx.fillStyle = SURFACE
    ctx.fillRect(40, 40, 1000, height - 80)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)'
    ctx.lineWidth = 3
    ctx.strokeRect(40, 40, 1000, height - 80)
  }

  const drawText = (
    text: string,
    options: { size: number; weight?: string | number; color?: string; align?: CanvasTextAlign } = {
      size: 32,
    },
  ): number => {
    const lines = wrapLines(ctx, text, maxWidth, options.size, String(options.weight ?? '400'))
    const lineHeight = Math.max(Math.round(options.size * 1.25), 24)
    if (draw) {
      lines.forEach((line, index) => {
        ctx.font = `${options.weight ?? '400'} ${options.size}px Inter, Arial, sans-serif`
        ctx.fillStyle = options.color ?? INK
        ctx.textAlign = options.align ?? 'left'
        ctx.fillText(line, 72, cursor + index * lineHeight)
      })
    }
    return cursor + lines.length * lineHeight
  }

  cursor = drawText('PREDISHA', { size: 46, weight: 700, color: ACCENT })
  cursor = drawText(receiptSubtitle, { size: 24, weight: 600, color: INK })
  if (draw) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(72, cursor + 18)
    ctx.lineTo(1008, cursor + 18)
    ctx.stroke()
  }
  cursor += 64

  cursor = drawText(match.competition, { size: 26, weight: 600, color: MUTED })
  cursor = drawText(`${match.home.short} vs ${match.away.short}`, { size: 76, weight: 700, color: INK })
  cursor = drawText(match.kickoffLabel, { size: 28, weight: 500, color: MUTED })
  cursor += 18

  cursor = drawText(recommendedHeading, { size: 28, weight: 600, color: MUTED })
  cursor = drawText(outcomeLabel, { size: 88, weight: 700, color: ACCENT })
  cursor = drawText(probabilityText, { size: 32, weight: 600, color: INK })
  cursor += 24

  cursor = drawText(disclaimerText, { size: 22, weight: 500, color: MUTED })

  return cursor
}

function buildReceiptImage(params: ReceiptParams): string {
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1080

  let ctx = canvas.getContext('2d')
  if (!ctx) return ''

  const contentBottom = layoutReceipt(ctx, params, 1080, false)
  const height = Math.max(1080, Math.ceil(contentBottom + 40))

  canvas.height = height
  ctx = canvas.getContext('2d')
  if (!ctx) return ''

  layoutReceipt(ctx, params, height, true)

  return canvas.toDataURL('image/png')
}

interface BetSlipProps {
  match: MatchView
  premium: boolean
}

export function BetSlip({ match, premium }: BetSlipProps) {
  const { lang } = useLanguage()
  const [receipt, setReceipt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sw = lang === 'sw'
  const t = {
    heading: sw ? 'Risiti ya tadhmini' : 'Prediction receipt',
    subtitle: sw
      ? 'Tengeneza risiti ya tadhmini inayoshirikiwa kwa chaguo la modeli la mkutano huu.'
      : 'Generate a shareable receipt for this model pick.',
    generate: sw ? 'Tengeneza risiti ya tadhmini' : 'Generate prediction receipt',
    download: sw ? 'Piga risiti (PNG)' : 'Download receipt (PNG)',
    premiumTitle: sw ? 'Risiti za tadhmini za premium' : 'Premium prediction receipts',
    premiumBody: sw
      ? 'Risiti za PNG zinazoshirikiwa ni sehemu ya mpango wa premium. Tengeneza risiti ya chaguo la modeli kwa kila mkutano.'
      : 'Shareable PNG receipts are part of the premium plan. Generate a model pick receipt for any fixture.',
    insufficient: sw
      ? 'Takwimu zinapingana kwa tathmini thabiti ya mkutano huu.'
      : 'Insufficient data for a reliable recommendation on this fixture.',
    recommended: sw ? 'Mapendekezo' : 'Recommended',
    probability: sw ? 'Uwezekano' : 'Probability',
    disclaimer: sw
      ? 'Risiti zinatumia matokeo ya modeli yaliyoonyeshwa kwenye ukurasa. Uwezekano ni makadirio, si uhakika au ushauri wa kamari. Predisha haipokei, haihifadhi, wala kuweka bet. Tumia risiti kwa mtoa huduma unayemwamini.'
      : 'Receipts use the same transparent model outputs shown on the page. Probabilities are estimates, not odds, guarantees, or betting advice. No bet is placed and no funds are held by Predisha. Use the receipt with any provider you trust.',
    errorInvalid: sw
      ? 'Hakuna chaguo thabiti la modeli kwa mkutano huu.'
      : 'No reliable model pick is available for this fixture.',
  }

  const outcome = bestOutcome(match, lang)

  function handleGenerate() {
    if (!outcome) {
      setError(t.errorInvalid)
      return
    }
    const dataUrl = buildReceiptImage({ match, outcome, lang })
    if (!dataUrl) {
      setError(t.errorInvalid)
      return
    }
    setError(null)
    setReceipt(dataUrl)
  }

  function handleDownload() {
    if (!receipt) return
    const link = document.createElement('a')
    link.href = receipt
    link.download = `predisha-receipt-${match.id}.png`
    link.click()
  }

  return (
    <section className="rounded-2xl border border-border bg-surface/60 p-5">
      <h2 className="flex items-center gap-2 font-display text-base font-bold">
        <Sparkles className="h-4 w-4 text-accent" />
        {t.heading}
      </h2>
      <p className="mt-2 text-xs leading-relaxed text-muted-text">{t.subtitle}</p>

      {premium ? (
        <div className="mt-5 space-y-4">
          {outcome ? (
            <div className="rounded-xl border border-border bg-background/40 p-4">
              <div className="flex items-start justify-between gap-3 text-xs">
                <span className="min-w-0 text-muted-text">{t.recommended}</span>
                <span className="max-w-[60%] break-words text-right font-semibold">
                  {outcome.label}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-xs">
                <span className="min-w-0 text-muted-text">{t.probability}</span>
                <span className="shrink-0 text-right font-semibold text-accent">
                  {percent(outcome.probability)}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-xl border border-dashed border-border bg-background/40 px-3 py-3 text-xs leading-relaxed text-muted-text">
              <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {t.insufficient}
            </div>
          )}

          <button
            type="button"
            onClick={handleGenerate}
            disabled={!outcome}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Download className="h-4 w-4" />
            {t.generate}
          </button>

          {receipt ? (
            <div className="overflow-hidden rounded-xl border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={receipt} alt="Prediction receipt" className="w-full" />
              <button
                type="button"
                onClick={handleDownload}
                className="flex w-full items-center justify-center gap-2 rounded-b-xl border-t border-border bg-background/60 px-4 py-2.5 text-xs font-semibold text-main-text transition-colors hover:text-accent"
              >
                <Download className="h-3.5 w-3.5" />
                {t.download}
              </button>
            </div>
          ) : null}

          {error ? <p className="text-xs text-red-300">{error}</p> : null}
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-border bg-background/40 px-4 py-5 text-center">
          <Lock className="mx-auto h-5 w-5 text-muted-text" />
          <p className="mt-3 text-sm font-semibold text-main-text">{t.premiumTitle}</p>
          <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted-text">{t.premiumBody}</p>
          <a
            href="/sign-up"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
          >
            Create a free account
          </a>
        </div>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-muted-text">{t.disclaimer}</p>
    </section>
  )
}

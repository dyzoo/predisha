import type { BuilderResult, BuilderSelection } from '@/lib/predictions/builder-types'
import { BUILDER_RISK_CONFIG, percent } from '@/lib/predictions/builder-types'

const WIDTH = 1080
const MIN_HEIGHT = 1440
const ACCENT = '#C8FF43'
const INK = '#F5F7FA'
const MUTED = '#A5AFBD'
const BG = '#101318'
const SURFACE = '#1D232C'
const MARGIN = 40
const LEFT = 88
const RIGHT = WIDTH - 88
const CONTENT_WIDTH = RIGHT - LEFT

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + width, y, x + width, y + height, radius)
  ctx.arcTo(x + width, y + height, x, y + height, radius)
  ctx.arcTo(x, y + height, x, y, radius)
  ctx.arcTo(x, y, x + width, y, radius)
  ctx.closePath()
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
): string[] {
  const words = value.split(/\s+/).filter(Boolean)
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

function fontFor(size: number, weight: number): string {
  return `${weight} ${size}px Inter, Arial, sans-serif`
}

interface TextOptions {
  size: number
  weight?: number
  color?: string
  align?: CanvasTextAlign
  maxWidth?: number
  lineHeight?: number
}

function measureLines(
  ctx: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
  size: number,
  weight: number,
): string[] {
  ctx.font = fontFor(size, weight)
  return wrapText(ctx, value, maxWidth)
}

function writeText(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  options: TextOptions,
  draw: boolean,
): number {
  const size = options.size
  const weight = options.weight ?? 500
  ctx.font = fontFor(size, weight)
  ctx.fillStyle = options.color ?? INK
  ctx.textAlign = options.align ?? 'left'
  const lines = wrapText(ctx, value, options.maxWidth ?? CONTENT_WIDTH)
  const lineHeight = options.lineHeight ?? Math.round(size * 1.3)
  if (draw) {
    lines.forEach((line, index) => {
      ctx.fillText(line, x, y + index * lineHeight)
    })
  }
  return y + lines.length * lineHeight
}

function layoutSelection(
  ctx: CanvasRenderingContext2D,
  selection: BuilderSelection,
  index: number,
  rowTop: number,
  draw: boolean,
): number {
  const textLeft = LEFT + 56
  const rightWidth = 220
  const leftWidth = RIGHT - textLeft - rightWidth - 24
  const name = `${selection.homeName} vs ${selection.awayName}`
  const subtitle = `${selection.competition} · ${selection.kickoffLabel ?? ''} · ${selection.market}`
  const probability = percent(selection.probability)

  const nameLines = measureLines(ctx, name, leftWidth, 25, 600)
  const subtitleLines = measureLines(ctx, subtitle, leftWidth, 17, 500)
  const outcomeLines = measureLines(ctx, selection.outcomeLabel, rightWidth, 24, 700)
  const probabilityLines = measureLines(ctx, probability, rightWidth, 19, 600)

  const nameEnd = rowTop + 52 + nameLines.length * 32
  const subtitleBaseline = Math.max(rowTop + 92, nameEnd + 8)
  const subtitleEnd = subtitleBaseline + subtitleLines.length * 24
  const leftBottom = subtitleEnd + 20

  const outcomeEnd = rowTop + 52 + outcomeLines.length * 30
  const probabilityBaseline = Math.max(rowTop + 92, outcomeEnd + 8)
  const rightBottom = probabilityBaseline + probabilityLines.length * 25

  const rowHeight = Math.max(140, Math.max(leftBottom, rightBottom) - rowTop + 24)

  if (draw) {
    ctx.fillStyle = 'rgba(255,255,255,0.035)'
    roundedRect(ctx, LEFT - 16, rowTop, CONTENT_WIDTH + 32, rowHeight, 14)
    ctx.fill()

    ctx.fillStyle = ACCENT
    roundedRect(ctx, LEFT, rowTop + 24, 36, 36, 10)
    ctx.fill()

    ctx.fillStyle = BG
    ctx.font = fontFor(20, 700)
    ctx.textAlign = 'center'
    ctx.fillText(String(index + 1), LEFT + 18, rowTop + 50)

    writeText(
      ctx,
      name,
      textLeft,
      rowTop + 44,
      { size: 25, weight: 600, color: INK, maxWidth: leftWidth, lineHeight: 30 },
      true,
    )
    writeText(
      ctx,
      subtitle,
      textLeft,
      subtitleBaseline,
      { size: 17, weight: 500, color: MUTED, maxWidth: leftWidth, lineHeight: 22 },
      true,
    )
    writeText(
      ctx,
      selection.outcomeLabel,
      RIGHT,
      rowTop + 44,
      {
        size: 24,
        weight: 700,
        color: ACCENT,
        align: 'right',
        maxWidth: rightWidth,
        lineHeight: 28,
      },
      true,
    )
    writeText(
      ctx,
      probability,
      RIGHT,
      probabilityBaseline,
      { size: 19, weight: 600, color: INK, align: 'right', maxWidth: rightWidth, lineHeight: 25 },
      true,
    )
  }

  return rowTop + rowHeight + 16
}

function layout(
  ctx: CanvasRenderingContext2D,
  result: BuilderResult,
  height: number,
  draw: boolean,
): number {
  if (draw) {
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, WIDTH, height)
    ctx.fillStyle = SURFACE
    roundedRect(ctx, MARGIN, MARGIN, WIDTH - MARGIN * 2, height - MARGIN * 2, 28)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'
    ctx.lineWidth = 3
    roundedRect(ctx, MARGIN, MARGIN, WIDTH - MARGIN * 2, height - MARGIN * 2, 28)
    ctx.stroke()
  }

  let y = 120
  y = writeText(ctx, 'PREDISHA', LEFT, y, { size: 46, weight: 700, color: ACCENT }, draw)
  y = writeText(
    ctx,
    'AI PREDICTION BET SLIP',
    LEFT,
    y + 6,
    { size: 22, weight: 600, color: MUTED },
    draw,
  )

  const generated = new Date(result.generatedAt)
  writeText(
    ctx,
    generated.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }),
    RIGHT,
    124,
    { size: 20, weight: 500, color: MUTED, align: 'right' },
    draw,
  )

  y += 24
  if (draw) {
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(LEFT, y)
    ctx.lineTo(RIGHT, y)
    ctx.stroke()
  }
  y += 56

  y = writeText(ctx, 'RISK PROFILE', LEFT, y, { size: 20, weight: 600, color: MUTED, lineHeight: 24 }, draw)
  y = writeText(
    ctx,
    BUILDER_RISK_CONFIG[result.risk].label.toUpperCase(),
    LEFT,
    y + 8,
    { size: 34, weight: 700, color: INK, lineHeight: 36 },
    draw,
  )

  y += 36
  y = writeText(
    ctx,
    `SELECTIONS (${result.selections.length})`,
    LEFT,
    y,
    { size: 20, weight: 600, color: MUTED, lineHeight: 24 },
    draw,
  )
  y += 30

  result.selections.forEach((selection, index) => {
    y = layoutSelection(ctx, selection, index, y, draw)
  })

  y += 6
  if (draw) {
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(LEFT, y)
    ctx.lineTo(RIGHT, y)
    ctx.stroke()
  }
  y += 60

  y = writeText(ctx, 'MODEL CONFIDENCE', LEFT, y, { size: 20, weight: 600, color: MUTED, lineHeight: 24 }, draw)
  y = writeText(
    ctx,
    percent(result.combinedProbability),
    LEFT,
    y + 10,
    { size: 46, weight: 700, color: ACCENT, lineHeight: 50 },
    draw,
  )

  y = writeText(
    ctx,
    'Estimated analysis only. Probabilities are model estimates, not odds or guarantees, and are not betting advice. The platform does not accept, hold, or place bets. Combinations become less likely as selections are added. Bet responsibly, 18+.',
    LEFT,
    y + 60,
    { size: 14, weight: 500, color: MUTED, lineHeight: 18 },
    draw,
  )

  return y
}

export function renderSlipImage(result: BuilderResult): string {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = MIN_HEIGHT

  let ctx = canvas.getContext('2d')
  if (!ctx) return ''

  const contentBottom = layout(ctx, result, MIN_HEIGHT, false)
  const height = Math.max(MIN_HEIGHT, Math.ceil(contentBottom + 80))

  canvas.height = height
  ctx = canvas.getContext('2d')
  if (!ctx) return ''

  layout(ctx, result, height, true)

  return canvas.toDataURL('image/png')
}

export function formStyles(result: string): string {
  if (result === 'W') return 'bg-accent/20 text-accent'
  if (result === 'L') return 'bg-red-500/15 text-red-300'
  return 'bg-white/10 text-muted-text'
}

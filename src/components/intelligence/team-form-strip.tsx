import { formStyles } from './form-styles'

export function TeamFormStrip({
  form,
  label,
  compact = false,
}: {
  form: string[]
  label?: string
  compact?: boolean
}) {
  return (
    <div className="min-w-0">
      {label ? <p className="mb-2 text-[11px] font-semibold text-muted-text">{label}</p> : null}
      {form.length === 0 ? (
        <p className="text-xs text-muted-text">No recent results available</p>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5" aria-label={`${label ?? 'Recent form'}: ${form.join(', ')}`}>
          {form.map((result, index) => (
            <span
              key={`${result}-${index}`}
              role="img"
              aria-label={result === 'W' ? 'Win' : result === 'D' ? 'Draw' : 'Loss'}
              title={result === 'W' ? 'Win' : result === 'D' ? 'Draw' : 'Loss'}
              className={`inline-flex items-center justify-center rounded-md font-bold tabular-nums ${compact ? 'h-5 w-5 text-[9px]' : 'h-7 w-7 text-[10px]'} ${formStyles(result)}`}
            >
              {result}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

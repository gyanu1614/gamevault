import { CaretDownIcon } from '@phosphor-icons/react/dist/csr/CaretDown'
import { CaretUpIcon } from '@phosphor-icons/react/dist/csr/CaretUp'

/**
 * The 7-day price change on a value card: a caret and the percent, green up,
 * red down (src/lib/values/trends.ts). One look on every hub. Renders nothing
 * without a change.
 */
export function TrendChip({ pct }: { pct: number | null | undefined }) {
  if (pct == null) return null
  const up = pct >= 0
  const Caret = up ? CaretUpIcon : CaretDownIcon
  return (
    <span
      className="inline-flex items-center gap-0.5 font-semibold tabular-nums"
      style={{ color: up ? 'var(--color-success)' : 'var(--color-error)' }}
      title="7-day change"
    >
      <Caret aria-hidden size={10} weight="fill" />
      <span className="sr-only">{up ? 'Up' : 'Down'} over 7 days</span>
      {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

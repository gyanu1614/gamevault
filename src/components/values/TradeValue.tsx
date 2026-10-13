import type { ReactNode } from 'react'

/**
 * A community trade-value number, shared everywhere one renders (hero, list
 * cards, Variants table, calculator): gold with the slow `.trade-shine`
 * sweep from globals.css. Pass the formatted number as children.
 */
export function TradeValue({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`trade-shine tabular-nums ${className}`}>{children}</span>
}

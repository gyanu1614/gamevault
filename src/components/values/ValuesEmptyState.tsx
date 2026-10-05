import type { ReactNode } from 'react'
import { VALUE_SURFACE } from './styles'

/** Empty / no-results / no-data state for every values surface. */
export function ValuesEmptyState({
  title,
  body,
  action,
  compact = false,
  className = '',
}: {
  title: string
  body?: ReactNode
  action?: ReactNode
  compact?: boolean
  className?: string
}) {
  return (
    <div className={`${VALUE_SURFACE} ${compact ? 'px-5 py-8' : 'px-6 py-12'} text-center ${className}`}>
      <h2 className={`${compact ? 'text-base' : 'text-xl'} font-semibold text-text-primary`}>{title}</h2>
      {body && <p className="mx-auto mt-2 max-w-md text-sm text-text-secondary">{body}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}

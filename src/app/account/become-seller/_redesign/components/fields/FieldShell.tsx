/**
 * FieldShell — label + optional hint + error, wrapping any control. Gives every
 * field in the light seller application the same rhythm: a Title-Case label, a
 * muted hint line, the control, then a forest-red error when present.
 */

'use client'

import type { ReactNode } from 'react'
import { PALETTE } from '../../theme'

interface FieldShellProps {
  label: string
  /** Renders a small "(Optional)" tag after the label instead of a required asterisk. */
  optional?: boolean
  /** One-line helper under the label. */
  hint?: string
  /** Validation message; when present the field reads as errored. */
  error?: string
  /** id of the control, for the label's htmlFor. */
  htmlFor?: string
  children: ReactNode
  className?: string
}

export default function FieldShell({
  label,
  optional,
  hint,
  error,
  htmlFor,
  children,
  className,
}: FieldShellProps) {
  return (
    <div className={className}>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-sm font-medium"
        style={{ color: PALETTE.ink }}
      >
        {label}
        {optional ? (
          <span className="ml-1 text-xs font-normal" style={{ color: PALETTE.ink2 }}>
            (Optional)
          </span>
        ) : (
          <span className="ml-0.5" style={{ color: '#B4462F' }} aria-hidden>
            *
          </span>
        )}
      </label>
      {hint && (
        <p className="mb-1.5 text-xs leading-relaxed" style={{ color: PALETTE.ink2 }}>
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p className="mt-1.5 text-xs" style={{ color: '#B4462F' }}>
          {error}
        </p>
      )}
    </div>
  )
}

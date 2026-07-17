/**
 * SectionLabel — a small forest heading with a lime dot, used to group fields
 * within a step (Your Name / Location / Contact / Business Details). Quiet by
 * design so the form stays a calm single column.
 */

'use client'

import type { ReactNode } from 'react'
import { PALETTE } from '../../theme'

export default function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: PALETTE.lime }}
        aria-hidden
      />
      <h3
        className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: PALETTE.forest }}
      >
        {children}
      </h3>
    </div>
  )
}

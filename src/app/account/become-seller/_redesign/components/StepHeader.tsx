/**
 * StepHeader — the top of every step's right-pane content: a large forest
 * HEADING, and directly under it a small ICON + one line explaining what the
 * step needs. This is an icon+text affordance (not a plain paragraph): the icon
 * sits in a soft forest-tinted chip so the explainer reads as guidance.
 */

'use client'

import type { LucideIcon } from 'lucide-react'
import { PALETTE } from '../theme'

interface StepHeaderProps {
  heading: string
  /** One line explaining what this step collects. Keep it outcome-oriented. */
  explainer: string
  icon: LucideIcon
}

export default function StepHeader({ heading, explainer, icon: Icon }: StepHeaderProps) {
  return (
    <header className="mb-8">
      <h2
        className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]"
        style={{ color: PALETTE.forest }}
      >
        {heading}
      </h2>
      <div className="mt-2 flex items-center gap-2.5">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{
            backgroundColor: 'rgba(20,67,42,0.08)',
            color: PALETTE.forest2,
          }}
        >
          <Icon className="h-4 w-4" />
        </span>
        <p className="text-sm leading-relaxed" style={{ color: PALETTE.ink2 }}>
          {explainer}
        </p>
      </div>
    </header>
  )
}

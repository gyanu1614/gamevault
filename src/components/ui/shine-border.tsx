'use client'

/**
 * ShineBorder — vendored from Magic UI and modified. Not a dependency: the
 * upstream component is changed here, so it lives in the repo.
 *
 * What differs from upstream:
 *   - Upstream paints the element's BACKGROUND via the mask trick. That is
 *     stripped: this renders a border layer only, so the button keeps its own
 *     fill, gloss and inset highlight underneath.
 *   - One colour, not a multi-colour gradient.
 *   - The travel happens in the first 25% of the cycle; the rest is a rest
 *     gap, so it reads as one slow pass rather than constant motion.
 *   - Soft stops, so the shine is a band and not a hard bright line.
 *   - Under prefers-reduced-motion it renders a static border and never
 *     animates. Handled in CSS so it responds without a re-render.
 */

import { cn } from '@/lib/utils'
import type { CSSProperties } from 'react'

interface ShineBorderProps {
  /** Seconds for one full cycle, travel plus rest gap. */
  duration?: number
  /** Single colour for the travelling band. */
  shineColor?: string
  /** Border thickness in px. */
  borderWidth?: number
  className?: string
}

export function ShineBorder({
  duration = 9,
  shineColor = 'rgba(255,255,255,0.24)',
  borderWidth = 1,
  className,
}: ShineBorderProps) {
  return (
    <span
      aria-hidden
      className={cn('shine-border', className)}
      style={
        {
          '--shine-duration': `${duration}s`,
          '--shine-color': shineColor,
          '--shine-width': `${borderWidth}px`,
        } as CSSProperties
      }
    />
  )
}

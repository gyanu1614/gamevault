'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * A game's square icon for admin rows, with an initial-letter fallback.
 *
 * The fallback also covers an image that failed BEFORE hydration (a plain
 * onError never fires for those, which left broken-image icons in the rows):
 * on mount a finished image with no pixels counts as failed.
 */
export function GameTile({
  src,
  name,
  className = 'h-9 w-9',
}: {
  src: string | null | undefined
  name: string | null | undefined
  className?: string
}) {
  const [failed, setFailed] = useState(!src)
  const ref = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const img = ref.current
    if (img && img.complete && img.naturalWidth === 0) setFailed(true)
  }, [src])

  if (failed || !src) {
    return (
      <span
        aria-hidden
        className={cn(
          'grid shrink-0 place-items-center rounded-md bg-white/[0.06] text-[13px] font-bold text-text-secondary',
          className,
        )}
      >
        {(name || '?').trim().charAt(0).toUpperCase()}
      </span>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt=""
      onError={() => setFailed(true)}
      className={cn('shrink-0 rounded-md bg-bg-overlay object-cover', className)}
    />
  )
}

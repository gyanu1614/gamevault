'use client'

import { useState } from 'react'
import { ImageBrokenIcon } from '@phosphor-icons/react/dist/csr/ImageBroken'

/**
 * Item art for value cards / heroes / rails. Remote catalogue art is
 * hotlinked and sometimes 404s upstream (e.g. Adopt Me's Amethyst Penguin),
 * so a failed load swaps to a quiet placeholder instead of the browser's
 * broken-image glyph + alt text.
 */
export function ValueArt({
  src,
  alt,
  size,
  pixelated = false,
  className = '',
  priority = false,
}: {
  src: string | null | undefined
  alt: string
  size: number
  pixelated?: boolean
  className?: string
  priority?: boolean
}) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <span
        role="img"
        aria-label={alt}
        className={`flex items-center justify-center rounded-md bg-white/[0.04] text-text-disabled ${className}`}
        style={{ width: size, height: size }}
      >
        <ImageBrokenIcon size={Math.round(size * 0.32)} weight="duotone" aria-hidden />
      </span>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote catalogue art
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailed(true)}
      className={`object-contain drop-shadow-[0_10px_16px_rgba(0,0,0,0.55)] ${pixelated ? '[image-rendering:pixelated]' : ''} ${className}`}
      style={{ width: size, height: size }}
    />
  )
}

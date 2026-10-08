'use client'

import { useEffect, useRef, useState } from 'react'
import { ImageBrokenIcon } from '@phosphor-icons/react/dist/csr/ImageBroken'
import { ImageIcon } from '@phosphor-icons/react/dist/csr/Image'

/**
 * Item art for value cards / heroes / rails. Remote catalogue art is
 * hotlinked and sometimes 404s upstream (a few Adopt Me pets do),
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
  'aria-hidden': ariaHidden,
}: {
  src: string | null | undefined
  alt: string
  size: number
  pixelated?: boolean
  className?: string
  priority?: boolean
  /** Hide from screen readers when the name is already visible next to the art. */
  'aria-hidden'?: boolean
}) {
  const [failed, setFailed] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  // A server-rendered <img> can fail BEFORE hydration attaches onError; catch
  // that case once on mount (complete + no pixels = failed load).
  useEffect(() => {
    const img = imgRef.current
    if (img && img.complete && img.naturalWidth === 0) setFailed(true)
  }, [src])
  if (!src || failed) {
    return (
      <span
        role="img"
        aria-label={alt}
        aria-hidden={ariaHidden}
        className={`flex items-center justify-center rounded-md bg-white/[0.04] text-text-disabled ${className}`}
        style={{ width: size, height: size }}
      >
        {/* No art at all (e.g. account brackets) reads as a plain image slot;
            only a load that FAILED shows the broken glyph. */}
        {src ? (
          <ImageBrokenIcon size={Math.round(size * 0.32)} weight="duotone" aria-hidden />
        ) : (
          <ImageIcon size={Math.round(size * 0.32)} weight="duotone" aria-hidden />
        )}
      </span>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote catalogue art
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      aria-hidden={ariaHidden}
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

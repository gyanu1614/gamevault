'use client'

import { useEffect, useRef, useState } from 'react'

/** Game logo (or a 2-3 letter monogram when a game has no art, or its art
 *  fails to load — never the browser's broken-image glyph). */
export function GameMark({
  name,
  imageUrl,
  size,
}: {
  name: string
  imageUrl: string | null | undefined
  size: 'trigger' | 'row'
}) {
  const [failed, setFailed] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  // A server-rendered <img> can fail before hydration attaches onError.
  useEffect(() => {
    const img = imgRef.current
    if (img && img.complete && img.naturalWidth === 0) setFailed(true)
  }, [imageUrl])
  const box =
    size === 'trigger'
      ? 'h-[28px] w-[28px] sm:h-[34px] sm:w-[34px]'
      : 'h-[26px] w-[26px]'
  if (imageUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote game logo
      <img
        ref={imgRef}
        src={imageUrl}
        alt={`${name} logo`}
        aria-hidden
        onError={() => setFailed(true)}
        className={`${box} shrink-0 rounded-md object-cover`}
      />
    )
  }
  return (
    <span
      aria-hidden
      className={`${box} flex shrink-0 items-center justify-center rounded-md bg-bg-overlay text-[10px] font-bold text-text-secondary ${
        size === 'trigger' ? 'sm:text-[11px]' : ''
      }`}
    >
      {name.slice(0, size === 'trigger' ? 3 : 2).toUpperCase()}
    </span>
  )
}

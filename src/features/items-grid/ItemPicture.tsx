'use client'

import { useEffect, useRef, useState } from 'react'

/** Never blow the art up beyond this many times its own pixels (it blurs). */
const MAX_UPSCALE = 1.5

/**
 * A catalogue picture on a grid card. Lazy, held near its own resolution once
 * loaded so small art stays sharp, and a picture that fails to load (storage
 * hiccup, a moved file) turns into a quiet placeholder instead of the
 * browser's broken-image box with the alt text in it. A picture that settled
 * before hydration (its load/error event fired before React listened) is
 * read off the element once mounted.
 */
export function ItemPicture({ src, name }: { src: string | null; name: string }) {
  const ref = useRef<HTMLImageElement>(null)
  const [cap, setCap] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el?.complete) return
    if (el.naturalWidth > 0) setCap(el.naturalWidth * MAX_UPSCALE)
    else setFailed(true)
  }, [src])

  if (!src || failed) {
    return (
      <span className="font-medium uppercase tracking-wider text-text-tertiary" style={{ fontSize: 'var(--fs-micro)' }}>
        No Image
      </span>
    )
  }
  return (
    /* eslint-disable-next-line @next/next/no-img-element -- catalogue art from storage, same as the value pages */
    <img
      ref={ref}
      src={src}
      alt={name}
      width={128}
      height={128}
      loading="lazy"
      decoding="async"
      onLoad={(e) => setCap(e.currentTarget.naturalWidth * MAX_UPSCALE)}
      onError={() => setFailed(true)}
      style={cap ? { maxWidth: cap, maxHeight: cap } : undefined}
      // Sized against the positioned box, not the grid track: a big source can never spill out.
      className="absolute inset-0 m-auto h-[76%] w-[76%] object-contain drop-shadow-[0_10px_14px_rgba(0,0,0,0.4)]"
    />
  )
}

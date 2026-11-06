'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

import { PICTURE_WIDTHS, pictureUrl } from '@/lib/images/picture-url'

/** Never blow the art up beyond this many times its own pixels (it blurs). */
const MAX_UPSCALE = 1.5
/** A failed picture gets these two more tries: the image route answers 502 (never cached) when Storage is slow. */
const RETRY_DELAYS_MS = [1500, 4000]

/**
 * A catalogue picture (grid cards, the pet page's tile), sized to its positioned
 * box so a big source can never spill out and held near its own resolution
 * once loaded so small art stays sharp. A failed load waits and tries again,
 * hidden meanwhile, so a storage hiccup never shows the browser's broken-image
 * box; after the retries the quiet placeholder shows. A picture that settled
 * before hydration (its event fired before React listened) is read off the
 * element once mounted.
 */
export function ItemPicture({
  src,
  name,
  className,
  placeholder = 'No Image',
  size = 128,
  priority = false,
}: {
  src: string | null
  name: string
  /** Its share of the box and any shadow. */
  className: string
  placeholder?: ReactNode
  size?: number
  /** The page's main picture: load first, never lazily. */
  priority?: boolean
}) {
  const ref = useRef<HTMLImageElement>(null)
  const [cap, setCap] = useState<number | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [waiting, setWaiting] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el?.complete) return
    if (el.naturalWidth > 0) setCap(el.naturalWidth * MAX_UPSCALE)
    else setWaiting(true)
  }, [])

  useEffect(() => {
    if (!waiting) return
    const delay = RETRY_DELAYS_MS[attempt]
    if (delay == null) {
      setFailed(true)
      return
    }
    const timer = setTimeout(() => {
      setAttempt((a) => a + 1)
      setWaiting(false)
    }, delay)
    return () => clearTimeout(timer)
  }, [waiting, attempt])

  if (!src || failed) {
    return (
      <span className="font-medium uppercase tracking-wider text-text-tertiary" style={{ fontSize: 'var(--fs-micro)' }}>
        {placeholder}
      </span>
    )
  }
  return (
    /* eslint-disable-next-line @next/next/no-img-element -- catalogue art from storage, same as the value pages */
    <img
      // A new element per try: the browser really asks again.
      key={attempt}
      ref={ref}
      src={pictureUrl(src, size > PICTURE_WIDTHS.card ? 'big' : 'card')}
      alt={name}
      width={size}
      height={size}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      onLoad={(e) => setCap(e.currentTarget.naturalWidth * MAX_UPSCALE)}
      onError={() => setWaiting(true)}
      style={{ ...(cap ? { maxWidth: cap, maxHeight: cap } : null), visibility: waiting ? 'hidden' : undefined }}
      className={`absolute inset-0 m-auto object-contain ${className}`}
    />
  )
}

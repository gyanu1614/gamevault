'use client'

import { useEffect, useRef } from 'react'

interface CountUpOptions {
  target: number
  duration?: number
  prefix?: string
  suffix?: string
  decimals?: number
  compact?: boolean
}

function formatValue(v: number, opts: CountUpOptions): string {
  const { prefix = '', suffix = '', decimals = 0, compact = false } = opts
  let out: string
  if (compact) {
    out = v >= 1_000_000
      ? (v / 1_000_000).toFixed(2).replace(/\.00$/, '') + 'M'
      : Math.round(v).toLocaleString()
  } else {
    out = v.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  }
  return prefix + out + suffix
}

export function useCountUp(opts: CountUpOptions) {
  const elRef = useRef<HTMLElement | null>(null)
  const prefersReduced = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false

  useEffect(() => {
    const el = elRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry.isIntersecting) return
        observer.disconnect()

        if (prefersReduced) {
          el.textContent = formatValue(opts.target, opts)
          return
        }

        const duration = opts.duration ?? 1400
        const t0 = performance.now()

        const tick = (now: number) => {
          const progress = Math.min(1, (now - t0) / duration)
          const eased = 1 - Math.pow(1 - progress, 3)
          el.textContent = formatValue(opts.target * eased, opts)
          if (progress < 1) requestAnimationFrame(tick)
          else el.textContent = formatValue(opts.target, opts)
        }

        requestAnimationFrame(tick)
      },
      { threshold: 0.3 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [opts, prefersReduced])

  return elRef
}

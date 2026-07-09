'use client'

import { cn } from '@/lib/utils'

/**
 * SilverIcon — the site's uniform icon material.
 *
 * Source 3D icons/SVGs come in any color; every UI icon renders through
 * this: grayscaled to glossy silver (with a whisper of green) and a
 * white glass-shine overlay CSS-masked to the icon's own silhouette.
 * Keep brightness ≤ 1.05 and contrast ≥ 1.2 — see the
 * silver-glass-3d-icons memory note. Swap `src` freely; the material
 * stays consistent.
 */
export function SilverIcon({ src, className }: { src: string; className?: string }) {
  const mask: React.CSSProperties = {
    WebkitMaskImage: `url(${src})`,
    maskImage: `url(${src})`,
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
  }
  return (
    <span className={cn('relative inline-block flex-none select-none', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        aria-hidden
        className="h-full w-full object-contain [filter:grayscale(1)_sepia(0.15)_hue-rotate(40deg)_saturate(1.05)_brightness(1.05)_contrast(1.2)_drop-shadow(0_4px_6px_rgba(0,0,0,0.55))]"
      />
      {/* glass shine, clipped to the icon shape */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(150deg,rgba(255,255,255,0.42),rgba(255,255,255,0.12)_38%,rgba(255,255,255,0)_60%)]"
        style={mask}
      />
    </span>
  )
}

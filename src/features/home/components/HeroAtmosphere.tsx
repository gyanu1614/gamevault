'use client'

/**
 * HeroAtmosphere — decorative depth over the hero art.
 *
 * No library: this is three CSS gradients and a handful of absolutely
 * positioned dots. A particle library (tsparticles, three, vanta) would add
 * 50-150KB and a JS render loop to do the same job worse — these layers are
 * GPU-composited and cost nothing to animate.
 *
 * Layers, back to front:
 *   1. Bloom      — soft accent-tinted light from above, sells depth
 *   2. Sheen      — a wide diagonal highlight that drifts slowly
 *   3. Motes      — sparse drifting specks, the only "floating" element
 *
 * All inert and aria-hidden. Every loop is disabled under
 * prefers-reduced-motion via the shared rule in globals.css.
 */

/** Deterministic so server and client markup match — no Math.random(). */
const MOTES = [
  { left: 12, top: 28, size: 2, delay: 0, duration: 19 },
  { left: 23, top: 62, size: 3, delay: 4, duration: 24 },
  { left: 34, top: 16, size: 2, delay: 9, duration: 21 },
  { left: 46, top: 47, size: 2, delay: 2, duration: 26 },
  { left: 57, top: 71, size: 3, delay: 12, duration: 18 },
  { left: 68, top: 24, size: 2, delay: 6, duration: 23 },
  { left: 76, top: 55, size: 2, delay: 15, duration: 20 },
  { left: 84, top: 35, size: 3, delay: 1, duration: 27 },
  { left: 91, top: 66, size: 2, delay: 8, duration: 22 },
  { left: 18, top: 80, size: 2, delay: 11, duration: 25 },
  { left: 62, top: 88, size: 2, delay: 5, duration: 19 },
  { left: 40, top: 83, size: 2, delay: 14, duration: 28 },
] as const

export function HeroAtmosphere() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* 1 — Bloom: light spilling in from above the fold. Kept low: the art
          below sits under 90% ink, so anything stronger reads as haze on
          black rather than light on a scene. */}
      <div
        className="absolute inset-x-0 top-0 h-[70%]"
        style={{
          background:
            'radial-gradient(70% 100% at 50% 0%, rgba(var(--color-accent-text-rgb, 86, 184, 127), 0.05) 0%, rgba(var(--color-accent-text-rgb, 86, 184, 127), 0.02) 38%, transparent 72%)',
        }}
      />

      {/* 2 — Sheen: wide diagonal highlight, drifting.
          It sits ABOVE the fade, so it must carry its own vertical falloff:
          a highlight that paints at full strength down to the clip edge adds
          light the page below doesn't have, and the boundary reads as a
          lightness step (measured at +8/channel before this mask). The mask
          takes it to zero well before the edge, so both sides resolve to the
          same ground colour. */}
      <div
        data-hero-sheen=""
        className="absolute -inset-x-1/4 top-0 h-full"
        style={{
          background:
            'linear-gradient(104deg, transparent 32%, rgba(255,255,255,0.022) 47%, rgba(255,255,255,0.035) 50%, rgba(255,255,255,0.022) 53%, transparent 68%)',
          maskImage: 'linear-gradient(to bottom, #000 0%, #000 38%, transparent 72%)',
          WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, #000 38%, transparent 72%)',
          animation: 'dm-sheen 18s ease-in-out infinite',
          willChange: 'transform',
        }}
      />

      {/* 3 — Motes: the floating specks. Wrapped in the same falloff as the
          sheen so specks near the bottom don't paint light past the fade. */}
      <div
        className="absolute inset-0"
        style={{
          maskImage: 'linear-gradient(to bottom, #000 0%, #000 38%, transparent 72%)',
          WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, #000 38%, transparent 72%)',
        }}
      >
      {MOTES.map((m, i) => (
        <span
          key={i}
          data-hero-mote=""
          className="absolute rounded-full"
          style={{
            left: `${m.left}%`,
            top: `${m.top}%`,
            width: m.size,
            height: m.size,
            background: 'rgba(255,255,255,0.32)',
            boxShadow: '0 0 5px rgba(255,255,255,0.18)',
            animation: `dm-mote ${m.duration}s ease-in-out ${m.delay}s infinite`,
            willChange: 'transform, opacity',
          }}
        />
      ))}
      </div>
    </div>
  )
}

'use client'

/**
 * PreFooterCtaBand
 * Full-bleed pre-footer CTA band per handoff spec (design_handoff_cta_band/README.md).
 *
 * Layer stack (back → front):
 *   1. Game key art — darkened via CSS filter
 *   2. Grade layers: color-blend radial + flat dark + green cast
 *   3. Falloff radial (slow light drift animation)
 *   4. Top fade → page background
 *   5. Bottom fade → page background
 *   6. Text scrim (behind copy only)
 *   7. Content (h2, p, button)
 *
 * Motion:
 *   - Art breathes: CSS keyframe dm-breathe 25s
 *   - Light drifts: CSS keyframe dm-lightdrift 40s
 *   - Cursor parallax: framer-motion useSpring, fine pointer only
 *   - Button press: scale(0.97) on pointerdown, spring release
 *   - prefers-reduced-motion: all ambient motion disabled via CSS
 *
 * Artwork:
 *   Default: /hero/roblox.jpg (1920×1080). Supply any 16:9 image at
 *   ≥1600px wide. Place at /public/hero/{name}.jpg and pass as `artSrc`.
 *
 * Hardcoded values (not in token layer):
 *   - #18804B / #1D9459 / #13683C — deep green button (palette lift, not stock lime)
 *   - rgba(24,128,75,.09) — green cast overlay
 *   - rgba(14,17,21,.8) — text scrim ink
 *   - clamp(158px,19vw,264px) — section vertical padding (spec value)
 *   - clamp(20px,5vw,64px)   — section horizontal padding (spec value)
 *   These are spec-exact values that sit outside the DropMarket token set.
 */

import { useRef, useEffect, useState } from 'react'
import { useMotionValue, useSpring, motion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'

interface PreFooterCtaBandProps {
  /** 16:9 game key art. Default: /hero/roblox.jpg */
  artSrc?: string
  artWidth?: number
  artHeight?: number
  headline?: string
  support?: string
  buttonLabel?: string
  buttonHref?: string
}

export function PreFooterCtaBand({
  artSrc = '/hero/roblox.jpg',
  artWidth = 1920,
  artHeight = 1080,
  headline = 'Start Your Collection',
  support = 'Verified Sellers, Ready to Deliver.',
  buttonLabel = 'Browse Marketplace',
  buttonHref = '/browse',
}: PreFooterCtaBandProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const [pressed, setPressed] = useState(false)

  // Cursor parallax — framer-motion damped springs, fine pointer only
  const rawX = useMotionValue(0)
  const rawY = useMotionValue(0)
  const springConfig = { damping: 80, stiffness: 60, mass: 1.4 }
  const springX = useSpring(rawX, springConfig)
  const springY = useSpring(rawY, springConfig)

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)')
    if (!mq.matches) return

    const onMove = (e: MouseEvent) => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const nx = (e.clientX / vw) * 2 - 1  // -1..1
      const ny = (e.clientY / vh) * 2 - 1
      rawX.set(nx * -7)
      rawY.set(ny * -4)
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [rawX, rawY])

  return (
    <>
      <style>{`
        @keyframes dm-breathe {
          0%,100% { transform: translate3d(0, 0.5%, 0) scale(1.014); }
          50%      { transform: translate3d(0, -0.9%, 0) scale(1.036); }
        }
        @keyframes dm-lightdrift {
          0%,100% { transform: translate3d(-2.4%, 0.9%, 0); }
          50%      { transform: translate3d(2.4%, -0.9%, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-band-art], [data-light-drift] {
            animation: none !important;
            transform: none !important;
            translate: none !important;
          }
        }
      `}</style>

      <section
        ref={sectionRef}
        style={{
          position: 'relative',
          overflow: 'hidden',
          padding: 'clamp(158px,19vw,264px) clamp(20px,5vw,64px)',
          background: '#171B21',
        }}
      >
        {/* ── Layer 1-2: Art + grade stack ──────────────────────── */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          <motion.div
            data-band-art=""
            style={{
              position: 'absolute',
              inset: '-9% 0',
              willChange: 'transform',
              animation: 'dm-breathe 25s cubic-bezier(.45,0,.55,1) infinite',
              translateX: springX,
              translateY: springY,
            }}
          >
            {/* Art — darkened first per spec */}
            <div style={{ position: 'absolute', inset: 0, filter: 'brightness(.66) saturate(.75) contrast(1.02)' }}>
              <Image
                src={artSrc}
                alt=""
                aria-hidden
                fill
                sizes="100vw"
                priority={false}
                style={{ objectFit: 'cover', objectPosition: 'center' }}
              />
            </div>

            {/* Grade 1: color-blend radial — tints toward base, never drains */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                background: 'radial-gradient(closest-side at 50% 54%, rgba(23,27,33,0) 0%, rgba(23,27,33,.5) 52%, rgba(23,27,33,1) 88%)',
                mixBlendMode: 'color',
                opacity: 0.25,
              }}
            />
            {/* Grade 2: flat dark */}
            <div
              aria-hidden="true"
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: '#171B21', opacity: 0.2 }}
            />
            {/* Grade 3: faint green cast */}
            <div
              aria-hidden="true"
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'rgba(24,128,75,.09)' }}
            />
          </motion.div>
        </div>

        {/* ── Layer 3: Falloff radial — slow light drift ─────────── */}
        <div
          data-light-drift=""
          aria-hidden="true"
          style={{
            position: 'absolute', inset: '-6%', pointerEvents: 'none',
            background: 'radial-gradient(closest-side at 50% 54%, rgba(23,27,33,0) 0%, rgba(23,27,33,.12) 40%, rgba(23,27,33,.62) 68%, rgba(23,27,33,.95) 88%)',
            animation: 'dm-lightdrift 40s cubic-bezier(.42,0,.58,1) infinite',
            willChange: 'transform',
          }}
        />

        {/* ── Layer 4: Top fade ──────────────────────────────────── */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '44%', pointerEvents: 'none',
            background: 'linear-gradient(180deg, #171B21 0%, rgba(23,27,33,.82) 34%, rgba(23,27,33,0) 100%)',
          }}
        />

        {/* ── Layer 5: Bottom fade ───────────────────────────────── */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: '34%', pointerEvents: 'none',
            background: 'linear-gradient(0deg, #171B21 0%, rgba(23,27,33,.8) 38%, rgba(23,27,33,0) 100%)',
          }}
        />

        {/* ── Layer 6: Text scrim (behind copy only) ─────────────── */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', top: '50%', left: '50%', pointerEvents: 'none',
            translate: '-50% -50%',
            width: 'min(1000px, 124%)', height: '400px',
            background: 'radial-gradient(closest-side, rgba(14,17,21,.8), rgba(14,17,21,.42) 46%, rgba(14,17,21,0) 78%)',
          }}
        />

        {/* ── Layer 7: Content ───────────────────────────────────── */}
        <div
          style={{
            position: 'relative', zIndex: 2,
            maxWidth: '680px', margin: '0 auto',
            textAlign: 'center', pointerEvents: 'none',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 'clamp(28px, 3.4vw, 42px)',
              fontWeight: 800,
              lineHeight: 1.14,
              letterSpacing: '-.025em',
              textWrap: 'balance' as React.CSSProperties['textWrap'],
              color: 'var(--color-text-primary)',
            }}
          >
            {headline}
          </h2>

          <p
            style={{
              margin: '16px auto 0',
              fontSize: 'clamp(15px, 1.15vw, 17px)',
              fontWeight: 400,
              lineHeight: 1.6,
              color: 'var(--color-text-secondary)',
              whiteSpace: 'nowrap',
            }}
          >
            {support}
          </p>

          <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'center' }}>
            <Link
              href={buttonHref}
              onPointerDown={() => setPressed(true)}
              onPointerUp={() => setPressed(false)}
              onPointerLeave={() => setPressed(false)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '44px',
                height: '40px',
                padding: '0 22px',
                border: 0,
                borderRadius: '6px',
                background: pressed ? '#13683C' : '#18804B',
                color: '#FFFFFF',
                fontSize: '15px',
                fontWeight: 700,
                letterSpacing: '-.01em',
                cursor: 'pointer',
                pointerEvents: 'auto',
                textDecoration: 'none',
                transform: pressed ? 'scale(.97)' : 'scale(1)',
                transition: 'background 140ms var(--ease-default), transform 90ms var(--ease-default)',
                outline: 'none',
              }}
              onMouseEnter={e => { if (!pressed) (e.currentTarget as HTMLElement).style.background = '#1D9459' }}
              onMouseLeave={e => { if (!pressed) (e.currentTarget as HTMLElement).style.background = '#18804B' }}
              className="focus-visible:shadow-[0_0_0_3px_rgba(24,128,75,.55)]"
            >
              {buttonLabel}
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}

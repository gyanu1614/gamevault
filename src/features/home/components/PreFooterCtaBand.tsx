'use client'

/**
 * PreFooterCtaBand
 *
 * Layer stack (back → front), all position:absolute siblings on <section>:
 *   1. Art drift wrapper — breathing keyframe, cursor parallax via spring
 *   2. Grade A — color-blend radial (tints art toward page base)
 *   3. Grade B — flat dark at 20% opacity
 *   4. Grade C — faint green cast
 *   5. Falloff radial — slow light-drift keyframe, centre-bright vignette
 *   6. Top fade  — linear to page bg, kills the hard edge under navbar
 *   7. Bottom fade — linear to page bg, kills the hard edge above footer
 *   8. Text scrim — tight radial behind copy only
 *   9. Content — z-index:2
 *
 * Height: min 320px mobile / 420px desktop, max 520px — never full-viewport.
 * Vertical padding replaces fixed padding with flex centering.
 */

import { useEffect, useState } from 'react'
import { useMotionValue, useSpring, motion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'

interface PreFooterCtaBandProps {
  /** Clean in-game screenshot, 16:9, ≥1600px wide. No baked-in text or logos. */
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
  const [pressed, setPressed] = useState(false)

  const rawX = useMotionValue(0)
  const rawY = useMotionValue(0)
  const springConfig = { damping: 80, stiffness: 60, mass: 1.4 }
  const springX = useSpring(rawX, springConfig)
  const springY = useSpring(rawY, springConfig)

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)')
    if (!mq.matches) return
    const onMove = (e: MouseEvent) => {
      rawX.set((e.clientX / window.innerWidth) * 2 - 1)
      rawY.set((e.clientY / window.innerHeight) * 2 - 1)
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
        style={{
          position: 'relative',
          overflow: 'hidden',
          background: '#171B21',
          /* Height: clamp between mobile-min and desktop-max, never full-viewport */
          minHeight: 'clamp(320px, 36vw, 520px)',
          maxHeight: 'clamp(320px, 36vw, 520px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 clamp(20px, 5vw, 64px)',
        }}
      >

        {/* ── Layer 1: Art — breathing drift, cursor parallax ─────── */}
        {/*
          Isolation is NOT set here so the grade layers above can blend
          against the art via mix-blend-mode. The art wrapper sits in its
          own overflow:hidden clip so the 9% bleed doesn't show.
        */}
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
            <Image
              src={artSrc}
              alt=""
              aria-hidden
              fill
              sizes="100vw"
              priority={false}
              style={{
                objectFit: 'cover',
                objectPosition: 'center',
                /* Darken first — art should sit well back */
                filter: 'brightness(.55) saturate(.70) contrast(1.05)',
              }}
            />
          </motion.div>
        </div>

        {/* ── Layer 2: Grade A — color-blend radial ───────────────── */}
        {/*
          Tints the art toward the page base tone progressively from
          centre to edge. mix-blend-mode:color works here because this
          div is a SIBLING of the art container (same stacking context as
          <section>), not a child of the motion.div (which creates its own
          stacking context via will-change:transform, breaking blend modes).
        */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(closest-side at 50% 54%, rgba(23,27,33,0) 0%, rgba(23,27,33,.5) 52%, rgba(23,27,33,1) 88%)',
            mixBlendMode: 'color',
            opacity: 0.3,
          }}
        />

        {/* ── Layer 3: Grade B — flat dark ────────────────────────── */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: '#171B21',
            opacity: 0.25,
          }}
        />

        {/* ── Layer 4: Grade C — faint green cast ─────────────────── */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'rgba(24,128,75,.09)',
          }}
        />

        {/* ── Layer 5: Falloff radial — slow light drift ───────────── */}
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

        {/* ── Layer 6: Top fade — resolves to exact page bg token ── */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '52%',
            pointerEvents: 'none',
            background: 'linear-gradient(180deg, var(--color-bg-base) 0%, var(--color-bg-base) 4%, rgba(23,27,33,.92) 22%, rgba(23,27,33,.6) 48%, rgba(23,27,33,0) 100%)',
          }}
        />

        {/* ── Layer 7: Bottom fade — resolves to exact page bg token ─ */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: '52%',
            pointerEvents: 'none',
            background: 'linear-gradient(0deg, var(--color-bg-base) 0%, var(--color-bg-base) 4%, rgba(23,27,33,.92) 22%, rgba(23,27,33,.6) 48%, rgba(23,27,33,0) 100%)',
          }}
        />

        {/* ── Layer 8: Text scrim ──────────────────────────────────── */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', top: '50%', left: '50%',
            translate: '-50% -50%',
            width: 'min(1000px, 124%)', height: '400px',
            pointerEvents: 'none',
            background: 'radial-gradient(closest-side, rgba(14,17,21,.82), rgba(14,17,21,.44) 46%, rgba(14,17,21,0) 78%)',
          }}
        />

        {/* ── Layer 9: Content ─────────────────────────────────────── */}
        <div
          style={{
            position: 'relative', zIndex: 2,
            maxWidth: '680px', width: '100%',
            textAlign: 'center', pointerEvents: 'none',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 'clamp(26px, 3.4vw, 36px)',
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
              margin: '14px auto 0',
              fontSize: '16px',
              fontWeight: 400,
              lineHeight: 1.6,
              color: 'var(--color-text-secondary)',
              whiteSpace: 'nowrap',
            }}
          >
            {support}
          </p>

          <div style={{ marginTop: '28px', display: 'flex', justifyContent: 'center' }}>
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

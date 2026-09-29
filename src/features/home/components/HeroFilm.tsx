'use client'

/**
 * HeroFilm — section 1 of the homepage: a scroll film.
 *
 * A tall section with a sticky, viewport-high stage. Scrolling through the
 * section scrubs the stage through two beats, reversibly:
 *
 *   1. Hero — headline, subtext, search and category shortcuts, centred
 *      over the dimmed hero art.
 *   2. Statement — the copy lifts away, the veil over the hero art lifts
 *      so the art shines, and the statement plus four category tiles come
 *      into focus and hold. The stage then releases and they scroll away
 *      with it, into Popular Games.
 *
 * (A 3D "Drop" crate for beat 1 is parked on branch wip/hero-drop-crate.)
 *
 * Full-bleed by design (the stage is the hero's art, which the section
 * contract allows to be full width); the copy inside opts into the page
 * measure. It sets no padding or margin of its own — the rhythm gap below
 * it is the page's.
 *
 * Requires `.page-stage` to clip with `overflow: clip`, not `hidden`:
 * `hidden` makes the stage a scroll container, and sticky would pin to it
 * instead of the viewport.
 *
 * Motion discipline:
 *   - Scroll drives motion values only (useScroll/useTransform); nothing
 *     here re-renders per frame. The 3D scene reads the same values.
 *   - The entrance is CSS, not a mount animation, so the server HTML paints
 *     visible without waiting for hydration.
 *   - Reduced motion: no film. The stage renders once, static (globals.css).
 */

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion'
import { Crown } from 'lucide-react'
import { SilverIcon } from '@/components/ui/silver-icon'
import { GridSpotlight } from './GridSpotlight'
import { HeroSearch } from './HeroSearch'

/** Multi-game shortcuts. Every href was checked against production (200). */
const SHORTCUTS = [
  { label: 'Valorant Accounts', href: '/valorant/buy-accounts', icon: 'accounts' },
  { label: 'Robux', href: '/roblox/buy-robux', icon: 'currency' },
  { label: 'V-Bucks', href: '/fortnite/buy-vbucks', icon: 'currency' },
  { label: 'CS2 Skins', href: '/cs2/buy-items', icon: 'items' },
  { label: 'GTA Accounts', href: '/gta-vi/buy-accounts', icon: 'accounts' },
] as const

/** Beat 2's proof row — the same claims the homepage TrustStrip makes. */
const PROOF = [
  { icon: '/icons/set/verified.svg', label: 'Verified Sellers' },
  { icon: '/icons/set/wallet.svg', label: 'Secure Payments' },
  { icon: '/icons/set/support.svg', label: 'Real Human Support' },
] as const

/** A house category glyph, masked so it takes the platinum fill. */
function Glyph({ icon, className }: { icon: string; className: string }) {
  return (
    <span
      aria-hidden
      className={className}
      style={{
        maskImage: `url(/icons/categories/${icon}.svg)`,
        WebkitMaskImage: `url(/icons/categories/${icon}.svg)`,
      }}
    />
  )
}

/**
 * The hero art (R6 key art) and its normalising filter. The filter makes
 * any plate sit at the same weight under the veil, so swapping the art
 * never means retuning the veil.
 */
const HERO_ART_SRC = '/hero/home.avif'
const HERO_ART_NORMALISE = 'brightness(0.5) contrast(0.75) saturate(0.6)'

/**
 * Beat 2's four ways in. Each opens the navbar's own category menu (the
 * desktop dropdown, or the mobile menu's category screen) through the
 * `dm:open-category` event the navbar already listens for — there are no
 * category landing pages to link to. Glyphs are the house category set.
 */
const CATEGORIES = [
  { id: 'currency', label: 'Currency', icon: 'currency' },
  { id: 'accounts', label: 'Accounts', icon: 'accounts' },
  { id: 'items', label: 'Items', icon: 'items' },
  { id: 'top-up', label: 'Top Ups', icon: 'top-up' },
] as const

function HeroCategory({
  category,
  index,
  progress,
}: {
  category: (typeof CATEGORIES)[number]
  index: number
  progress: MotionValue<number>
}) {
  // Staggered arrival just behind the statement.
  const start = 0.3 + index * 0.035
  const end = start + 0.12
  const opacity = useTransform(progress, [start, end], [0, 1])
  const y = useTransform(progress, [start, end], [36, 0])

  return (
    <motion.li style={{ opacity, y }}>
      <button
        type="button"
        className="hero-cat group"
        onClick={() => window.dispatchEvent(new CustomEvent('dm:open-category', { detail: category.id }))}
      >
        <span className="hero-cat__orb">
          <Glyph icon={category.icon} className="hero-cat__glyph" />
        </span>
        <span aria-hidden className="hero-cat__pool" />
        <span className="hero-cat__label">{category.label}</span>
      </button>
    </motion.li>
  )
}

export function HeroFilm() {
  const filmRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()

  const { scrollYProgress } = useScroll({ target: filmRef, offset: ['start start', 'end end'] })
  // Reduced motion: every transform reads a progress that never moves, so
  // the stage renders once at its resting state.
  const still = useMotionValue(0)
  const p = reduceMotion ? still : scrollYProgress

  // Which beat is on screen. Only flips at the midpoint, so this re-renders
  // twice per pass, not per frame. The hidden beat is made `inert`: faded
  // elements are still in the DOM, and without it Tab walks into invisible
  // category tiles (beat 1) or the invisible search (beat 2).
  const [beat, setBeat] = useState<1 | 2>(1)
  useMotionValueEvent(p, 'change', (v) => setBeat(v > 0.3 ? 2 : 1))
  // React 18 has no boolean `inert`: `true` warns and is dropped, the empty
  // string renders the attribute (same pattern as FaqCards).
  const inert = (hidden: boolean) => (hidden ? { inert: '' as unknown as boolean } : {})

  // Pointer, normalised to -0.5..0.5 and smoothed.
  const rawX = useMotionValue(0)
  const rawY = useMotionValue(0)
  const px = useSpring(rawX, { stiffness: 60, damping: 20, mass: 0.6 })
  const py = useSpring(rawY, { stiffness: 60, damping: 20, mass: 0.6 })

  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    const onMove = (e: PointerEvent) => {
      rawX.set(e.clientX / window.innerWidth - 0.5)
      rawY.set(e.clientY / window.innerHeight - 0.5)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [rawX, rawY])

  // Beat 1 copy leaves first, so it's gone before the crate reaches centre.
  const copyOpacity = useTransform(p, [0.02, 0.24], [1, 0])
  const copyY = useTransform(p, [0.02, 0.24], [0, -70])
  const copyFilter = useTransform(p, [0.02, 0.24], ['blur(0px)', 'blur(8px)'])
  const copyEvents = useTransform(p, (v) => (v > 0.08 ? 'none' : 'auto'))

  // Beat 2 statement: arrives from depth and holds. It does NOT fade out:
  // it is still on the stage when the sticky releases, so it scrolls away
  // with the page instead of leaving an empty stage to scroll past.
  const lineOpacity = useTransform(p, [0.22, 0.42], [0, 1])
  const lineScale = useTransform(p, [0.22, 0.42], [0.86, 1])
  const lineFilter = useTransform(p, [0.22, 0.42], ['blur(14px)', 'blur(0px)'])
  const catsEvents = useTransform(p, (v) => (v > 0.4 ? 'auto' : 'none'))

  // The hero art. Suppressed behind beat 1's copy; in beat 2 the veil
  // lifts and the camera keeps pushing, so the art is what the statement
  // stands in front of.
  const artScale = useTransform(p, [0, 1], [1.04, 1.2])
  const artX = useTransform(px, (v) => v * -18)
  const veilOpacity = useTransform(p, [0, 0.18, 0.46, 1], [1, 1, 0.35, 0.5])
  const scrimOpacity = useTransform(p, [0.2, 0.44], [0, 1])

  // Light from above drifts with the push and the pointer.
  const lightScale = useTransform(p, [0, 0.8], [1, 1.25])
  const lightX = useTransform(px, (v) => v * -24)

  return (
    <section ref={filmRef} aria-label="DropMarket" className="hero-film">
      <div ref={stageRef} className="hero-film__stage">
        {/* The hero art. It carries its own normalising filter; the veil
            above it is not tuned per image (swap the art, keep the veil). */}
        <motion.div aria-hidden className="hero-film__art-bg" style={{ scale: artScale, x: artX }}>
          <Image
            src={HERO_ART_SRC}
            alt=""
            fill
            sizes="100vw"
            priority
            // Already AVIF; the optimizer would only re-encode a lossy file.
            unoptimized
            className="object-cover object-center"
            style={{ filter: HERO_ART_NORMALISE }}
          />
        </motion.div>
        <motion.div aria-hidden className="hero-film__veil" style={{ opacity: veilOpacity }} />

        <motion.div aria-hidden className="hero-film__light" style={{ scale: lightScale, x: lightX }} />

        {/* The only grid: invisible at rest, revealed around the pointer.
            Wrapped so it paints above the art, but it tracks the whole stage. */}
        <div aria-hidden className="hero-film__spot">
          <GridSpotlight bleed={0} hostRef={stageRef} />
        </div>

        {/* Keeps the statement legible once the art is lit behind it. */}
        <motion.div aria-hidden className="hero-film__scrim" style={{ opacity: scrimOpacity }} />

        {/* Beat 1 copy. */}
        <motion.div
          className="hero-film__copy"
          style={{ opacity: copyOpacity, y: copyY, filter: copyFilter }}
          {...inert(beat === 2)}
        >
          <div className="page-measure">
            {/* Centred column. Only the column takes the pointer, never the
                whole layer, so the grid spotlight still tracks around it. */}
            <motion.div className="mx-auto max-w-[680px] text-center" style={{ pointerEvents: copyEvents }}>
              <h1 className="hero-film__title">
                {/* The smaller lead-in line; the crown sits on "Gamer's".
                    The line box is padded up so the reveal mask doesn't clip
                    the crown, which pokes above the cap height. */}
                <span
                  className="hero-film__line hero-film__line--lead"
                  style={{ '--enter-delay': '0.1s' } as React.CSSProperties}
                >
                  <span>
                    The{' '}
                    <span className="hero-film__crowned">
                      Gamer&apos;s
                      <Crown aria-hidden className="hero-film__crown" strokeWidth={2} />
                    </span>
                  </span>
                </span>
                <span className="hero-film__line hero-film__line--muted" style={{ '--enter-delay': '0.2s' } as React.CSSProperties}>
                  <span>Marketplace.</span>
                </span>
              </h1>

              {/* Two rows: what you can buy, then the promise. */}
              <p className="hero-film__rise hero-film__sub" style={{ '--enter-delay': '0.35s' } as React.CSSProperties}>
                <span>Buy Skins, Accounts and In-Game Currency From Verified Sellers.</span>
                <span className="hero-film__sub-promise">Delivery Guaranteed in Minutes or Full Refund.</span>
              </p>

              {/* relative z-10: the results panel must paint over the
                  shortcut row, and each .hero-film__rise is its own
                  stacking context (entrance animation). */}
              <div className="hero-film__rise relative z-10 mt-8" style={{ '--enter-delay': '0.45s' } as React.CSSProperties}>
                <HeroSearch />
              </div>

              <ul className="hero-film__rise hero-shortcuts mt-4" style={{ '--enter-delay': '0.55s' } as React.CSSProperties}>
                {SHORTCUTS.map((s) => (
                  <li key={s.href}>
                    <Link href={s.href} className="hero-shortcut">
                      <Glyph icon={s.icon} className="hero-shortcut__glyph" />
                      {s.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </motion.div>

        {/* Beat 2 statement + the four ways in. Hidden under reduced motion. */}
        <motion.div
          aria-hidden={reduceMotion ? true : undefined}
          className="hero-film__statement"
          style={{ opacity: lineOpacity, scale: lineScale, filter: lineFilter }}
          {...inert(beat === 1)}
        >
          {/* data-nav-fill-at: the homepage navbar fills just before this
              line scrolls under it (navbar-floating.tsx). */}
          <p className="hero-film__badge" data-nav-fill-at>
            <Image src="/icons/safedrop-emblem.avif" alt="" width={30} height={30} />
            SafeDrop Protection
          </p>

          <p className="hero-film__statement-text">
            <span>Buy and Sell in Any Game.</span>
            <span className="hero-film__line--muted">
              Every Order <em className="hero-film__accent">Protected</em>.
            </span>
          </p>

          <motion.ul className="hero-cats" style={{ pointerEvents: catsEvents }}>
            {CATEGORIES.map((c, i) => (
              <HeroCategory key={c.id} category={c} index={i} progress={p} />
            ))}
          </motion.ul>

          <ul className="hero-film__proof">
            {PROOF.map((item) => (
              <li key={item.label}>
                <SilverIcon src={item.icon} className="h-6 w-6 shrink-0" />
                {item.label}
              </li>
            ))}
          </ul>
        </motion.div>

        <div aria-hidden className="hero-film__fade" />
      </div>
    </section>
  )
}

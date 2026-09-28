'use client'

/**
 * HeroFilm — section 1 of the homepage: a scroll film.
 *
 * A tall section with a sticky, viewport-high stage. Scrolling through the
 * section scrubs the stage through two beats, reversibly:
 *
 *   1. Hero — headline, search and category shortcuts on the left; game
 *      art cards floating at three depths on the right.
 *   2. Statement — the copy lifts away, the cards fly past the camera
 *      (outward from a vanishing point, growing and blurring), the veil
 *      over the hero art lifts so the art shines, and the statement plus
 *      four category tiles come into focus and hold. The stage then
 *      releases and they scroll away with it, into Popular Games.
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
 *     here re-renders per frame.
 *   - The entrance is CSS, not a mount animation, so the server HTML paints
 *     visible without waiting for hydration.
 *   - Reduced motion: no film. The stage renders once, static (globals.css).
 */

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionStyle,
  type MotionValue,
} from 'framer-motion'
import { SilverIcon } from '@/components/ui/silver-icon'
import { GridSpotlight } from './GridSpotlight'
import { HeroSearch } from './HeroSearch'

/**
 * The floating cards. Positions are % of the card region (wide layout: the
 * right-hand part of the page measure, see .hero-film__cards) and of the
 * stage (compact layout, `m`; cards without `m` are wide-only); `d` is depth — nearer cards are bigger, move
 * more with the pointer and fly out harder. Art is the same file Popular
 * Games uses, so every game here has a card below too.
 */
interface FilmCard {
  slug: string
  name: string
  x: number
  y: number
  w: number
  d: number
  r: number
  m?: { x: number; y: number; w: number }
}

const CARDS: FilmCard[] = [
  { slug: 'fortnite', name: 'Fortnite', x: 60, y: 52, w: 228, d: 1.15, r: 4, m: { x: 50, y: 79, w: 132 } },
  { slug: 'valorant', name: 'Valorant', x: 27, y: 47, w: 188, d: 0.9, r: -7, m: { x: 19, y: 81, w: 104 } },
  { slug: 'gta-vi', name: 'GTA VI', x: 90, y: 43, w: 172, d: 0.8, r: 8, m: { x: 81, y: 80, w: 104 } },
  { slug: 'roblox', name: 'Roblox', x: 41, y: 26, w: 126, d: 0.55, r: -10 },
  { slug: 'cs2', name: 'CS2', x: 79, y: 82, w: 150, d: 0.7, r: 6 },
  { slug: 'steal-a-brainrot', name: 'Steal a Brainrot', x: 76, y: 24, w: 116, d: 0.5, r: 11 },
  { slug: 'apex-legends', name: 'Apex Legends', x: 34, y: 81, w: 128, d: 0.6, r: -5 },
]

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
  const opacity = useTransform(progress, [start, start + 0.12], [0, 1])
  const y = useTransform(progress, [start, start + 0.12], [36, 0])

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

/** Where the camera "pushes" toward, as % of the stage. */
const VANISH = { x: 50, y: 45 }

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

function FlyingCard({
  card,
  index,
  fly,
  px,
  py,
  mobileRef,
}: {
  card: FilmCard
  index: number
  fly: MotionValue<number>
  px: MotionValue<number>
  py: MotionValue<number>
  mobileRef: React.MutableRefObject<boolean>
}) {
  // Nearer cards start moving a touch earlier, so the push reads as depth.
  const local = (v: number) => clamp01(v * (0.8 + card.d * 0.3))
  const pos = () => (mobileRef.current && card.m ? card.m : card)

  const x = useTransform(fly, (v) => {
    const push = Math.pow(local(v), 1.25)
    return `${(pos().x - VANISH.x) * 0.9 * push * 2.1 * card.d}vw`
  })
  const y = useTransform(fly, (v) => {
    const push = Math.pow(local(v), 1.25)
    return `${(pos().y - VANISH.y) * push * 2.1 * card.d}vh`
  })
  const scale = useTransform(fly, (v) => 1 + local(v) ** 2 * 3 * card.d)
  const opacity = useTransform(fly, (v) => 1 - clamp01((local(v) - 0.55) / 0.4))
  const filter = useTransform(fly, (v) => `blur(${(local(v) * 9 * card.d).toFixed(2)}px)`)

  // Pointer parallax, in px, on its own layer so it composes with the
  // scroll transform above instead of fighting it.
  const parX = useTransform(px, (v) => v * 28 * card.d)
  const parY = useTransform(py, (v) => v * 18 * card.d)
  const rotY = useTransform(px, (v) => v * 10)
  const rotX = useTransform(py, (v) => v * -8)

  return (
    <motion.div
      className="hero-film__card"
      data-mobile={card.m ? '' : undefined}
      style={{
        // Layout comes in as CSS custom properties (globals.css places the
        // card per breakpoint); motion owns transform, opacity and filter.
        ...({
          '--x': `${card.x}%`,
          '--y': `${card.y}%`,
          '--w': `${card.w}px`,
          '--mx': card.m ? `${card.m.x}%` : undefined,
          '--my': card.m ? `${card.m.y}%` : undefined,
          '--mw': card.m ? `${card.m.w}px` : undefined,
        } as MotionStyle),
        zIndex: Math.round(card.d * 10),
        x,
        y,
        scale,
        opacity,
        filter,
      }}
    >
      <motion.div style={{ x: parX, y: parY, rotateX: rotX, rotateY: rotY }}>
        <div
          className="hero-film__float"
          style={{ '--dur': `${6.5 + index * 0.8}s`, '--delay': `${-index * 1.1}s` } as React.CSSProperties}
        >
          <div className="hero-film__enter" style={{ '--enter-delay': `${0.25 + index * 0.08}s` } as React.CSSProperties}>
            <Link
              href={`/${card.slug}`}
              className="hero-film__art group"
              style={{ '--r': `${card.r}deg` } as React.CSSProperties}
              aria-label={card.name}
            >
              <Image
                src={`/games/art/${card.slug}.png`}
                alt=""
                fill
                // The nearest card is the largest element in the first
                // viewport, so it is the LCP candidate: load it first.
                priority={index === 0}
                sizes={`${card.w}px`}
                className="object-cover object-top"
              />
              <span aria-hidden className="hero-film__rim" />
              <span className="hero-film__name">{card.name}</span>
            </Link>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

export function HeroFilm() {
  const filmRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const mobileRef = useRef(false)

  const { scrollYProgress } = useScroll({ target: filmRef, offset: ['start start', 'end end'] })
  // Reduced motion: every transform reads a progress that never moves, so
  // the stage renders once at its resting state.
  const still = useMotionValue(0)
  const p = reduceMotion ? still : scrollYProgress

  // Pointer, normalised to -0.5..0.5 and smoothed.
  const rawX = useMotionValue(0)
  const rawY = useMotionValue(0)
  const px = useSpring(rawX, { stiffness: 60, damping: 20, mass: 0.6 })
  const py = useSpring(rawY, { stiffness: 60, damping: 20, mass: 0.6 })

  useEffect(() => {
    // Matches the compact layout breakpoint in globals.css.
    const mq = window.matchMedia('(max-width: 1023px)')
    const sync = () => (mobileRef.current = mq.matches)
    sync()
    mq.addEventListener('change', sync)

    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      return () => mq.removeEventListener('change', sync)
    }
    const onMove = (e: PointerEvent) => {
      rawX.set(e.clientX / window.innerWidth - 0.5)
      rawY.set(e.clientY / window.innerHeight - 0.5)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      mq.removeEventListener('change', sync)
      window.removeEventListener('pointermove', onMove)
    }
  }, [rawX, rawY])

  // Beat 1 → 2: the push. Cards fly out over the first ~half of the film.
  const fly = useTransform(p, [0.03, 0.5], [0, 1], { clamp: true })

  // Beat 1 copy leaves first, so it's gone before the cards pass it.
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

        {/* Cards live in the page measure so their spread tracks the copy. */}
        <div className="hero-film__cards" style={{ perspective: 1200 }}>
          {CARDS.map((card, i) => (
            <FlyingCard key={card.slug} card={card} index={i} fly={fly} px={px} py={py} mobileRef={mobileRef} />
          ))}
        </div>

        {/* Beat 1 copy. */}
        <motion.div
          className="hero-film__copy"
          style={{ opacity: copyOpacity, y: copyY, filter: copyFilter }}
        >
          <div className="page-measure">
            {/* Only the copy column takes the pointer, never the whole
                layer, so the cards beside it stay hoverable. */}
            <motion.div className="max-w-[600px]" style={{ pointerEvents: copyEvents }}>
              <h1 className="hero-film__title">
                <span className="hero-film__line" style={{ '--enter-delay': '0.1s' } as React.CSSProperties}>
                  <span>The Gamer&apos;s</span>
                </span>
                <span className="hero-film__line hero-film__line--muted" style={{ '--enter-delay': '0.2s' } as React.CSSProperties}>
                  <span>Marketplace.</span>
                </span>
              </h1>

              <p className="hero-film__rise mt-5 max-w-[46ch] text-body-lg text-text-secondary" style={{ '--enter-delay': '0.35s' } as React.CSSProperties}>
                Buy Skins, Accounts and In-Game Currency From Verified Sellers. Delivery Guaranteed in Minutes or Full
                Refund.
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

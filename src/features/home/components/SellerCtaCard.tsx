'use client'

/**
 * SellerCtaCard — one card of the seller bento.
 *
 * Two element types, because the interaction differs: a card with its own
 * button must NOT be a link (a link inside a link is invalid and breaks
 * keyboard navigation), so that card is an <article> whose button is the
 * only target. Cards without a button are wholly clickable <a>s.
 *
 * Three content layouts, alternating down the bento — see `layout`. Blocks
 * are pushed apart with mt-auto rather than absolute offsets, so a longer
 * title reflows instead of overlapping the art.
 *
 * Surfaces:
 *   'light'     the finished white card — see `.seller-card--light`
 *   'prototype' bare shell, no treatment yet
 */

import { ShineBorder } from '@/components/ui/shine-border'
import { motion, useReducedMotion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useId, useState, type CSSProperties } from 'react'

/**
 * TEMPORARY — card 3's background split treatment. Flip to compare the two
 * in the browser, then delete the loser and this flag along with it.
 *
 *   'tonal' — a diagonal light fall; the whole effect is the soft band
 *   'wave'  — a curved split with a 1px edge so it reads as deliberate
 */
type SplitVariant = 'tonal' | 'wave'
const SPLIT_DEFAULT: SplitVariant = 'wave'

/**
 * TEMPORARY — display face for the card titles. Switch in the browser with
 * ?font=archivo. Titles only this round: body, sub, step indicator, CTA
 * label and the section h2 all keep the current face.
 */
/**
 * TEMPORARY — card 3's coin decoration. Switch in the browser with
 * ?coins=full. 'clipped' lets coin A straddle the left border; 'full' keeps
 * all four inside. Same four instances and positions either way.
 */
type CoinStyle = 'clipped' | 'full'
const COIN_STYLE: CoinStyle = 'clipped'

/**
 * Three decor objects at three depths. STOP AT THREE.
 *
 * Depth is carried by size, opacity and blur together: the dollar is sharp
 * and nearest, ETH mid and slightly soft, the small coin faintest and
 * softest. Two break an edge — the dollar the left border, ETH the bottom —
 * and the third floats free.
 *
 * No two share a horizontal or vertical axis and every gap differs. All
 * three stay left of the wave's 62% entry so the figure keeps a clean
 * silhouette, and clear of the text column.
 */
const CARD3_DECOR = [
  {
    // Foreground. Breaks the LEFT border. Sharp, no blur.
    key: 'dollar',
    src: '/images/decor/coin-gold.webp',
    w: 426,
    h: 328,
    size: { clipped: 130, full: 80 },
    rotate: -13,
    opacity: 0.39,
    filter: 'saturate(0.62) brightness(0.92) contrast(1.05)',
    shadow: { blur: 12, alpha: 0.5, scale: 0.86 },
    top: '-6%',
    left: { clipped: '-5%', full: '53%' },
    clipBottom: false,
  },
  {
    // Midground. Breaks the BOTTOM border on the SAME hard line as the
    // figure — see `.seller-decor--cut`. Roughly 45% sits below the edge.
    key: 'eth',
    src: '/images/decor/eth.webp',
    w: 409,
    h: 415,
    size: { clipped: 96, full: 96 },
    rotate: 18,
    opacity: 0.3,
    filter: 'saturate(0.5) brightness(0.85) contrast(1.02) blur(0.4px)',
    shadow: { blur: 9, alpha: 0.4, scale: 0.8 },
    top: '82%',
    // 48%, not 39%: the centred text block runs to x=479 on a 1136px card
    // and the ETH began at x=443, so it sat under the Start Selling button.
    // 48% puts its left edge at x=545, clear with ~66px to spare.
    left: { clipped: '48%', full: '48%' },
    clipBottom: true,
  },
  {
    // Background. Floats free, no edge break — the second gold coin that was
    // here previously. Smaller, fainter and softer than the other two,
    // which is what carries it back in depth.
    key: 'coin-b',
    src: '/images/decor/coin-gold-b.webp',
    w: 409,
    h: 415,
    size: { clipped: 60, full: 60 },
    rotate: -19,
    opacity: 0.18,
    filter: 'saturate(0.5) brightness(0.8) contrast(1) blur(1px)',
    shadow: { blur: 7, alpha: 0.3, scale: 0.78 },
    top: '11%',
    left: { clipped: '54%', full: '54%' },
    clipBottom: false,
  },
] as const

/**
 * TEMPORARY — card 1's AK treatment. Switch in the browser with ?ak=colour.
 * Full colour at full opacity: against the saturated gradient the render no
 * longer needs holding back.
 */
type AkStyle = 'colour' | 'grey'
const AK_STYLE: AkStyle = 'colour'
const AK_TREATMENT: Record<AkStyle, { filter: string; opacity: number }> = {
  colour: { filter: 'none', opacity: 1 },
  grey: { filter: 'saturate(0) brightness(0.95) contrast(1.05)', opacity: 0.85 },
}

type DisplayFont = 'archivo' | 'current'
const DISPLAY_FONT: DisplayFont = 'archivo'

/**
 * Card 3's figure. Two-figure Fortnite render: wider than a single-figure
 * cutout, so it sits further in (-40px) than a narrow one would.
 */
const CARD3_FIGURE = {
  src: '/images/steps/step-03-alt.webp',
  width: 778,
  height: 632,
  right: '-40px',
  filter:
    'saturate(0.76) brightness(0.93) contrast(0.98) drop-shadow(0 0 1px rgba(0, 0, 0, 0.3))',
} as const

/**
 * Reads ?split=wave from the URL so both variants can be compared on the
 * running dev server without editing and rebuilding. Falls back to the
 * default everywhere else, including during SSR.
 */
function useDisplayFont(): DisplayFont {
  const [font, setFont] = useState<DisplayFont>(DISPLAY_FONT)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('font')
    if (q === 'archivo' || q === 'current') setFont(q)
  }, [])
  return font
}

function useAkStyle(): AkStyle {
  const [style, setStyle] = useState<AkStyle>(AK_STYLE)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('ak')
    if (q === 'colour' || q === 'grey') setStyle(q)
  }, [])
  return style
}

function useCoinStyle(): CoinStyle {
  const [style, setStyle] = useState<CoinStyle>(COIN_STYLE)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('coins')
    if (q === 'clipped' || q === 'full') setStyle(q)
  }, [])
  return style
}

function useSplitVariant(): SplitVariant {
  const [variant, setVariant] = useState<SplitVariant>(SPLIT_DEFAULT)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('split')
    if (q === 'wave' || q === 'tonal') setVariant(q)
  }, [])
  return variant
}

/**
 * Card 1's lower area: a loose cascade of category pills instead of an
 * image. Each carries its own horizontal offset and opacity, so the stack
 * steps sideways and fades toward the card's bottom edge rather than
 * reading as an aligned list. The last two run past the edge and are cut by
 * the card's overflow.
 */
/**
 * Card 1's diagonal: a straight line from 46% at the top to 30% at the
 * bottom. Card 3 owns the wave; this is deliberately a different device.
 *
 * Two closings off one geometry — the fill is bounded by the card, the clip
 * runs to -0.5/1.5 on the left, top and bottom so ONLY the right edge cuts
 * the figure. Same pattern as card 3's wave, same reason.
 */
/**
 * The rifle's own axis IS the split — no separate diagonal. The barrel runs
 * lower-left to upper-right at ~22deg in the render; this line is parallel to
 * it and offset below, so everything ABOVE is the lighter surface.
 */
const CARD1_BARREL_FILL = 'M0,0.70 L1,0.22 L1,0 L0,0 Z'

const CARD1_CATEGORIES = [
  { label: 'Currency', offset: 0, opacity: 1 },
  { label: 'Accounts', offset: 28, opacity: 0.9 },
  { label: 'Items', offset: 12, opacity: 0.78 },
  { label: 'Top-Ups', offset: 40, opacity: 0.62 },
  { label: 'Boosting', offset: 6, opacity: 0.45 },
  { label: 'Gift Cards', offset: 22, opacity: 0.3 },
] as const

/** Renders a Link as one motion <a>, rather than a motion div wrapping it. */
const MotionLink = motion.create(Link)

export interface SellerCta {
  /**
   * Step number. No card renders an eyebrow any more — the numbers were
   * removed so the row reads consistently — but the field is kept for
   * ordering and as a stable key.
   */
  step: string
  title: string
  /**
   * A single word inside `title` to carry the accent. Matched verbatim; the
   * rest of the title stays at full foreground.
   */
  accentWord?: string
  /**
   * Renders the title as stacked lines instead of one wrapping run, so the
   * break points and the per-line scale are a design decision. `scale`
   * multiplies the card's base title size; `accent` tints that line.
   */
  titleStack?: {
    text: string
    scale: number
    accent?: boolean
    align?: 'right'
    /** Left indent, in em of THAT line's own size — steps the stack. */
    indent?: number
  }[]
  /**
   * Body copy. An array renders one non-wrapping line per entry — use it
   * where the line breaks are a design decision rather than a consequence of
   * the column width.
   */
  sub: string | string[]
  tone: 'light' | 'prototype'
  /** Where the copy sits, and therefore which edge the art bleeds off. */
  layout: 'text-top' | 'text-bottom' | 'text-left'
  /** Renders the pill button instead of making the card a link. */
  button?: { label: string; href: string }
  /**
   * Cut-out art. A neutral placeholder stands in while a card has none, so
   * the layout is testable before the asset exists.
   */
  art?: { src: string; width: number; height: number }
  /** Decorative category cascade in place of art. Card 1 only. */
  categories?: boolean
  /** Cut-out figure breaking the LEFT border. Card 1 only. */
  figureLeft?: { src: string; width: number; height: number }
  /**
   * Saturated card surface, as a full CSS background value. Per-card so the
   * hue is data, not CSS. Null or absent means the card keeps the flat
   * graphite token and its foreground-based border.
   */
  gradient?: string | null
  /**
   * Corner-glow CSS value. Card 1 moved to a full `gradient` surface, so
   * this is card 2's depth layer — a different hue and corner so the two
   * read as siblings rather than twins.
   */
  glowColor?: string | null
  /** Silhouette pattern behind the figure. Card 1 only. */
  pattern?: string | null
  /**
   * Explicit title line breaks, where no column width can produce the wanted
   * wrap. Each entry is one line.
   */
  titleBreak?: string[]
  /** Category fee ladder in the card's lower half. Card 2 only. */
  feeLadder?: { label: string; rate: string; accent?: boolean }[]
  /** Where the whole card points when it has no button. */
  href?: string
}

export function SellerCtaCard({ cta }: { cta: SellerCta }) {
  const reduceMotion = useReducedMotion()
  const splitVariant = useSplitVariant()
  const coinStyle = useCoinStyle()
  const displayFont = useDisplayFont()
  const akStyle = useAkStyle()
  const card3 = CARD3_FIGURE
  const light = cta.tone === 'light'
  const textLeft = cta.layout === 'text-left'

  const motionProps = {
    whileHover: reduceMotion ? undefined : { y: -4 },
    whileTap: reduceMotion ? undefined : { y: -1 },
    transition: { type: 'spring' as const, stiffness: 420, damping: 34, mass: 0.7 },
    className: [
      'seller-card group relative flex h-full flex-col',
      'transition-colors duration-fast focus-visible:outline-none',
      // The hover border recolours toward the foreground token, which is
      // built for graphite. A gradient card keeps its own white border.
      cta.gradient ? '' : 'hover:border-border-default',
      // Cards 1 and 2 clip their art; card 3 lets it cross the right border.
      textLeft
        ? 'seller-card--breakout'
        : cta.figureLeft
          ? 'seller-card--breakout-left'
          : 'overflow-hidden',
      // The two top cards run landscape rather than portrait — portrait is
      // what made the section outgrow the screen. From lg the heights track
      // the viewport so the whole section clears one screen; see the row
      // rules in globals.css.
      // Heights live entirely in globals.css — see the row rules there.
      textLeft ? 'seller-card--row2' : 'seller-card--row1',
      cta.feeLadder && 'seller-card--fee',
      light && 'seller-card--light',
    ]
      .filter(Boolean)
      .join(' '),
    // Inline, not a class: the value is per-card data. Overrides the
    // graphite background-color and the foreground-based border from
    // `.seller-card`, which both read wrong on a saturated surface.
    style: cta.gradient
      ? { background: cta.gradient, border: '1px solid rgba(255,255,255,0.14)' }
      : undefined,
  }

  // Card 3 is full width, so its title carries more size than the two
  // half-width cards above it.
  const archivo = displayFont === 'archivo'
  const titleClass = [
    // A gradient card sets its own pure white; the token is for graphite.
    cta.gradient ? '' : 'text-text-primary',
    // The break points come from `titleStack` now, so the title needs no
    // width constraint of its own — and a 58% cap actively clipped the
    // larger second line, which is wider than the first.
    cta.titleStack ? '' : cta.figureLeft ? 'max-w-[58%]' : '',
    // No width cap: the break is explicit. A cap cannot produce the wanted
    // two lines here — it would need to be >=319px to hold "ON SELECT GAMES"
    // yet <309px to stop "FEES FROM 0% ON" fitting the first line, and no
    // value satisfies both. `titleBreak` inserts the break instead.
    cta.feeLadder ? 'max-w-full text-right' : '',
    archivo
      ? textLeft
        ? 'uppercase text-[28px] md:text-[38px]'
        : cta.figureLeft
          ? 'uppercase text-[clamp(30px,3.4vw,44px)]'
          : cta.feeLadder
            ? 'uppercase text-[clamp(26px,2.6vw,34px)]'
            : 'text-[22px] md:text-[24px]'
      : `font-semibold leading-[1.25] tracking-[-0.01em] ${textLeft ? 'text-[23px]' : 'text-[19px]'}`,
  ].join(' ')
  // Archivo's own metrics, applied inline because the width axis and the
  // variable are not expressible as Tailwind utilities.
  const titleStyle: CSSProperties | undefined = archivo
    ? {
        fontFamily: 'var(--font-archivo)',
        fontVariationSettings: textLeft
          ? "'wdth' 112"
          : cta.figureLeft || cta.feeLadder
            ? "'wdth' 106"
            : "'wdth' 120",
        fontWeight: 800,
        // Uppercase needs less negative tracking than mixed case.
        letterSpacing:
          textLeft || cta.feeLadder ? '-0.01em' : cta.figureLeft ? '-0.005em' : '-0.03em',
        lineHeight: cta.figureLeft ? 1.1 : cta.feeLadder ? 1.05 : 1.0,
      }
    : undefined
  // 10px under the title, 22px over the button: the four elements are spaced
  // to read as one block rather than as a list of separate items.
  // On a gradient card the colours are literals, not tokens: the grey
  // secondary token measures 2.60:1 over a saturated teal. White at 0.78
  // gives 4.53:1 at the gradient's lightest stop. Cards 2 and 3 keep the
  // tokens they had.
  // A multi-line sub sets its own measure via whitespace-nowrap, so the 42ch
  // clamp would fight it — the column width is the constraint there.
  const bodyClass = cta.feeLadder
    ? // Left-aligned inside the right-hand column: right-aligned body copy
      // gives a ragged left edge that is harder to read, and it was leaving
      // a one-word orphan. The title stays right-aligned.
      'mt-2.5 text-text-secondary text-[15px] leading-[1.5] text-left'
    : `${cta.figureLeft ? 'mt-3' : 'mt-2.5'} ${cta.gradient ? 'font-medium' : 'text-text-secondary'} ${Array.isArray(cta.sub) ? '' : 'max-w-[42ch]'} text-[16px] leading-[1.5]`
  // Card 3's sub runs in Archivo at normal width so it sits under the
  // expanded title as the same family, not a second typeface.
  const bodyStyle: CSSProperties | undefined =
    archivo && textLeft
      ? { fontFamily: 'var(--font-archivo)', fontVariationSettings: "'wdth' 100", fontWeight: 400 }
      : undefined

  // Entrance motion, card 3 only: four children on a short stagger. Under
  // prefers-reduced-motion both variants are identical, so nothing moves and
  // nothing fades — the block is simply present.
  const stagger = {
    hidden: {},
    show: { transition: { staggerChildren: reduceMotion ? 0 : 0.06 } },
  }
  const rise = reduceMotion
    ? { hidden: {}, show: {} }
    : {
        hidden: { y: 12, opacity: 0 },
        show: { y: 0, opacity: 1, transition: { duration: 0.4, ease: 'easeOut' as const } },
      }

  // Card 3 composes on a diagonal: the title anchors top-left and the sub +
  // button anchor to the bottom of the free space, so the 248px gap between
  // the text and the figure's ink becomes the composition's centre instead
  // of dead weight. `copyParts` lets that card place the two groups
  // separately; every other card renders them as one stacked run.
  const diagonal = textLeft
  const copy = (
    <>
      <motion.h3
        variants={rise}
        className={titleClass}
        style={cta.gradient ? { ...titleStyle, color: '#FFFFFF' } : titleStyle}
      >
        {cta.titleStack
          ? cta.titleStack.map((line, i) => (
              <span
                key={i}
                className="block whitespace-nowrap"
                style={{
                  fontSize: `${line.scale}em`,
                  // Each line sets its own leading: at 1.0 the larger middle
                  // line would otherwise inherit spacing sized for the
                  // smaller ones and collide with them.
                  lineHeight: 0.98,
                  color: line.accent ? 'var(--color-accent-text)' : undefined,
                }}
              >
                {line.text}
              </span>
            ))
          : cta.titleBreak
            ? cta.titleBreak.map((line, i) => (
                <span key={i} className="block">
                  {line}
                </span>
              ))
            : cta.accentWord
            ? cta.title.split(new RegExp(`(${cta.accentWord})`)).map((part, i) =>
                part === cta.accentWord ? (
                  <span key={i} style={{ color: 'var(--color-accent-text)' }}>
                    {part}
                  </span>
                ) : (
                  part
                ),
              )
            : cta.title}
      </motion.h3>
      <motion.p
        variants={rise}
        className={bodyClass}
        // 0.92, not 1: it measures 5.64:1 at the gradient's lightest stop
        // (well over 4.5) while staying a visible step below the pure-white
        // title, so the hierarchy survives the lift in weight and colour.
        style={cta.gradient ? { ...bodyStyle, color: 'rgba(255,255,255,0.92)' } : bodyStyle}
      >
        {Array.isArray(cta.sub)
          ? cta.sub.map((line, i) => (
              // Each entry is one line by contract, so it must not wrap; the
              // column is sized to the longest of them.
              <span key={i} className="block whitespace-nowrap">
                {line}
              </span>
            ))
          : cta.sub}
      </motion.p>
      {cta.button && (
        // Pill carrying the accent — see `.seller-btn` in globals.css.
        <motion.div variants={rise} className={`${diagonal ? '' : 'mt-[22px]'} self-start`}>
          <Link
            href={cta.button.href}
            className="seller-btn inline-flex rounded-[8px] text-[15px]"
          >
            <ShineBorder />
            {cta.button.label}
          </Link>
        </motion.div>
      )}
    </>
  )

  // Card 3 (option I): the sub and the button share one row beneath the
  // title, vertically centred on each other, and the whole column takes a
  // looser left inset so the card breathes. Every other card keeps the
  // stacked run above.
  const copyDiagonal = cta.button && (
    // `w-fit` on the GROUP, not just the title: the group shrinks to its
    // widest child (the title's longest line), so the row beneath inherits
    // exactly the title's measure and can centre inside it. The two then
    // read as one block rather than two independently placed things.
    <div className="flex w-fit flex-col">
      <motion.h3
        variants={rise}
        // A block-level h3 would fill the group, and a right-aligned line
        // would then land at the group's edge instead of under the longest
        // line. Shrinking to content makes the stack its own measure.
        className={`${titleClass} w-fit`}
        style={titleStyle}
      >
        {cta.titleStack?.map((line, i) => (
          <span
            key={i}
            className="block whitespace-nowrap"
            style={{
              fontSize: `${line.scale}em`,
              lineHeight: 0.98,
              // Space between the stacked lines. As an em it scales with the
              // line's own size, so the gap under the large middle line stays
              // proportional instead of looking tight next to it.
              marginTop: i === 0 ? undefined : '0.04em',
              // Steps the line right so the stack reads as a staircase
              // rather than a flush-left block. In em of the line's own
              // size, so it stays proportional if the scale changes.
              marginLeft: line.indent ? `${line.indent}em` : undefined,
              color: line.accent ? 'var(--color-accent-text)' : undefined,
              // The h3 is only as wide as its longest line (EARNING), so
              // right-aligning a shorter line lands it flush under that
              // line's right edge — TODAY under the "NING".
              textAlign: line.align,
            }}
          >
            {line.text}
          </span>
        ))}
      </motion.h3>
      {/* One row, centred within the title's width: `justify-center` spreads
          the copy and the CTA around the group's centre line, and
          `items-center` aligns the pill to the copy's optical centre rather
          than to a text baseline. */}
      <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-7 gap-y-4">
        <motion.p
          variants={rise}
          className={`${bodyClass} !mt-0 text-center`}
          style={bodyStyle}
        >
          {cta.sub}
        </motion.p>
        <motion.div variants={rise}>
          <Link
            href={cta.button.href}
            className="seller-btn inline-flex rounded-[8px] text-[15px]"
          >
            <ShineBorder />
            {cta.button.label}
          </Link>
        </motion.div>
      </div>
    </div>
  )

  // Card 2's money cluster + typographic hero. NOTE: no money-bag asset
  // exists in public/images/decor (only the two coins and the ETH), so the
  // brief's 210px bag is built from the largest coin instead — reported
  // rather than substituted with unrelated art.
  const FEE_DECOR = [
    // Stands in for the bag: largest object, anchored bottom-left.
    // left -12%, not -8%: at -8% the 210px anchor reaches x=175 on a 1150
    // card while the detail line starts at x=163. Sliding it further off
    // the edge keeps the brief's 210px size rather than shrinking the hero.
    { src: '/images/decor/coin-gold.webp', size: 210, rotate: -8, left: '-12%', bottom: '-14%', opacity: 0.88, brightness: 0.9, z: 3 },
    // left 16% / bottom 38%, not 26% / 24%: at 26% this coin's right edge
    // reaches x=225 on a 1280 card while the detail line starts at x=218,
    // and the two also overlap vertically. Up and left clears both without
    // crushing the cluster into the corner.
    { src: '/images/decor/coin-gold-b.webp', size: 96, rotate: 16, left: '16%', bottom: '38%', opacity: 0.78, brightness: 0.86, z: 4 },
    { src: '/images/decor/eth.webp', size: 62, rotate: -22, left: '30%', bottom: '2%', opacity: 0.62, brightness: 0.82, z: 4 },
  ] as const

  const feeDecor = cta.feeLadder && (
    <>
      {/* Typographic hero, behind the coins and above the gradient. */}
      <div
        aria-hidden
        // 28cqw, not a fixed 230px: at 230 the glyph runs 354px wide and
        // overlaps the title's ink at all three widths (by 57px at 1440,
        // 146px at 1150). Clearing it everywhere caps a fixed size at
        // 128px, too small to read as a hero — a card-relative size keeps
        // it large where there is room. `.seller-card--fee` supplies the
        // container context.
        className="seller-fee-numeral pointer-events-none absolute select-none"
        style={{
          // Top-left, not behind the cluster: at top:30% the glyph sat at
          // y 84-192 while coin B covers y 65-185 over the same x range, so
          // it was almost entirely buried. The card's lower half is dense
          // with coins; the top-left corner is the one clear region.
          left: '1%',
          top: '2%',
          zIndex: 1,
          fontFamily: 'var(--font-archivo)',
          fontVariationSettings: "'wdth' 106",
          fontWeight: 800,
          fontSize: '28cqw',
          lineHeight: 1,
        }}
      >
        0%
      </div>

      {/* Contact shadow under the anchor object, sized from it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          left: '-12%',
          bottom: '-14%',
          width: 210 * 0.55,
          height: 20,
          marginLeft: 210 * 0.225,
          zIndex: 2,
          filter: 'blur(16px)',
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.5) 0%, transparent 70%)',
        }}
      />

      {FEE_DECOR.map((d) => (
        <img
          key={d.src + d.size}
          src={d.src}
          alt=""
          aria-hidden
          draggable={false}
          className="pointer-events-none absolute select-none"
          style={{
            left: d.left,
            bottom: d.bottom,
            width: d.size,
            height: 'auto',
            opacity: d.opacity,
            zIndex: d.z,
            // Dimmed so the title stays the brightest thing on the card.
            filter: `brightness(${d.brightness})`,
            transform: `rotate(${d.rotate}deg)`,
          }}
        />
      ))}

      {/* Grain over the objects, under the text. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{
          zIndex: 5,
          opacity: 0.045,
          mixBlendMode: 'overlay',
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='r2'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23r2)'/%3E%3C/svg%3E\")",
        }}
      />
    </>
  )

  // Cards 1 and 2: the art bleeds off one edge and is clipped by the card's
  // radius. A neutral block stands in until the asset exists — never white,
  // and never a labelled box that reads as a failed load.
  const bleed = (
    <div
      aria-hidden
      data-card-art
      className={[
        'pointer-events-none absolute select-none',
        cta.layout === 'text-top' && '-bottom-[30px] right-0 h-[72%] w-[80%]',
        cta.layout === 'text-bottom' && '-top-[30px] -right-[20px] h-[62%] w-[70%]',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        maskImage:
          cta.layout === 'text-top'
            ? 'linear-gradient(to top, transparent 0%, #000 10%)'
            : 'linear-gradient(to bottom, transparent 0%, #000 12%)',
        WebkitMaskImage:
          cta.layout === 'text-top'
            ? 'linear-gradient(to top, transparent 0%, #000 10%)'
            : 'linear-gradient(to bottom, transparent 0%, #000 12%)',
      }}
    >
      {cta.art ? (
        <Image
          src={cta.art.src}
          alt=""
          width={cta.art.width}
          height={cta.art.height}
          priority={false}
          draggable={false}
          className="h-full w-full object-contain"
        />
      ) : (
        <div
          className="h-full w-full rounded-[12px]"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--foreground) 6%, transparent)',
          }}
        />
      )}
    </div>
  )

  // Card 3's figure is not in a bleed wrapper: it has to escape the card, so
  // it is positioned against the card itself. The mask lives on the <img>.
  const figure = cta.art && (
    <Image
      src={cta.art.src}
      alt=""
      aria-hidden
      width={cta.art.width}
      height={cta.art.height}
      priority={false}
      draggable={false}
      className="seller-figure"
    />
  )

  // Background split. Sits behind every other layer in the card and never
  // touches the border, radius or outer shape — `inset: 0` plus an inherited
  // radius means the card's own corners clip it.
  // The wave curve, authored ONCE in normalised card space. Two consumers:
  // the tonal fill below, and the figure's left boundary (via the wrapper in
  // `contents`). Both read the same `d`, so the painted edge and the clipped
  // edge are the same line by construction rather than by tuning.
  //
  // Moved right from the earlier 48/62 so it cuts through the orange
  // character's torso instead of passing over empty card: it now enters at
  // 62% of card width and exits at 74%.
  const WAVE_D = 'M0.62,0 C0.67,0.25 0.57,0.45 0.66,0.62 C0.72,0.74 0.74,0.86 0.76,1'

  // Drawn fill: bounded by the card, because the tonal split should stop at
  // the card's edges.
  const WAVE_FILL_D = `${WAVE_D} L1,1 L1,0 Z`

  // Clip: the SAME curve, but with its outer bounds pushed well outside the
  // card so only the LEFT edge ever cuts. The curve is extended straight up
  // to -0.5 and straight down to 1.5 before closing right at 1.5 — without
  // those extensions the subpath closed across the card's top edge and
  // sliced the cap and both heads flat.
  // Right bound is 1, not 1.5: the figure is cut flush at the card's right
  // border rather than overhanging it. Top and bottom still run well outside
  // (-0.5 / 1.5) so neither edge ever cuts.
  const WAVE_CLIP_D =
    `M0.62,-0.5 L${WAVE_D.slice(1)} L0.76,1.5 L1,1.5 L1,-0.5 Z`

  const split = (
    <div
      aria-hidden
      // -inset-px so this box is the card's BORDER box (1136x365), matching
      // the figure wrapper. `inset: 0` sits inside the 1px border and makes
      // it 1134x363 — the same normalised path on two different box sizes
      // puts the drawn edge ~1px off the clipped edge.
      className="pointer-events-none absolute -inset-px z-[-1] overflow-hidden"
      style={{ borderRadius: 'inherit' }}
    >
      {splitVariant === 'tonal' ? (
        <div
          className="h-full w-full"
          style={{
            background:
              'linear-gradient(105deg, transparent 0%, transparent 46%, color-mix(in srgb, var(--foreground) 3%, transparent) 58%, color-mix(in srgb, var(--foreground) 3%, transparent) 100%)',
          }}
        />
      ) : (
        <svg
          className="h-full w-full"
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
          focusable="false"
        >
          {/* Lifted a point (6% -> 7%) because a figure now sits on the
              lighter side and was flattening the tonal difference. Geometry
              unchanged. */}
          <path d={WAVE_FILL_D} fill="color-mix(in srgb, var(--foreground) 7%, transparent)" />
          <path
            d={WAVE_D}
            fill="none"
            stroke="color-mix(in srgb, var(--foreground) 10%, transparent)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
    </div>
  )

  // The clip path lives in card space, so the wrapper it applies to must BE
  // the card's box — a path in objectBoundingBox units on the figure's own
  // (smaller, offset) box would land ~356px away from the drawn curve and
  // produce exactly the double edge we are trying to avoid.
  const waveClipDefs = (
    <svg aria-hidden width="0" height="0" className="absolute" focusable="false">
      <defs>
        <clipPath id="card3-wave" clipPathUnits="objectBoundingBox">
          <path d={WAVE_CLIP_D} />
        </clipPath>
      </defs>
    </svg>
  )

  const contents = textLeft ? (
    <>
      {split}
      {waveClipDefs}
      {/* Back to front: ambient bleed, contact shadow, figure, text. */}
      <div aria-hidden className="seller-dot-grid" />
      <div
        aria-hidden
        className={`seller-coins${coinStyle === 'clipped' ? ' seller-coins--clipped' : ''}`}
      >
        {CARD3_DECOR.map((d) => (
          <span
            key={d.key}
            className={`seller-decor${d.clipBottom ? ' seller-decor--cut' : ''}`}
            style={{ left: d.left[coinStyle], top: d.top }}
          >
            <span
              className="seller-decor-shadow"
              style={{
                width: d.size[coinStyle] * d.shadow.scale,
                filter: `blur(${d.shadow.blur}px)`,
                background: `radial-gradient(ellipse at center, rgba(0,0,0,${d.shadow.alpha}) 0%, transparent 70%)`,
              }}
            />
            <img
              src={d.src}
              alt=""
              width={d.w}
              height={d.h}
              draggable={false}
              style={{
                width: d.size[coinStyle],
                height: 'auto',
                opacity: d.opacity,
                filter: d.filter,
                transform: `rotate(${d.rotate}deg)`,
              }}
            />
          </span>
        ))}
      </div>
      {/* Clipped to the card: only the figure breaks out. */}
      <div aria-hidden className="seller-light-clip">
        <div className="seller-light-field" />
      </div>
      <div aria-hidden className="seller-colour-spill" />
      {textLeft ? (
        // Wrapper spans the CARD box, so the wave clip is evaluated in the
        // same coordinate space the curve was drawn in. The figure inside it
        // keeps its own bottom inset clip; one element cannot carry both a
        // url() and an inset() clip-path.
        <div
          aria-hidden
          // Spans the card's BORDER box so the clip resolves in the same
          // coordinate space the curve was drawn in — but does NOT clip its
          // own overflow, so the figure's 48px top overhang survives. The
          // clip path's bounds now run to -0.5/1.5, well outside this box.
          className="seller-wave-clip pointer-events-none absolute -inset-px z-[2] overflow-visible"
          style={{ clipPath: 'url(#card3-wave)', WebkitClipPath: 'url(#card3-wave)' }}
        >
          <Image
            src={card3.src}
            alt=""
            width={card3.width}
            height={card3.height}
            priority={false}
            draggable={false}
            className="seller-figure"
            style={{ right: card3.right, filter: card3.filter }}
          />
        </div>
      ) : (
        <div
          aria-hidden
          className="absolute bottom-0 right-0 h-[85%] w-[43%] rounded-[12px]"
          style={{ backgroundColor: 'color-mix(in srgb, var(--foreground) 6%, transparent)' }}
        />
      )}
      {/* Over the figure, under the text. */}
      <div aria-hidden className="seller-grain" />

      {/* Capped at 44%: the raised hand reaches toward the card's centre, so
          wider copy runs into the fingers. z-3 keeps it over every layer. */}
      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.4 }}
        // Option I: centred as one block with a looser left inset, so the
        // card breathes instead of the copy hugging the 25px padding. The
        // measure stays clear of the character — its alpha profile shows
        // full height only from 76% across.
        // pl-24 at lg: the dollar coin breaks the left border at left:-5%
        // and runs 130px wide, so the copy starts well clear of it rather
        // than stacking over it. The measure narrows to match, keeping the
        // copy off the character (full height from 76% across).
        className="relative z-[4] flex h-full flex-col justify-center pl-5 lg:max-w-[58%] lg:pl-24 xl:max-w-[56%]"
      >
        {copyDiagonal ?? copy}
      </motion.div>
    </>
  ) : (
    <>
      {cta.figureLeft ? (
        // Flat surface, border, text, one image. No split, no streak, no
        // dot grid, no ambient layers, no contact shadow — card 1 is stripped
        // back and the card's own overflow does the cutting.
        <>
        {cta.pattern && (
          <div
            aria-hidden
            className="seller-pattern"
            style={{ backgroundImage: `url(${cta.pattern})` }}
          />
        )}
        <Image
          src={cta.figureLeft.src}
          alt=""
          aria-hidden
          width={cta.figureLeft.width}
          height={cta.figureLeft.height}
          priority={false}
          draggable={false}
          // unoptimized: the optimizer was re-encoding this WebP to JPEG
          // (Content-Type: image/jpeg, 0% alpha), flattening the cutout onto
          // white — which rendered as an invisible white block on the card.
          // The source is already a compressed WebP, so nothing is lost.
          unoptimized
          className="seller-figure-left"
          style={{ filter: AK_TREATMENT[akStyle].filter, opacity: AK_TREATMENT[akStyle].opacity }}
        />
        </>
      ) : cta.categories ? (
        // Lower 55% of the card. The last pills run past the bottom edge and
        // are cut by the card's own overflow — no mask, a hard clip.
        <div
          aria-hidden
          // z-1: card 1's square grid is an ::after with no z-index, and a
          // pseudo-element generated last paints over any static sibling.
          // Without this the grid cuts straight across the pills.
          className="pointer-events-none absolute inset-x-0 bottom-0 top-[48%] z-[1] select-none"
        >
          <div className="flex flex-col gap-2.5 px-6">
            {CARD1_CATEGORIES.map((c) => (
              <span
                key={c.label}
                className="self-start whitespace-nowrap rounded-[8px] px-4 py-2 text-[13px] font-medium"
                // The mix colour follows the CARD, not the page: --foreground
                // is near-white, and 5/9/55% of near-white on card 1's white
                // surface is invisible. The light card mixes toward its own
                // dark ink at the same percentages.
                style={{
                  marginLeft: c.offset,
                  opacity: c.opacity,
                  backgroundColor: light
                    ? 'color-mix(in srgb, #111111 5%, transparent)'
                    : 'color-mix(in srgb, var(--foreground) 5%, transparent)',
                  border: light
                    ? '1px solid color-mix(in srgb, #111111 9%, transparent)'
                    : '1px solid color-mix(in srgb, var(--foreground) 9%, transparent)',
                  color: light
                    ? 'color-mix(in srgb, #111111 55%, transparent)'
                    : 'color-mix(in srgb, var(--foreground) 55%, transparent)',
                }}
              >
                {c.label}
              </span>
            ))}
          </div>
        </div>
      ) : cta.feeLadder ? (
        feeDecor
      ) : (
        bleed
      )}
      <div
        // Card 1: glow 0, pattern 1, AK 2, text 3.
        className={`relative z-[6] flex flex-col ${
          cta.layout === 'text-bottom'
            ? 'mt-auto max-w-[68%]'
            : cta.figureLeft
              ? // Top-left, above the barrel. `self-start` keeps the block at
                // its natural height — a pb-% here padded the flex child and
                // grew the whole row, which is what made cards 1 and 2 taller.
                // 56%: the minimum that keeps the 30px title on one line.
                // Wider (62%) pushed the title's right edge to 60.9% of the
                // card, where opaque AK artwork sits — verified by sampling
                // the asset's alpha at that point.
                // 72%: the subtext's longest line measures 368px at 16px
                // Inter medium, which is 71% of a 558px card including the
                // 25px padding. Narrower wraps it; the type is not shrunk.
                'max-w-[72%] self-start'
              : cta.feeLadder
                ? // Card 2 is the only card with text on the RIGHT — the
                  // alternation across the row is deliberate. `ml-auto`
                  // anchors the block to the right edge; the rate sheet
                  // occupies the left half as its own absolute layer.
                  // No `justify-center`: card 1's text starts at the top of
                  // the card, and centring put card 2's title at y=167 vs
                  // card 1's y=25. The horizontal mirror is intentional;
                  // the vertical mismatch was not.
                  'max-w-[46%] ml-auto items-end'
                : 'max-w-[62%]'
        }`}
      >
        {copy}
      </div>
    </>
  )

  // A card with a button is not itself a link — see the note above.
  if (cta.button) return <motion.article {...motionProps}>{contents}</motion.article>

  return (
    <MotionLink href={cta.href ?? '/sell'} {...motionProps}>
      {contents}
    </MotionLink>
  )
}

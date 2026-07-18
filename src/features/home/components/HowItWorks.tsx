'use client'

/**
 * HowItWorks — V20/P16
 *
 * Apple-style scroll-pinned section. The stage on the right is `sticky`
 * and stays in view while the copy column on the left scrolls past 4
 * stages. As scroll progress through the section advances, the stage
 * cross-fades between four hero illustrations.
 *
 * Hero artwork is loaded from `/public/assets/howitworks/`:
 *   - stage-1.svg  (You Pay)
 *   - stage-2.svg  (You're Covered)
 *   - stage-3.svg  (They Deliver)
 *   - stage-4.svg  (Seller Gets Paid)
 *
 * Use Storyset's "SVG AND CSS" export (single .svg with embedded CSS
 * animations). Rendered via plain <img> so the CSS animations inside
 * the SVG file play — next/image rasterizes and would freeze them.
 * Sources: storyset.com (free, custom colors), iconscout.com.
 *
 * Implementation: framer-motion useScroll + useTransform per stage to
 * fade in/out at the right scroll window. Mobile collapses to inline
 * stages below each copy block.
 */

import { useRef } from 'react'
import {
  motion,
  useScroll,
  useTransform,
  type MotionValue,
} from 'framer-motion'

interface CopyFragment {
  type: 'plain' | 'accent' | 'strong'
  text: string
}

interface Stage {
  step: string
  label: string
  copy: CopyFragment[]
}

const STAGES: Stage[] = [
  {
    step: '01',
    label: 'You Pay',
    copy: [
      { type: 'plain',  text: 'Check out on ' },
      { type: 'strong', text: 'DropMarket' },
      { type: 'plain',  text: ' like any store — and your order is covered by ' },
      { type: 'accent', text: 'SafeDrop Buyer Protection' },
      { type: 'plain',  text: ' from the first second.' },
    ],
  },
  {
    step: '02',
    label: "You're Covered",
    copy: [
      { type: 'strong', text: 'SafeDrop™' },
      { type: 'plain',  text: ' guarantees the outcome: ' },
      { type: 'accent', text: 'get what you ordered, or your money back' },
      { type: 'plain',  text: '. Change your mind before delivery? Cancel any time.' },
    ],
  },
  {
    step: '03',
    label: 'They Deliver',
    copy: [
      { type: 'plain',  text: 'Seller hands over the goods — items, currency, accounts, whatever. Most orders ' },
      { type: 'accent', text: 'complete in minutes' },
      { type: 'plain',  text: '. You check it, you decide if it’s as described.' },
    ],
  },
  {
    step: '04',
    label: 'Seller Gets Paid',
    copy: [
      { type: 'plain',  text: 'Confirm the drop and the seller is paid out. Something off? ' },
      { type: 'accent', text: 'We step in' },
      { type: 'plain',  text: " — full refund if it's not delivered or not as described." },
    ],
  },
]

function renderCopy(fragments: CopyFragment[]) {
  return fragments.map((f, i) => {
    if (f.type === 'accent')
      return (
        <span key={i} className="font-semibold text-lime-text">
          {f.text}
        </span>
      )
    if (f.type === 'strong')
      return (
        <span key={i} className="font-bold text-text-primary">
          {f.text}
        </span>
      )
    return <span key={i}>{f.text}</span>
  })
}

export function HowItWorks() {
  const sectionRef = useRef<HTMLDivElement>(null)
  // Scroll progress 0→1 across the section.
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  })

  return (
    <section
      ref={sectionRef}
      className="relative"
    >
      {/* Header — centered, no bg, no extra padding. Sits directly on
          whatever's behind (body bg or hero art continuation). */}
      <div className="max-w-container mx-auto px-6 pb-6 pt-12 text-center">
        <div className="mb-3 inline-flex items-center gap-2">
          <span className="h-px w-10 bg-gradient-to-l from-lime/50 to-transparent" aria-hidden />
          <span className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-lime-text">
            How it works
          </span>
          <span className="h-px w-10 bg-gradient-to-r from-lime/50 to-transparent" aria-hidden />
        </div>
        {/* App-shell — `t-section` supplies the 20px phone size; the
            existing sm/lg utilities restore 44/56px unchanged. */}
        <h2 className="t-section font-black leading-[1.02] tracking-tight sm:text-[44px] lg:text-[56px]">
          Safe drops, <span className="text-lime-text">every time</span>.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-[17px] leading-relaxed text-text-secondary">
          Every order is covered by <span className="font-bold text-text-primary">SafeDrop™ Buyer Protection</span> — get what you ordered, or your money back.
        </p>
      </div>

      {/* V20/P23 — Centered two-column composition. Capped at 1100px
          and centered so the copy + art read as one paired block in
          the middle of the page, not two stranded corners. Reduced
          gap pulls them closer together. */}
      <div className="mx-auto grid w-full max-w-[1100px] grid-cols-1 px-6 lg:grid-cols-[1fr_1fr] lg:gap-10">
        {/* LEFT — scrolling copy */}
        <div className="flex flex-col">
          {STAGES.map((stage, i) => (
            <StageCopy key={stage.step} stage={stage} index={i} />
          ))}
        </div>

        {/* RIGHT — sticky stage */}
        <div className="relative hidden lg:block">
          <div className="sticky top-[calc(50vh-240px)] flex h-[480px] items-center justify-center">
            <Stage scrollYProgress={scrollYProgress} />
          </div>
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────
   COPY COLUMN
   ──────────────────────────────────────────────────────────── */

function StageCopy({ stage, index }: { stage: Stage; index: number }) {
  // V20/P22 — Last copy block gets extra bottom padding so the sticky
  // stage on the right stays pinned through the full Stage 4 scroll
  // window, instead of releasing as soon as its copy passes centre.
  const isLast = index === 3
  return (
    <div
      className={`flex flex-col justify-center py-10 lg:min-h-screen lg:py-12 ${isLast ? 'lg:pb-[40vh]' : ''}`}
    >
      <div className="max-w-[460px]">
        <div className="mb-4 inline-flex items-center gap-2">
          <span className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-lime-text tabular-nums">
            Step {stage.step}
          </span>
          <span className="h-px w-6 bg-lime/40" aria-hidden />
        </div>
        <h3 className="text-[28px] font-black leading-[1.05] tracking-tight text-text-primary sm:text-[36px] lg:text-[44px]">
          {stage.label}
        </h3>
        <p className="mt-6 text-[18px] leading-[1.55] text-text-secondary">
          {renderCopy(stage.copy)}
        </p>

        {/* MOBILE STAGE — inline below copy, only visible < lg */}
        <div className="mt-8 lg:hidden">
          <div className="aspect-square w-full max-w-[320px] mx-auto">
            <StageArtForIndex index={index} />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
   STAGE (sticky right column, scroll-cross-fades between arts)
   ──────────────────────────────────────────────────────────── */

function Stage({ scrollYProgress }: { scrollYProgress: MotionValue<number> }) {
  return (
    <div className="relative aspect-square w-full max-w-[440px]">
      {/* Soft halo behind every stage so transitions feel grounded */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(closest-side, rgba(198,255,61,0.15), transparent 70%)',
        }}
      />
      {[1, 2, 3, 4].map((n, i) => (
        <StageLayer
          key={n}
          scrollYProgress={scrollYProgress}
          index={i}
          src={`/assets/howitworks/stage-${n}.svg`}
          alt={STAGES[i].label}
        />
      ))}
    </div>
  )
}

/**
 * Cross-fade one stage layer in / out based on scroll progress windows.
 * Each layer is opaque in the [start, peak] window and fades around it.
 *
 * For 4 stages, each owns 25% of the scroll. Stage `i` peak is at
 * (i + 0.5) / 4. Fade windows overlap slightly so cross-fades feel
 * continuous, not stepped.
 */
function StageLayer({
  scrollYProgress,
  index,
  src,
  alt,
}: {
  scrollYProgress: MotionValue<number>
  index: number
  src: string
  alt: string
}) {
  // Each stage owns one quarter of the scroll. Stage `i` lives in the
  // window [i/4, (i+1)/4]. Crossfades happen in the last ~8% of each
  // stage's window into the next.
  const STAGE_SIZE = 1 / 4
  const CROSSFADE = 0.08
  const stageStart = index * STAGE_SIZE
  const stageEnd = (index + 1) * STAGE_SIZE

  // V20/P21 — First stage: fully visible from scrollYProgress 0 so the
  // hero illustration is on screen the moment the user reaches the
  // section, even before they scroll through Stage 1's copy. Other
  // stages still fade in from the previous stage's tail.
  const fadeIn = index === 0 ? 0 : stageStart
  const inAt = index === 0 ? 0 : stageStart + CROSSFADE
  // Last stage stays visible to the bottom of the section. Earlier
  // stages fade out as the next one rises.
  const outAt = index === 3 ? 1 : stageEnd - CROSSFADE
  const fadeOut = index === 3 ? 1 : stageEnd

  const opacity = useTransform(
    scrollYProgress,
    [fadeIn, inAt, outAt, fadeOut],
    [0, 1, 1, 0],
  )
  const scale = useTransform(
    scrollYProgress,
    [fadeIn, inAt, outAt, fadeOut],
    [0.94, 1, 1, 0.94],
  )

  return (
    <motion.div className="absolute inset-0" style={{ opacity, scale }}>
      <StageImage src={src} alt={alt} />
    </motion.div>
  )
}

function StageArtForIndex({ index }: { index: number }) {
  return (
    <StageImage
      src={`/assets/howitworks/stage-${index + 1}.svg`}
      alt={STAGES[index].label}
    />
  )
}

/**
 * Renders a hero SVG with a gentle idle float so the scene feels alive
 * even without scroll. Uses a plain <img> tag so CSS animations inside
 * the SVG (e.g. Storyset's exported animated SVG + CSS) actually play
 * — next/image would rasterize them and freeze the animation.
 */
function StageImage({ src, alt }: { src: string; alt: string }) {
  return (
    <motion.div
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      className="relative h-full w-full"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="absolute inset-0 h-full w-full object-contain drop-shadow-[0_30px_60px_rgba(0,0,0,0.55)]"
      />
    </motion.div>
  )
}


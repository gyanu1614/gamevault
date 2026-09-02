'use client'

/**
 * HubCtaBand — the shared "modal band" used at the bottom of every content-hub
 * page: a per-game background hero (public/cta-heroes/{gameSlug}.jpg) behind a
 * left-weighted scrim, left-aligned title + body, and a CTA button on the right.
 *
 * This is the ONE band. HubBuyCta (buy) and the /sell page CTAs both render it
 * with different text so every page's CTA looks identical — no reinventing the
 * modal. Drop public/cta-heroes/{slug}.jpg to fill the bg; missing file falls
 * back to a clean gradient.
 *
 * Client component only for the <img> onError fallback.
 */

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export function HubCtaBand({
  gameSlug,
  title,
  body,
  ctaLabel,
  ctaHref,
  /** 'green' = forest buy button (default); 'accent' passes a custom bg color. */
  ctaColor = '#1B6B3F',
  ctaTextColor = '#ffffff',
  className,
  /** When set, the CTA opens a modal instead of navigating: the button is
      rendered as a <button> and passed to this wrapper (e.g. a DialogTrigger).
      Takes precedence over ctaHref. */
  ctaWrap,
  /** Override the background image path. Defaults to the buy banner's
      public/cta-heroes/{slug}.jpg; the seller banner passes its own folder
      (public/seller-cta/{slug}.png). Missing file falls back to the scrim. */
  bgSrc,
}: {
  gameSlug: string
  title: ReactNode
  body: ReactNode
  ctaLabel: string
  ctaHref: string
  ctaColor?: string
  ctaTextColor?: string
  className?: string
  ctaWrap?: (button: ReactNode) => ReactNode
  bgSrc?: string
}) {
  const [hasImage, setHasImage] = useState(true)

  return (
    <section className={className ?? 'pt-12 sm:pt-16'}>
      <div className="relative overflow-hidden border border-[#1E2723] bg-[#0C0F0E]">
        {/* Per-game background hero. Buy banner: public/cta-heroes/{slug}.jpg;
            seller banner passes bgSrc for its own folder. */}
        {hasImage && (
          // eslint-disable-next-line @next/next/no-img-element -- static per-game bg
          <img
            src={bgSrc ?? `/cta-heroes/${gameSlug}.jpg`}
            alt=""
            aria-hidden
            onError={() => setHasImage(false)}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.28]"
          />
        )}
        {/* Left-weighted scrim — keeps the copy legible and is the no-image fallback. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, #0C0F0E 0%, rgba(12,15,14,0.92) 42%, rgba(12,15,14,0.55) 100%)',
          }}
        />

        <div className="relative flex flex-wrap items-center justify-between gap-6 p-6 sm:p-10">
          <div className="min-w-0">
            <h2 className="mb-3 text-[22px] font-semibold leading-tight tracking-tight text-[#F1F3F1] sm:text-[26px]">
              {title}
            </h2>
            <p className="max-w-xl text-sm leading-relaxed text-[#98A398]">{body}</p>
          </div>
          {ctaWrap ? (
            ctaWrap(
              <button
                type="button"
                className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-6 py-4 text-sm font-bold shadow-[0_6px_16px_-8px_rgba(0,0,0,0.6)] transition-transform active:scale-[0.99]"
                style={{ background: ctaColor, color: ctaTextColor }}
              >
                {ctaLabel}
                <ArrowRight className="h-4 w-4" />
              </button>,
            )
          ) : (
            <Link
              href={ctaHref}
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-6 py-4 text-sm font-bold shadow-[0_6px_16px_-8px_rgba(0,0,0,0.6)] transition-transform active:scale-[0.99]"
              style={{ background: ctaColor, color: ctaTextColor }}
            >
              {ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}

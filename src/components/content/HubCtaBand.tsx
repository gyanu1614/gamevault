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
import Link from '@/components/navigation/AppLink'
import { ArrowRightIcon } from '@phosphor-icons/react/dist/csr/ArrowRight'

/** 6px button, brand fill by default; hover lifts brightness (fill is inline). */
const CTA_BTN =
  'inline-flex h-12 shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-6 text-sm font-semibold ' +
  'shadow-[0_6px_16px_-8px_rgba(0,0,0,0.6)] transition-[filter,transform] hover:brightness-110 active:scale-[0.98] ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring'

export function HubCtaBand({
  gameSlug,
  title,
  body,
  ctaLabel,
  ctaHref,
  /** Button fill. Defaults to the brand green (same as VALUE_BTN_PRIMARY);
      a caller may pass its own accent. */
  ctaColor = 'var(--color-accent-default)',
  ctaTextColor = 'var(--color-text-inverse)',
  className,
  /** When set, the CTA opens a modal instead of navigating: the button is
      rendered as a <button> and passed to this wrapper (e.g. a DialogTrigger).
      Takes precedence over ctaHref. */
  ctaWrap,
  /** Override the background image path. Defaults to the buy banner's
      public/cta-heroes/{slug}.jpg; the seller banner passes its own folder
      (public/seller-cta/{slug}.png). Missing file falls back to the scrim. */
  bgSrc,
  /** Background image opacity (0–1). Default 0.28 (buy banner); the seller
      banner passes a higher value for a more visible backdrop. */
  bgOpacity = 0.28,
  /** Add an extra scrim from the RIGHT edge so a brighter backdrop doesn't
      wash out the CTA button on the right. Off by default (buy banner); the
      seller banner enables it. */
  rightScrim = false,
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
  bgOpacity?: number
  rightScrim?: boolean
}) {
  const [hasImage, setHasImage] = useState(true)

  return (
    // Constrained to the standard page width by DEFAULT so every CTA (buy +
    // sell, every game) is the same size without each caller re-wrapping it.
    // A caller can still pass its own className to override (e.g. a narrower
    // content column).
    <section
      className={
        className ?? 'mx-auto w-full max-w-7xl px-4 pt-12 sm:px-6 sm:pt-16 lg:px-8'
      }
    >
      {/* Card-surface band: 8px corners, soft drop shadow, no outline. */}
      <div className="relative overflow-hidden rounded-lg bg-bg-base shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]">
        {/* Per-game background hero. Buy banner: public/cta-heroes/{slug}.jpg;
            seller banner passes bgSrc for its own folder. */}
        {hasImage && (
          // eslint-disable-next-line @next/next/no-img-element -- static per-game bg
          <img
            src={bgSrc ?? `/cta-heroes/${gameSlug}.jpg`}
            alt=""
            aria-hidden
            loading="lazy"
            decoding="async"
            onError={() => setHasImage(false)}
            style={{ opacity: bgOpacity }}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          />
        )}
        {/* Left-weighted scrim — keeps the copy legible and is the no-image fallback. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, var(--color-bg-base) 0%, rgba(22,23,27,0.92) 42%, rgba(22,23,27,0.55) 100%)',
          }}
        />
        {/* Optional right-edge scrim — darkens the right third so a brighter
            backdrop doesn't wash out the CTA button. */}
        {rightScrim && (
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(90deg, transparent 55%, rgba(22,23,27,0.65) 100%)',
            }}
          />
        )}

        <div className="relative flex flex-wrap items-center justify-between gap-6 p-6 sm:p-10">
          <div className="min-w-0">
            <h2 className="mb-3 text-[22px] font-semibold leading-tight tracking-tight text-text-primary sm:text-[26px]">
              {title}
            </h2>
            <p className="max-w-xl text-sm leading-relaxed text-text-secondary">{body}</p>
          </div>
          {ctaWrap ? (
            ctaWrap(
              <button
                type="button"
                className={CTA_BTN}
                style={{ background: ctaColor, color: ctaTextColor }}
              >
                {ctaLabel}
                <ArrowRightIcon size={16} weight="bold" aria-hidden />
              </button>,
            )
          ) : (
            <Link
              href={ctaHref}
              className={CTA_BTN}
              style={{ background: ctaColor, color: ctaTextColor }}
            >
              {ctaLabel}
              <ArrowRightIcon size={16} weight="bold" aria-hidden />
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}

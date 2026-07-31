'use client'

/**
 * Shared end-of-page "buy" CTA for every game content-hub page (blog, values,
 * per-pet, calculator …). One consistent modal-style band, neutral chrome, the
 * shared forest accent button.
 *
 * PER-GAME BACKGROUND HERO (drop-in): the band shows a background image from
 *   public/cta-heroes/{gameSlug}.jpg
 * Drop your own file at that path and it appears on ALL of that game's pages —
 * no DB, no admin. A placeholder ships in the folder (see its README). If the
 * file is missing/unreplaced, the image quietly fails to load and the CTA falls
 * back to a clean gradient, so it always looks finished.
 *
 * Client component only because it needs the <img> onError fallback; the image
 * itself is a plain background layer, so there's no interactivity cost.
 */

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export function HubBuyCta({
  gameName,
  gameSlug,
  buyHref,
  title,
}: {
  gameName: string
  gameSlug: string
  buyHref: string
  title?: string
}) {
  const [hasImage, setHasImage] = useState(true)
  const heading = title ?? `Skip the grind — buy the ${gameName} item you want`

  return (
    <section className="pt-12 sm:pt-16">
      <div className="relative overflow-hidden border border-[#1E2723] bg-[#0C0F0E]">
        {/* Per-game background hero — drop public/cta-heroes/{slug}.jpg to fill
            it. onError hides a missing/placeholder file so the gradient shows. */}
        {hasImage && (
          // eslint-disable-next-line @next/next/no-img-element -- static per-game bg
          <img
            src={`/cta-heroes/${gameSlug}.jpg`}
            alt=""
            aria-hidden
            onError={() => setHasImage(false)}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.28]"
          />
        )}
        {/* Scrim: keeps text legible over any image, and IS the fallback look
            when no image loads. Left-weighted so the copy side stays readable. */}
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
              {heading}
            </h2>
            <p className="max-w-xl text-sm leading-relaxed text-[#98A398]">
              Every order is covered by SafeDrop — the seller is paid only after
              you confirm delivery.
            </p>
          </div>
          <Link
            href={buyHref}
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap bg-[#1B6B3F] px-6 py-4 text-sm font-bold text-white shadow-[0_6px_16px_-8px_rgba(27,107,63,0.6)] transition hover:bg-[#1f7a48]"
          >
            Buy {gameName} items
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}

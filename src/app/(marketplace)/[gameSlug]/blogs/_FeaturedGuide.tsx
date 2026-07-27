/**
 * "Start here" — the one guide given real weight at the top of the hub.
 *
 * Styled in the same forest palette as the Values page. Split card: art on a
 * tinted tile at left, copy at right, collapsing to one column on mobile. Art
 * is always `contain` — covers are landscape and item renders square, so
 * cropping either would misrepresent it.
 */

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

const UPDATED = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

export function FeaturedGuide({
  href,
  category,
  readMinutes,
  title,
  excerpt,
  publishedAt,
  cover,
  initials,
}: {
  href: string
  category: string
  readMinutes: number
  title: string
  excerpt: string
  publishedAt: string
  cover?: string | null
  initials: string
}) {
  const updated = (() => {
    const d = new Date(publishedAt)
    return Number.isFinite(d.getTime()) ? UPDATED.format(d) : null
  })()

  return (
    <section className="pt-12 sm:pt-16">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[20px] font-semibold tracking-tight text-[#F1F3F1] sm:text-[24px]">
          Start here
        </h2>
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6D7A72]">
          Featured guide
        </span>
      </div>

      {/* Rectangular card (zero radius) with a subtle-fill hover, matching the
          content design. Border brightens slightly on hover. */}
      <Link
        href={href}
        className="group grid items-stretch overflow-hidden border border-[#1A211A] bg-[#0B0F0C] transition-colors hover:border-[#263026] lg:grid-cols-[0.8fr_1.2fr]"
      >
        <div className="relative flex items-center justify-center border-b border-[#1A211A] bg-gradient-to-br from-[#0D140E] to-[#0B0F0C] p-6 transition-colors group-hover:bg-[#101710] sm:p-8 lg:border-b-0 lg:border-r">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote cover art
            <img
              src={cover}
              alt=""
              className="block max-h-[220px] w-full max-w-[150px] object-contain transition-transform duration-500 group-hover:scale-105 sm:max-w-[220px]"
            />
          ) : (
            <div className="flex aspect-square w-full max-w-[150px] items-center justify-center border border-[#23291F] bg-[#0E1211] sm:max-w-[220px]">
              <span className="px-3 text-center text-[10px] font-semibold uppercase leading-relaxed tracking-[0.1em] text-[#6D7A72]">
                {initials} art
              </span>
            </div>
          )}
          <span className="absolute left-4 top-4 bg-[#1B6B3F] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white">
            Featured
          </span>
        </div>

        <div className="flex flex-col justify-center p-6 sm:p-8">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4FB477]">
            {category} · {readMinutes} min read
          </p>
          <h3 className="mb-3 text-[22px] font-semibold leading-snug tracking-tight text-[#F1F3F1] sm:text-[26px]">
            {title}
          </h3>
          <p className="mb-5 max-w-xl text-[14px] leading-relaxed text-[#9BA8A0]">
            {excerpt}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5 bg-[#3FA35C] px-4 py-3 text-[13px] font-semibold text-[#08110B] transition group-hover:bg-[#4CBB6B]">
              Read the guide
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
            {updated && (
              <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#6D7A72]">
                Updated {updated}
              </span>
            )}
          </div>
        </div>
      </Link>
    </section>
  )
}

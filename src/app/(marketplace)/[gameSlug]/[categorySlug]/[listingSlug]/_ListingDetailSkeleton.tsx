/**
 * Listing detail skeleton.
 *
 * SEO — this used to be `loading.tsx`. A route-level loading file is a
 * Suspense boundary ABOVE the page, so the HTTP shell flushed with a 200
 * before the page could call `notFound()`: every dead listing URL answered
 * `200 + "Listing Not Found"` (a soft 404 Google was invited to index).
 * It is now a plain component used as the fallback of an in-page Suspense
 * boundary, so the page's existence check runs first and can still set a
 * real 404 — same skeleton, correct status.
 *
 * Mirrors the CURRENT _ListingDetailClient.tsx, component by component, with
 * the same wrapper classes so nothing shifts when the page swaps in:
 *
 *   LEFT column   context row (game logo · Game › Category) → title →
 *                 square gallery (max 360px, centred) → Description card
 *   RIGHT rail    buy card (seller row · 3 info rows · Total · Buy button)
 *                 → trust card (3 icon cells)
 *   BELOW         "Similar Listings" header + carousel of ItemCards
 *
 * Everything past the similar-listings row (How It Works band, FAQ, blog
 * rail, payments marquee) is well below the first screen and is not drawn.
 *
 * Placeholder blocks and the item-card placeholder are the SAME components
 * the items-page skeleton uses (imported), so both loading states match.
 */

import { Block, ItemCardSkeleton } from '../_ItemsSkeleton'

/** A text line: a block vertically centred in a row of the real line height. */
function Line({ lineHeight, className }: { lineHeight: string; className: string }) {
  return (
    <div className="flex items-center" style={{ height: lineHeight }}>
      <Block className={className} />
    </div>
  )
}

export default function ListingDetailSkeleton() {
  return (
    <main className="min-h-screen pb-24 sm:pb-12" aria-busy>
      {/* Page wrapper — same padding as the real page. */}
      <div className="mx-auto w-full max-w-7xl px-3 pt-8 sm:px-6 sm:pt-10 lg:px-8">
        {/* Main grid — flexible left column + 380px rail. */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8 lg:items-start">
          {/* ── LEFT ─────────────────────────────────────────────────── */}
          <div className="min-w-0 space-y-5">
            <div>
              {/* Context row — 32px game logo, "Game › Category". */}
              <div className="mb-3 flex items-center gap-2.5">
                <Block className="h-8 w-8 shrink-0 rounded-lg" />
                <Block className="h-3.5 w-20" />
                <Block className="h-3.5 w-16" />
              </div>
              {/* Title — one line of 24 / 28 / 30px at leading-tight (1.25). */}
              <div className="flex h-[30px] items-center sm:h-[35px] lg:h-[37.5px]">
                <Block className="h-[70%] w-3/4 max-w-[560px]" />
              </div>
            </div>

            {/* Gallery — square, capped at 360px, centred. */}
            <Block className="mx-auto aspect-square w-full max-w-[360px] rounded-lg" />

            {/* Description card — icon + heading, then body lines. */}
            <div className="rounded-lg border border-border-default bg-bg-overlay p-5">
              <div className="mb-3.5 flex items-center gap-2.5">
                <Block className="h-8 w-8 shrink-0 rounded-lg" />
                <Block className="h-[17px] w-28" />
              </div>
              {/* Body: 15px at leading 1.75 = 26.25px per line. */}
              <Line lineHeight="26.25px" className="h-3.5 w-full" />
              <Line lineHeight="26.25px" className="h-3.5 w-11/12" />
              <Line lineHeight="26.25px" className="h-3.5 w-2/3" />
            </div>
          </div>

          {/* ── RIGHT rail ───────────────────────────────────────────── */}
          <div>
            {/* Buy card — same surface as the real one. */}
            <div className="relative flex flex-col overflow-hidden rounded-lg border border-border-default bg-[rgba(20,20,27,0.56)] p-5 shadow-elevated backdrop-blur-md">
              {/* Seller row — 36px avatar, name + meta line, arrow. */}
              <div className="flex items-center gap-2.5 pb-4">
                <Block className="h-9 w-9 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Block className="h-3.5 w-28" />
                  <Block className="h-3 w-40" />
                </div>
                <Block className="h-4 w-4 shrink-0 rounded" />
              </div>

              {/* Info rows — Delivery Time, Delivery Method, In Stock. */}
              {[0, 1, 2].map((i) => (
                <div key={i} className="border-t border-border-subtle py-3.5">
                  <div className="flex h-[21.75px] items-center justify-between gap-3">
                    <Block className="h-4 w-32" />
                    <Block className="h-4 w-16" />
                  </div>
                </div>
              ))}

              {/* Total — label left, 26px price right. */}
              <div className="flex items-center justify-between gap-2 border-t border-border-subtle py-3.5">
                <Block className="h-4 w-12" />
                <Block className="h-[26px] w-28" />
              </div>

              {/* Buy button — h-12. */}
              <Block className="mt-4 h-12 w-full rounded-md" />
            </div>

            {/* Trust card — three icon cells. */}
            <div className="relative mt-3 overflow-hidden rounded-lg border border-border-default bg-[rgba(20,20,27,0.56)] p-4 shadow-elevated backdrop-blur-md">
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5 px-1.5 py-2">
                    <Block className="h-8 w-8 rounded-full" />
                    <Block className="h-2.5 w-14" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Similar Listings — header + carousel of item cards ─────── */}
        <section className="mt-12 sm:mt-16">
          <div className="mb-4 flex items-end justify-between gap-3">
            {/* SectionHeading md — 22 / 24px at leading 1.05. */}
            <Block className="h-[23px] w-44 sm:h-[25px] sm:w-52" />
            <div className="hidden gap-1.5 sm:flex">
              <Block className="h-9 w-9 rounded-full" />
              <Block className="h-9 w-9 rounded-full" />
            </div>
          </div>
          <div className="flex gap-3 overflow-hidden pb-2 sm:gap-4">
            {[0, 1, 2].map((i) => (
              // Same card-width rule as the real carousel: ~2.4 cards per
              // view on sm+, one card + a peek on phones.
              <div
                key={i}
                className="w-[calc(85%-0.5rem)] min-w-[280px] shrink-0 sm:w-[calc((100%-2rem)/2.4)] sm:min-w-[320px] sm:max-w-[420px]"
              >
                <ItemCardSkeleton />
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}

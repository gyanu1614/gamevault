/**
 * V17z — Route loading skeleton for /{gameSlug}/{categorySlug}.
 *
 * Every wrapper className in this file is copied verbatim from the
 * real components in this same directory so when the real page swaps
 * in, geometry doesn't shift by a pixel.
 *
 * Source components (don't edit a class here without matching there):
 *   • GameSubNav pill         → src/components/marketplace/GameSubNav.tsx
 *   • SectionHeader           → _CurrencyPageClient.tsx :: SectionHeader
 *   • HeroCard wrapper        → _CurrencyPageClient.tsx :: HeroCard
 *   • SectionCard ("raised")  → _CurrencyPageClient.tsx :: SectionCard
 *   • SellerRow article       → _CurrencyPageClient.tsx :: SellerRow
 *   • Main wrapper            → _CurrencyPageClient.tsx :: return()
 *
 * Items pages briefly see this same skeleton because Next can't
 * branch loading.tsx on the URL slug. Currency is the higher-traffic
 * surface and the one the user complained about, so we tune for it.
 */

function Block({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-bg-overlay/80 ${className}`} />
  )
}

/* ── HeroCard skeleton — mirrors HeroCard's <section> + 1fr_auto_1fr
      split exactly. Block sizes derived from the real text sizes
      (text-base sm:text-[17px] for seller name, text-[22px] sm:text-[26px]
      for price, etc.) so the swap is invisible. */
function HeroCardSkeleton() {
  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-border-default bg-bg-raised p-5 sm:p-6 lg:p-8 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.06)]"
      aria-hidden
    >
      {/* "Recommended" chip — h-7-ish pill, top-right */}
      <div className="absolute right-5 top-5 z-10 sm:right-6 sm:top-6">
        <Block className="h-6 w-[122px] rounded-full" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_auto_1fr] lg:gap-0">
        {/* LEFT — seller row → delivery/stock → instructions → badges */}
        <div className="space-y-4 lg:pr-8">
          {/* Seller row (avatar size=48, name text-base sm:text-[17px]) */}
          <div className="-m-1 flex items-center gap-3 rounded-xl p-1">
            <Block className="h-12 w-12 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Block className="h-[17px] w-32" />
                <Block className="h-3.5 w-3.5 rounded-full" />
              </div>
              <Block className="h-3 w-40" />
            </div>
            <Block className="h-4 w-4 rounded" />
          </div>

          {/* Delivery + In stock info rows */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Block className="h-3 w-24" />
              <Block className="h-3.5 w-20" />
            </div>
            <div className="flex items-center justify-between">
              <Block className="h-3 w-16" />
              <div className="flex items-center gap-1.5">
                <Block className="h-1.5 w-1.5 rounded-full" />
                <Block className="h-3.5 w-28" />
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div>
            <Block className="mb-1.5 h-2.5 w-20 uppercase" />
            <div className="space-y-1.5">
              <Block className="h-3 w-full" />
              <Block className="h-3 w-5/6" />
              <Block className="h-3 w-4/5" />
            </div>
          </div>

          {/* Badges pill row */}
          <div className="flex flex-wrap gap-2">
            <Block className="h-6 w-32 rounded-full" />
            <Block className="h-6 w-28 rounded-full" />
            <Block className="h-6 w-36 rounded-full" />
          </div>
        </div>

        {/* CENTRE divider — same hidden/visible rules as real */}
        <div className="hidden w-px bg-border-subtle lg:block" aria-hidden />
        <div className="block h-px w-full bg-border-subtle lg:hidden" aria-hidden />

        {/* RIGHT — price eyebrow + big number → stepper → meta → buy CTA
            → trust chips. Block dimensions track the real text-[11px]
            eyebrow and text-[22px] sm:text-[26px] price. */}
        <div className="lg:pl-8">
          <div>
            <Block className="h-2.5 w-24" />
            <Block className="mt-1.5 h-[22px] w-28 sm:h-[26px]" />
          </div>

          {/* Stepper — real is h-12 sm:h-[52px] rounded-xl border bg-bg-overlay */}
          <div className="mt-3 sm:mt-4">
            <div className="flex h-12 items-center overflow-hidden rounded-xl border border-border-default bg-bg-overlay sm:h-[52px]">
              <Block className="m-3 h-6 w-6 rounded" />
              <span aria-hidden className="h-6 w-px bg-border-subtle" />
              <Block className="mx-auto h-5 w-24" />
              <span aria-hidden className="h-6 w-px bg-border-subtle" />
              <Block className="m-3 h-6 w-6 rounded" />
            </div>
            <div className="mt-1.5 flex items-center justify-between px-1">
              <Block className="h-2.5 w-32" />
              <Block className="h-2.5 w-32" />
            </div>
          </div>

          {/* Buy CTA — real is mt-3 h-12 rounded-xl border */}
          <Block className="mt-3 h-12 w-full rounded-xl" />

          {/* Trust chips — grid-cols-3 gap-1.5 mt-3 */}
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            <Block className="h-[58px] rounded-xl" />
            <Block className="h-[58px] rounded-xl" />
            <Block className="h-[58px] rounded-xl" />
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── SellerRow skeleton — mirrors the real <article> wrapper:
      overflow-hidden rounded-xl border border-border-subtle bg-bg-raised
      with relative > flex content + p-4 sm:p-5 inner padding. */
function SellerRowSkeleton() {
  return (
    <article className="overflow-hidden rounded-xl border border-border-subtle bg-bg-raised">
      <div className="relative">
        <div className="relative z-10 flex items-center gap-3 p-4 sm:gap-5 sm:p-5">
          {/* Seller chunk (avatar size=40 → h-10 w-10) */}
          <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
            <Block className="h-10 w-10 shrink-0 rounded-full" />
            <div className="min-w-0 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Block className="h-[15px] w-28" />
                <Block className="h-3.5 w-3.5 rounded-full" />
              </div>
              <div className="flex items-center gap-2">
                <Block className="h-3 w-16" />
                <Block className="h-3 w-14" />
              </div>
            </div>
          </div>

          {/* Metric columns + divider + price — only on sm+ */}
          <div className="hidden items-center gap-5 sm:flex">
            <div className="w-[120px] space-y-1.5">
              <Block className="h-2.5 w-12" />
              <Block className="h-4 w-20" />
            </div>
            <div className="w-[100px] space-y-1.5">
              <Block className="h-2.5 w-14" />
              <Block className="h-4 w-16" />
            </div>
            <div className="w-[110px] space-y-1.5">
              <Block className="h-2.5 w-14" />
              <Block className="h-4 w-20" />
            </div>
            <span aria-hidden className="h-10 w-px bg-border-subtle" />
            <div className="w-[120px] shrink-0 space-y-1">
              <Block className="h-[22px] w-20" />
              <Block className="h-2.5 w-16" />
            </div>
          </div>

          {/* Select btn + caret */}
          <div className="flex shrink-0 items-center gap-2">
            <Block className="h-10 w-20 rounded-lg" />
            <Block className="h-9 w-9 rounded-lg" />
          </div>
        </div>
      </div>
    </article>
  )
}

export default function CategoryLoading() {
  return (
    <main className="min-h-screen bg-bg-base pb-24 pt-3 sm:pt-4">
      {/* GameSubNav skeleton — classNames copy-pasted from
          src/components/marketplace/GameSubNav.tsx so width/padding
          match the real pill exactly. */}
      <div className="relative z-40 flex justify-center py-6 sm:py-8 md:py-10 pointer-events-none bg-bg-base px-3">
        <div className="pointer-events-auto w-full max-w-fit flex items-center gap-0.5 rounded-full border border-white/[0.1] bg-bg-base shadow-2xl backdrop-blur-xl px-2 py-2 sm:px-3 sm:py-2.5">
          {/* Game logo + name */}
          <div className="flex flex-shrink-0 items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2">
            <Block className="h-6 w-6 rounded-md sm:h-7 sm:w-7" />
            <Block className="h-3.5 w-16 sm:w-20" />
          </div>
          {/* Divider */}
          <div className="mx-1 h-4 w-px bg-white/[0.12] flex-shrink-0 sm:mx-1.5 sm:h-5" aria-hidden />
          {/* Category tabs (5 placeholders matching px-3/4 py-1.5/2 + icon+label) */}
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2"
            >
              <Block className="h-3.5 w-3.5 rounded-sm sm:h-4 sm:w-4" />
              <Block className="h-3.5 w-12 sm:w-14" />
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 lg:px-8">
        {/* SectionHeader — flex flex-wrap items-end justify-between gap-3 px-1
            h2 is text-[20px] sm:text-[22px] / subtitle text-[13px] sm:text-[13.5px] */}
        <div className="flex flex-wrap items-end justify-between gap-3 px-1">
          <div className="min-w-0 space-y-1.5">
            <Block className="h-[22px] w-48" />
            <Block className="h-3.5 w-64 max-w-full" />
          </div>
        </div>

        {/* Hero card sits in a mt-3 wrapper just like the real one. */}
        <div className="mt-3">
          <HeroCardSkeleton />
        </div>

        {/* "Other sellers" section — same mt-12 spacing and SectionHeader
            geometry. Wrapped in SectionCard tone="raised" which is
            rounded-3xl border bg-bg-raised p-5/6/8. */}
        <div className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-3 px-1">
            <div className="min-w-0 space-y-1.5">
              <Block className="h-[22px] w-36" />
              <Block className="h-3.5 w-72 max-w-full" />
            </div>
            {/* Filter chips placeholder — shrink-0 trailing slot */}
            <div className="hidden shrink-0 items-center gap-2 sm:flex">
              <Block className="h-9 w-28 rounded-full" />
              <Block className="h-9 w-24 rounded-full" />
              <Block className="h-9 w-24 rounded-full" />
            </div>
          </div>

          <section className="relative mt-3 overflow-hidden rounded-3xl border border-border-default bg-bg-raised p-5 shadow-elevated sm:p-6 lg:p-8">
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <SellerRowSkeleton key={i} />
              ))}
            </div>
          </section>
        </div>

        {/* Trust stack — mx-auto mt-16 max-w-4xl space-y-8 */}
        <div className="mx-auto mt-16 max-w-4xl space-y-8">
          {/* How it works */}
          <div className="space-y-4">
            <Block className="mx-auto h-6 w-40" />
            <div className="grid gap-3 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border-subtle bg-bg-raised/60 p-4"
                >
                  <Block className="mb-3 h-8 w-8 rounded-full" />
                  <Block className="mb-1.5 h-4 w-24" />
                  <Block className="h-3 w-full" />
                  <Block className="mt-1 h-3 w-4/5" />
                </div>
              ))}
            </div>
          </div>

          {/* FAQ */}
          <div className="space-y-3">
            <Block className="mx-auto h-6 w-28" />
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border-subtle bg-bg-raised/60 p-4"
                >
                  <Block className="h-4 w-3/4" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

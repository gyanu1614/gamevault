/**
 * V19/P23 — Currency-shaped route skeleton. Picked by loading.tsx when
 * the URL is a currency category (anything that's not the items shape).
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
 */

function Block({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-bg-overlay-2 ${className}`} />
  )
}

/* ── HeroCard skeleton — V21/P7.i — mirrors the new two-card split:
      <div grid lg:grid-cols-[1fr_minmax(360px,440px)]> with a left
      Card (seller → delivery → stock → instructions → badges) and a
      right Card (recommended chip → price → stepper → meta → buy →
      trust). Both rounded-lg shadcn Cards, no center divider, no
      glassy shadow. Block sizes track the real text sizes so the
      swap is pixel-stable. */
function HeroCardSkeleton() {
  return (
    <section aria-hidden>
      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(360px,440px)]">
        {/* LEFT CARD — seller row → delivery/stock → instructions → badges */}
        <div className="rounded-lg border border-border-default bg-bg-raised p-5 sm:p-6">
          {/* Seller row (avatar size=48) */}
          <div className="-m-1 mb-1 flex items-center gap-3 rounded-lg p-1">
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

          {/* Delivery Time row — border-t py-3.5 */}
          <div className="flex items-center justify-between border-t border-border-subtle py-3.5">
            <Block className="h-3.5 w-24" />
            <Block className="h-3.5 w-24" />
          </div>
          {/* In Stock row */}
          <div className="flex items-center justify-between border-t border-border-subtle py-3.5">
            <Block className="h-3.5 w-16" />
            <div className="flex items-center gap-1.5">
              <Block className="h-1.5 w-1.5 rounded-full" />
              <Block className="h-3.5 w-28" />
            </div>
          </div>

          {/* Delivery Instructions — border-t py-3.5 */}
          <div className="border-t border-border-subtle py-3.5">
            <Block className="mb-1.5 h-3.5 w-32" />
            <div className="space-y-1.5">
              <Block className="h-3 w-full" />
              <Block className="h-3 w-5/6" />
              <Block className="h-3 w-4/5" />
            </div>
          </div>

          {/* Badges row — border-t pt-3.5 */}
          <div className="flex flex-wrap gap-2 border-t border-border-subtle pt-3.5">
            <Block className="h-6 w-32 rounded-md" />
            <Block className="h-6 w-28 rounded-md" />
            <Block className="h-6 w-36 rounded-md" />
          </div>
        </div>

        {/* RIGHT CARD — desktop only (mobile uses the sticky tile below).
            recommended chip → price → stepper → meta → buy → trust. */}
        <div className="relative hidden rounded-lg border border-border-default bg-bg-raised p-5 sm:p-6 lg:block">
          {/* Recommended chip top-right */}
          <div className="absolute right-5 top-5 z-10">
            <Block className="h-6 w-[122px] rounded-md" />
          </div>

          {/* Price Per Unit eyebrow + big number */}
          <div>
            <Block className="h-2.5 w-24" />
            <Block className="mt-1.5 h-[26px] w-28" />
          </div>

          {/* Stepper — border-t pt-4, real is h-12 sm:h-[52px] rounded-lg */}
          <div className="mt-4 border-t border-border-subtle pt-4">
            <div className="flex h-12 items-center overflow-hidden rounded-lg border border-border-default bg-bg-overlay sm:h-[52px]">
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

          {/* Buy CTA — mt-4 h-12 rounded-lg */}
          <Block className="mt-4 h-12 w-full rounded-lg" />

          {/* Trust chips — grid-cols-3 gap-1.5 border-t mt-4 pt-4 */}
          <div className="mt-4 grid grid-cols-3 gap-1.5 border-t border-border-subtle pt-4">
            <Block className="h-[58px] rounded-lg" />
            <Block className="h-[58px] rounded-lg" />
            <Block className="h-[58px] rounded-lg" />
          </div>
        </div>
      </div>

      {/* Mobile sticky price tile — lg:hidden, mt-3 h-14 rounded-lg */}
      <Block className="mt-3 h-14 w-full rounded-lg lg:hidden" />
    </section>
  )
}

/* ── SellerRow skeleton — mirrors the real <article> wrapper:
      overflow-hidden rounded-xl border border-border-subtle bg-bg-raised
      with relative > flex content + p-4 sm:p-5 inner padding. */
function SellerRowSkeleton() {
  return (
    <article className="overflow-hidden rounded-lg border border-border-default bg-bg-raised">
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

export default function CurrencySkeleton() {
  return (
    <main className="min-h-screen pb-24 pt-3 sm:pt-4">
      {/* GameSubNav skeleton — classNames copy-pasted from
          src/components/marketplace/GameSubNav.tsx so width/padding
          match the real pill exactly. */}
      <div className="relative z-40 flex justify-center py-3 sm:py-4 md:py-5 pointer-events-none px-3">
        <div className="pointer-events-auto w-full max-w-fit flex items-center gap-0.5 rounded-full border border-white/[0.1] shadow-2xl backdrop-blur-2xl backdrop-saturate-150 px-2 py-1.5 sm:px-2.5 sm:py-2" style={{ backgroundColor: 'rgba(28, 28, 37, 0.30)' }}>
          {/* V21/P7.q — One block per slot (game + each category). */}
          <div className="flex flex-shrink-0 items-center px-2.5 py-1 sm:px-3.5 sm:py-1.5">
            <Block className="h-3.5 w-20 sm:w-24" />
          </div>
          <div className="mx-1 h-4 w-px bg-white/[0.12] flex-shrink-0 sm:mx-1.5 sm:h-5" aria-hidden />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center px-2.5 py-1 sm:px-3.5 sm:py-1.5">
              <Block className="h-3.5 w-14 sm:w-16" />
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 lg:px-8">
        {/* SectionHeader — V21/P7.i — now has a 48px logo tile before
            the title/subtitle block. */}
        <div className="flex flex-wrap items-end justify-between gap-3 px-1">
          <div className="flex min-w-0 items-center gap-3">
            <Block className="h-12 w-12 shrink-0 rounded-lg" />
            <div className="min-w-0 space-y-1.5">
              <Block className="h-[22px] w-48" />
              <Block className="h-3.5 w-64 max-w-full" />
            </div>
          </div>
        </div>

        {/* Hero card sits in a mt-3 wrapper just like the real one. */}
        <div className="mt-3">
          <HeroCardSkeleton />
        </div>

        {/* "Other sellers" section — same mt-12 spacing and SectionHeader
            geometry. Wrapped in SectionCard tone="raised" which is
            rounded-xl border bg-bg-raised p-5/6/8. */}
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

          {/* V21/P7.i — Rows float directly (no outer SectionCard), matching
              the real page where each SellerRow renders its own surface. */}
          <div className="mt-3 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <SellerRowSkeleton key={i} />
            ))}
          </div>
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

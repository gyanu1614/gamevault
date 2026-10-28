/**
 * Checkout skeleton — the same frame as the live page (owner 2026-10-27):
 * the item page's max-w-7xl width, the Secure Checkout header, then the
 * 1fr / 420px (xl 460px) grid —
 * payment rows (radio, name + line, logo tile) and the seal strip on the
 * left; the order card, the rating card and the trust list on the right.
 */

import { PANEL_CLASS, PANEL_STYLE, rowStyle } from './_surfaces'

const GROUND = '#16171B'

function Block({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-white/[0.07] ${className}`} />
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`${PANEL_CLASS} ${className}`} style={PANEL_STYLE}>
      {children}
    </div>
  )
}

export default function CheckoutLoading() {
  return (
    <div className="min-h-screen" style={{ background: GROUND }}>
      {/* Navbar strip */}
      <div className="flex h-16 items-center justify-between px-4 sm:px-10">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 animate-pulse rounded-md bg-white/10" />
          <div className="h-4 w-24 animate-pulse rounded bg-white/10" />
        </div>
        <div className="h-7 w-7 animate-pulse rounded-full bg-white/10" />
      </div>

      <div className="mx-auto w-full max-w-7xl px-3 pb-24 pt-8 sm:px-6 sm:pt-10 lg:px-8">
        {/* Header row */}
        <div className="flex items-center gap-3">
          <Block className="h-9 w-9" />
          <Block className="h-6 w-6 rounded-full" />
          <Block className="h-7 w-48" />
        </div>

        <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_460px] xl:gap-10">
          {/* Phones: compact order strip */}
          <Card className="p-3.5 lg:hidden">
            <Block className="h-4 w-20" />
            <div className="mt-2.5 flex items-start gap-3">
              <Block className="h-[52px] w-[52px]" />
              <div className="min-w-0 flex-1">
                <Block className="h-4 w-44" />
                <Block className="mt-1.5 h-3 w-40" />
                <Block className="mt-1.5 h-3 w-28" />
              </div>
              <Block className="h-5 w-14" />
            </div>
          </Card>

          {/* Left — payment column */}
          <div>
            <div className="mb-3 flex items-center justify-between gap-4">
              <Block className="h-6 w-40" />
              <Block className="h-4 w-44" />
            </div>
            {/* Method rows: radio, name, logo tile */}
            <div className="flex flex-col gap-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex min-h-[48px] items-center gap-3 rounded-md bg-[#202127]/75 px-3.5 py-1.5"
                  style={rowStyle(false)}
                >
                  <Block className="h-[18px] w-[18px] rounded-full" />
                  <Block className="h-4 w-28 flex-1" />
                  <Block className="h-7 w-[48px]" />
                </div>
              ))}
            </div>

            {/* Phones: discount + money rows under the list */}
            <Card className="mt-4 px-4 pb-4 pt-3 lg:hidden">
              <Block className="h-3.5 w-40" />
              <div className="mt-3 space-y-2 border-t border-white/[0.08] pt-3.5">
                {[0, 1].map((i) => (
                  <div key={i} className="flex justify-between">
                    <Block className="h-3.5 w-28" />
                    <Block className="h-3.5 w-14" />
                  </div>
                ))}
              </div>
            </Card>

            {/* Seal strip */}
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-start gap-2 sm:justify-center">
                  <Block className="h-[18px] w-[18px]" />
                  <div>
                    <Block className="h-3 w-28" />
                    <Block className="mt-1.5 h-2.5 w-32" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — order card, rating, trust list */}
          <div className="flex flex-col gap-3.5">
            <Card className="hidden p-5 lg:block">
              <div className="flex items-center gap-3.5">
                <Block className="h-14 w-14 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <Block className="h-4 w-40" />
                  <Block className="mt-1.5 h-3.5 w-24" />
                </div>
              </div>
              <Block className="mt-3.5 h-10 w-full" />
              <div className="mt-4 flex items-center gap-3 border-t border-white/[0.08] pt-4">
                <Block className="h-10 w-10 rounded-full" />
                <div>
                  <Block className="h-4 w-32" />
                  <Block className="mt-1 h-3 w-24" />
                </div>
              </div>
              <div className="mt-4 space-y-2 border-t border-white/[0.08] pt-3.5">
                {[0, 1].map((i) => (
                  <div key={i} className="flex justify-between">
                    <Block className="h-3.5 w-28" />
                    <Block className="h-3.5 w-14" />
                  </div>
                ))}
                <div className="flex justify-between border-t border-white/[0.08] pt-3">
                  <Block className="h-5 w-12" />
                  <Block className="h-6 w-20" />
                </div>
              </div>
              <Block className="mt-4 h-12 w-full" />
              <Block className="mx-auto mt-3 h-3 w-56" />
            </Card>
            <Card className="flex items-center gap-3 px-5 py-4">
              <Block className="h-4 w-24" />
              <Block className="ml-auto h-5 w-32" />
            </Card>
            <Card className="space-y-4 px-5 py-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-start gap-3">
                  <Block className="h-5 w-5" />
                  <div>
                    <Block className="h-3.5 w-36" />
                    <Block className="mt-1.5 h-3 w-48" />
                  </div>
                </div>
              ))}
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

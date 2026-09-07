/**
 * Checkout skeleton — Ivory Ledger era. Shape-faithful to the live page:
 * dark navbar strip, ivory ground, Secure Checkout header row, then the
 * 1fr/400px grid — crypto method card + disabled rows on the left, the
 * white order-summary card on the right. Pulses in ivory tones so the
 * transition into the real page is colour- and shape-stable.
 */

const IVORY = '#FAFAF7'
const NAV = '#141714'
const LINE = '#E4E5DE'

function Block({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-[#ECEBE3] ${className}`} />
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border bg-white ${className}`} style={{ borderColor: LINE }}>
      {children}
    </div>
  )
}

export default function CheckoutLoading() {
  return (
    <div className="min-h-screen" style={{ background: IVORY }}>
      {/* Navbar strip */}
      <div className="flex h-16 items-center justify-between px-4 sm:px-10" style={{ background: NAV }}>
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 animate-pulse rounded-md bg-white/10" />
          <div className="h-4 w-24 animate-pulse rounded bg-white/10" />
        </div>
        <div className="h-7 w-7 animate-pulse rounded-full bg-white/10" />
      </div>

      <div className="mx-auto w-full max-w-[1120px] px-4 pb-24 pt-8 sm:px-10">
        {/* Header row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Block className="h-9 w-9" />
            <Block className="h-7 w-48" />
          </div>
          <Block className="h-8 w-36" />
        </div>

        <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_400px] lg:gap-8">
          {/* Left — payment column */}
          <div>
            <Block className="h-5 w-24" />
            <Block className="mt-2 h-4 w-72" />

            {/* Crypto card */}
            <Card className="mt-4 p-4">
              <div className="flex items-center gap-3">
                <Block className="h-[18px] w-[18px] rounded-full" />
                <Block className="h-4 w-16" />
                <Block className="h-5 w-14" />
                <Block className="h-5 w-24" />
                <span className="ml-auto flex gap-1.5">
                  <Block className="h-5 w-5 rounded-full" />
                  <Block className="h-5 w-5 rounded-full" />
                </span>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-2" style={{ borderColor: LINE }}>
                <div>
                  <Block className="mb-1.5 h-3.5 w-10" />
                  <Block className="h-[42px] w-full" />
                </div>
                <div>
                  <Block className="mb-1.5 h-3.5 w-16" />
                  <Block className="h-[42px] w-full" />
                </div>
              </div>
              <Block className="mt-3 h-[52px] w-full rounded-lg" />
            </Card>

            {/* Local method rows (GCash/OXXO/Boleto) */}
            {[0, 1, 2].map((i) => (
              <Card key={`m${i}`} className="mt-3 flex items-center gap-3 p-4">
                <Block className="h-[18px] w-[18px] rounded-full" />
                <Block className="h-[18px] w-[18px]" />
                <Block className="h-4 w-20" />
                <Block className="ml-auto h-5 w-20" />
              </Card>
            ))}
            {/* Disabled "Soon" rows */}
            {[0, 1, 2, 3].map((i) => (
              <Card key={`s${i}`} className="mt-3 flex items-center gap-3 px-4 py-3.5">
                <Block className="h-[18px] w-[18px] rounded-full" />
                <Block className="h-4 w-36" />
                <Block className="ml-auto h-5 w-16" />
              </Card>
            ))}

            <Block className="mt-5 hidden h-12 w-full lg:block" />
            <Block className="mx-auto mt-2.5 hidden h-3.5 w-80 lg:block" />
          </div>

          {/* Right — summary card */}
          <Card className="p-5">
            <div className="flex items-center gap-3.5">
              <Block className="h-14 w-14 rounded-lg" />
              <div className="min-w-0 flex-1">
                <Block className="h-4 w-40" />
                <Block className="mt-1.5 h-3.5 w-24" />
              </div>
            </div>
            <div className="mt-3 space-y-2 border-t pt-3" style={{ borderColor: LINE }}>
              <div className="flex justify-between"><Block className="h-3.5 w-24" /><Block className="h-3.5 w-12" /></div>
              <div className="flex justify-between"><Block className="h-3.5 w-16" /><Block className="h-3.5 w-8" /></div>
            </div>
            <div className="mt-3 flex items-center gap-3 border-t pt-3" style={{ borderColor: LINE }}>
              <Block className="h-10 w-10 rounded-full" />
              <div>
                <Block className="h-4 w-32" />
                <Block className="mt-1 h-3 w-24" />
              </div>
            </div>
            <div className="mt-4 space-y-2 border-t pt-3.5" style={{ borderColor: LINE }}>
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex justify-between">
                  <Block className="h-3.5 w-28" />
                  <Block className="h-3.5 w-14" />
                </div>
              ))}
              <div className="flex justify-between border-t pt-3" style={{ borderColor: LINE }}>
                <Block className="h-5 w-12" />
                <Block className="h-6 w-20" />
              </div>
            </div>
            <div className="mt-4 border-t pt-3.5" style={{ borderColor: LINE }}>
              <Block className="h-4 w-40" />
              <Block className="mt-1.5 h-3.5 w-full" />
              <div className="mt-3 flex gap-1.5">
                <Block className="h-7 flex-1" />
                <Block className="h-7 flex-1" />
                <Block className="h-7 flex-1" />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

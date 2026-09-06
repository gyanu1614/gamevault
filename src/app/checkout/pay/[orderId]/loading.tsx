/**
 * Payment page skeleton — Ledger Receipt shaped: dark navbar, step row,
 * then the 300/520/270 three-column silhouette (ledger rail · receipt
 * card with QR square · assurance column). Ivory pulses, shape-stable.
 */

const IVORY = '#FAFAF7'
const NAV = '#1A1D19'
const LINE = '#E7E5DF'

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

export default function PayLoading() {
  return (
    <div className="min-h-screen" style={{ background: IVORY }}>
      <div className="flex h-[54px] items-center justify-between px-4 sm:px-8" style={{ background: NAV }}>
        <div className="flex items-center gap-2">
          <div className="h-[22px] w-[22px] animate-pulse rounded-md bg-white/10" />
          <div className="h-4 w-24 animate-pulse rounded bg-white/10" />
        </div>
        <div className="h-7 w-7 animate-pulse rounded-full bg-white/10" />
      </div>

      <div className="mx-auto w-full max-w-[1180px] px-4 pb-10 pt-5 sm:px-8">
        <div className="flex justify-center">
          <Block className="h-6 w-80" />
        </div>

        <div className="mt-5 flex flex-col gap-3 lg:grid lg:justify-center lg:gap-7 lg:[grid-template-columns:300px_520px_270px]">
          {/* Ledger rail */}
          <Card className="hidden p-[18px] lg:block">
            <Block className="h-3.5 w-32" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="mt-4 flex items-start gap-3">
                <Block className="mt-1 h-2 w-2 rounded-full" />
                <div className="flex-1">
                  <Block className="h-3.5 w-36" />
                  <Block className="mt-1 h-3 w-24" />
                </div>
              </div>
            ))}
          </Card>

          {/* Receipt card */}
          <Card className="px-5 py-5 sm:px-7 sm:py-6">
            <div className="flex items-center gap-3.5">
              <Block className="h-[52px] w-[52px] rounded-md" />
              <div className="min-w-0 flex-1">
                <Block className="h-4 w-44" />
                <Block className="mt-1.5 h-3 w-28" />
              </div>
              <Block className="h-6 w-16" />
            </div>
            <div className="my-4 border-t border-dashed" style={{ borderColor: LINE }} />
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
              <Block className="h-[196px] w-[196px] rounded-md" />
              <div className="flex w-full flex-1 flex-col gap-3">
                <Block className="h-3 w-20" />
                <Block className="h-7 w-40" />
                <Block className="h-3 w-28" />
                <Block className="h-10 w-full" />
                <Block className="h-[42px] w-full rounded-md" />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <Block className="h-6 w-44" />
              <Block className="h-4 w-36" />
            </div>
            <Block className="mt-3.5 h-12 w-full rounded-md" />
          </Card>

          {/* Assurance column */}
          <div className="hidden lg:block">
            <Card className="p-[18px]">
              <Block className="h-4 w-44" />
              <Block className="mt-2 h-3.5 w-full" />
              <Block className="mt-1 h-3.5 w-3/4" />
            </Card>
            <Card className="mt-3 p-[18px]">
              <Block className="h-3.5 w-20" />
              <Block className="mt-2 h-3.5 w-14" />
              <Block className="mt-2 h-3.5 w-24" />
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

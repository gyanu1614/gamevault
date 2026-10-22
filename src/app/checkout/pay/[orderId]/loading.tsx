/**
 * Payment page skeleton: the white hosted-invoice layout (owner 2026-10-21).
 * Light header, then one centred card: order total + Order Info, coin row,
 * amount, QR square, address, Open In Wallet, progress bar. Shape-stable.
 */

function Block({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-[#E9ECF0] motion-reduce:animate-none ${className}`} />
}

export default function PayLoading() {
  return (
    <div className="min-h-[100dvh] bg-[#F4F5F7]" aria-busy="true" aria-label="Loading payment">
      <div className="border-b border-[#E6E8EC] bg-white">
        <div className="mx-auto flex h-14 w-full max-w-[960px] items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Block className="h-6 w-6" />
            <Block className="h-4 w-24" />
          </div>
          <Block className="h-4 w-28" />
        </div>
      </div>

      <div className="mx-auto w-full max-w-[480px] px-4 pb-16 pt-6 sm:pt-10">
        <div className="overflow-hidden rounded-2xl border border-[#E6E8EC] bg-white">
          <div className="flex flex-col items-center border-b border-[#E6E8EC] px-6 pb-4 pt-6">
            <Block className="h-3 w-40" />
            <Block className="mt-2.5 h-8 w-36" />
            <Block className="mt-2 h-3 w-24" />
            <Block className="mt-3 h-8 w-28" />
          </div>
          <div className="space-y-5 px-6 pb-6 pt-5">
            <div className="flex items-center justify-between">
              <Block className="h-6 w-36" />
              <Block className="h-7 w-16" />
            </div>
            <div>
              <Block className="h-3 w-20" />
              <Block className="mt-2 h-7 w-44" />
            </div>
            <Block className="mx-auto h-[266px] w-[266px] rounded-xl" />
            <div>
              <Block className="h-3 w-28" />
              <Block className="mt-2 h-11 w-full rounded-lg" />
            </div>
            <Block className="h-11 w-full rounded-lg" />
          </div>
          <div className="grid grid-cols-4 gap-2 border-t border-[#E6E8EC] px-6 py-4">
            {[0, 1, 2, 3].map((i) => (
              <Block key={i} className="h-1" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

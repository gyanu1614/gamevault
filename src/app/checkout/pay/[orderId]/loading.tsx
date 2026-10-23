/**
 * Payment page skeleton: the white hosted-invoice layout (owner 2026-10-21).
 * Light header, then one centred card: order total + Order Info, coin row,
 * amount, QR square, address, Open In Wallet, progress bar. Desktop: 880px
 * with the QR on the left (owner 2026-10-22). Shape-stable.
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

      <div className="mx-auto w-full max-w-[480px] px-4 pb-16 pt-6 sm:pt-10 lg:max-w-[880px]">
        <div className="overflow-hidden rounded-2xl border border-[#E6E8EC] bg-white">
          <div className="flex flex-col items-center border-b border-[#E6E8EC] px-6 pb-4 pt-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
            <div className="flex flex-col items-center lg:items-start">
              <Block className="h-3 w-40" />
              <Block className="mt-2.5 h-8 w-36" />
              <Block className="mt-2 h-3 w-24" />
            </div>
            <Block className="mt-3 h-8 w-28 lg:mt-0" />
          </div>
          <div className="grid grid-cols-1 gap-5 px-6 pb-6 pt-5 lg:grid-cols-[296px_minmax(0,1fr)] lg:gap-x-8 lg:px-8 lg:py-7">
            <div className="space-y-5 lg:col-start-2">
              <div className="flex items-center justify-between">
                <Block className="h-6 w-36" />
                <Block className="h-7 w-16" />
              </div>
              <div>
                <Block className="h-3 w-20" />
                <Block className="mt-2 h-7 w-44" />
              </div>
            </div>
            <Block className="mx-auto h-[266px] w-[266px] rounded-xl lg:col-start-1 lg:row-span-2 lg:row-start-1" />
            <div className="space-y-5 lg:col-start-2">
              <div>
                <Block className="h-3 w-28" />
                <Block className="mt-2 h-11 w-full rounded-lg" />
              </div>
              <Block className="h-11 w-full rounded-lg" />
            </div>
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

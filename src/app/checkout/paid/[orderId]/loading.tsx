/** Skeleton for /checkout/paid/[orderId] — the same column as OrderPaidView: mark, title, line, order card, two buttons (site navbar comes from the layout). */
export default function Loading() {
  const bar = 'animate-pulse rounded-md bg-white/[0.06]'
  return (
    <main className="mx-auto flex min-h-[calc(100dvh-var(--navbar-bottom,0px))] w-full max-w-[640px] flex-col items-center justify-center px-4 py-6" aria-busy="true">
      <div className={`${bar} h-[60px] w-[60px] rounded-full`} />
      <div className={`${bar} mt-4 h-8 w-52`} />
      <div className={`${bar} mt-2.5 h-4 w-72`} />
      <div className={`${bar} mt-6 h-[196px] w-full rounded-xl`} />
      <div className="mt-5 flex w-full flex-col gap-2.5 sm:flex-row">
        <div className={`${bar} h-12 w-full rounded-lg sm:flex-1`} />
        <div className={`${bar} h-12 w-full rounded-lg sm:flex-1`} />
      </div>
    </main>
  )
}

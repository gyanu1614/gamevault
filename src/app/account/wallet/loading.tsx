import { MetricCardSkeleton } from '@/components/ui/skeletons'

export default function WalletLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="skeleton h-10 w-10 rounded-xl" />
        <div className="space-y-1.5">
          <div className="skeleton h-6 w-36 rounded-lg" />
          <div className="skeleton h-3 w-48 rounded" />
        </div>
      </div>
      {/* Balance cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => <MetricCardSkeleton key={i} />)}
      </div>
      {/* Connect card */}
      <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="skeleton h-9 w-9 rounded-lg" />
            <div className="space-y-1.5">
              <div className="skeleton h-4 w-28 rounded" />
              <div className="skeleton h-3 w-20 rounded" />
            </div>
          </div>
          <div className="skeleton h-6 w-20 rounded-full" />
        </div>
        <div className="skeleton h-24 w-full rounded-xl" />
      </div>
    </div>
  )
}

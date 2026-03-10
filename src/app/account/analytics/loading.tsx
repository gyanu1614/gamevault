import { MetricCardSkeleton } from '@/components/ui/skeletons'

export default function AnalyticsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="skeleton h-7 w-28 rounded-lg" />
        <div className="skeleton h-4 w-44 rounded" />
      </div>
      {/* Top metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <MetricCardSkeleton key={i} />)}
      </div>
      {/* Chart placeholder */}
      <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-5 space-y-4">
        <div className="skeleton h-4 w-32 rounded" />
        <div className="skeleton h-52 w-full rounded-xl" />
      </div>
      {/* Secondary metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => <MetricCardSkeleton key={i} />)}
      </div>
    </div>
  )
}

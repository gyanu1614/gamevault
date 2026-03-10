import { MetricCardSkeleton } from '@/components/ui/skeletons'

export default function TiersLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="skeleton h-7 w-32 rounded-lg" />
        <div className="skeleton h-4 w-52 rounded" />
      </div>
      {/* Current tier card */}
      <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="skeleton h-12 w-12 rounded-2xl" />
          <div className="space-y-2">
            <div className="skeleton h-5 w-24 rounded-lg" />
            <div className="skeleton h-3 w-36 rounded" />
          </div>
          <div className="ml-auto skeleton h-6 w-20 rounded-full" />
        </div>
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-2 w-full rounded-full" />
        <div className="skeleton h-3 w-32 rounded" />
      </div>
      {/* Tier benefits */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => <MetricCardSkeleton key={i} />)}
      </div>
      {/* All tiers */}
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-4 flex items-center gap-4">
            <div className="skeleton h-10 w-10 rounded-xl" />
            <div className="space-y-1.5 flex-1">
              <div className="skeleton h-4 w-24 rounded" />
              <div className="skeleton h-3 w-40 rounded" />
            </div>
            <div className="skeleton h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

import { MetricCardSkeleton, OrderCardSkeleton } from '@/components/ui/skeletons'

export default function OrdersLoading() {
  return (
    <div className="space-y-6">
      {/* Header placeholder */}
      <div className="space-y-1">
        <div className="skeleton h-7 w-32 rounded-lg" />
        <div className="skeleton h-4 w-48 rounded" />
      </div>
      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <MetricCardSkeleton key={i} />)}
      </div>
      {/* Order list */}
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => <OrderCardSkeleton key={i} />)}
      </div>
    </div>
  )
}

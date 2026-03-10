import { MetricCardSkeleton, OrderCardSkeleton } from '@/components/ui/skeletons'
import { ListingCardSkeleton } from '@/components/listing-card'

export default function ListingsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="skeleton h-7 w-36 rounded-lg" />
        <div className="skeleton h-4 w-52 rounded" />
      </div>
      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <MetricCardSkeleton key={i} />)}
      </div>
      {/* Listing grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {Array.from({ length: 8 }).map((_, i) => <ListingCardSkeleton key={i} />)}
      </div>
    </div>
  )
}

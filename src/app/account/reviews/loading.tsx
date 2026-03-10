import { MetricCardSkeleton, ReviewCardSkeleton } from '@/components/ui/skeletons'

export default function ReviewsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="skeleton h-7 w-28 rounded-lg" />
        <div className="skeleton h-4 w-44 rounded" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => <MetricCardSkeleton key={i} />)}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => <ReviewCardSkeleton key={i} />)}
      </div>
    </div>
  )
}

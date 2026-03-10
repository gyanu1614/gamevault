/**
 * Seller Reviews Hook
 * Fetches and manages seller reviews with response functionality
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { reviewsApi, Review } from '@/lib/api/seller-compatible'
import { toast } from 'sonner'

interface UseReviewsOptions {
  rating?: number
  search?: string
}

export function useSellerReviews(options?: UseReviewsOptions) {
  const queryClient = useQueryClient()

  // Fetch reviews
  const {
    data: reviews,
    isLoading: reviewsLoading,
    error: reviewsError,
  } = useQuery<Review[]>({
    queryKey: ['seller', 'reviews', options],
    queryFn: () => reviewsApi.getAll(options),
  })

  // Fetch review stats
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery<{
    avgRating: number
    totalReviews: number
    ratingCounts: Record<number, number>
    responseRate: number
  }>({
    queryKey: ['seller', 'reviews', 'stats'],
    queryFn: () => reviewsApi.getStats(),
  })

  // Respond to review mutation
  const respondToReview = useMutation({
    mutationFn: ({ id, response }: { id: string; response: string }) =>
      reviewsApi.respond(id, response),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller', 'reviews'] })
      toast.success('Response posted successfully!')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to post response')
    },
  })

  return {
    reviews: reviews || [],
    stats: stats || {
      avgRating: 0,
      totalReviews: 0,
      ratingCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      responseRate: 0,
    },
    isLoading: reviewsLoading || statsLoading,
    error: reviewsError || statsError,
    respondToReview: respondToReview.mutateAsync,
    isResponding: respondToReview.isPending,
  }
}

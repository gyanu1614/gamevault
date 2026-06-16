'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

interface LoadMoreListingsProps {
  currentPage: number
  hasMore: boolean
  listingsPerPage: number
}

export default function LoadMoreListings({
  currentPage,
  hasMore,
  listingsPerPage
}: LoadMoreListingsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const handleLoadMore = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(currentPage + 1))

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  if (!hasMore) {
    return null
  }

  return (
    <div className="flex justify-center mt-8">
      <button
        onClick={handleLoadMore}
        disabled={isPending}
        className="px-8 py-3 bg-gradient-to-r from-lime to-blue-500 hover:from-lime hover:to-blue-600 text-text-primary font-semibold rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {isPending ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading...
          </>
        ) : (
          'Load More'
        )}
      </button>
    </div>
  )
}

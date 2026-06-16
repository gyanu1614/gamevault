'use client'

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PaginationControlsProps {
  currentPage: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
  onPageChange: (page: number) => void
  totalItems?: number
  itemsPerPage?: number
}

export function PaginationControls({
  currentPage,
  totalPages,
  hasNextPage,
  hasPrevPage,
  onPageChange,
  totalItems,
  itemsPerPage = 20,
}: PaginationControlsProps) {
  const startItem = (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalItems || 0)

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = []
    const showPages = 5

    if (totalPages <= showPages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      pages.push(1)

      if (currentPage > 3) {
        pages.push('ellipsis')
      }

      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)

      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) {
          pages.push(i)
        }
      }

      if (currentPage < totalPages - 2) {
        pages.push('ellipsis')
      }

      if (!pages.includes(totalPages)) {
        pages.push(totalPages)
      }
    }

    return pages
  }

  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
      {/* Item count */}
      <div className="text-sm text-text-secondary">
        {totalItems ? (
          <>
            Showing <span className="font-medium text-white">{startItem}</span> to{' '}
            <span className="font-medium text-white">{endItem}</span> of{' '}
            <span className="font-medium text-white">{totalItems}</span> results
          </>
        ) : (
          `Page ${currentPage} of ${totalPages}`
        )}
      </div>

      {/* Page controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onPageChange(1)}
          disabled={!hasPrevPage}
          className="h-8 w-8 text-text-secondary hover:text-white disabled:opacity-50"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!hasPrevPage}
          className="h-8 w-8 text-text-secondary hover:text-white disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-1 mx-2">
          {getPageNumbers().map((page, idx) =>
            page === 'ellipsis' ? (
              <span key={`ellipsis-${idx}`} className="px-2 text-text-tertiary">
                ...
              </span>
            ) : (
              <Button
                key={page}
                variant={currentPage === page ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onPageChange(page)}
                className={`h-8 w-8 ${
                  currentPage === page
                    ? 'bg-indigo-600 text-white'
                    : 'text-text-secondary hover:text-white hover:bg-white/10'
                }`}
              >
                {page}
              </Button>
            )
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!hasNextPage}
          className="h-8 w-8 text-text-secondary hover:text-white disabled:opacity-50"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => onPageChange(totalPages)}
          disabled={!hasNextPage}
          className="h-8 w-8 text-text-secondary hover:text-white disabled:opacity-50"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

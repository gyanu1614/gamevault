'use client'

/**
 * CategoryPills
 *
 * Horizontally scrolling sticky pill row shown below the navbar on category pages.
 * Shows sub-types from category metadata (e.g. Robux, Game Pass, Gift Card for Roblox/Currency).
 * Clicking a pill adds ?type=slug to URL for client-side filtering.
 *
 * Design: Eldorado-style — sticky below navbar, horizontal scroll with hidden scrollbar.
 */

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import { cn } from '@/lib/utils'

interface CategoryPillsProps {
  /** Sub-type labels from category.metadata.sub_types (e.g. ["Robux", "Game Pass"]) */
  subTypes: string[]
  /** Optional: current active type from URL searchParam */
  activeType?: string | null
}

export default function CategoryPills({ subTypes, activeType }: CategoryPillsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const setType = useCallback(
    (type: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (type) {
        params.set('type', type.toLowerCase().replace(/\s+/g, '-'))
      } else {
        params.delete('type')
      }
      // Reset to page 1 when switching type
      params.delete('page')
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [router, pathname, searchParams]
  )

  if (!subTypes || subTypes.length === 0) return null

  return (
    <div className="flex items-start">
      <div
        className="flex items-center gap-2 overflow-x-auto"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
          {/* "All" pill */}
          <button
            onClick={() => setType(null)}
            className={cn(
              'flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-150',
              !activeType
                ? 'bg-white text-black'
                : 'bg-bg-raised-hover text-text-secondary hover:bg-white/[0.12] hover:text-text-primary'
            )}
          >
            All
          </button>

          {subTypes.map((subType) => {
            const typeSlug = subType.toLowerCase().replace(/\s+/g, '-')
            const isActive = activeType === typeSlug

            return (
              <button
                key={subType}
                onClick={() => setType(subType)}
                className={cn(
                  'flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-150 whitespace-nowrap',
                  isActive
                    ? 'bg-lime text-text-inverse'
                    : 'bg-bg-raised-hover text-text-secondary hover:bg-white/[0.12] hover:text-text-primary'
                )}
              >
                {subType}
              </button>
            )
          })}
      </div>
    </div>
  )
}

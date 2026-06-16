/**
 * CategorySelector Component
 *
 * Displays game-specific categories and handles special field requirements:
 * - Shows only categories for the selected game
 * - Automatically displays region selector if category requires it
 * - Automatically displays platform selector if category requires it
 * - Adapts UI based on metadata from database
 */

'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Category {
  id: string
  game_id: string
  name: string
  slug: string
  icon: string
  description?: string
  display_order: number
  metadata: {
    type?: 'currency' | 'items' | 'account' | 'service' | 'gift_card'
    requires_region?: boolean
    requires_platform?: boolean
    available_regions?: Array<{ code: string; name: string; currency?: string }>
    available_platforms?: string[]
    unit_label?: string
    is_limited?: boolean
    is_modded?: boolean
  }
}

interface CategorySelectorProps {
  categories: Category[]
  selectedCategoryId: string
  onSelectCategory: (categoryId: string) => void
  className?: string
  disabled?: boolean
}

export default function CategorySelector({
  categories,
  selectedCategoryId,
  onSelectCategory,
  className,
  disabled = false,
}: CategorySelectorProps) {
  if (categories.length === 0) {
    return (
      <div className={className}>
        <label className="mb-2 block text-sm font-medium text-text-secondary">
          Category <span className="text-error">*</span>
        </label>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-center text-sm text-text-secondary">
          Select a game first to see available categories
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <label className="mb-3 block text-sm font-medium text-text-secondary">
        Category <span className="text-error">*</span>
      </label>
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => {
          const isSelected = selectedCategoryId === category.id
          const requiresSpecialField =
            category.metadata?.requires_region || category.metadata?.requires_platform

          return (
            <button
              key={category.id}
              onClick={() => !disabled && onSelectCategory(category.id)}
              disabled={disabled}
              className={cn(
                'relative inline-flex items-center gap-2 rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition-all',
                isSelected
                  ? 'border-primary bg-primary/20 text-white'
                  : 'border-white/10 bg-white/5 text-text-secondary hover:border-white/20 hover:text-white',
                disabled && 'cursor-not-allowed opacity-50'
              )}
            >
              <span className="text-lg">{category.icon}</span>
              <span>{category.name}</span>

              {/* Show indicator if special field required */}
              {requiresSpecialField && (
                <span className="text-xs text-text-tertiary">
                  ({category.metadata.requires_region && 'Region'}
                  {category.metadata.requires_region && category.metadata.requires_platform && '/'}
                  {category.metadata.requires_platform && 'Platform'})
                </span>
              )}

              {isSelected && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

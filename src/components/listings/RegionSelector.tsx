/**
 * RegionSelector Component
 *
 * Displays region selection for categories that require it (gift cards, regional accounts, etc.)
 * Reads available regions from category metadata
 */

'use client'

import { Check, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Region {
  code: string
  name: string
  currency?: string
}

interface RegionSelectorProps {
  regions: Region[]
  selectedRegion: string
  onSelectRegion: (regionCode: string) => void
  className?: string
  label?: string
}

export default function RegionSelector({
  regions,
  selectedRegion,
  onSelectRegion,
  className,
  label = 'Region',
}: RegionSelectorProps) {
  if (regions.length === 0) {
    return null
  }

  return (
    <div className={className}>
      <label className="mb-3 flex items-center gap-2 text-sm font-medium text-text-secondary">
        <Globe className="h-4 w-4" />
        {label} <span className="text-error">*</span>
      </label>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {regions.map((region) => {
          const isSelected = selectedRegion === region.code

          return (
            <button
              key={region.code}
              onClick={() => onSelectRegion(region.code)}
              className={cn(
                'relative rounded-lg border-2 p-3 text-left transition-all',
                isSelected
                  ? 'border-primary bg-primary/20'
                  : 'border-white/10 bg-white/5 hover:border-white/20'
              )}
            >
              <div className="font-semibold text-white">{region.code}</div>
              <div className="mt-0.5 text-xs text-text-secondary">{region.name}</div>
              {region.currency && (
                <div className="mt-1 text-[10px] text-text-tertiary">{region.currency}</div>
              )}

              {isSelected && (
                <div className="absolute right-2 top-2 rounded-full bg-primary p-1">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

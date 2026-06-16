'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Slider } from '@/components/ui/slider'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { X, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FiltersSidebarProps {
  minPrice?: number
  maxPrice?: number
  className?: string
  /** When true: renders just the filter content card, no desktop wrapper / no mobile FAB */
  inline?: boolean
}

export default function FiltersSidebar({ minPrice = 0, maxPrice = 1000, className, inline = false }: FiltersSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // State for filters
  const [priceRange, setPriceRange] = useState([
    parseFloat(searchParams.get('minPrice') || '0'),
    parseFloat(searchParams.get('maxPrice') || String(maxPrice))
  ])
  const [sellerTiers, setSellerTiers] = useState<string[]>(() => {
    const tiers = searchParams.get('tiers')
    return tiers ? tiers.split(',') : []
  })
  const [deliveryTimes, setDeliveryTimes] = useState<string[]>(() => {
    const times = searchParams.get('delivery')
    return times ? times.split(',') : []
  })
  const [onlineOnly, setOnlineOnly] = useState(searchParams.get('online') === 'true')
  const [showMobile, setShowMobile] = useState(false)

  // Available options
  const tierOptions = [
    { value: 'bronze', label: 'Bronze', color: 'text-orange-400' },
    { value: 'silver', label: 'Silver', color: 'text-text-secondary' },
    { value: 'gold', label: 'Gold', color: 'text-warning' },
    { value: 'platinum', label: 'Platinum', color: 'text-cyan-400' }
  ]

  const deliveryOptions = [
    { value: 'instant', label: 'Instant (< 5 min)' },
    { value: '1-24h', label: '1-24 hours' },
    { value: '1-3 days', label: '1-3 days' },
    { value: '3-7 days', label: '3-7 days' }
  ]

  // Apply filters to URL
  const applyFilters = () => {
    const params = new URLSearchParams(searchParams.toString())

    // Price range
    if (priceRange[0] > 0) {
      params.set('minPrice', String(priceRange[0]))
    } else {
      params.delete('minPrice')
    }

    if (priceRange[1] < maxPrice) {
      params.set('maxPrice', String(priceRange[1]))
    } else {
      params.delete('maxPrice')
    }

    // Seller tiers
    if (sellerTiers.length > 0) {
      params.set('tiers', sellerTiers.join(','))
    } else {
      params.delete('tiers')
    }

    // Delivery times
    if (deliveryTimes.length > 0) {
      params.set('delivery', deliveryTimes.join(','))
    } else {
      params.delete('delivery')
    }

    // Online only
    if (onlineOnly) {
      params.set('online', 'true')
    } else {
      params.delete('online')
    }

    router.push(`${pathname}?${params.toString()}`)
    setShowMobile(false)
  }

  // Clear all filters
  const clearFilters = () => {
    setPriceRange([0, maxPrice])
    setSellerTiers([])
    setDeliveryTimes([])
    setOnlineOnly(false)

    // Clear URL params
    const params = new URLSearchParams(searchParams.toString())
    params.delete('minPrice')
    params.delete('maxPrice')
    params.delete('tiers')
    params.delete('delivery')
    params.delete('online')

    router.push(`${pathname}?${params.toString()}`)
    setShowMobile(false)
  }

  // Check if any filters are active
  const hasActiveFilters =
    priceRange[0] > 0 ||
    priceRange[1] < maxPrice ||
    sellerTiers.length > 0 ||
    deliveryTimes.length > 0 ||
    onlineOnly

  // Toggle seller tier
  const toggleTier = (tier: string) => {
    setSellerTiers(prev =>
      prev.includes(tier)
        ? prev.filter(t => t !== tier)
        : [...prev, tier]
    )
  }

  // Toggle delivery time
  const toggleDeliveryTime = (time: string) => {
    setDeliveryTimes(prev =>
      prev.includes(time)
        ? prev.filter(t => t !== time)
        : [...prev, time]
    )
  }

  // Filters content (reused for desktop and mobile)
  const filtersContent = (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <SlidersHorizontal className="w-5 h-5" />
          Filters
        </h3>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-lime-text hover:text-lime-text transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Price Range */}
      <div>
        <Label className="text-sm font-semibold text-text-primary mb-3 block">
          Price Range
        </Label>
        <div className="space-y-4">
          <Slider
            min={0}
            max={maxPrice}
            step={10}
            value={priceRange}
            onValueChange={setPriceRange}
            className="w-full"
          />
          <div className="flex items-center justify-between text-sm text-text-secondary">
            <span>${priceRange[0]}</span>
            <span>${priceRange[1]}</span>
          </div>
        </div>
      </div>

      {/* Seller Tier */}
      <div>
        <Label className="text-sm font-semibold text-text-primary mb-3 block">
          Seller Tier
        </Label>
        <div className="space-y-3">
          {tierOptions.map((tier) => (
            <div key={tier.value} className="flex items-center space-x-3">
              <Checkbox
                id={`tier-${tier.value}`}
                checked={sellerTiers.includes(tier.value)}
                onCheckedChange={() => toggleTier(tier.value)}
                className="border-border-default"
              />
              <Label
                htmlFor={`tier-${tier.value}`}
                className={cn(
                  'text-sm font-medium cursor-pointer select-none',
                  tier.color
                )}
              >
                {tier.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Delivery Time */}
      <div>
        <Label className="text-sm font-semibold text-text-primary mb-3 block">
          Delivery Time
        </Label>
        <div className="space-y-3">
          {deliveryOptions.map((option) => (
            <div key={option.value} className="flex items-center space-x-3">
              <Checkbox
                id={`delivery-${option.value}`}
                checked={deliveryTimes.includes(option.value)}
                onCheckedChange={() => toggleDeliveryTime(option.value)}
                className="border-border-default"
              />
              <Label
                htmlFor={`delivery-${option.value}`}
                className="text-sm text-text-secondary cursor-pointer select-none"
              >
                {option.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Online Now */}
      <div>
        <div className="flex items-center space-x-3">
          <Checkbox
            id="online-only"
            checked={onlineOnly}
            onCheckedChange={(checked) => setOnlineOnly(checked as boolean)}
            className="border-border-default"
          />
          <Label htmlFor="online-only" className="text-sm font-medium text-success cursor-pointer select-none">
            🟢 Online Now
          </Label>
        </div>
        <p className="text-xs text-text-tertiary mt-1 ml-6">
          Show only sellers currently online
        </p>
      </div>

      {/* Apply Button */}
      <button
        onClick={applyFilters}
        className="w-full px-4 py-3 bg-lime hover:bg-lime-hover-hover text-text-primary font-semibold rounded-lg transition-colors"
      >
        Apply Filters
      </button>
    </div>
  )

  // ── Inline / controlled mode (used by CategoryPageLayout) ───────────────
  if (inline) {
    return (
      <div className={cn('bg-bg-overlay border border-border-subtle rounded-xl p-5 backdrop-blur-xl overflow-y-auto', className)}>
        {filtersContent}
      </div>
    )
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <div className={cn('hidden lg:block', className)}>
        <div className="sticky top-24 bg-bg-overlay border border-white/[0.1] rounded-xl p-6 backdrop-blur-xl">
          {filtersContent}
        </div>
      </div>

      {/* Mobile Toggle Button */}
      <button
        onClick={() => setShowMobile(true)}
        className="lg:hidden fixed bottom-6 right-6 z-40 px-6 py-3 bg-lime hover:bg-lime-hover-hover text-text-primary font-semibold rounded-full shadow-lg flex items-center gap-2 transition-all"
      >
        <SlidersHorizontal className="w-5 h-5" />
        Filters
        {hasActiveFilters && (
          <span className="ml-1 w-2 h-2 bg-red-500 rounded-full" />
        )}
      </button>

      {/* Mobile Drawer */}
      {showMobile && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            onClick={() => setShowMobile(false)}
          />

          {/* Drawer */}
          <div className="lg:hidden fixed inset-y-0 right-0 w-full max-w-sm bg-gray-900 border-l border-white/[0.1] z-50 overflow-y-auto">
            <div className="p-6">
              {/* Close Button */}
              <button
                onClick={() => setShowMobile(false)}
                className="absolute top-4 right-4 p-2 text-text-secondary hover:text-text-primary transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              {filtersContent}
            </div>
          </div>
        </>
      )}
    </>
  )
}

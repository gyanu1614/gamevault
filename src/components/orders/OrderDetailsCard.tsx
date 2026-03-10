'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'
import { Eye } from 'lucide-react'

interface OrderDetailsCardProps {
  order: any
  role: 'buyer' | 'seller'
  onClick?: () => void
}

function Row({ label, value, valueClass }: { label: string; value: React.ReactNode; valueClass?: string }) {
  if (!value) return null
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/[0.04] last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={cn('text-xs text-gray-200 font-medium text-right max-w-[60%] truncate', valueClass)}>
        {value}
      </span>
    </div>
  )
}

export default function OrderDetailsCard({ order, role, onClick }: OrderDetailsCardProps) {
  const listing = order.listing
  const game    = listing?.game
  const category = listing?.category
  const attrs   = listing?.item_attributes as Record<string, string> | null

  // Build rows from item_attributes (e.g. rarity, level, brainrot count, etc.)
  const attrRows = attrs
    ? Object.entries(attrs).map(([k, v]) => ({
        label: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        value: String(v),
      }))
    : []

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-white/[0.05] flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          {game?.image_url && (
            <Image
              src={game.image_url}
              alt={game.name || 'Game'}
              width={20}
              height={20}
              className="rounded-md object-cover flex-shrink-0"
            />
          )}
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500">Order Details</span>
        </div>
        {onClick && (
          <button
            onClick={onClick}
            className="flex items-center gap-1.5 text-[10px] text-violet-400 font-medium rounded-lg px-2 py-1.5 transition-colors hover:bg-violet-500/10"
          >
            <Eye className="h-3 w-3" />
            <span>View Full Details</span>
          </button>
        )}
      </div>

      {/* Rows */}
      <div className="px-5">
        {game?.name && (
          <Row
            label="Game"
            value={
              <span className="flex items-center gap-2 justify-end">
                {game.image_url && (
                  <Image src={game.image_url} alt={game.name} width={16} height={16} className="rounded object-cover" />
                )}
                {game.name}
              </span>
            }
          />
        )}

        {category?.name && <Row label="Item Type" value={category.name} />}
        {listing?.platform && <Row label="Platform" value={listing.platform} />}
        {listing?.region && <Row label="Region" value={listing.region} />}

        {/* Dynamic item attributes (rarity, level, brainrot count, etc.) */}
        {attrRows.map(({ label, value }) => (
          <Row key={label} label={label} value={value} />
        ))}

        {/* Buyer / Seller info based on role */}
        {role === 'seller' ? (
          <Row
            label="Buyer"
            value={`@${order.buyer?.username}`}
            valueClass="text-violet-400"
          />
        ) : (
          <Row
            label="Seller"
            value={order.seller?.shop_name || `@${order.seller?.username}`}
            valueClass="text-violet-400"
          />
        )}

        {listing?.delivery_method && (
          <Row
            label="Delivery"
            value={listing.delivery_method === 'instant' ? 'Instant' : listing.delivery_time || 'Manual'}
          />
        )}
      </div>
    </div>
  )
}

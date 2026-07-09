'use client'

import { X, ExternalLink, Package, Clock, Shield, Star } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { getAvatarUrl } from '@/lib/utils/avatar'

interface ItemDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  order: any
}

export default function ItemDetailsModal({ isOpen, onClose, order }: ItemDetailsModalProps) {
  const listing = order.listing
  const game = listing?.game
  const category = listing?.category
  const seller = order.seller
  const attrs = listing?.item_attributes as Record<string, string> | null

  // Build attribute rows
  const attrRows = attrs
    ? Object.entries(attrs).map(([k, v]) => ({
        label: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        value: String(v),
      }))
    : []

  // Handle escape key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
          />

          {/* Modal Container - centers to viewport */}
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="min-h-screen flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={handleKeyDown}
                className="relative w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl border border-border-subtle bg-[#0d0d14] shadow-2xl my-8"
              >
                {/* Header */}
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border-subtle bg-[#0d0d14]/95 backdrop-blur-xl px-6 py-4">
                  <div className="flex items-center gap-3">
                    {game?.image_url && (
                      <Image
                        src={game.image_url}
                        alt={game.name || 'Game'}
                        width={32}
                        height={32}
                        className="rounded-lg object-cover ring-1 ring-white/10"
                      />
                    )}
                    <div>
                      <h2 className="text-lg font-bold text-white">Item Details</h2>
                      <p className="text-xs text-text-tertiary">Order #{order.order_number || order.id.slice(0, 8).toUpperCase()}</p>
                    </div>
                  </div>

                  {/* Close button */}
                  <button
                    onClick={onClose}
                    className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-bg-overlay hover:text-white"
                    aria-label="Close modal"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(85vh - 80px)' }}>
                  <div className="space-y-6">
                    {/* Item Image */}
                    {listing?.image_url ? (
                      <div className="relative w-full h-64 overflow-hidden rounded-xl border border-border-subtle bg-bg-overlay">
                        <Image
                          src={listing.image_url}
                          alt={listing.title || 'Item'}
                          fill
                          className="object-contain"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="w-full h-64 rounded-xl border border-border-subtle bg-bg-overlay flex items-center justify-center">
                        <Package className="h-16 w-16 text-text-disabled" />
                      </div>
                    )}

                    {/* Details */}
                    <div className="space-y-6">
                      {/* Title */}
                      <div>
                        <h3 className="text-xl font-bold text-white mb-2">{listing?.title || 'Unknown Item'}</h3>
                        <div className="flex items-center gap-2 text-sm text-text-secondary">
                          {game?.image_url && (
                            <Image src={game.image_url} alt={game.name} width={16} height={16} className="rounded object-cover" />
                          )}
                          <span>{game?.name || 'Unknown Game'}</span>
                          {category?.name && (
                            <>
                              <span className="text-gray-700">•</span>
                              <span>{category.name}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Delivery & Protection Info */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg border border-border-subtle bg-bg-overlay p-3">
                          <div className="flex items-center gap-2 text-xs text-text-tertiary mb-1">
                            <Clock className="h-3.5 w-3.5" />
                            <span>Delivery</span>
                          </div>
                          <p className="text-sm font-semibold text-white">
                            {listing?.delivery_method === 'instant' ? 'Instant' : listing?.delivery_time || 'Manual'}
                          </p>
                        </div>

                        <div className="rounded-lg border border-lime-tint-border bg-lime/5 p-3">
                          <div className="flex items-center gap-2 text-xs text-lime-text mb-1">
                            <Shield className="h-3.5 w-3.5" />
                            <span>Protection</span>
                          </div>
                          <p className="text-sm font-semibold text-white capitalize">
                            {order.vaultshield_tier || 'Standard'}
                          </p>
                        </div>
                      </div>

                      {/* SafeDrop Explanation */}
                      {order.vaultshield_tier && (
                        <div className="rounded-lg border border-lime-tint-border bg-gradient-to-br from-lime/10 to-transparent p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-lime/20 flex items-center justify-center">
                              <Shield className="h-4 w-4 text-lime-text" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-semibold text-white mb-1">
                                SafeDrop {(order.vaultshield_tier || 'Standard').charAt(0).toUpperCase() + (order.vaultshield_tier || 'Standard').slice(1)} Protection
                              </h4>
                              <p className="text-xs text-text-secondary leading-relaxed">
                                {order.vaultshield_tier === 'premium'
                                  ? 'Full protection for 30 days. File claims for incorrect items, missing content, or account issues. Your purchase is fully protected.'
                                  : order.vaultshield_tier === 'enhanced'
                                  ? 'Enhanced protection for 7 days. File claims for incorrect items or missing content. Extended dispute resolution window.'
                                  : 'Standard 48-hour protection. File claims for incorrect items or missing content. Basic buyer protection included.'}
                              </p>
                              {order.warranty_expires_at && (
                                <p className="text-xs text-lime-text mt-2">
                                  Protection expires: {new Date(order.warranty_expires_at).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  })}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Attributes */}
                      {attrRows.length > 0 && (
                        <div>
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-3">Attributes</h4>
                          <div className="space-y-2">
                            {attrRows.map(({ label, value }) => (
                              <div key={label} className="flex items-center justify-between py-2 border-b border-border-subtle last:border-0">
                                <span className="text-sm text-text-tertiary">{label}</span>
                                <span className="text-sm text-white font-medium">{value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Platform & Region */}
                      {(listing?.platform || listing?.region) && (
                        <div>
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-3">Platform Details</h4>
                          <div className="space-y-2">
                            {listing.platform && (
                              <div className="flex items-center justify-between py-2 border-b border-border-subtle">
                                <span className="text-sm text-text-tertiary">Platform</span>
                                <span className="text-sm text-white font-medium">{listing.platform}</span>
                              </div>
                            )}
                            {listing.region && (
                              <div className="flex items-center justify-between py-2">
                                <span className="text-sm text-text-tertiary">Region</span>
                                <span className="text-sm text-white font-medium">{listing.region}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Description */}
                      {listing?.description && (
                        <div>
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-3">Description</h4>
                          <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{listing.description}</p>
                        </div>
                      )}

                      {/* Seller Info */}
                      <div className="rounded-xl border border-border-subtle bg-bg-overlay p-4">
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-3">Sold By</h4>
                        <div className="flex items-center gap-3">
                          <div className="relative h-12 w-12 flex-shrink-0">
                            <Image
                              src={getAvatarUrl(seller?.avatar_url, seller?.username)}
                              alt={seller?.username || 'Seller'}
                              fill
                              className="rounded-full object-cover ring-2 ring-white/10"
                              unoptimized
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">
                              {seller?.shop_name || seller?.username || 'Unknown Seller'}
                            </p>
                            <p className="text-xs text-text-tertiary">@{seller?.username || 'unknown'}</p>
                          </div>
                          <Link
                            href={`/shop/${seller?.shop_slug || seller?.username}`}
                            target="_blank"
                            className="flex items-center gap-1.5 rounded-lg border border-lime-tint-border bg-lime/10 px-3 py-2 text-xs font-medium text-lime-text transition-colors hover:border-lime hover:bg-lime/20"
                          >
                            <span>Visit Store</span>
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </div>

                        {/* Seller rating (if available) */}
                        {seller?.average_rating != null && (
                          <div className="mt-3 pt-3 border-t border-border-subtle flex items-center gap-2">
                            <Star className="h-4 w-4 fill-yellow-400 text-warning" />
                            <span className="text-sm font-semibold text-white">{seller.average_rating.toFixed(1)}</span>
                            <span className="text-xs text-text-tertiary">
                              ({seller.total_reviews || 0} review{seller.total_reviews !== 1 ? 's' : ''})
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Price */}
                      <div className="rounded-xl border border-lime-tint-border bg-gradient-to-br from-lime/10 to-transparent p-4">
                        <div className="flex items-baseline justify-between">
                          <span className="text-sm text-text-secondary">Total Paid</span>
                          <div className="text-right">
                            <p className="text-xl font-bold text-white">${order.total_amount?.toFixed(2) || '0.00'}</p>
                            <p className="text-xs text-text-tertiary">
                              Order Price: ${order.subtotal?.toFixed(2) || '0.00'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

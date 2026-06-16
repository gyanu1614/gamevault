'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MessageCircle, AlertCircle } from 'lucide-react'
import { ContactSellerModal } from './contact-seller-modal'
import { useAuth } from '@/hooks/use-auth'

interface ListingActionButtonsProps {
  listingId: string
  listingTitle: string
  sellerId: string
  sellerUsername: string
  price: number
  image: string
  gameSlug: string
  categorySlug: string
  listingSlug: string
  quantity: number
  isUnlimited: boolean
}

export function ListingActionButtons({
  listingId,
  listingTitle,
  sellerId,
  sellerUsername,
  price,
  image,
  gameSlug,
  categorySlug,
  listingSlug,
  quantity,
  isUnlimited,
}: ListingActionButtonsProps) {
  const { user } = useAuth()
  const router = useRouter()
  const [isModalOpen, setIsModalOpen] = useState(false)

  const isOwnListing = user?.id === sellerId

  const handleBuyNow = () => {
    // Direct checkout without cart
    router.push(`/checkout/${listingId}`)
  }

  return (
    <>
      {isOwnListing ? (
        <>
          {/* Warning message for own listing */}
          <div className="flex items-start gap-2 text-sm text-amber-400 bg-amber-500/10 rounded-lg p-3 border border-amber-500/20 mb-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p>You cannot purchase your own listing</p>
          </div>

          {/* Edit listing — owner's listing */}
          <Link href={`/seller/listings/${listingId}/edit`}>
            <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border-default bg-bg-raised px-5 py-3 text-sm font-medium text-text-primary transition-colors hover:bg-bg-raised-hover hover:border-lime-tint-border">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit listing
            </button>
          </Link>
        </>
      ) : (
        <>
          {/* Buy Now — full-width primary. Wishlist is pulled OUT of the
              row and rendered as a small ghost action below the CTA pair,
              so Buy Now and Contact Seller match in width. */}
          <button
            onClick={handleBuyNow}
            className="group relative mb-2 flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-lime text-sm font-bold uppercase tracking-wider text-text-inverse shadow-[0_1px_0_0_rgba(255,255,255,0.4)_inset,0_-1px_0_0_rgba(0,0,0,0.15)_inset,0_4px_12px_-2px_rgba(198,255,61,0.35)] transition-all hover:bg-lime-hover hover:shadow-[0_1px_0_0_rgba(255,255,255,0.4)_inset,0_-1px_0_0_rgba(0,0,0,0.15)_inset,0_6px_20px_-4px_rgba(198,255,61,0.5)] active:translate-y-px"
          >
            <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent opacity-50" />
            Buy Now — ${price.toFixed(2)}
          </button>

          {/* Contact Seller — secondary */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="mb-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border-default bg-bg-raised text-sm font-medium text-text-primary transition-colors hover:border-lime-tint-border hover:bg-bg-raised-hover"
          >
            <MessageCircle className="h-4 w-4" />
            Contact seller
          </button>

          <ContactSellerModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            sellerId={sellerId}
            sellerUsername={sellerUsername}
            listingTitle={listingTitle}
            listingId={listingId}
          />
        </>
      )}
    </>
  )
}

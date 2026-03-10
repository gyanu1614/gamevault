'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MessageCircle, AlertCircle } from 'lucide-react'
import { ContactSellerModal } from './contact-seller-modal'
import { useAuth } from '@/hooks/use-auth'
import WishlistButton from '@/components/wishlist/WishlistButton'

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

          {/* Edit listing button - vibrant color */}
          <Link href={`/seller/listings/${listingId}/edit`}>
            <button className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-medium text-black transition-all hover:bg-white/90 active:scale-95">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Listing
            </button>
          </Link>
        </>
      ) : (
        <>
          {/* Button Group: Buy Now + Wishlist */}
          <div className="flex gap-2 mb-2">
            {/* Buy Now Button - Full width */}
            <button
              onClick={handleBuyNow}
              className="flex-1 py-3 bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Buy Now - ${price.toFixed(2)}
            </button>

            {/* Wishlist Button */}
            <div className="flex items-center">
              <WishlistButton listingId={listingId} variant="default" />
            </div>
          </div>

          {/* Contact Seller for other users */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full py-3 bg-white/[0.05] hover:bg-white/[0.08] text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            Contact Seller
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

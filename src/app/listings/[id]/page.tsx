'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import Link from 'next/link'
import { Star, Eye, ShoppingCart, Shield, Zap, ArrowLeft, Plus, Minus } from 'lucide-react'
import { getListing } from '@/lib/api/listings'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert } from '@/components/ui/alert'

export default function ListingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [quantity, setQuantity] = useState(1)

  const { data, isLoading, error } = useQuery({
    queryKey: ['listing', params.id],
    queryFn: () => getListing(params.id as string),
  })

  const listing = data?.data

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[95vw] px-4 py-8 sm:max-w-[90vw] md:max-w-5xl lg:max-w-6xl xl:max-w-7xl">
        {/* Back button placeholder */}
        <div className="h-8 w-32 skeleton rounded-lg mb-6" />
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Image skeleton */}
          <div className="aspect-square skeleton rounded-2xl" />
          {/* Details skeleton */}
          <div className="space-y-4">
            <div className="h-7 w-3/4 skeleton rounded-lg" />
            <div className="h-5 w-1/2 skeleton rounded-lg" />
            <div className="h-32 skeleton rounded-xl" />
            <div className="h-12 w-40 skeleton rounded-xl" />
            <div className="space-y-2 pt-4">
              <div className="h-4 w-full skeleton rounded" />
              <div className="h-4 w-5/6 skeleton rounded" />
              <div className="h-4 w-4/6 skeleton rounded" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !listing) {
    return (
      <div className="mx-auto w-full max-w-[95vw] px-4 py-8 sm:max-w-[90vw] md:max-w-2xl">
        <div>
          <Alert variant="destructive">
            <strong>Listing not found</strong>
            <p className="mt-1 text-sm">
              This listing may have been removed or is no longer available.
            </p>
          </Alert>
          <div className="mt-4">
            <Link href="/browse">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Browse
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const primaryImage = listing.images?.[0] || '/placeholder-listing.png'
  const isOwnListing = user?.id === listing.seller_id
  const maxQuantity = listing.is_unlimited ? 10 : listing.quantity

  const handleAddToCart = () => {
    // TODO: Implement cart functionality
    console.log('Add to cart:', { listingId: listing.id, quantity })
  }

  return (
    <div className="mx-auto w-full max-w-[95vw] px-4 py-8 sm:max-w-[90vw] md:max-w-5xl lg:max-w-6xl xl:max-w-7xl">
      <div>
        {/* Back Button */}
        <Link
          href="/browse"
          className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to listings
        </Link>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Images */}
          <div>
            <div className="overflow-hidden rounded-lg border">
              <img
                src={primaryImage}
                alt={listing.title}
                className="aspect-square w-full object-cover"
              />
            </div>

            {/* Thumbnail Gallery */}
            {listing.images && listing.images.length > 1 && (
              <div className="mt-4 grid grid-cols-4 gap-2">
                {listing.images.map((image, index) => (
                  <button
                    key={index}
                    className="overflow-hidden rounded border hover:border-primary"
                  >
                    <img
                      src={image}
                      alt={`${listing.title} ${index + 1}`}
                      className="aspect-square w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div>
            {/* Game & Category */}
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="secondary">
                {listing.game.emoji} {listing.game.name}
              </Badge>
              <Badge variant="outline">{listing.category.name}</Badge>
            </div>

            {/* Title */}
            <h1 className="mb-4 text-3xl font-bold">{listing.title}</h1>

            {/* Stats */}
            <div className="mb-4 flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                {listing.views} views
              </div>
              <div className="flex items-center gap-1">
                <ShoppingCart className="h-4 w-4" />
                {listing.sales} sold
              </div>
            </div>

            {/* Price */}
            <div className="mb-6">
              <div className="text-4xl font-bold">${listing.price.toFixed(2)}</div>
              <div className="text-sm text-muted-foreground">
                Delivery: {listing.delivery_time}
              </div>
            </div>

            {/* Stock Status */}
            {listing.is_unlimited ? (
              <Badge className="mb-4 bg-green-500">Unlimited Stock Available</Badge>
            ) : listing.quantity > 0 ? (
              <Badge className="mb-4 bg-orange-500">
                Only {listing.quantity} left in stock
              </Badge>
            ) : (
              <Badge className="mb-4 bg-red-500">Out of Stock</Badge>
            )}

            {/* Quantity Selector & Add to Cart */}
            {!isOwnListing && listing.quantity > 0 && (
              <div className="mb-6 space-y-4">
                <div className="flex items-center gap-4">
                  <label className="text-sm font-medium">Quantity:</label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-12 text-center font-medium">{quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantity(Math.min(maxQuantity, quantity + 1))}
                      disabled={quantity >= maxQuantity}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <Button size="lg" className="w-full" onClick={handleAddToCart}>
                  <ShoppingCart className="mr-2 h-5 w-5" />
                  Add to Cart - ${(listing.price * quantity).toFixed(2)}
                </Button>
              </div>
            )}

            {isOwnListing && (
              <Alert className="mb-6">
                This is your listing. You cannot purchase your own items.
              </Alert>
            )}

            {/* Features */}
            <div className="mb-6 space-y-3 rounded-lg border bg-muted/50 p-4">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-medium">30-Day Protection</div>
                  <div className="text-sm text-muted-foreground">
                    Full refund if item not as described
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-medium">Fast Delivery</div>
                  <div className="text-sm text-muted-foreground">
                    {listing.delivery_time}
                  </div>
                </div>
              </div>
            </div>

            <Separator className="my-6" />

            {/* Seller Info */}
            <div>
              <h3 className="mb-3 font-semibold">Seller Information</h3>
              <Link
                href={`/sellers/${listing.seller.id}`}
                className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:border-primary"
              >
                {listing.seller.avatar_url ? (
                  <img
                    src={listing.seller.avatar_url}
                    alt={listing.seller.username}
                    className="h-12 w-12 rounded-full"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold">
                    {listing.seller.username[0].toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <div className="font-medium">{listing.seller.username}</div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="secondary" className="text-xs">
                      {listing.seller.seller_tier}
                    </Badge>
                    {listing.seller.seller_rating > 0 && (
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span>{listing.seller.seller_rating.toFixed(1)}</span>
                        <span>({listing.seller.total_reviews} reviews)</span>
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {listing.seller.total_sales} total sales
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="mt-8">
          <h2 className="mb-4 text-2xl font-bold">Description</h2>
          <div className="rounded-lg border bg-card p-6">
            <p className="whitespace-pre-wrap text-muted-foreground">
              {listing.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

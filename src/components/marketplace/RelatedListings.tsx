/**
 * RelatedListings — Server Component
 *
 * Shows up to 4 active listings from the same game + category,
 * excluding the current listing. Rendered on the listing detail page.
 */

import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { TrendingDown, Zap, Clock } from 'lucide-react'

interface RelatedListingsProps {
  gameId: string
  categoryId: string
  currentListingId: string
  gameSlug: string
  categorySlug: string
}

export default async function RelatedListings({
  gameId,
  categoryId,
  currentListingId,
  gameSlug,
  categorySlug,
}: RelatedListingsProps) {
  const supabase = await createClient()

  const { data: listingsRaw } = await supabase
    .from('listings')
    .select(`
      id, slug, title, price, original_price, images, delivery_time,
      quantity, is_unlimited, sales,
      seller:profiles!listings_seller_id_fkey(username, avatar_url, seller_rating)
    `)
    .eq('game_id', gameId)
    .eq('category_id', categoryId)
    .eq('status', 'active')
    .neq('id', currentListingId)
    .order('sales', { ascending: false })
    .limit(4)

  const listings = listingsRaw as any[] | null

  if (!listings || listings.length === 0) return null

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <span className="w-1 h-5 rounded-full bg-violet-500 inline-block" />
        More like this
      </h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {listings.map((listing) => {
          const seller = listing.seller as any
          const image = listing.images?.[0] ?? null
          const isInstant = listing.delivery_time?.toLowerCase().includes('instant')
          const hasPriceDrop =
            listing.original_price != null && listing.original_price > listing.price
          const discountPct = hasPriceDrop
            ? Math.round(
                ((listing.original_price! - listing.price) / listing.original_price!) * 100
              )
            : 0

          return (
            <Link
              key={listing.id}
              href={`/${gameSlug}/${categorySlug}/${listing.slug}`}
              className="group relative flex flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] transition-all duration-300 hover:border-violet-500/40 hover:bg-white/[0.06] hover:shadow-[0_0_24px_-4px_rgba(139,92,246,0.3)]"
            >
              {/* Image */}
              <div className="relative aspect-[4/3] overflow-hidden bg-white/[0.03]">
                {image ? (
                  <Image
                    src={image}
                    alt={listing.title}
                    fill
                    sizes="(max-width: 640px) 50vw, 25vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-4xl">🎮</div>
                )}

                {/* Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                {/* Delivery badge — top right */}
                <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 backdrop-blur-md border border-white/10">
                  {isInstant ? (
                    <Zap className="w-2.5 h-2.5 text-violet-400" />
                  ) : (
                    <Clock className="w-2.5 h-2.5 text-white/50" />
                  )}
                  <span className="text-[9px] text-white/70 leading-none">
                    {listing.delivery_time ?? 'TBD'}
                  </span>
                </div>

                {/* Price — bottom left */}
                <div className="absolute bottom-2 left-2 flex flex-col items-start gap-0.5">
                  {hasPriceDrop && (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-white/50 line-through leading-none">
                        ${listing.original_price!.toFixed(2)}
                      </span>
                      <span className="flex items-center gap-0.5 rounded bg-green-500/90 px-1 py-0.5 text-[9px] font-bold text-white leading-none">
                        <TrendingDown className="h-2 w-2" />
                        -{discountPct}%
                      </span>
                    </div>
                  )}
                  <span className="font-mono text-base font-bold text-white drop-shadow-md">
                    ${listing.price.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Body */}
              <div className="flex flex-col gap-2 p-3">
                <h3 className="line-clamp-2 text-xs font-semibold text-white/90 leading-snug group-hover:text-violet-300 transition-colors">
                  {listing.title}
                </h3>

                <div className="mt-auto flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {seller?.avatar_url ? (
                      <img
                        src={seller.avatar_url}
                        alt={seller.username ?? ''}
                        className="h-4 w-4 rounded-full object-cover ring-1 ring-white/10 flex-shrink-0"
                      />
                    ) : (
                      <div className="h-4 w-4 rounded-full bg-violet-500/20 flex items-center justify-center text-[8px] font-bold text-violet-400 flex-shrink-0">
                        {(seller?.username ?? '?')[0].toUpperCase()}
                      </div>
                    )}
                    <span className="truncate text-[10px] text-white/40">
                      {seller?.username}
                    </span>
                  </div>
                  <span className="text-[10px] text-white/30 shrink-0">
                    {listing.sales} sold
                  </span>
                </div>
              </div>

              {/* Hover ring */}
              <div className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 ring-1 ring-violet-500/30" />
            </Link>
          )
        })}
      </div>
    </section>
  )
}

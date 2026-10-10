/**
 * /listing-preview/[id] — the seller's (or an admin's) view of a listing that
 * is NOT live: pending review, changes requested, rejected, paused, sold.
 *
 * The public listing page is ISR and serves active listings only, so it can
 * no longer show these (see its header). This route is per request on
 * purpose: it reads through the session client, where RLS lets only the
 * listing's seller and admins see a non-active row; everyone else gets a 404.
 * It renders the same body as the public page with the preview banner and
 * buying disabled. Never indexed; an active listing redirects to its page.
 */
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { Suspense, cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { isUuid } from '@/lib/ids'
import { listingUrl } from '@/lib/listings/url'
import { GameHeroBackdrop } from '@/components/marketplace/GameHeroBackdrop'
import ListingDetailSkeleton from '@/app/(marketplace)/[gameSlug]/[categorySlug]/[listingSlug]/_ListingDetailSkeleton'
import {
  LISTING_DETAIL_SELECT,
  ListingDetailBody,
} from '@/app/(marketplace)/[gameSlug]/[categorySlug]/[listingSlug]/_ListingDetailBody'

interface PageProps {
  params: Promise<{ id: string }>
}

const getPreviewListing = cache(async function getPreviewListing(id: string) {
  if (!isUuid(id)) return null
  const supabase = await createClient()
  const { data } = (await supabase
    .from('listings')
    .select(LISTING_DETAIL_SELECT)
    .eq('id', id)
    .maybeSingle()) as { data: any }
  return data?.game?.slug && data?.category?.slug ? data : null
})

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const listing = await getPreviewListing(id)
  return {
    title: listing ? `Preview: ${listing.title}` : 'Listing Not Found',
    robots: { index: false, follow: false },
  }
}

export default async function ListingPreviewPage({ params }: PageProps) {
  const { id } = await params
  const listing = await getPreviewListing(id)
  if (!listing) notFound()
  if (listing.status === 'active') redirect(listingUrl(listing))

  return (
    <div className="relative isolate min-h-screen">
      <GameHeroBackdrop gameSlug={listing.game.slug} size="market">
        <Suspense fallback={<ListingDetailSkeleton />}>
          <ListingDetailBody
            listing={listing}
            isPreview
            gameSlug={listing.game.slug}
            categorySlug={listing.category.slug}
          />
        </Suspense>
      </GameHeroBackdrop>
    </div>
  )
}

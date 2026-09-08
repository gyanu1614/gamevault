import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { CheckoutForm } from './CheckoutForm'
import { PURCHASES_ENABLED } from '@/lib/config/purchases'
import BuyingOpensSoon from './_BuyingOpensSoon'

interface CheckoutPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ qty?: string }>
}

export default async function CheckoutPage({ params, searchParams }: CheckoutPageProps) {
  const { id } = await params
  // V14j — Read qty hint from URL so deep-linked Buy now (e.g. from the
  // currency page) pre-fills the buyer's chosen quantity. Falls back to
  // the listing's min_quantity inside CheckoutForm if absent or invalid.
  const { qty } = await searchParams
  const parsedQty = qty ? Math.max(1, parseInt(qty, 10) || 0) : undefined
  const supabase = await createClient()

  const { data: listing, error } = await supabase
    .from('listings')
    .select(`
      *,
      seller:seller_id (
        id, username, shop_name, avatar_url, seller_tier,
        seller_rating, total_reviews, total_sales, is_verified, created_at
      ),
      game:game_id ( id, name, slug, image_url ),
      category:category_id ( id, name, slug, metadata )
    `)
    .eq('id', id)
    .single() as any

  if (error || !listing) redirect('/browse')
  if (listing.status !== 'active') {
    redirect(`/${listing.game.slug}/${listing.category.slug}/${listing.slug}`)
  }

  const { data: { user } } = await supabase.auth.getUser()

  // Buyer country from Vercel's geo header (absent on localhost → the
  // selector shows every local method). Drives the region filter only —
  // never blocks a method.
  const buyerCountry = (await headers()).get('x-vercel-ip-country')

  // V73 — Buyer profile for the checkout identity strip (username +
  // avatar; the auth user alone has only the email).
  let buyerProfile: { username: string | null; avatar_url: string | null } | null = null
  if (user) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', user.id)
      .maybeSingle() as any
    buyerProfile = prof ?? null
  }

  // V19/P24/P7.l — Bundle currency: pull the matching bundle row out
  // of the game's currency category_config so the checkout summary
  // can show the bundle's name + icon instead of the auto-generated
  // listing title. Falls back gracefully if anything is missing.
  let bundleSummary: {
    name: string
    iconUrl: string | null
  } | null = null
  if (listing.bundle_id) {
    const { data: configRow } = await supabase
      .from('category_configs')
      .select('config')
      .eq('game_id', listing.game.id)
      .eq('category_type', 'currency')
      .maybeSingle() as any
    const bundles = configRow?.config?.bundles as
      | Array<{ id: string; name: string; icon_url?: string | null }>
      | undefined
    const match = bundles?.find((b) => b.id === listing.bundle_id)
    if (match) {
      bundleSummary = {
        name: match.name,
        iconUrl: match.icon_url ?? null,
      }
    }
  }

  // V75 — Last 5 reviews for the seller peek dialog (no profile
  // navigation from checkout — the reviews come to the buyer).
  let sellerReviews: any[] = []
  if (listing.seller?.id) {
    const { data: revs } = await supabase
      .from('reviews')
      .select('id, rating, comment, created_at, buyer:profiles!reviews_reviewer_id_fkey (username, avatar_url)')
      .eq('seller_id', listing.seller.id)
      .order('created_at', { ascending: false })
      .limit(5) as any
    sellerReviews = revs ?? []
  }

  // V14m — Block self-purchase. Sellers can't buy their own listings,
  // and the order/refund flow would loop on the same account. Bounce back
  // to the edit page for currency / listing page otherwise.
  if (user && listing.seller?.id === user.id) {
    redirect(`/sell/edit/${listing.id}`)
  }

  // Buying gate: while purchases are off, the whole checkout (incl. direct
  // URLs) renders the coming-soon panel + notify-me capture. Server actions
  // are independently gated, so this is presentation — the hard block is in
  // createCheckout.
  if (!PURCHASES_ENABLED) {
    const backHref =
      listing.game?.slug && listing.category?.slug && listing.slug
        ? `/${listing.game.slug}/${listing.category.slug}/${listing.slug}`
        : '/'
    return (
      <main className="w-full">
        <BuyingOpensSoon
          listingId={listing.id}
          listingTitle={listing.title}
          price={Number(listing.price) || 0}
          currency={listing.currency || 'USD'}
          gameName={listing.game?.name ?? null}
          gameSlug={listing.game?.slug ?? null}
          backHref={backHref}
        />
      </main>
    )
  }

  return (
    // V19/P24/P7.bb — Full-bleed checkout: no max-width container, no
    // Back chip. The CheckoutForm's two halves now extend edge-to-edge
    // of the viewport. Browser back handles return navigation.
    <main className="w-full">
      <CheckoutForm
        listing={listing}
        user={user}
        buyerProfile={buyerProfile}
        sellerReviews={sellerReviews}
        initialQty={parsedQty}
        bundleSummary={bundleSummary}
        buyerCountry={buyerCountry}
      />
    </main>
  )
}

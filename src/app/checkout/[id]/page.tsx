import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { isUuid } from '@/lib/ids'
import { HeroBackdrop, HeroBackdropPreload } from '@/components/hero-backdrop'
import { CheckoutForm } from './CheckoutForm'
import { getSiteRating } from '@/lib/reviews/site-rating'
import { PURCHASES_ENABLED } from '@/lib/config/purchases'
import BuyingOpensSoon from './_BuyingOpensSoon'
import { eligibleMethods, toClientMethods } from '@/lib/payments/eligibility'
import { round2 } from '@/lib/fees'
import { clampCheckoutQty } from './qty'
import { findDeliveryMethod } from '@/lib/currency/delivery-methods'
import { PAID_LIFECYCLE } from '@/lib/payments/return-destination'
import { loadPaidOrderSummary } from '../_components/paid-order'
import { isSellerOnline } from '@/lib/presence/online'

interface CheckoutPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ qty?: string; country?: string; order?: string }>
}

export default async function CheckoutPage({ params, searchParams }: CheckoutPageProps) {
  const { id } = await params
  // V14j — Read qty hint from URL so deep-linked Buy now (e.g. from the
  // currency page) pre-fills the buyer's chosen quantity. Falls back to
  // the listing's min_quantity inside CheckoutForm if absent or invalid.
  const { qty, country: countryOverride, order: priorOrderId } = await searchParams
  const parsedQty = qty ? Math.max(1, parseInt(qty, 10) || 0) : undefined
  // ROUTE-009 — a malformed id is a guaranteed miss, so short-circuit before
  // the query rather than relying on Postgres rejecting the cast. Mirrors this
  // route's existing miss behaviour (redirect to /browse) so a malformed id
  // and an absent one stay indistinguishable to the visitor.
  if (!isUuid(id)) redirect('/browse')

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
      category:game_categories!listings_game_category_id_fkey ( id, name, slug, type )
    `)
    .eq('id', id)
    .single() as any

  if (error || !listing) redirect('/browse')

  const { data: { user } } = await supabase.auth.getUser()

  // Same-tab pay (owner 2026-10-16): leaving for the provider page stamps
  // ?order=<id> on this URL, so Back lands here knowing which order it was.
  // Paid (or Payssion says paid while the webhook is in flight) → the one
  // Order Paid page, never a fresh Pay button (no accidental second purchase,
  // no back-trap; owner 2026-10-19: same design everywhere). Still unpaid →
  // the form, with a "not finished" note; Pay again reuses or replaces that
  // order server-side. Checked before the sold-out redirect: the buyer may
  // have bought the last one.
  let unfinishedPayment = false
  if (user && priorOrderId && isUuid(priorOrderId)) {
    const prior = await loadPaidOrderSummary(supabase, priorOrderId, user.id)
    if (prior && prior.listingId === listing.id) {
      let paid = PAID_LIFECYCLE.has(prior.status)
      if (!paid && prior.status === 'pending') {
        const { openAttemptForOrder } = await import('@/lib/payments/attempts')
        const { paidAtProvider } = await import('@/lib/payments/provider-paid-probe')
        paid = await paidAtProvider(await openAttemptForOrder(prior.id), prior.id)
        unfinishedPayment = !paid
      }
      if (paid) redirect(`/checkout/paid/${prior.id}`)
    }
  }

  if (listing.status !== 'active') {
    redirect(`/${listing.game.slug}/${listing.category.slug}/${listing.slug}`)
  }

  // Buyer country from Vercel's geo header (absent on localhost → the
  // selector shows every local method). Drives the region filter only —
  // never blocks a method. ?country=XX overrides the header so the filter
  // is testable on localhost and debuggable anywhere (UI-only, harmless).
  const buyerCountry = countryOverride ?? (await headers()).get('x-vercel-ip-country')

  // STATE-007 — the bundle's category_config, the seller's reviews and
  // presence are mutually independent and each only needs data already loaded,
  // so the guarded reads are hoisted into one fan-out rather than serial
  // round-trips. A guard that does not apply resolves to { data: null }. (The
  // buyer's own avatar comes from the site account menu's useAuth.)
  const [configRes, reviewsRes, presenceRes] = await Promise.all([
    // The currency config also names the listing's delivery method.
    listing.bundle_id || listing.delivery_method_type
      ? (supabase
          .from('category_configs')
          .select('config')
          .eq('game_id', listing.game.id)
          .eq('category_type', 'currency')
          .maybeSingle() as any)
      : Promise.resolve({ data: null }),
    listing.seller?.id
      ? (supabase
          .from('reviews')
          .select('id, rating, comment, created_at, buyer:profiles!reviews_reviewer_id_fkey (username, avatar_url)')
          .eq('seller_id', listing.seller.id)
          .order('created_at', { ascending: false })
          .limit(5) as any)
      : Promise.resolve({ data: null }),
    // The item card's "Online" dot. Its own read, so a miss only hides the dot.
    listing.seller?.id
      ? (supabase
          .from('seller_presence')
          .select('is_online, last_seen_at')
          .eq('seller_id', listing.seller.id)
          .maybeSingle() as any)
      : Promise.resolve({ data: null }),
  ])

  // V19/P24/P7.l — Bundle currency: pull the matching bundle row out
  // of the game's currency category_config so the checkout summary
  // can show the bundle's name + icon instead of the auto-generated
  // listing title. Falls back gracefully if anything is missing.
  let bundleSummary: {
    name: string
    iconUrl: string | null
  } | null = null
  {
    const bundles = (configRes as any).data?.config?.bundles as
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

  // Currency delivery method (Gamepass, UID / Login …): label + tooltip.
  const deliveryMethod = findDeliveryMethod((configRes as any).data?.config, listing.delivery_method_type)

  // V75 — Last 5 reviews for the seller peek dialog (no profile
  // navigation from checkout — the reviews come to the buyer).
  const sellerReviews: any[] = (reviewsRes as any).data ?? []

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

  // Checkout B3 — the payment methods this order can be paid with and what
  // each costs the buyer, from the ONE eligibility source createCheckout
  // also consults (payment_method_fees → buyer_fee_quote). Quoted for the
  // same quantity the form renders; hidden / over-cap methods never reach
  // the client. Fails closed: a quote error is a page error, not a default fee.
  const quantity = clampCheckoutQty(listing, parsedQty, !!bundleSummary)
  const subtotal = round2(Number(listing.price) * quantity)
  const [eligibility, siteRating] = await Promise.all([
    eligibleMethods({
      buyerId: user?.id ?? null,
      currency: (listing.currency as string | null) || 'USD',
      country: buyerCountry,
      subtotalMinor: BigInt(Math.round(subtotal * 100)),
    }),
    getSiteRating(),
  ])

  const form = (
    <CheckoutForm
      methods={toClientMethods(eligibility.methods)}
      listing={listing}
      user={user}
      sellerReviews={sellerReviews}
      initialQty={parsedQty}
      bundleSummary={bundleSummary}
      buyerCountry={buyerCountry}
      deliveryMethod={deliveryMethod}
      unfinishedPayment={unfinishedPayment}
      siteRating={siteRating}
      sellerOnline={isSellerOnline((presenceRes as any).data)}
    />
  )

  // The homepage art behind the top, heavily faded (owner 2026-10-27: "a
  // subtle touch, a minimal bare background") with the deep dim the Order
  // Paid page uses, so the form stays the loudest thing on the page. The
  // checkout draws its own navbar, so the art starts at the page top.
  return (
    <main className="w-full">
      <HeroBackdropPreload name="home" />
      {/* overflow-clip: the art box is a fixed clamp() height, taller than
          a short checkout, and would add a scroll of bare art under the
          footer. clip (not hidden) keeps the summary column sticky. */}
      <HeroBackdrop name="home" navbarOffset={0} className="hero-dim-deep overflow-clip">
        {form}
      </HeroBackdrop>
    </main>
  )
}

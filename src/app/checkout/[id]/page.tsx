import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CheckoutForm } from './CheckoutForm'
import Link from 'next/link'
import { ArrowLeft, ShieldCheck } from 'lucide-react'

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

  // V14m — Block self-purchase. Sellers can't escrow money to themselves,
  // and the order/refund flow would loop on the same account. Bounce back
  // to the edit page for currency / listing page otherwise.
  if (user && listing.seller?.id === user.id) {
    redirect(`/account/listings/${listing.id}/edit`)
  }

  // V17g — Resolve the right "back" target.
  //
  // Currency listings don't have individual detail pages — they all
  // live on the currency category page. Use the category's canonical
  // slug from the DB directly (e.g. buy-robux for Roblox, buy-vbucks
  // for Fortnite). Non-currency listings go to their own detail page.
  const isCurrency = listing.category?.metadata?.type === 'currency'
  const backHref = isCurrency
    ? `/${listing.game.slug}/${listing.category.slug}`
    : `/${listing.game.slug}/${listing.category.slug}/${listing.slug}`
  const backLabel = isCurrency
    ? `Back to ${listing.game.name}`
    : 'Back to listing'

  return (
    // V14m — Tightened further. Floating navbar ends ~64px; pt-16 (64px)
    // tucks the Back chip right up under it so important content is in
    // view immediately without scroll.
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-16 sm:px-6 sm:pt-20">
      {/* V14m — Back chip with tighter vertical rhythm. */}
      <Link
        href={backHref}
        className="group inline-flex items-center gap-2 rounded-full border border-border-subtle bg-bg-raised px-3.5 py-1.5 text-[12.5px] font-semibold text-text-secondary transition-colors hover:border-lime-tint-border hover:bg-lime-tint-bg/30 hover:text-lime-text"
      >
        <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
        {backLabel}
      </Link>

      <header className="mt-3 mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">Checkout</h1>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-lime-tint-border bg-lime-tint-bg px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-lime-text">
          <ShieldCheck className="h-3.5 w-3.5" />
          Protected
        </span>
      </header>

      <CheckoutForm listing={listing} user={user} initialQty={parsedQty} />
    </main>
  )
}

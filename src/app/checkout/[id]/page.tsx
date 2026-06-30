import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CheckoutForm } from './CheckoutForm'

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

  // V14m — Block self-purchase. Sellers can't escrow money to themselves,
  // and the order/refund flow would loop on the same account. Bounce back
  // to the edit page for currency / listing page otherwise.
  if (user && listing.seller?.id === user.id) {
    redirect(`/sell/edit/${listing.id}`)
  }

  return (
    // V19/P24/P7.bb — Full-bleed checkout: no max-width container, no
    // Back chip. The CheckoutForm's two halves now extend edge-to-edge
    // of the viewport. Browser back handles return navigation.
    <main className="w-full">
      <CheckoutForm
        listing={listing}
        user={user}
        initialQty={parsedQty}
        bundleSummary={bundleSummary}
      />
    </main>
  )
}

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CheckoutForm } from './CheckoutForm'
import Link from 'next/link'
import { ArrowLeft, Shield } from 'lucide-react'

interface CheckoutPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function CheckoutPage({ params }: CheckoutPageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Get listing details
  const { data: listing, error } = await supabase
    .from('listings')
    .select(`
      *,
      seller:seller_id (
        id,
        username,
        avatar_url,
        seller_tier
      ),
      game:game_id (
        id,
        name,
        slug,
        image_url
      ),
      category:category_id (
        id,
        name,
        slug
      )
    `)
    .eq('id', id)
    .single()

  if (error || !listing) {
    redirect('/marketplace')
  }

  // Check if listing is available
  if (listing.status !== 'active') {
    redirect(`/marketplace/${listing.game.slug}/${listing.category.slug}/${listing.slug}`)
  }

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-black">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Back Button */}
        <Link
          href={`/marketplace/${listing.game.slug}/${listing.category.slug}/${listing.slug}`}
          className="mb-6 inline-flex items-center gap-2 text-gray-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Listing
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-white">Checkout</h1>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/30">
              <Shield className="h-4 w-4 text-violet-400" />
              <span className="text-xs font-medium text-violet-300">Protected</span>
            </div>
          </div>
          <p className="mt-2 text-gray-400">
            Your purchase is protected by VaultShield escrow protection
          </p>
        </div>

        {/* Checkout Form */}
        <CheckoutForm listing={listing} user={user} />
      </div>
    </div>
  )
}

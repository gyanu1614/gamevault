/**
 * DEV-ONLY checkout preview — renders CheckoutForm with mock props so
 * the phase-by-phase design tweaks can be verified without an
 * authenticated session (real /checkout/* is middleware-gated).
 * 404s outside development. Remove when the checkout phases wrap.
 */

import { notFound } from 'next/navigation'
import { CheckoutForm } from '../../checkout/[id]/CheckoutForm'
import type { ClientMethod } from '@/lib/payments/eligibility'
import { PaymentsMarquee } from '@/components/marketplace/PaymentsMarquee'

const MOCK_LISTING = {
  id: '00000000-0000-0000-0000-000000000000',
  title: 'Dual Nebula Katana',
  description: 'Limited-edition dual-wield katana skin with animated nebula trail effects. Delivered via in-game trade within minutes of payment confirmation. Includes both blade variants and the exclusive back-bling attachment. Works on all platforms with cross-save enabled. Contact the seller through order chat after purchase to arrange the trade lobby.',
  price: 2.39,
  quantity: 7,
  min_quantity: 1,
  is_unlimited: false,
  images: ['/games/fortnite.png'],
  game: { id: 'g1', name: 'Brawl Blade', slug: 'brawl-blade', image_url: '/games/fortnite.png' },
  seller: {
    id: 's1',
    username: 'NebulaTrader',
    shop_name: 'Nebula Traders',
    avatar_url: null,
    seller_tier: 'gold',
    seller_rating: 4.9,
    total_reviews: 214,
    total_sales: 1382,
    is_verified: true,
    created_at: '2024-03-14T00:00:00Z',
  },
}

const MOCK_REVIEWS = [
  { id: 'r1', rating: 5, comment: 'Instant delivery, exactly as described. Would buy again.', created_at: '2026-06-28T00:00:00Z', buyer: { username: 'phantom_x', avatar_url: null } },
  { id: 'r2', rating: 5, comment: 'Smooth trade, great comms.', created_at: '2026-06-21T00:00:00Z', buyer: { username: 'Kittenzz', avatar_url: null } },
  { id: 'r3', rating: 4, comment: 'Took a few minutes but all good.', created_at: '2026-06-11T00:00:00Z', buyer: { username: 'drav3n', avatar_url: null } },
]

const MOCK_USER = { id: 'u1', email: 'buyer@dropmarket.gg', created_at: '2025-11-02T00:00:00Z' }

// Checkout B3: the page normally quotes these from payment_method_fees via
// eligibleMethods(); the preview hands in fixed quotes for 2 × $2.39.
const q = (feeMinor: number, pctEffective: number) => ({ feeMinor, totalMinor: 478 + feeMinor, pctEffective })
const MOCK_METHODS: ClientMethod[] = [
  { method: 'btcpay', pmId: null, kind: 'crypto', label: 'Crypto', countries: [], coverage: 'Worldwide', countryMatch: true, refundable: true, instantClearing: true, quote: q(24, 5) },
  { method: 'pix_br', pmId: 'pix_br', kind: 'local', label: 'Pix', countries: ['BR'], coverage: 'Brazil', countryMatch: false, refundable: true, instantClearing: true, quote: q(67, 14.02) },
  { method: 'gcash_ph', pmId: 'gcash_ph', kind: 'local', label: 'GCash', countries: ['PH'], coverage: 'Philippines', countryMatch: false, refundable: true, instantClearing: true, quote: q(69, 14.44) },
  { method: 'qr_ph', pmId: 'qr_ph', kind: 'local', label: 'QR Ph', countries: ['PH'], coverage: 'Philippines', countryMatch: false, refundable: false, instantClearing: true, quote: q(62, 12.97) },
  { method: 'wallet', pmId: null, kind: 'wallet', label: 'Store credit', countries: [], coverage: '', countryMatch: true, refundable: true, instantClearing: true, quote: q(24, 5) },
]

export default function CheckoutPreviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return (
    <div
      className="min-h-screen bg-[#0c0e14]"
      style={{ backgroundImage: 'radial-gradient(120% 46% at 50% -6%, #141a26, rgba(20,26,38,0) 62%)' }}
    >
      <CheckoutForm
        listing={MOCK_LISTING}
        user={MOCK_USER}
        buyerProfile={{ username: 'gyan_dev', avatar_url: null }}
        sellerReviews={MOCK_REVIEWS}
        initialQty={2}
        bundleSummary={null}
        methods={MOCK_METHODS}
      />
      {/* mirrors checkout/layout.tsx */}
      <div className="-mt-10 sm:-mt-16">
        <PaymentsMarquee />
      </div>
    </div>
  )
}

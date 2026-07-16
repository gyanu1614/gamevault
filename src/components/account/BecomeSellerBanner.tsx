'use client'

import Link from 'next/link'
import { Store, TrendingUp, DollarSign, Users, ArrowRight, Clock } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'

export default function BecomeSellerBanner() {
  const { user } = useAuth()
  const status = user?.sellerApplicationStatus ?? null
  const isPending =
    status === 'pending' || status === 'under_review' || status === 'info_requested'
  const ctaHref = isPending ? '/account/seller-status' : '/account/become-seller'

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <div className="max-w-4xl w-full">
        {/* Main Card */}
        <div className="bg-white/[0.04] border border-lime-tint-border rounded-2xl p-12 text-center">
          {/* Icon */}
          <div className="w-20 h-20 mx-auto mb-6 bg-lime/20 rounded-full flex items-center justify-center">
            <Store className="w-10 h-10 text-lime-text" />
          </div>

          {/* Heading */}
          <h1 className="text-4xl font-bold text-white mb-4">
            Become a Seller on DropMarket
          </h1>
          <p className="text-xl text-text-secondary mb-8 max-w-2xl mx-auto">
            Start earning by selling game items, accounts, and services to thousands of gamers worldwide
          </p>

          {/* Benefits */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="bg-bg-overlay border border-border-subtle rounded-xl p-6">
              <TrendingUp className="w-8 h-8 text-success mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-white mb-2">Grow Your Business</h3>
              <p className="text-sm text-text-secondary">
                Reach a global audience of gamers looking for quality items
              </p>
            </div>

            <div className="bg-bg-overlay border border-border-subtle rounded-xl p-6">
              <DollarSign className="w-8 h-8 text-success mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-white mb-2">Competitive Fees</h3>
              <p className="text-sm text-text-secondary">
                Keep more of your earnings with our low platform fees
              </p>
            </div>

            <div className="bg-bg-overlay border border-border-subtle rounded-xl p-6">
              <Users className="w-8 h-8 text-blue-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-white mb-2">SafeDrop Protection</h3>
              <p className="text-sm text-text-secondary">
                Secure transactions with built-in buyer protection
              </p>
            </div>
          </div>

          {/* CTA — reactive: pending applicants get routed to their status
              page instead of a fresh application. */}
          <Link
            href={ctaHref}
            className="inline-flex items-center gap-2 px-8 py-4 bg-lime hover:bg-lime/90 text-text-inverse font-semibold rounded-xl transition-colors duration-200"
          >
            {isPending ? (
              <>
                <Clock className="w-5 h-5" />
                View Application Status
              </>
            ) : (
              <>
                Start Selling Now
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </Link>

          {/* Fine Print */}
          <p className="text-sm text-text-tertiary mt-6">
            {isPending
              ? "Your application is under review — we'll email you with the decision."
              : 'Application review typically takes 2-3 business days'}
          </p>
        </div>

        {/* Quick Stats */}
        <div className="mt-8 grid grid-cols-3 gap-4 max-w-2xl mx-auto">
          <div className="text-center">
            <div className="text-2xl font-bold text-lime-text">10K+</div>
            <div className="text-xs text-text-secondary">Active Sellers</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-lime-text">$2M+</div>
            <div className="text-xs text-text-secondary">Monthly Volume</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-lime-text">4.8★</div>
            <div className="text-xs text-text-secondary">Avg Seller Rating</div>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import Link from 'next/link'
import { Store, TrendingUp, DollarSign, Users, ArrowRight } from 'lucide-react'

export default function BecomeSellerBanner() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <div className="max-w-4xl w-full">
        {/* Main Card */}
        <div className="bg-gradient-to-br from-lime/10 via-purple-500/10 to-pink-500/10 border border-lime-tint-border rounded-2xl p-12 text-center">
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

          {/* CTA */}
          <Link
            href="/account/become-seller"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-lime to-purple-600 hover:from-lime hover:to-purple-500 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 transform hover:scale-105"
          >
            Start Selling Now
            <ArrowRight className="w-5 h-5" />
          </Link>

          {/* Fine Print */}
          <p className="text-sm text-text-tertiary mt-6">
            Application review typically takes 24-48 hours
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

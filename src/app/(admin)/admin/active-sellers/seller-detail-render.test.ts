/**
 * Regression test for Sentry JAVASCRIPT-NEXTJS-4:
 * TypeError "Cannot read properties of undefined (reading 'toFixed')" on
 * /admin/active-sellers.
 *
 * SellerDetail crosses a server-action serialization boundary, so its
 * `amount: number` fields are a compile-time claim, not a runtime guarantee.
 * Every `.toFixed()` in the detail client trusted that claim, and one missing
 * number took down the entire route instead of one cell.
 *
 * This renders the REAL component (react-dom/server — the repo's vitest env is
 * `node` with no jsdom/RTL, and SSR is enough to execute every formatter in the
 * render path) for a brand-new seller with no sales and no rating, plus rows
 * whose numeric fields are absent.
 */

import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// `React.cache` is a server-runtime API that a transitive Supabase import
// reaches for; it does not exist in the plain node test environment.
vi.mock('react', async () => {
  const actual = await vi.importActual<any>('react')
  return { ...actual, cache: (fn: any) => fn, default: actual.default ?? actual }
})
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('next/link', () => ({ default: ({ children }: any) => children }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const ISO = '2026-09-01T00:00:00.000Z'

/** A seller who just signed up: no sales, no rating, no balances, no tier config. */
function newSellerDetail(): any {
  return {
    profile: {
      id: 'u1',
      username: 'brandnew',
      full_name: null,
      email: 'new@example.com',
      avatar_url: null,
      shop_name: null,
      shop_slug: null,
      role: 'seller',
      seller_tier: 'bronze',
      seller_status: 'active',
      seller_restriction_reason: null,
      seller_restricted_at: null,
      kyc_status: null,
      founding_seller: false,
      is_test: false,
      created_at: ISO,
      total_sales: 0,
      seller_rating: null,
      total_reviews: 0,
    },
    presence: { store_paused: false, last_active_at: null },
    listings: { countsByStatus: {}, recent: [] },
    orders: {
      totalOrders: 0,
      completedCount: 0,
      revenue: 0,
      gmv: 0,
      completionRate: 100,
      recent: [],
    },
    wallet: { sellerBalances: [], storeCreditBalances: [], transactions: [] },
    withdrawals: [],
    restrictions: [],
    tier: { history: [], configs: [], info: null },
    reviews: [],
    application: null,
  }
}

async function render(detail: any): Promise<string> {
  const mod = await import('./[id]/SellerDetailClient')
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return renderToString(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(mod.default, { userId: 'u1', initialDetail: detail }),
    ),
  )
}

describe('SellerDetailClient — seller with no sales and no rating', () => {
  it('renders without throwing', async () => {
    const html = await render(newSellerDetail())
    expect(html).toContain('brandnew')
  })

  it('shows a placeholder for the missing rating rather than a number', async () => {
    const html = await render(newSellerDetail())
    expect(html).toContain('Rating')
    expect(html).not.toContain('NaN')
  })

  it('renders zeroed money without NaN', async () => {
    const html = await render(newSellerDetail())
    expect(html).toContain('$0.00')
    expect(html).not.toContain('undefined')
  })
})

describe('SellerDetailClient — rows missing the numeric field entirely', () => {
  // Each case is a field the types declare as `number` but that arrived
  // undefined in production. Every one of these threw before the fix.
  const cases: [string, (d: any) => void][] = [
    ['seller balance row without an amount', (d) => {
      d.wallet.sellerBalances = [{ currency: 'USD' }]
    }],
    ['store-credit row without an amount', (d) => {
      d.wallet.storeCreditBalances = [{ currency: 'USD' }]
    }],
    ['listing without a price', (d) => {
      d.listings.countsByStatus = { active: 1 }
      d.listings.recent = [
        { id: 'l1', title: 'A listing', status: 'active', created_at: ISO, game_name: null },
      ]
    }],
    ['order without a seller payout', (d) => {
      d.orders.totalOrders = 1
      d.orders.recent = [
        { id: 'o1', order_number: 'ORD-1', total_amount: 5, status: 'completed', created_at: ISO },
      ]
    }],
    ['withdrawal without an amount', (d) => {
      d.withdrawals = [
        { id: 'w1', net_amount: null, method_name: 'PayPal', status: 'pending', created_at: ISO },
      ]
    }],
    ['wallet transaction without an amount', (d) => {
      d.wallet.transactions = [
        { id: 't1', type: 'credit', description: null, status: 'posted', created_at: ISO },
      ]
    }],
    ['aggregate revenue undefined', (d) => {
      d.orders.revenue = undefined
      d.orders.gmv = undefined
    }],
    ['tier config without a rank discount', (d) => {
      d.tier.configs = [{
        tier: 'bronze',
        display_name: 'Bronze',
        discount_pts: undefined,
        listing_limit: null,
        pre_moderation_listings: null,
        badge_color: null,
        sort_order: 1,
      }]
    }],
  ]

  for (const [name, mutate] of cases) {
    it(`renders with a ${name}`, async () => {
      const detail = newSellerDetail()
      mutate(detail)
      const html = await render(detail)
      expect(html).toContain('brandnew')
      expect(html).not.toContain('NaN')
    })
  }
})

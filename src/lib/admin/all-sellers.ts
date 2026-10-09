/**
 * Types + constants for Admin → Sellers (plain module: the 'use server'
 * loader may only export async functions).
 */
import type { FoundingStage } from '@/lib/founding/onboarding'

export const SELLERS_PAGE_SIZE = 25

export type SellerStageFilter = 'all' | 'in_progress' | 'live' | 'listed' | 'sold' | 'stalled'
export type SellerTrustFilter = 'all' | 'verified' | 'new'

export type AllSellersFilters = {
  q?: string
  stage?: SellerStageFilter
  trust?: SellerTrustFilter
  founding?: boolean
  page?: number
}

export type SellerListRow = {
  id: string
  username: string | null
  full_name: string | null
  email: string | null
  avatar_url: string | null
  shop_name: string | null
  shop_slug: string | null
  seller_tier: string | null
  seller_status: string | null
  is_verified: boolean
  founding_seller: boolean
  is_test: boolean
  /** profile row created (signup) */
  signed_up_at: string
  /** 1 account · 2 details · 3 store · 4 agreement · 5 live */
  stage: FoundingStage
  /** Beyond "live": listed, sold. */
  milestone: 'none' | 'listed' | 'sold'
  country: string | null
  discord: string | null
  sells: string[]
  agreement_signed_at: string | null
  completed_at: string | null
  last_active_at: string | null
  stats: {
    active_listings: number
    completed_sales: number
    /** SUM(seller_payout) over completed orders, major units */
    revenue: number
    /** seller_available_balance in USD, major units; null = not fetched */
    balance_usd: number | null
  }
}

export type SellerFunnel = {
  signed_up: number
  details: number
  store: number
  agreement: number
  live: number
  listed: number
  sold: number
  verified: number
  founding: number
}

export type AllSellersResult = {
  rows: SellerListRow[]
  total: number
  page: number
  pageSize: number
  funnel: SellerFunnel
}


export const STAGE_LABEL: Record<FoundingStage, string> = {
  1: 'Signed Up',
  2: 'Details',
  3: 'Store',
  4: 'Agreement',
  5: 'Live',
}

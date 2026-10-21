/**
 * Types of the browser seller API (matching the existing schema).
 *
 * Part of the browser seller API, split out of lib/api/seller-compatible.ts
 * (2026-10-20, files under ~400 lines). Import from '@/lib/api/seller-compatible'.
 */
import { type SellerTier } from '@/lib/seller/tiers'

export type ListingStatus =
  | 'draft' | 'active' | 'sold' | 'archived' | 'suspended' | 'paused'
  | 'pending_approval' | 'changes_requested' | 'rejected'
export type OrderStatus = 'pending' | 'paid' | 'processing' | 'completed' | 'disputed' | 'refunded' | 'cancelled'
// Seller ranks now come from the central rank ladder — re-exported so
// existing importers of `SellerTier` from this module keep working.
export type { SellerTier }

export interface Listing {
  id: string
  seller_id: string
  game_id: string
  category_id: string
  /** Step 1b — the game_categories row; category_id is the Phase-A legacy mirror. */
  game_category_id?: string | null
  title: string
  description: string
  price: number
  currency: string
  quantity: number
  is_unlimited: boolean
  status: ListingStatus
  images: string[]
  delivery_time: string
  delivery_method: string
  views: number
  /** Second view counter (the "most viewed" sort key); bumped together with
   *  `views` since 2026-10-01. */
  view_count?: number | null
  sales: number
  created_at: string
  updated_at: string
  /** SEO slug for the public listing URL (nullable on legacy rows). */
  slug?: string | null
  /** Minimum purchase quantity (currency offers). */
  min_quantity?: number | null
  /** Fixed-bundle currency listings only (category_configs bundles[].id). */
  bundle_id?: string | null
  /** Short sequential offer ID (#33404) — null until the migration runs. */
  offer_number?: number | null
  /** Admin moderation notes — what to change (surfaced to the seller
   *  ONLY while status === 'changes_requested'; approval notes are
   *  internal). */
  moderation_notes?: string | null
  // Joined data
  game?: {
    id: string
    name: string
    slug: string
    emoji: string
    image_url?: string | null
  }
  category?: {
    id: string
    name: string
    slug: string
    /** game_categories.type — the fee / warranty key ('currency' | 'items' | …). */
    type?: string | null
  }
}

export interface Order {
  id: string
  buyer_id: string
  seller_id: string
  listing_id: string
  order_number?: string
  quantity: number
  unit_price: number
  subtotal: number
  platform_fee_rate: number
  payment_processing_fee_rate: number
  platform_fee: number
  payment_processing_fee: number
  total_amount: number
  seller_payout: number
  status: OrderStatus
  delivery_details?: any
  delivered_at?: string
  dispute_reason?: string
  disputed_at?: string
  created_at: string
  updated_at: string
  completed_at?: string
  // Joined data
  listing?: Listing
  buyer?: {
    id: string
    username: string
    avatar_url?: string
  }
}

export interface Review {
  id: string
  order_id: string
  reviewer_id: string
  reviewed_user_id: string
  rating: number
  comment?: string
  review_type: 'buyer_to_seller' | 'seller_to_buyer'
  seller_response?: string
  seller_responded_at?: string
  helpful_count?: number
  created_at: string
  updated_at: string
  // Joined data
  reviewer?: {
    id: string
    username: string
    avatar_url?: string
  }
  order?: {
    listing_id: string
    listing?: {
      title: string
    }
  }
}

export interface DashboardStats {
  earnings: {
    today: number
    week: number
    month: number
    allTime: number
  }
  listings: {
    active: number
    paused: number
    draft: number
    sold: number
  }
  orders: {
    pending: number
    processing: number
    completed: number
    disputed: number
  }
  performance: {
    totalViews: number
    totalSales: number
    conversionRate: number
    avgRating: number
  }
}

export interface SellerProfile {
  id: string
  username: string
  seller_tier: SellerTier
  total_sales: number
  seller_rating: number
  total_reviews: number
  shop_name: string | null
  shop_slug: string | null
  shop_name_updated_at: string | null
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  attachments: string[]
  is_read: boolean
  read_at: string | null
  created_at: string
  sender?: {
    id: string
    username: string
    avatar_url: string
  }
}

export interface Conversation {
  id: string
  order_id: string | null
  buyer_id: string
  seller_id: string
  last_message_at: string
  created_at: string
  buyer?: {
    id: string
    username: string
    avatar_url: string
  }
  seller?: {
    id: string
    username: string
    avatar_url: string
    is_verified?: boolean | null
  }
  last_message?: {
    content: string
    sender_id: string
  }
  unread_count?: number
  order?: {
    id: string
    order_number?: string
    status: OrderStatus
    total_amount: number
    quantity?: number
    listing?: {
      id: string
      title: string
      images: string[]
      game?: { id?: string; name: string; slug: string; image_url?: string | null }
      category?: { name: string; slug: string; type?: string | null }
    }
  }
}

export interface EarningsStats {
  total_earnings: number
  pending_balance: number
  available_balance: number
  total_payouts: number
  this_month_earnings: number
}

export interface Transaction {
  id: string
  order_id: string
  order_number: string
  buyer_username: string
  amount: number
  platform_fee: number
  net_amount: number
  status: string
  created_at: string
  listing_title: string
}

export interface Payout {
  id: string
  amount: number
  status: string
  method: string
  created_at: string
  completed_at: string | null
}

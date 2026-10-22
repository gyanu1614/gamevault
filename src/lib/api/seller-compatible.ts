/**
 * DROPMARKET SELLER API (Compatible with existing schema)
 * Works with your existing database structure
 * Date: January 25, 2026
 *
 * Split by domain into lib/api/seller/* (2026-10-20, files under ~400 lines);
 * this module re-exports them so every importer keeps one path.
 */

export type {
  ListingStatus,
  OrderStatus,
  Listing,
  Order,
  Review,
  DashboardStats,
  SellerProfile,
  Message,
  Conversation,
  EarningsStats,
  Transaction,
  Payout,
} from './seller/types'
export { listingsApi } from './seller/listings'
export { ordersApi, buyerOrdersApi } from './seller/orders'
export { reviewsApi } from './seller/reviews'
export { analyticsApi } from './seller/analytics'
export { settingsApi } from './seller/settings'
export { messagesApi } from './seller/messages'
export { earningsApi } from './seller/earnings'

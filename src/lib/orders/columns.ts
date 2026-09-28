/**
 * Which `orders` columns a session client (anon / authenticated) may SELECT.
 *
 * RLS returns the whole row to both parties of an order, so since migration
 * 20260927224019_orders_column_privacy the database itself withholds each
 * side's private money/payment fields: `anon` and `authenticated` hold a
 * column-level SELECT grant on ORDER_PARTY_COLUMNS only. A session read of
 * '*' or of a private column is refused (42501) — select ORDER_PARTY_SELECT
 * instead, and read the caller's OWN private fields through
 * withOwnOrderFields (src/lib/orders/own-fields.ts).
 *
 * The service role (money RPCs, crons, webhooks, admin actions after
 * requireAdmin) still reads every column.
 *
 * Pinned against the live grant by
 * src/test/guards/orders-column-privacy.guard.integration.test.ts — a new
 * `orders` column is private until it is granted in a migration AND added
 * here.
 */

/** The seller's payout and the platform's take — never shown to the buyer. */
export const ORDER_SELLER_PRIVATE_COLUMNS = [
  'seller_payout',
  'seller_commission_pct',
  'seller_fee_trace',
  'platform_fee',
  'platform_fee_rate',
  'stripe_transfer_id',
] as const

/** The buyer's checkout link, wallet use, promo, fees and provider ids — never shown to the seller. */
export const ORDER_BUYER_PRIVATE_COLUMNS = [
  'checkout_url',
  'wallet_amount_used',
  'promo_code_id',
  'promo_discount',
  'payment_processing_fee',
  'payment_processing_fee_rate',
  'provider_charge_id',
  'stripe_payment_intent_id',
  'payment_provider',
  'buyer_fee_pct',
  'buyer_fee_amount',
  'buyer_fee_method',
] as const

/** Every column granted to anon / authenticated (both parties see these). */
export const ORDER_PARTY_COLUMNS = [
  'id',
  'order_number',
  'buyer_id',
  'seller_id',
  'listing_id',
  'quantity',
  'unit_price',
  'subtotal',
  'total_amount',
  'status',
  'protection_until',
  'delivery_details',
  'delivered_at',
  'dispute_reason',
  'disputed_at',
  'created_at',
  'updated_at',
  'completed_at',
  'escrow_status',
  'auto_release_at',
  'release_method',
  'vaultshield_level',
  'delivery_evidence_required',
  'delivery_evidence_urls',
  'buyer_confirmed_at',
  'seller_marked_delivered_at',
  'delivering_at',
  'is_guest_order',
  'chat_active_until',
  'vaultshield_tier_fee_rate',
  'vaultshield_tier_fee',
  'warranty_expires_at',
  'cancelled_at',
  'version',
  'instant_delivery_code',
  'instant_delivery_inventory_id',
  'instant_delivery_delivered_at',
  'currency',
  'payment_expires_at',
  'paid_at',
  'order_number_search',
  'stock_claimed_at',
  'stock_returned_at',
  'confirm_reminder_sent_at',
] as const

/** Drop-in for a session client's `select('*')` on orders. */
export const ORDER_PARTY_SELECT = ORDER_PARTY_COLUMNS.join(', ')

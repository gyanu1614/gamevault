/**
 * AUTH-001 — Public storefront column allowlists.
 *
 * `/shop/[slug]` reads `profiles` with the SERVICE ROLE (the page must work for
 * anonymous visitors and `seller_applications` is RLS-protected) and hands the
 * row to a client component. Anything selected therefore ships to the browser
 * in the RSC payload. Selecting `*` leaked email, PayPal, Stripe Connect ids,
 * balances, KYC and restriction state. Select ONLY what the storefront renders.
 *
 * Keep these lists in sync with `SellerStorefront.tsx` — the test in
 * `public-profile.test.ts` asserts the allowlist covers what it renders and
 * contains none of `SENSITIVE_PROFILE_COLUMNS`.
 */

export const PUBLIC_SELLER_PROFILE_COLUMNS = [
  'id',
  'username',
  'shop_name',
  'shop_slug',
  'business_name',
  'avatar_url',
  'banner_url',
  'bio',
  'created_at',
  'seller_tier',
  'is_verified',
  'founding_seller',
] as const

/** Exact select string for the public seller profile (+ approval status). */
// A string LITERAL (not a template) so supabase-js can type the rows; the test
// asserts it stays in sync with PUBLIC_SELLER_PROFILE_COLUMNS.
export const PUBLIC_SELLER_PROFILE_SELECT =
  'id, username, shop_name, shop_slug, business_name, avatar_url, banner_url, bio, created_at, seller_tier, is_verified, founding_seller, seller_applications!seller_applications_user_id_fkey ( status )' as const

/** Review columns safe for the public page — moderation state is excluded. */
export const PUBLIC_REVIEW_COLUMNS = [
  'id',
  'order_id',
  'reviewer_id',
  'seller_id',
  'listing_id',
  'game_id',
  'rating',
  'title',
  'comment',
  'is_positive',
  'seller_response',
  'seller_responded_at',
  'is_verified_purchase',
  'created_at',
  'updated_at',
  'edit_count',
  'last_edited_at',
] as const

export const PUBLIC_REVIEW_SELECT =
  'id, order_id, reviewer_id, seller_id, listing_id, game_id, rating, title, comment, is_positive, seller_response, seller_responded_at, is_verified_purchase, created_at, updated_at, edit_count, last_edited_at, buyer:profiles!reviews_buyer_id_fkey(username, avatar_url), order:orders(order_number)' as const

/**
 * Columns that must NEVER reach an anonymous visitor. Not exhaustive by
 * design — the allowlist is the control; this list is the regression guard.
 */
export const SENSITIVE_PROFILE_COLUMNS = [
  'email',
  'paypal_email',
  'stripe_account_id',
  'stripe_connect_account_id',
  'stripe_connect_onboarding_url',
  'stripe_connect_status',
  'stripe_connect_charges_enabled',
  'stripe_connect_payouts_enabled',
  'stripe_connect_connected_at',
  'payout_enabled',
  'seller_balance',
  'pending_balance',
  'lifetime_earnings',
  'loyalty_balance',
  'lifetime_cashback_earned',
  'kyc_status',
  'kyc_submitted_at',
  'seller_status',
  'seller_restriction_reason',
  'seller_restricted_at',
  'seller_restricted_by',
  'referral_code',
  'referred_by',
  'inform_status',
  'is_test',
  'is_guest',
  'role',
  'badges',
  'shop_custom_css',
] as const

export const SENSITIVE_REVIEW_COLUMNS = [
  'is_visible',
  'flagged_for_moderation',
  'moderation_reason',
] as const

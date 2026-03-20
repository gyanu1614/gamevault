# GameVault Database Schema Reference

**Last Updated:** March 17, 2026
**Database:** Supabase PostgreSQL
**Total Tables:** 47
**Schema Status:** ✅ Production-Ready

> **NOTE:** This is the authoritative schema reference. All migrations have been applied manually via Supabase SQL Editor. Do NOT attempt to re-run migrations - the database is complete.

---

## 📊 Quick Stats

- **Total Tables:** 47
- **User-Facing Features:** 15+ complete systems
- **Admin Features:** 8 dedicated tables
- **Audit/Logging:** 3 comprehensive audit systems
- **Financial Tables:** 7 (wallet, payouts, loyalty, promos)
- **Seller System:** 10 tables (KYC, tiers, presence, stats)

---

## 🗂️ Table Categories

### Core User System (5 tables)
- `profiles` - User profiles with seller data, shop customization
- `admin_roles` - Admin role assignments with MFA support
- `role_permissions` - Permission definitions per role
- `referral_codes` - User referral tracking
- `wishlists` - User wishlists for listings

### Marketplace (4 tables)
- `games` - 18 supported games (Roblox, Fortnite, Valorant, etc.)
- `categories` - Game categories with icons and metadata
- `listings` - Marketplace listings with instant delivery support
- `listing_templates` - Game-specific dynamic form fields

### Orders & Transactions (7 tables)
- `orders` - Complete order system with escrow, wallet, instant delivery
- `instant_delivery_inventory` - Code/key management for instant delivery
- `order_cancellation_requests` - Buyer cancellation workflow
- `disputes` - Dispute system
- `dispute_messages` - Dispute chat/evidence
- `dispute_resolutions` - Resolution tracking and outcomes
- `listing_price_history` - Price change tracking

### Financial System (7 tables)
- `wallet_balances` - User wallet balances (available/pending)
- `wallet_transactions` - Wallet transaction history
- `payouts` - Seller payout tracking (Stripe Connect)
- `seller_payouts` - Legacy payout table
- `loyalty_credits` - Loyalty/cashback credit ledger
- `promo_codes` - Promotional codes
- `promo_code_usages` - Promo code usage tracking

### Seller System (10 tables)
- `seller_applications` - 6-step KYC application process
- `seller_kyc_documents` - Document uploads (ID, proof of address, etc.)
- `seller_verification_logs` - Audit trail for seller verification
- `seller_tier_config` - Tier definitions (Bronze → Diamond)
- `seller_tier_history` - Tier change history
- `seller_presence` - Real-time online/offline status
- `seller_stats` - Daily seller analytics
- `seller_restrictions` - Ban/restriction management
- `seller_notifications` - Seller-specific notifications
- `shop_visits` - Shop visitor analytics

### Communication (4 tables)
- `conversations` - Order-based chat conversations
- `messages` - Real-time messages
- `notifications` - User notifications (30+ types)
- `reviews` - Order reviews with ratings

### Review System (2 tables)
- `reviews` - Product/seller reviews
- `review_edit_history` - Review editing audit trail

### Admin System (4 tables)
- `admin_roles` - Role assignments
- `admin_activity_log` - Comprehensive admin action logging
- `admin_action_logs` - Detailed admin actions
- `admin_notifications` - Admin-specific alerts

### Audit & Compliance (5 tables)
- `audit_logs` - System-wide audit trail (immutable)
- `fraud_flags` - Fraud detection flags
- `gdpr_requests` - GDPR export/deletion requests
- `inform_disclosures` - INFORM Act seller disclosures
- `processed_operations` - Idempotency key tracking

### Advanced Features (3 tables)
- `trustpilot_invitations` - Automated review invitations
- `referral_earnings` - Referral commission tracking
- `banner_presets` - Shop banner templates

---

## 📋 Detailed Table Schemas

### 1. profiles

**Purpose:** Core user profiles with seller capabilities

**Key Columns:**
- `id` (uuid, PK) - Links to auth.users
- `username` (text, unique) - 3-30 characters
- `email` (text) - User email
- `full_name`, `bio`, `avatar_url` - Profile info
- `seller_tier` - unverified/bronze/silver/gold/platinum/diamond
- `seller_status` - active/restricted/banned
- `total_sales`, `seller_rating`, `total_reviews` - Seller metrics
- `shop_name`, `shop_slug` - Custom shop branding
- `shop_banner_url`, `banner_preset` - Shop customization
- `shop_primary_color`, `shop_secondary_color` - Theme colors
- `stripe_connect_account_id` - Stripe Connect account
- `stripe_connect_status` - not_connected/pending/restricted/active/disabled
- `wallet_balance`, `pending_balance`, `lifetime_earnings` - Financial
- `loyalty_balance`, `lifetime_cashback_earned` - Loyalty system
- `referral_code`, `referred_by` - Referral system
- `is_verified`, `is_guest` - Account flags
- `kyc_status` - pending/approved/rejected
- `inform_status` - INFORM Act compliance status

**Relationships:**
- One-to-many: listings, orders (buyer/seller), reviews, disputes
- One-to-one: seller_presence, wallet_balances, admin_roles

---

### 2. listings

**Purpose:** Marketplace product listings

**Key Columns:**
- `id` (uuid, PK)
- `seller_id` (uuid, FK → profiles)
- `game_id` (uuid, FK → games)
- `category_id` (uuid, FK → categories)
- `title` (text, 5-100 chars) - Required
- `description` (text) - Required
- `price`, `original_price` (numeric) - Pricing
- `quantity` (integer) - Available stock
- `status` - draft/active/sold/archived/suspended/paused/pending_approval/out_of_stock
- `images` (text[]) - Image URLs
- `delivery_time` - 20min/1hr/3hr/6hr/12hr/24hr/3day
- `delivery_method` - manual/instant
- `delivery_method_type` - code/credentials/key/gift_card
- `template_data` (jsonb) - Game-specific fields
- `slug` (text, unique) - SEO-friendly URL
- `view_count`, `sales` - Metrics
- `approved_by`, `rejected_by` - Moderation
- `region`, `platform` - Item details

**Constraints:**
- Title: 5-100 characters
- Price: > 0
- Quantity: >= 0

---

### 3. orders

**Purpose:** Complete order lifecycle management

**Key Columns:**
- `id` (uuid, PK)
- `order_number` (text, unique) - Human-readable ID
- `buyer_id`, `seller_id` (uuid, FK → profiles)
- `listing_id` (uuid, FK → listings)
- `quantity`, `unit_price`, `subtotal` - Pricing
- `platform_fee`, `payment_processing_fee` - Fees
- `total_amount`, `seller_payout` - Final amounts
- `wallet_amount_used` - Wallet payment amount
- `promo_code_id`, `promo_discount` - Promo codes
- `vaultshield_tier_fee_rate`, `vaultshield_tier_fee` - Protection fees
- `status` - pending/paid/delivering/delivered/completed/disputed/refunded/cancelled
- `escrow_status` - held/released/refunded/frozen
- `stripe_payment_intent_id`, `stripe_transfer_id` - Stripe IDs
- `auto_release_at` - Escrow auto-release timestamp
- `release_method` - auto/buyer_confirmed/admin/dispute_resolved
- `vaultshield_level` - standard/enhanced/premium
- `warranty_expires_at` - Protection expiry
- `delivery_evidence_required`, `delivery_evidence_urls` - Evidence
- `instant_delivery_code` - Decrypted instant delivery code
- `instant_delivery_inventory_id` - FK to inventory
- `instant_delivery_delivered_at` - Delivery timestamp
- `chat_active_until` - Chat expiry
- `protection_until` - VaultShield protection window
- `is_guest_order` - Guest checkout flag
- `version` - Optimistic locking version

**Status Flow:**
```
pending → paid → delivering → delivered → completed
              ↓              ↓
          cancelled      disputed
                            ↓
                      resolved/refunded
```

---

### 4. instant_delivery_inventory

**Purpose:** Manage codes/keys for instant delivery listings

**Key Columns:**
- `id` (uuid, PK)
- `listing_id` (uuid, FK → listings)
- `delivery_type` - code/credentials/key/gift_card
- `delivery_data` (text) - Encrypted code/key
- `code_hash` (text) - Hash for deduplication
- `status` - available/sold/reserved/invalid
- `sold_to_order_id` (uuid, FK → orders)
- `sold_at`, `created_at` - Timestamps
- `created_by` (uuid, FK → profiles)
- `decrypted_at`, `decrypted_by_user_id` - Access tracking

**Security:**
- Codes stored encrypted at rest
- Only decrypted when buyer purchases
- Access logging for compliance

---

### 5. wallet_balances

**Purpose:** User wallet balances

**Key Columns:**
- `id` (uuid, PK)
- `user_id` (uuid, FK → profiles, unique)
- `available_balance` (numeric, >= 0) - Spendable balance
- `pending_balance` (numeric, >= 0) - Locked funds
- `lifetime_earned` - Total earned (refunds, cashback)
- `lifetime_spent` - Total spent
- `total_cashback` - Cashback earned
- `referral_earnings` - Referral commissions

---

### 6. wallet_transactions

**Purpose:** Wallet transaction ledger

**Key Columns:**
- `id` (uuid, PK)
- `user_id` (uuid, FK → profiles)
- `type` - topup/cashback/refund/purchase/withdrawal/referral_bonus
- `amount` (numeric) - Transaction amount
- `balance_after` (numeric) - Balance snapshot
- `description` (text) - Human-readable description
- `reference_id`, `reference_type` - Link to order/refund/etc
- `payment_method`, `payment_intent_id` - Payment details
- `status` - completed/pending/failed
- `created_at`, `completed_at` - Timestamps

---

### 7. seller_applications

**Purpose:** 6-step seller verification process

**Key Columns:**
- `id` (uuid, PK)
- `user_id` (uuid, FK → profiles)
- `status` - pending/approved/rejected/info_requested/under_review/withdrawn
- `is_18_or_older` (boolean) - Age verification
- `seller_type` - individual/business
- `primary_games` (uuid[]) - Games they'll sell
- `expected_monthly_volume` - Revenue estimate
- `full_legal_name`, `display_name` - Identity
- `country`, `state_province`, `city` - Location
- `phone_number`, `phone_verified` - Contact
- `company_legal_name`, `business_registration_number` - Business info
- `tax_id_vat` - Tax ID
- `payout_method` - bank_transfer/paypal/cryptocurrency
- `bank_account_number_encrypted`, `bank_routing_code` - Banking
- `paypal_email`, `crypto_wallet_address` - Payout methods
- `accepted_seller_agreement`, `accepted_privacy_policy` - Agreements
- `kyc_status` - pending/approved/rejected
- `identity_verified`, `address_verified`, `business_verified`, `tax_verified` - Checks
- `fraud_score` (0-100) - Risk assessment
- `reviewed_by`, `rejected_by` - Admin actions
- `rejection_reason`, `rejection_category` - Feedback
- `rejection_count`, `withdrawal_count` - History

**Verification Steps:**
1. Basic info (name, country, phone)
2. Business details (if applicable)
3. Payout method setup
4. Document upload (KYC)
5. Admin review
6. Approval/rejection

---

### 8. seller_kyc_documents

**Purpose:** Seller identity document storage

**Key Columns:**
- `id` (uuid, PK)
- `application_id` (uuid, FK → seller_applications)
- `user_id` (uuid, FK → profiles)
- `document_type` - id_front/id_back/selfie_with_id/proof_of_address/
                    certificate_of_incorporation/business_license/
                    director_id/bank_statement/w9_form/w8ben_form/other
- `file_path` (text) - Supabase Storage path
- `file_name`, `file_size`, `file_type` - File metadata
- `verified` (boolean) - Admin verification status
- `verified_by`, `verified_at` - Verification tracking
- `expires_at` - Document expiry (90 days default)
- `extracted_data` (jsonb) - OCR/parsed data
- `face_match_confidence` (numeric) - Selfie verification score
- `liveness_check_passed` (boolean) - Anti-spoof check

**Storage:** Stored in Supabase Storage `kyc-documents` bucket with RLS

---

### 9. seller_tier_config

**Purpose:** Define seller tier requirements and benefits

**Key Columns:**
- `tier` (text, PK) - bronze/silver/gold/platinum/diamond
- `display_name` (text) - Human-readable name
- `description` (text) - Tier description
- `min_sales` (integer) - Minimum completed sales
- `min_rating` (numeric) - Minimum average rating
- `min_age_days` (integer) - Account age requirement
- `min_completion_rate` (numeric) - Order completion rate
- `commission_rate` (numeric) - Platform commission (3.9% - 6.9%)
- `listing_limit` (integer) - Max active listings
- `banner_access` (boolean) - Can customize shop banner
- `badge_color` (text) - Badge color in UI
- `sort_order` (integer) - Display order

**Default Tiers:**
- **Unverified:** New sellers, high commission
- **Bronze:** Verified, 50+ sales
- **Silver:** 100+ sales, 4.5+ rating
- **Gold:** 500+ sales, 4.7+ rating, $10K+ volume
- **Platinum:** 2000+ sales, 4.8+ rating, $50K+ volume
- **Diamond:** Elite sellers, 5000+ sales

---

### 10. order_cancellation_requests

**Purpose:** Buyer-initiated order cancellation workflow

**Key Columns:**
- `id` (uuid, PK)
- `order_id` (uuid, FK → orders)
- `buyer_id` (uuid, FK → profiles)
- `reason` (text) - Cancellation reason (10-2000 chars)
- `status` (text) - pending/approved/rejected
- `admin_id` (uuid, FK → profiles) - Admin who processed
- `admin_notes` (text) - Admin's decision notes
- `created_at` - Request timestamp
- `processed_at` - Decision timestamp

**Business Rules:**
- Only available for orders with delivery time >= 6 hours
- Must wait 1+ hour after order creation
- Requires admin approval
- Refund processed if approved

---

### 11. disputes

**Purpose:** Order dispute management

**Key Columns:**
- `id` (uuid, PK)
- `transaction_id`, `order_reference` - Order link
- `buyer_id`, `seller_id` (uuid, FK → profiles)
- `reason` - non_delivery/wrong_item/not_as_described/fraud/quality/other
- `title`, `description` - Dispute details
- `evidence_urls` (text[]) - Evidence files
- `disputed_amount`, `resolved_amount` - Financial impact
- `status` - open/investigating/resolved/closed/escalated
- `priority` - low/normal/high/urgent
- `assigned_to` (uuid, FK → profiles) - Admin assigned
- `resolution_type` - refund_full/refund_partial/no_refund/replacement/other
- `resolution_notes` - Admin decision
- `resolved_by`, `resolved_at` - Resolution tracking
- `first_response_deadline`, `resolution_deadline` - SLAs

**Workflow:**
1. Buyer opens dispute
2. Admin assigned (auto or manual)
3. Evidence collected from both parties
4. Admin reviews and decides
5. Resolution applied (refund/release/partial)

---

### 12. reviews

**Purpose:** Order feedback system

**Key Columns:**
- `id` (uuid, PK)
- `order_id` (uuid, FK → orders, unique) - One review per order
- `reviewer_id` (uuid, FK → profiles) - Buyer
- `seller_id`, `listing_id`, `game_id` - Context
- `rating` (integer, 1-5) - Star rating
- `title` (text, <= 100 chars) - Review title
- `comment` (text, 10-2000 chars) - Review text
- `is_positive` (boolean) - Auto-set from rating >= 4
- `seller_response` (text, <= 500 chars) - Seller reply
- `seller_responded_at` - Response timestamp
- `is_verified_purchase` - Always true (reviews require order)
- `is_visible` - Moderation flag
- `flagged_for_moderation` - Admin review needed
- `edit_count`, `last_edited_at` - Edit tracking

**Rules:**
- Only buyers can leave reviews
- Only after order is completed
- Editable within 30 days
- Edit history tracked in `review_edit_history`

---

### 13. admin_roles

**Purpose:** Admin access control with MFA

**Key Columns:**
- `id` (uuid, PK)
- `user_id` (uuid, FK → profiles, unique)
- `role` - admin/moderator/support/super_admin
- `session_timeout_minutes` (integer, default 30)
- `failed_login_attempts` (integer) - Lockout tracking
- `locked_until` (timestamp) - Account lockout
- `is_active` (boolean) - Can access admin panel
- `granted_by` (uuid, FK → profiles) - Who gave role
- `last_login_at`, `last_active_at`, `last_login_ip` - Session tracking

**Security:**
- MFA/TOTP enforced for admin/super_admin
- Session timeout configurable per role
- Account lockout after failed attempts
- Activity logging in `admin_activity_log`

---

### 14. fraud_flags

**Purpose:** Automated fraud detection

**Key Columns:**
- `id` (uuid, PK)
- `user_id` (uuid, FK → profiles)
- `rule_id` (text) - Which rule triggered
- `severity` - low/medium/high
- `description` (text) - What was flagged
- `metadata` (jsonb) - Context data
- `status` - open/resolved/dismissed
- `resolved_at`, `resolved_by` - Admin action

**Rules Implemented:**
- New account + high-value listing
- Price significantly below market
- Duplicate listing detection
- Rapid account creation patterns
- Multiple accounts from same IP

---

### 15. processed_operations

**Purpose:** Idempotency key tracking

**Key Columns:**
- `id` (uuid, PK)
- `idempotency_key` (text, unique) - Request deduplication key
- `operation_type` (text) - Type of operation
- `user_id` (uuid, FK → profiles)
- `response_status` (integer) - HTTP status code
- `response_body` (jsonb) - Cached response
- `related_order_id` (uuid, FK → orders)
- `created_at`, `expires_at` - Lifetime (24 hours)

**Purpose:**
- Prevent duplicate payment operations
- Cache responses for retry safety
- Auto-expire after 24 hours

---

## 🔗 Key Relationships

### User → Everything
```
profiles (1) → (many) listings
profiles (1) → (many) orders (as buyer)
profiles (1) → (many) orders (as seller)
profiles (1) → (many) reviews
profiles (1) → (many) disputes
profiles (1) → (1) wallet_balances
profiles (1) → (1) seller_presence
```

### Order Lifecycle
```
listing → order → instant_delivery_inventory (optional)
                → payment (Stripe)
                → conversation/messages
                → delivery
                → review
                → (possible dispute)
                → completion/cancellation
```

### Seller Journey
```
profiles → seller_applications
        → seller_kyc_documents
        → admin approval
        → seller_tier_config
        → listings
        → orders (as seller)
        → seller_stats
        → payouts
```

---

## 🔐 Row Level Security (RLS)

All tables have RLS enabled with policies for:
- **Users:** Can only access their own data
- **Sellers:** Can access their listings, orders, applications
- **Admins:** Full access to all data for moderation
- **Service Role:** Unrestricted for server actions

**Critical RLS Policies:**
- Profiles: Users see only their profile, admins see all
- Orders: Buyers/sellers see their orders, admins see all
- Listings: Public read, seller write, admin moderate
- Wallet: Users see only their wallet
- KYC Documents: Seller + admin only
- Admin tables: Admin role required

---

## 🎯 Database Capabilities

### ✅ Fully Implemented:
1. Complete order system with escrow
2. Instant delivery inventory management
3. Wallet and loyalty systems
4. Order cancellation requests
5. Seller tier progression
6. 6-step KYC verification
7. Review system with editing
8. Dispute resolution
9. Real-time messaging
10. Shop customization
11. Referral and promo codes
12. Fraud detection infrastructure
13. GDPR and INFORM Act compliance
14. Comprehensive audit logging
15. Seller analytics

### 🟡 Partially Implemented (Backend Needed):
1. **Stripe Connect:** DB ready, transfer logic needed
2. **Payout Automation:** Tables exist, cron jobs needed
3. **Fraud Rules Engine:** Infrastructure ready, rules needed
4. **Trustpilot Integration:** Tables ready, API integration needed

### ❌ Not in Database (Future):
1. ML model tables (fraud prediction)
2. Semantic search vectors (pgvector)
3. AI chat history tables
4. Analytics aggregation tables

---

## 🛠️ Maintenance Notes

### Migration Status
- All 120 migrations applied manually via Supabase SQL Editor
- Migration tracking not in `supabase_migrations.schema_migrations`
- Database is complete and production-ready
- **DO NOT** re-run migrations

### Backup Strategy
- Supabase handles automatic backups
- Point-in-time recovery available
- Export schema via Supabase Dashboard → Database → Schema

### Performance Optimizations
- Indexes on all foreign keys
- Indexes on frequently queried columns (status, created_at)
- Composite indexes on common query patterns
- Realtime enabled on: orders, messages, conversations

### Storage Buckets
- `listing-images` - Listing photos
- `avatars` - User profile pictures
- `kyc-documents` - Seller verification docs
- `delivery-evidence` - Order delivery proof
- `seller-banners` - Shop banner images

---

## 📚 Related Documentation

- **Supabase Dashboard:** https://supabase.com/dashboard/project/cserfvellsliylifjkos
- **Type Generation:** `npx supabase gen types typescript --project-id cserfvellsliylifjkos`
- **Migration Files:** `/supabase/migrations/` (reference only)
- **Progress Tracking:** `/progress/march/`

---

## ⚠️ Important Reminders

1. **Schema is Complete:** Do not modify tables without documenting here
2. **RLS is Critical:** All queries run with RLS enabled in production
3. **Audit Everything:** Admin actions, financial operations, user data changes
4. **Encryption:** Sensitive data (bank details, codes) must be encrypted
5. **Idempotency:** Use `processed_operations` for payment operations
6. **Version Field:** Orders table has optimistic locking - always check version

---

**This is the single source of truth for GameVault's database schema.**
**Last verified:** March 17, 2026

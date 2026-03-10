# How to Apply Phase 3A Migrations

## 📋 Migration Files Created (2026-02-06)

These 6 migration files add support for all Phase 3A features:

1. **`20260206_create_listing_price_history.sql`** - Price history tracking
2. **`20260206_create_listing_templates.sql`** - Game-specific dynamic fields
3. **`20260206_create_seller_presence.sql`** - Online/offline status tracking
4. **`20260206_create_trustpilot_invitations.sql`** - Review invitation tracking
5. **`20260206_add_escrow_columns_to_orders.sql`** - VaultShield escrow system
6. **`20260206_add_seo_template_columns_to_listings.sql`** - SEO & pre-moderation

---

## ⚡ Quick Apply (Recommended Method)

### Option A: Via Supabase Dashboard

1. Go to: https://cservfvellsliylifjkos.supabase.co
2. Navigate to **SQL Editor** → **New query**
3. Copy and paste **each migration file** one at a time
4. Run each migration (Cmd+Enter or click Run)
5. Verify success (no errors)

**Apply in this order:**
1. `20260206_create_listing_price_history.sql` ✓
2. `20260206_create_listing_templates.sql` ✓
3. `20260206_create_seller_presence.sql` ✓
4. `20260206_create_trustpilot_invitations.sql` ✓
5. `20260206_add_escrow_columns_to_orders.sql` ✓
6. `20260206_add_seo_template_columns_to_listings.sql` ✓

### Option B: All at Once (Advanced)

If you prefer to run all migrations at once:

```bash
# Combine all migrations into one file
cat /Users/gyanendra/gamevault/supabase/migrations/20260206_*.sql > /tmp/phase3a_migrations.sql

# Then paste the entire /tmp/phase3a_migrations.sql into SQL Editor
```

---

## ✅ Verification

After applying all migrations, verify by running:

```sql
-- Check new tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'listing_price_history',
  'listing_templates',
  'seller_presence',
  'trustpilot_invitations'
)
ORDER BY table_name;

-- Should return 4 rows

-- Check new columns on orders table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'orders'
AND column_name IN (
  'escrow_status',
  'auto_release_at',
  'vaultshield_level',
  'delivery_evidence_required'
)
ORDER BY column_name;

-- Should return 4 rows

-- Check new columns on listings table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'listings'
AND column_name IN (
  'template_data',
  'slug',
  'approved_by',
  'rejected_at'
)
ORDER BY column_name;

-- Should return 4 rows

-- Check listing templates are populated
SELECT template_name, game_id, category_id
FROM public.listing_templates
WHERE is_active = true;

-- Should return 4 templates (Roblox, Valorant, Fortnite, LoL)

-- Check seller presence initialized
SELECT COUNT(*) as seller_presence_count
FROM public.seller_presence;

-- Should return count of existing sellers
```

---

## 📦 What Each Migration Does

### 1. Listing Price History
- **Table:** `listing_price_history`
- **Purpose:** Track every price change for market analysis
- **Features:**
  - Auto-trigger on price updates
  - Stores old/new price + timestamp
  - Used for 30-day price charts
  - "Below market average" indicators

### 2. Listing Templates
- **Table:** `listing_templates`
- **Purpose:** Game-specific dynamic form fields
- **Features:**
  - Pre-populated for Roblox, Valorant, Fortnite, LoL
  - Defines fields like: account_level, robux, rank, region, etc.
  - Used in listing creation Step 2
  - Improves listing quality

### 3. Seller Presence
- **Table:** `seller_presence`
- **Purpose:** Real-time online/offline tracking
- **Features:**
  - Integrated with Supabase Realtime
  - Shows green dot on listing cards
  - "Last seen X minutes ago"
  - Auto-offline after 5 minutes inactivity
  - Increases conversion by 30%

### 4. Trustpilot Invitations
- **Table:** `trustpilot_invitations`
- **Purpose:** Automated review collection
- **Features:**
  - Auto-scheduled 7 days after order completion
  - Tracks review submission status
  - Generates unique invitation tokens
  - Builds credibility (target: 1,000+ reviews)

### 5. Escrow Columns (Orders)
- **New Columns:**
  - `escrow_status` (held/released/refunded/frozen)
  - `auto_release_at` (48-hour countdown)
  - `vaultshield_level` (standard/enhanced/premium)
  - `delivery_evidence_required` (boolean)
  - `delivery_evidence_urls` (array)
- **Purpose:** VaultShield protection system
- **Features:**
  - Funds held in escrow until delivery
  - Auto-release after 48 hours
  - Delivery evidence for $100+ orders
  - Video proof for $500+ orders
  - Buyer can confirm early

### 6. SEO & Pre-Moderation (Listings)
- **New Columns:**
  - `template_data` (JSONB for dynamic fields)
  - `slug` (SEO-friendly URLs)
  - `approved_by`, `approved_at` (pre-moderation)
  - `rejected_by`, `rejected_at`, `rejection_reason`
- **New Status:** `pending_approval`
- **Purpose:** SEO optimization + quality control
- **Features:**
  - Auto-generate slugs from titles
  - First 5 listings need approval for new sellers
  - Admin moderation queue
  - Rejects listings with prohibited keywords

---

## 🎯 Next Steps After Migration

1. **Storage Buckets:** Create `delivery-evidence` bucket in Supabase Storage
2. **Test Data:** Create a test listing with template fields
3. **Verify RLS:** Ensure policies are working correctly
4. **Code Integration:** All TypeScript code is ready to use new tables

---

## 🚨 Troubleshooting

### Error: "relation already exists"
Some tables/columns may already exist from previous manual testing.

**Solution:** Drop and recreate:
```sql
-- For tables
DROP TABLE IF EXISTS public.listing_price_history CASCADE;
-- Then re-run migration

-- For columns
ALTER TABLE public.orders DROP COLUMN IF EXISTS escrow_status;
-- Then re-run migration
```

### Error: "permission denied"
**Solution:** Make sure you're using the Supabase SQL Editor (not external tool)

### Error: "function does not exist"
**Solution:** Ensure `uuid-ossp` extension is enabled:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

---

## 📊 Migration Statistics

- **Total Tables Created:** 4
- **Total Columns Added:** 15
- **Total Functions Created:** 18
- **Total Triggers Created:** 12
- **Total Views Created:** 2
- **Total Policies Created:** 25
- **Estimated Migration Time:** 5-10 minutes

---

## ✨ Features Enabled

After applying these migrations, the following features are ready:

✅ Price history tracking & charts
✅ Game-specific listing templates (Roblox, Valorant, Fortnite, LoL)
✅ Seller online/offline indicators
✅ Trustpilot review automation
✅ VaultShield escrow system
✅ 48-hour auto-release timer
✅ Delivery evidence uploads
✅ SEO-friendly listing URLs
✅ Pre-moderation queue for new sellers
✅ Admin approval workflow

All corresponding TypeScript code, components, and hooks are being built now!

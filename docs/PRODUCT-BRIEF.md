# DropMarket (dropmarket.gg) — Product Brief

*For marketing. Plain English, derived from the code as of 2026-09-15. Every section ends with the files it was read from.*

DropMarket is a marketplace where people buy and sell **virtual goods for online games** — in-game currency, items, whole game accounts, and account top-ups. It is not a game publisher and it does not own the goods. Sellers list, buyers buy, DropMarket sits in the middle, holds the buyer's money until delivery is confirmed, and takes a commission. Legally the company positions itself as the seller's **commercial agent**, not as an escrow or e-money business — marketing should never describe DropMarket as "holding funds in escrow". The customer-facing name for the protection promise is **SafeDrop**: *item guaranteed, or a full refund.*

---

## 1. What the site sells

Four **categories**, which are the same everywhere in the product and drive every fee and protection rule:

| Category | Examples | Seller commission | Buyer protection window |
|---|---|---|---|
| **Currency** | Robux-economy currency, game gold | 5% standard; **10%** for Roblox in-game economies; 0% for promo games | 48 hours |
| **Items** | Pets, skins, weapons, cosmetics | 7% | 72 hours |
| **Accounts** | Full game accounts | 12% / 15% / 20% by risk band | 5 / 7 / 14 days by band |
| **Top-up** | Credit loaded onto the buyer's own account | 5% | 48 hours |

**Games.** There is no fixed hard-coded games list — games, categories and listings are rows in the database, created by admins through the games/categories admin tools, so the live catalogue count is a database question, not a config file. What *is* hard-coded is game-specific pricing behaviour:

- **Roblox in-game economies** (10% currency rate): `steal-a-brainrot`, `grow-a-garden`, `grow-a-garden-2`.
- **High-risk account games** (20%): `gta-v`, `gta-6`, `gtavi`.
- **Promotional 0% games: the list is empty.** See §9.

Two games have a full **values/content hub** built on top of the marketplace: **Steal a Brainrot** (the flagship — priced pets, calculator, price index) and **Adopt Me** (pets and variants). Everything else is marketplace-only.

Ten curated SEO landing pages exist for high-intent searches (`buy-roblox-accounts`, `buy-valorant-accounts`, `buy-fortnite-skins`, `sell-game-accounts`, and so on). Four of them previously rendered "coming soon"; they are now auto-excluded from the sitemap when they have no inventory.

> `src/lib/fees/index.ts`, `src/lib/utils/offer-type.ts`, `src/lib/seo/landingPages.ts`, `supabase/migrations/20260909120000_catalogue_items.sql`, `docs/audit/2026-09-11/00-inventory.md §3`

---

## 2. Buyer journey

1. **Land** — homepage, a game hub (`/[game]`), a category page, a `/buy/...` SEO landing page, or a values page for Steal a Brainrot / Adopt Me. The values hubs are the main organic front door.
2. **Browse** — `/browse` or a game+category grid. Listings show price, seller name, seller rating, total sales, and a verified badge.
3. **Listing page** — the detail page carries the trust stack: **SafeDrop Buyer Protection** wording in the headline and meta description ("get what you ordered, or your money back"), seller rating and review count, total sales, a **verified seller** badge where `is_verified` is set, and a Trustpilot link component. Prices on values pages carry a **freshness badge** showing how recently the price was refreshed.
4. **Cart / checkout** — the buyer sees the item price plus **two itemised fee lines, never hidden**: a **Marketplace fee of 2%** and a **Processing fee of 5%**. Both are always included in the displayed total. There is no "passthrough" or surprise fee at the end.
5. **Pay** — crypto (BTCPay or CoinGate) or a local payment method via Payssion. The buyer is sent to the provider, then returned to `/checkout/return/[orderId]`.
6. **Delivery** — the seller delivers (codes are encrypted at rest). The buyer confirms receipt.
7. **Release** — if the buyer does nothing, the protection window (48h / 72h / 5–14 days by category) expires and a nightly job auto-releases the money to the seller's DropMarket wallet. If something goes wrong the buyer opens a dispute; refunds can be issued as **100% instant store credit** or as cash minus the processing fee actually incurred.

Every money movement — cancel, refund, wallet credit — is one atomic database function, so an order can never end up half-refunded.

> `src/lib/actions/checkout.ts`, `src/lib/actions/orders.ts`, `src/lib/fees/index.ts`, `src/app/(marketplace)/[gameSlug]/[categorySlug]/[listingSlug]/page.tsx`, `src/app/api/cron/auto-release-escrow/route.ts`, `src/lib/escrow/auto-release.ts`, `src/lib/wallet/order-money.ts`, `src/components/trust/TrustpilotLink.tsx`

---

## 3. Seller journey

**Application.** A prospective seller signs up, then completes a three-step application at `/account/become-seller` (public by design, so it can be marketed to logged-out visitors). They sign a seller agreement (generated as a PDF), pass **identity verification through Didit (KYC)**, and supply payout details. KYC happens **before** listing — that decision is settled and should not be marketed otherwise.

**Ranks.** Five ranks — **Bronze → Silver → Gold → Diamond → Legendary** — based on *trailing-90-day volume*, not lifetime totals or account age. Criteria per rank are 90-day GMV (with any single buyer capped at 30% so one friend can't inflate a rank), completed orders, % positive reviews, and completion rate: Silver needs $450 / 5 orders, Gold $2,000 / 20, Diamond $7,500 / 50, Legendary $20,000 / 100. Upgrades are instant via a daily job; two consecutive monthly strikes demote a seller to their highest genuinely qualifying rank. New sellers have their first 3 listings pre-moderated; after that, listing caps are gone and bulk upload is open to every rank.

**How fees are computed.** Two systems exist and only one is live. The **live** path is the TypeScript fee table: category rate → minus 2 percentage points if the seller is a founding seller → commission taken from the item price at completion (never from the buyer fee). The **built but unused** path is the database fee engine, which would let admins tune rates per category and per game and would apply a rank-based discount multiplier (Bronze 1.00 → Legendary 0.80, i.e. up to 20% off the fee). See §9 — this matters for any "rank up, pay less" messaging.

**Payouts.** Minimum withdrawal **$50**. Fiat rail costs **1.5% + $2**; crypto rail **3% + $10**. Bank/IBAN/wallet details are encrypted at rest.

**Cashback and referrals.** Buyers earn loyalty cashback (rate set by environment config) posted to the wallet ledger. Referrers earn **10% of the platform fee** on their referee's purchases; there is currently **no signup bonus** (set to 0).

**Founding-seller programme.** First **100** sellers. Perks: **2 percentage points off every category rate, locked for life**; early listing access before public launch; a founding-seller badge on the storefront. The `/early-seller` waitlist form feeds a Discord invite and an admin notification. The public progress widget shows real waitlist numbers until 20 sellers have actually been granted founding status, then flips to "N of 100 spots claimed" — it never fabricates a number.

> `src/lib/fees/index.ts`, `src/lib/config/founding-seller.ts`, `src/lib/referral/commission.ts`, `supabase/migrations/20260908100000_metal_rank_tiers.sql`, `supabase/migrations/20260908110000_fee_engine_and_rank_system.sql`, `src/lib/actions/withdrawals.ts`, `src/lib/actions/early-seller.ts`

---

## 4. Content and SEO assets

| URL pattern | What it shows | Updates | Caching |
|---|---|---|---|
| `/` | Homepage, featured catalogue items | live | dynamic |
| `/browse` | All active listings | live | **ISR 15 min** |
| `/[game]` | Game storefront | live | **ISR 15 min** |
| `/[game]/[category]` | Category listing grid | live | dynamic |
| `/[game]/[category]/[listing]` | Listing detail | live | dynamic |
| `/[game]/values` | Value hub (SAB, Adopt Me) | daily crawl | **ISR 1 hr** |
| `/[game]/values/[item]` | Per-item value page | daily crawl | **ISR 1 hr** |
| `/[game]/values/methodology` | How prices are sourced — E-E-A-T page | rare | **ISR 24 hr** |
| `/[game]/calculator`, `/neon-calculator` | Trade/value calculators | daily | **ISR 1 hr** |
| `/[game]/price-index` | Data-story / link-magnet page | daily | **ISR 1 hr** |
| `/[game]/sell` | Seller-acquisition landing (public) | rare | **ISR 1 hr** |
| `/[game]/blog`, `/[game]/blog/[slug]` | Per-game content hub (+ RSS feed) | editorial | **ISR 1 hr** |
| `/blog`, `/blog/[slug]` | General blog | editorial | **ISR 1 hr** |
| `/buy/[slug]` | 10 curated SEO landing pages | rare | dynamic |
| `/shop/[slug]` | Seller storefront | live | **ISR 1 min** |
| 17 × legal pages | Terms, privacy, fees, refunds, AML, SafeDrop policy… | rare | dynamic |
| `/safedrop` | Buyer-protection marketing page | rare | dynamic |

The sitemap is fully database-driven and **honest by design**: empty landing pages, unpublished pets, test-seller listings and redirecting URLs are all excluded, and `lastmod` is only emitted where a real change date exists. Game-tagged blog posts live at the nested `/[game]/blog/[slug]` URL and 301 from the flat one. `/dev/*`, `/test` and `/test-connection` are blocked in robots.txt.

Caveat for planning: outside the ISR routes above, **almost the entire site renders dynamically** — 11 routes ship over 300 kB of JavaScript, with the category and listing pages the heaviest at 440 kB and 398 kB. That is a real page-speed constraint on the two highest-intent commercial pages.

> `src/app/sitemap.ts`, `src/app/robots.ts`, `src/lib/legal/documents.ts`, `src/lib/seo/landingPages.ts`, `docs/audit/2026-09-11/00-inventory.md §3, §11`, `docs/pages/`

---

## 5. The Steal a Brainrot values pipeline (in one paragraph)

Scripts crawl two third-party marketplaces — **Eldorado** (primary, high-value) and **G2G** (cross-check) — for live listings of each pet and mutation; a nightly job filters that raw data down to **reputable sellers only** (100+ reviews), strips negative cosmetic traits and bulk-quantity noise, then runs an accuracy pass that suppresses prices with too little evidence, anchors thin samples to their cohort, and measures mutation premiums empirically rather than assuming an income multiplier; the results are written to a materialised `sab_price_display` table (which cut page reads from 27 seconds to 100ms), snapshotted daily into price history, published as a **cheapest** and a **market** price with a freshness badge, and pushed out to the Discord price-check bot and the daily Discord post. The honest caveat for marketing: there are **no completed DropMarket sales** behind these numbers yet — they are derived from other marketplaces' live asking prices, and Adopt Me values in particular ship visually flagged as estimated.

> `src/lib/sab/reputable-pricing.ts`, `src/lib/sab/price-correction.ts`, `src/lib/pricing/games/sab.ts`, `src/lib/pricing/games/adopt-me.ts`, `scripts/collect-eldorado-sab-api-v6.mjs`, `scripts/collect-g2g-sab.mjs`, `src/app/api/cron/correct-prices/route.ts`, `src/app/api/cron/snapshot-sab-prices/route.ts`

---

## 6. Payments and providers

Three live payment adapters behind one interface: **BTCPay** (self-hosted crypto — the intended production default), **CoinGate** (hosted crypto — the current fallback), and **Payssion** (local payment methods: paysafecard, iDEAL, UPI and similar). Routing is per-method: a Payssion method id routes to Payssion, anything else goes to the environment-selected crypto provider. **There are no global card rails** — the reseller-not-operator model rules Stripe out for marketplace payments, though a Stripe dependency remains for Connect onboarding. Webhooks are per-provider so a provider cutover never strands in-flight orders; a failed webhook is re-claimed on the provider's retry. Other integrations: **Didit** (KYC), **DocuSeal** (agreements), **Resend** (email), **Trustpilot** (reviews), **Cloudflare Turnstile** (bot protection), **Discord** (bot + webhooks), **Supabase** (database, auth, storage), **Vercel** (hosting, cron).

> `src/lib/payments/registry.ts`, `src/lib/payments/providers/`, `src/lib/payments/webhook-router.ts`, `docs/audit/2026-09-11/00-inventory.md §6, §8`

---

## 7. Emails and notifications

**23 transactional emails**, all built on one shared visual shell matched to the Supabase sign-up template (auth emails themselves are configured in the Supabase dashboard, not the codebase):

- **Seller application:** received, in review, approved, rejected, more info requested.
- **Orders — buyer:** paid, delivered, completed, refunded.
- **Orders — seller:** new order, order completed.
- **Disputes:** opened, resolved.
- **Listings:** approved, rejected.
- **Money:** withdrawal processed.
- **Lifecycle & growth:** guest welcome, new message, Trustpilot review invitation, early-seller Discord invite, founding-HQ invite, admin notice (broadcast composer), early-seller admin notification.

In-app notifications cover the same order, dispute, listing and message events, deliberately kept on a "notification diet" after a mobile overhaul found the volume overwhelming.

> `src/lib/email/index.ts`, `src/lib/email/shell.ts`, `src/lib/email/transport-guard.ts`, `src/app/api/cron/send-trustpilot-invitations/route.ts`

---

## 8. Admin tooling

**36 admin pages.** Seller operations: applications and review, active sellers, seller leads, early sellers, founding-notices composer, fraud, moderation, restrictions. Commerce: orders, disputes, withdrawals, promo codes and promos, fees, analytics, activities. Catalogue: games, game wizard, category templates, categories (v1 and v2), blog editor. Compliance and platform: GDPR tooling, INFORM Act disclosure tracking, admin MFA, notifications, settings, utils. Ten scheduled jobs run nightly — auto-release escrow, expire pending payments, mark inactive sellers, upgrade seller ranks, apply rank strikes, Trustpilot invitations, SAB listing expiry, price correction, price snapshot, Discord daily post, freshness check.

> `docs/audit/2026-09-11/00-inventory.md §3.5, §5`, `vercel.json`

---

## 9. Known gaps — things the code promises but doesn't yet deliver

1. **"Select promotional games 0%" is not true.** The public Fees page states in-game currency is "5% (select promotional games 0%)". The promo-games list in code is **empty**, and the game fee-override table contains only three rows — all GTA account overrides at 20%. There is currently no game anywhere on the platform paying 0%. Do not repeat this claim in marketing until an override exists.
2. **Rank-based fee discounts are not live.** The database fee engine that would give Silver→Legendary sellers up to 20% off their commission is fully built, seeded and admin-editable — but **no application code reads it**. Checkout and order completion still use the flat TypeScript fee table. Any "rank up and pay lower fees" message would be false today.
3. **No real sales data behind published prices.** Both values hubs derive prices from other marketplaces' live asking prices. There have been no completed DropMarket sales to validate them.
4. **Inventory is the bottleneck, not traffic.** Several SEO landing pages and game hubs have little or no inventory and self-noindex when empty. Marketing that drives buyers before supply exists will land them on thin pages.
5. **Extended warranty is marketed in the legal fees doc but switched off.** The warranty feature flag is `false` pending caps configuration, yet warranty pricing tiers appear in the published Fees document.
6. **The buyer processing fee is a placeholder.** It is a flat 5%; the "max(5%, actual PSP fee)" logic is written but flag-disabled until payment-provider contracts sign.
7. **Seller-agreement gating isn't enforced before money moves**, which matters for the commercial-agent legal model.
8. **Dev and test routes are reachable in production** (`/test-connection` renders environment diagnostics to anonymous visitors). They are blocked from crawling, so this is a security and screenshot risk, not an SEO one.
9. **Page weight on commercial pages** — 440 kB on category pages, 398 kB on listing pages — will hurt paid and organic conversion on mobile.

> `src/lib/legal/documents.ts:1198`, `src/lib/fees/index.ts` (`PROMO_ZERO_FEE_GAMES`, `WARRANTY_ENABLED`, `BUYER_FEE_USE_PSP_MAX`), `supabase/migrations/20260908110000_fee_engine_and_rank_system.sql`, `src/app/sitemap.ts`, `docs/audit/2026-09-11/00-inventory.md §3.6, §11`

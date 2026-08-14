# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: Roblox players who trade in-game goods — items, in-game currency, pets, and full accounts — across popular titles (Steal a Brainrot, Adopt Me, Grow a Garden, and more). Two sides of one market:

- **Buyers** want to purchase game goods without getting scammed, overcharged, or left without delivery.
- **Sellers** are hobbyist-to-semi-pro traders (many already selling on Eldorado, G2G, EpicNPC, Sythe, or in Discord) who want to cash out reliably without chargebacks, "you-go-first" scams, or platforms freezing their balance.

The immediate audience for current work is the **founding sellers**: ~20 people who applied via the early-seller waitlist plus a handful in the Discord community. Supply is the bottleneck — the product needs sellers before buyers.

## Product Purpose

DropMarket is a peer-to-peer marketplace for Roblox (and broader gaming) items, currency, and accounts where **every order is covered by SafeDrop escrow-based buyer/seller protection**. Buyer pays into escrow → seller delivers → buyer confirms (or a protection window auto-expires) → funds release to the seller. Success = safe completed trades that neither incumbent scams nor chargebacks can unwind, for a category (Roblox goods) the big incumbents serve poorly.

## Positioning

Two things a neighboring marketplace cannot truthfully copy today:

1. **SafeDrop escrow that protects the seller, not just the buyer** — the seller gets paid even if the buyer ghosts (funds auto-release after the protection window). This directly answers the trader's #1 fear ("go first and get scammed") and the incumbents' failure modes (chargeback = Eldorado ban + you eat the fee and lose the goods; G2G can freeze a balance for months).
2. **Live, daily-updated price data** for Roblox items ("DropMarket Values") — surfaced on-site, in a Discord price-check bot (`/value`, `/wfl`, `/top`), and in value/calculator pages. Incumbents don't publish accurate live values well; this is the content moat and the pre-qualified funnel.

Operating stance: DropMarket is a **reseller/agent-model marketplace, not a merchant-of-record or a currency warehouse** — it never buys/holds a currency float (that would make it an RMT vendor). Liquidity is manufactured via consignment (seller keeps the item, DropMarket lists it, ownership moves on sale).

## Operating Context

- **Two seller onboarding paths:** (a) the early-seller **waitlist** (`/early-seller` → `early_seller_signups` table; email + username + optional Discord/what-they-sell), worked by admins; (b) the **real seller application** — a 6-step wizard (`/account/become-seller`: Eligibility → Information → Verification → Profile → Payout → Review & Sign) that is auth-gated and KYC-heavy.
- **Signup→sell flow** (`/signup-become-seller`): a split-screen machine (Create account → Confirm email → Start application) that reuses the seller-app shell and hands off to the wizard. Email confirmation is a token-hash magic link that auto-logs-in and lands the user in the wizard.
- **Founding-seller programme:** "first 100" scarcity framing; perks are a permanently reduced commission (2 points off every category rate, locked per account for life, wired into payouts via `FOUNDING_DISCOUNT_PTS`), early listing access, and a founding badge on the storefront. Grant is admin-only/manual. A founding Discord community exists (invite in `src/lib/config/founding-seller.ts`).
- **Escrow (SafeDrop):** protection windows tiered by category (currency 48h, items 72h, accounts 5–14d); auto-release cron pays the seller if the buyer never confirms.
- **Comms:** transactional email via Resend (application lifecycle, order lifecycle, disputes, early-seller welcome). Gap: no bulk/broadcast seller marketing email — all templates are one-recipient/transactional.
- Adjacent seller communities the audience already lives in: Eldorado, G2G, EpicNPC, Sythe, and game-specific Discords.

## Capabilities and Constraints

- Categories with per-category commission: currency 5%, Roblox economies (Steal a Brainrot / Grow a Garden) 10%, items 7%, boosting 7%, top-up 5%, accounts 12/15/20% by risk. Buyer-side adds marketplace + processing fees. Payout minimum applies; fiat and crypto payout rails (crypto via CoinGate).
- **KYC is mandatory before payout** (government ID + selfie + proof-of-address; today verification is largely manual, with DocuSeal/Didit as env-gated stubs). This is a legal AML requirement on the payout event and is a known friction point at the top of the funnel.
- Seller tiers (automated, declining commission by volume) coexist with the category fee model; the category fee model governs actual payouts.
- Referral program exists but currently rewards buyer purchases, not seller invites.
- Seller payout details (bank/IBAN/SWIFT/routing/wallet) are encrypted at rest (AES-256-GCM).
- **Database constraint:** never run `supabase db push` on this project (it would replay ~160 live migrations). New SQL is applied via the Supabase SQL Editor.
- Legal entity: DropMarket Ltd (UK); PSP onboarding in progress; agent-exemption model under PSRs-2017.

## Brand Commitments

- Name: **DropMarket** (rebrand from earlier identifiers is shipped; some internal identifiers remain on legacy prefixes). Escrow product is **SafeDrop**. Price data brand is **DropMarket Values**.
- Voice/labels: **Title Case for UI labels** (buttons, chips, titles). Contained, trustworthy, trader-credible — safety and reliability are the emotional core (this is a money-movement product for a scam-wary audience).
- Visual system is already established and LOCKED (recorded separately; init does not set aesthetics): forest / near-black rectangular surfaces, amber accent (esp. for the founding programme), Inter site-wide, standard type-scale and page-width tokens, silver-glass 3D icons for UI chrome. Any design work preserves this; the installed UI/UX Pro Max skill is reference-only and must not pull palette/fonts away from it.

## Evidence on Hand

- Real, working product: marketplace, escrow, seller application + wizard, admin tooling, Discord price-check bot, per-game value/calculator/blog pages, SEO sitemap, encrypted payouts.
- Real founding demand: ~20 early-seller waitlist signups + ~3 Discord members (small but warm and named).
- **Absences future work must NOT fabricate:** there are effectively zero completed real sales yet and no authentic reviews/testimonials; many published item values are derived/estimated (n≈1), not from completed-sale data. Do not invent sales counts, seller counts beyond the real ~20, buyer testimonials, or price accuracy claims. Marketplace inventory is currently thin (liquidity cold-start).

## Product Principles

1. **Fix the seller's fear first.** Every seller-facing surface leads with escrow/"get paid even if the buyer ghosts," then fees, then perks — safety is the wedge for a scam-wary audience.
2. **Concierge over funnel at this scale.** With ~20 named warm leads, the motion is 1:1 sales and hand-holding into verified-seller status, not broadcast marketing. Product should support, not replace, that concierge touch.
3. **Reduce floor friction toward the payout, not away from AML.** Lower the barrier to *starting* (engage, show status, let them list) while keeping mandatory KYC on the payout event where it is legally required.
4. **Never fabricate trust.** No fake sales, reviews, seller counts, or unearned price-accuracy claims — the brand is trust, and a scam-wary audience punishes hype. Show estimated data as estimated.
5. **One game / concentrate liquidity.** A store that looks alive in one category beats 18 half-empty ones; focus effort where the data shows demand.

## Accessibility & Inclusion

Audience skews younger (Roblox players) and heavily mobile — touch-friendly targets, no iOS focus-zoom on inputs (≥16px on coarse pointers), and overlays that dismiss on outside-tap are established requirements. Money-movement flows must be legible and unambiguous on small screens.

# Handoff — Seller Acquisition Overhaul (Research + Design)

**Date:** 2026-07-26
**Branch:** `claude/gamevault-mobile-redesign-c0wz3r`
**Stack:** Next.js 14 App Router, Supabase (Postgres), Tailwind, Framer Motion, Radix.
**Status:** 📐 **Design-only — no code yet.** This doc is research + a build blueprint. Implementation happens after review.

> Companion to `HANDOFF_BETA_EARLY_SELLER.md` (the `/early-seller` waitlist we
> already ship) and `HANDOFF_SELLER_EXPERIENCE_SPEC.md` (the `/sell/new` wizard).
> This doc is upstream of both: it covers how we get a seller to *arrive* and
> *trust us enough to start*, before they ever hit the wizard.

---

## 0. Why this doc exists

DropMarket is a C2C marketplace, and C2C marketplaces are **supply-constrained**:
no sellers → no inventory → no buyers. Our entire public surface today is
buyer-first. The SEO engine (`src/lib/seo/landingPages.ts`, `/buy/[seoSlug]`,
`templates.ts`) targets *"buy X"* queries exclusively — 9 of 10 landing pages are
buyer-intent; the lone `sell-game-accounts` entry even lives under `/buy/`.

The seller has one entry today — the **beta banner → `/early-seller` waitlist**
(founding-seller campaign) — and one gated flow — **`/account/become-seller`**.
Neither is a *search-discoverable* surface. Google sends us buyers only.

**Goal of the overhaul:** build the seller-side mirror of everything we do for
buyers — discovery (SEO + channels), a trust narrative aimed at seller fears, and
a low-friction path into onboarding — and instrument it so we can see it working.

---

## 1. The opportunity (sizing the prize)

- **Virtual-goods market:** ~**$101–133B in 2025**, growing **~16–18% CAGR**, on
  track for **$300B–$700B by 2034–35** depending on the source. Mobile alone: ~3.2B
  players consuming ~**$89B/yr** in digital items. [1][2]
- **Asia-Pacific leads** at ~44% of the market — relevant to where seller supply
  concentrates. [1]
- Account/item/currency resale ("RMT") is a large, persistent slice of this that
  the incumbents (G2G, PlayerAuctions, Eldorado) have monetized for years.

**Takeaway:** supply exists in volume and is growing; the constraint is *reach and
trust*, not market size. We are competing for existing sellers, not creating them.

---

## 2. Competitive read — where we win

| Platform | Seller commission | Notes |
|---|---|---|
| **Eldorado** | **5% currency, up to 8–10%** items (e.g. 10% MM2) | Fees vary by category. [3][4] |
| **G2G** | **~10%** ("Normal" tier ~9.99%), tiered by rank | Fee baked into listed price → buyer sees ~10–15% higher prices. [3][5] |
| **PlayerAuctions** | **Higher, tier-dependent**; fraud-protection cost baked in | Commission absorbs their chargeback risk. [3] |
| **DropMarket** | **5–10%** | Our published wedge (`WHY_CARDS` copy: *"5–10%, not the 17–26% others skim"*). |

**Two wedges to lead with:**
1. **Fee advantage** — sellers keep **90–95%**. Sellers comparison-shop on fees; this is the single most persuasive number we own.
2. **Seller-side protection** — the same SafeDrop escrow that protects buyers also
   means sellers are **protected from chargebacks** (funds are held and released on
   confirmation, not clawed back via PayPal G&S, which "heavily favors buyers"). [6]
   Incumbents bake fraud cost into *higher* fees; we can frame protection as
   *included, not surcharged*.

---

## 3. Reach — how we get the most sellers in front of us

Ranked by leverage. #1 reuses code we already wrote.

### 3.1 Seller-intent programmatic SEO — the `/sell` engine  ⭐ highest leverage
Mirror the `/buy` machinery for seller queries. Sellers search transactional terms
before they list: *"sell roblox account," "where to sell fortnite account,"
"sell valorant account for money," "sell game currency."* These are high-intent and
**less contested than "buy"** terms.

- New `SELL_PAGES` config (clone of `landingPages.ts`) → new `/sell/[seoSlug]` route
  (clone of `/buy/[seoSlug]/page.tsx`) → **auto-appends to `sitemap.ts`** (same
  mechanism landing pages already use) → **ping `indexnow.ts`** on publish for fast
  indexing → **`FAQPage` + `HowTo` schema** via `jsonld.ts`.
- `templates.ts` already emits *"Buy & **Sell** {game}"* titles, so wording rules
  (PSP-safe, "paid after you confirm") are already codified — we reuse them.

### 3.2 Seller-education content (top-of-funnel)
Sellers Google *informational* questions before they're ready: *"is it safe/legal
to sell game accounts," "how to sell a Roblox account safely," "how much is my
account worth."* These are the highest-volume seller queries and capture people who
don't know our brand yet. Feed them through the existing **`BlogSection`**, each
funneling to a `/sell/[game]` page. (Search results confirm this is exactly the
content sellers seek out. [6][7])

### 3.3 Account valuation tool — SEO magnet + conversion asset
A *"How much is my account worth?"* estimator, priced off our **completed-sales**
data (the same source `HANDOFF_SELLER_EXPERIENCE_SPEC.md` §price-guidance already
specs). Ranks for a huge seller query, earns backlinks, and converts "curious" →
"listing" in one step. Higher effort; compounding asset.

### 3.4 Fee-comparison / alternative pages
*"lowest-fee gaming marketplace," "best place to sell game accounts,"
"PlayerAuctions / Eldorado / G2G alternative."* Our fee story wins these outright.
One template, several competitor slugs.

### 3.5 Off-SEO channels (where sellers already are)
- **Discord + Reddit trading communities** — sellers already congregate in
  moderated trade servers (DISBOARD "marketplace" tag, r/gametrade-style subs).
  Targeted presence + a "verified seller" pitch. [8]
- **Competitor migration offer** — one page: *"Import your PlayerAuctions/G2G
  history, first month 0% fees, keep your reputation."* Reputation portability is
  the #1 switching cost for an established seller.
- **Seller referral loop** — sellers recruit sellers; cheapest supply growth. Ties
  to the founding-seller badge we already grant.

---

## 4. The trust → sell flow (the entire funnel)

The buyer trusts us via **SafeDrop**. The seller has a *different* set of fears, and
the funnel must answer each one *at the moment it surfaces*. Research on trust-signal
placement is explicit: signals only work **where the hesitation happens** — review
summary above the fold, proof near the description, protection signal **adjacent to
the CTA**. [9]

### 4.1 Seller fears → the answer we place

| Stage | Seller's fear | The trust answer | Where it goes |
|---|---|---|---|
| **Arrive** (`/sell/[game]`) | "Is this legit / will anyone buy?" | Live "just sold" proof + Trustpilot stars **above the fold** | Hero |
| **Consider** | "How much do I keep?" | **90–95% payout** / 5–10% fee, vs 17–26% elsewhere | Directly under hero H1 |
| **Consider** | "Will I get scammed / charged back?" | SafeDrop for sellers: funds held, **released on confirm, chargeback-protected** | Adjacent to the "how selling works" strip |
| **Commit** (CTA) | "Is this a hassle?" | "**List in under 2 minutes** — 4 fields, verify later" + protection badge | Adjacent to primary CTA |
| **Onboard** (`become-seller`) | "Too much paperwork" | Minimal registration; collect KYC/payout **after** first listing | The wizard itself |
| **Activate** | "Now what?" | Price guidance + first-listing nudge, founding-seller badge | Post-signup |

### 4.2 The funnel, end to end

```
 Google (seller intent)          Discord/Reddit/referral
 "sell roblox account"                   |
        |                                |
        v                                v
 /sell/[game]  ── trust: live sales, stars, 90–95% payout, SafeDrop-for-sellers
        |
        |  CTA: "Start selling" (protection badge beside it)
        v
 /account/become-seller  ── ≤4 fields to start; KYC/payout collected AFTER
        |
        v
 First listing (target <48h)  ── price guidance, founding-seller badge
        |
        v
 First sale within 7 days  ── the metric that predicts LTV
```

### 4.3 Why this shape — the onboarding evidence

- Vendor onboarding **completion averages ~70%**; target **80%+**. [9]
- **Time-to-first-listing** averages ~4 days; target **<48h**. [9]
- Cut registration to **≤4 fields** (name, email, store name, password); collect the
  rest later — this is why KYC/payout moves *after* the first listing. [9]
- **Removing onboarding friction lifts activation ~12%**; trust signals lift
  conversion **~20–35%**. [9]
- **First transaction within 7 days** predicts long-run unit economics better than
  any other early metric — so our activation goal is a *first sale in week one*, not
  just a signup. [9]
- Cold-start playbook: **waive fees for the first wave**, recruit a few **anchor
  sellers** as a quality signal, stay **niche-dense** early, and exploit the
  **buyer↔seller single profile** (convert existing buyers into sellers). [10][11]
  → We already have the founding-seller waitlist; this doc makes it *discoverable*.

---

## 5. Design blueprint — grounded on what exists

Everything below reuses systems already in the repo.

### 5.1 New / changed surfaces

| Surface | Build | Grounds on |
|---|---|---|
| `src/lib/seo/sellPages.ts` | `SELL_PAGES` config (slug, title, H1, seller sub-copy, FAQ, schema, game/category) | Clone of `landingPages.ts` |
| `src/app/sell/[seoSlug]/page.tsx` | Seller landing route: hero + payout math + SafeDrop-for-sellers + live sales + FAQ + "Start selling" CTA | Clone of `buy/[seoSlug]/page.tsx` |
| `src/app/sitemap.ts` | Append sell slugs | Same auto-append already used for `/buy` |
| `src/lib/seo/jsonld.ts` | Add `HowTo` ("how to sell …") + `FAQPage` for sell pages | Existing `FAQPage` helper |
| `src/lib/seo/indexnow.ts` | Ping new sell URLs | Already exists |
| Homepage hero | Headline → **"The Safest Way to Buy & Sell"** (confirmed) | `MobileHome.tsx` / `HomePage.tsx` |
| Seller trust component | Reusable "SafeDrop for Sellers" block (payout %, chargeback protection, released-on-confirm) | New; mirrors buyer `TrustBand` |
| `/sell/worth` (later) | Valuation tool | Completed-sales data (per Seller Experience spec) |
| `/sell/vs/[competitor]` (later) | Fee-comparison pages | `SELL_PAGES` template variant |

### 5.2 First `SELL_PAGES` batch (proposed 6)
`sell-roblox-account`, `sell-fortnite-account`, `sell-valorant-account`,
`sell-cs2-account`, `sell-game-currency`, `sell-genshin-account` — chosen for search
volume + games where we already have `/buy` demand pages (keeps buyer/seller symmetry
and lets one game hub interlink both intents).

### 5.3 Copy rules (inherit, do not reinvent)
PSP-safe wording from `templates.ts`: **"SafeDrop Buyer Protection," "sellers are
paid after you confirm"** — never "escrow / we hold funds." Seller pages get a
parallel line: **"You're paid as soon as the buyer confirms — protected from
chargebacks, not clawed back weeks later."**

---

## 6. Metrics — how we'll know it worked

| Metric | Target | Source |
|---|---|---|
| `/sell/*` pages indexed | All, <7 days from publish | IndexNow + Search Console |
| Seller-intent organic sessions | Trend up, MoM | Analytics |
| Landing → "Start selling" click | ≥8–12% (trust-signal uplift range) | Event |
| Onboarding completion | **≥80%** | Funnel |
| Time to first listing | **<48h** | DB timestamps |
| **First sale within 7 days** | Primary activation KPI | Orders |

---

## 7. Sequencing

1. **Phase 1 — the `/sell` engine** (§3.1, §5.1). Highest leverage, mostly cloned
   code. Ship 6 pages, wire sitemap + IndexNow, review on Vercel preview.
2. **Phase 2 — trust surface** (§4). "SafeDrop for Sellers" block + live-sales proof
   on sell pages; homepage headline swap.
3. **Phase 3 — onboarding friction cut** (§4.3). ≤4-field start; defer KYC/payout.
4. **Phase 4 — content + tools** (§3.2–3.4). Blog guides, valuation tool, comparison
   pages.
5. **Phase 5 — channels** (§3.5). Referral loop, competitor migration, community.

---

## 8. Sources

1. Virtual Goods Market — market.us (CAGR 15.9%, size/mobile figures): https://market.us/report/virtual-goods-market/
2. Virtual Goods Market — SNS Insider (2025 size, 2035 forecast): https://www.snsinsider.com/reports/virtual-goods-market-10293
3. Best Gaming Account Marketplaces 2026 (G2G vs Eldorado) — METAMMO: https://metammo.com/guides/best-gaming-account-marketplace-comparison-2026
4. Eldorado seller fees: https://support.eldorado.gg/en/articles/8409025-seller-fees
5. G2G commission fee: https://support.g2g.com/support/solutions/articles/5000001408-what-is-the-commission-fee-to-sell-at-g2g-marketplace-
6. How to Sell Game Items for Real Money — Eneba Hub (escrow, PayPal G&S favors buyers): https://www.eneba.com/hub/play-to-earn/sell-game-items/
7. How to Sell Game Accounts Safely & Legally — gameserrors: https://gameserrors.com/selling-and-buying-gaming-accounts-tips-and-risks/
8. Discord "Marketplace" trading servers — DISBOARD: https://disboard.org/servers/tag/marketplace
9. Marketplace CRO / seller onboarding stats (completion 70%→80%, ≤4 fields, +12% activation, +20–35% trust-signal uplift, signal placement, first-txn-7-day KPI): https://www.lowcode.agency/blog/marketplace-conversion-rate-optimization-guide · https://www.journeyh.io/blog/marketplace-onboarding-marketplace-seller
10. 19 Tactics to Solve the Chicken-or-Egg Problem — NFX: https://www.nfx.com/post/19-marketplace-tactics-for-overcoming-the-chicken-or-egg-problem
11. Solving the Chicken-and-Egg Problem for a C2C marketplace — Fastlaunch: https://medium.com/fastlaunch/how-to-solve-the-chicken-and-egg-problem-for-a-c2c-marketplace-37d3610b1985

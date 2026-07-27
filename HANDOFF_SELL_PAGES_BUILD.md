# Handoff — /sell Seller-Acquisition Pages (Build + Evidence)

**Date:** 2026-07-26
**Branch:** `claude/gamevault-mobile-redesign-c0wz3r`  ·  **PR:** #7
**Stack:** Next.js 14 App Router, Supabase, Tailwind, framer-motion.

> What we said, what we built, and where every change lives. Companion to the
> strategy doc **`HANDOFF_SELLER_ACQUISITION_OVERHAUL.md`** (the "why"); this doc
> is the "what + where". The design mockup lives as a Claude artifact (homepage
> before/after) referenced in chat.

---

## 1. The insight (why we built this)

DropMarket is a supply-constrained C2C marketplace, and its whole public surface
was **buyer-first** — the `/buy` SEO engine targets "buy X" queries, with nothing
built to capture **seller** intent. We built the seller-side mirror: `/sell/[game]`
landing pages that rank for "sell {game} account" and funnel visitors into the
founding-seller programme.

### Competitive evidence (researched, sourced)

- **Competitors run exactly this.** Eldorado ships buy pages
  (`/fortnite-accounts-for-sale/…`), a seller entry (`/become-seller`) **and**
  seller guides (`/blog/sell-fortnite-account-guide/`). Their Fortnite category
  alone reportedly draws "thousands of monthly orders and tens of thousands of
  monthly visitors." [1][5]
- **Organic search is the category's #1 channel.** PlayerAuctions gets **~52–57%
  of all traffic from organic search** — its biggest channel — and that feeds
  **~20,000 active sellers / 30M completed deals** (since 1999). Eldorado's organic
  is its #2 channel (~21%). [3][4]
- **Programmatic-SEO lift benchmarks** (single template → many pages, like our
  engine): The Search Initiative **+38% organic, 0→1,923 top-10 keywords in 12 mo**
  (1 template → 500 pages); SUSO **+398% in 18 mo** (~100 pages); Omnius **+220% in
  a quarter**. [2]
- **Honest gap:** the incumbents' *founding-era* tactics aren't public. But their
  current footprint (heavy pSEO + low-friction seller path + escrow trust) shows
  what works, and matches our cold-start research (anchor sellers, first-wave fee
  waivers, buyer↔seller single profile).

**Takeaway:** this is a proven structure; the real % gains come from **breadth** —
scaling the template well past the initial 6 pages.

---

## 2. What we built

A programmatic seller-SEO engine mirroring the existing `/buy` system, plus a
full design pass so the pages look and feel like DropMarket.

| Feature | Detail |
|---|---|
| **6 seller landing pages** | `/sell/sell-roblox-account`, `-fortnite-account`, `-valorant-account`, `-cs2-account`, `-genshin-account`, `sell-game-currency` |
| **Config-driven** | Add a row to `SELL_PAGES` → new page, auto-added to sitemap. Single source of truth. |
| **SEO** | Per-page title/description/canonical/OG/Twitter, single H1, **FAQPage + HowTo JSON-LD**, sitemap entry, internal links. Crawlable (not blocked in robots). |
| **Unique per-page content** | Keyword-rich **About** prose per game (e.g. Roblox: "how much is 1,000 Robux worth", retail vs player price, how to sell) — fixes thin/duplicate-content risk. |
| **Hero** | Shared DropMarket **homepage hero backdrop** (`home.avif` + scrim), real game logo (`/games/*` via `getGameIcon`), Inter extrabold title. |
| **Design language** | "Floating" — no boxed/modal cards; `divide-y` rows, bare columns. All sections aligned to one `max-w-3xl` rail. |
| **Motion** | "How selling works" is an animated flow: staggered scroll-reveal, left→right connector arrows, glow-icon hover. Respects `prefers-reduced-motion`. |
| **FAQ** | Uses the items-page `FaqCards` component (consistent house style). |
| **CTA target** | Public `/early-seller` founding-seller waitlist (honest during beta; not the gated `/account/*`). |
| **Auth** | Marketing slugs whitelisted as public in middleware; the real seller listing tools (`/sell/new`, `/sell/edit`, `/sell/bulk`) stay gated. |

---

## 3. Where the changes live (file map)

### New files
| File | What it is |
|------|------------|
| `src/lib/seo/sellPages.ts` | `SELL_PAGES` config (6 pages) + `about` prose + FAQs; `getSellPage`, `getAllSellPageSlugs`. **This is where you add/edit pages.** |
| `src/app/sell/[seoSlug]/page.tsx` | The server route: metadata, JSON-LD, hero, market proof, About, FAQ, CTA. |
| `src/app/sell/[seoSlug]/_HowSellingWorks.tsx` | Client component — the animated 3-step flow (framer-motion). |
| `HANDOFF_SELLER_ACQUISITION_OVERHAUL.md` | Strategy/research doc (the "why"). |
| `HANDOFF_SELL_PAGES_BUILD.md` | This file. |

### Modified files
| File | Change |
|------|--------|
| `src/app/sitemap.ts` | Appends `/sell/*` slugs (via `getAllSellPageSlugs`) next to the `/buy` pages. |
| `src/middleware.ts` | Whitelists the exact `/sell/<seoSlug>` marketing slugs as public; listing tools stay gated. |

### Reused (not modified)
`@/components/hero-backdrop` (HeroBackdrop), `@/components/marketplace/FaqCards`,
`@/features/home/lib/game-icons` (getGameIcon), `/public/games/*`,
`/public/assets/heroes/home.avif`, `/early-seller`, `/fees`.

---

## 4. Commit trail (branch `claude/gamevault-mobile-redesign-c0wz3r`)

| Commit | Summary |
|--------|---------|
| `ff3d1e2` | Strategy/research handoff doc |
| `e6d4167` | Phase 1 — `/sell` engine (config + route + sitemap) |
| `7138f7f` | Middleware: make `/sell` marketing pages public, keep listing tools gated |
| `4dc23a5` | Homepage hero backdrop on `/sell` |
| `a9d0ccc` | Revamp: real game logo, floating layout, shorter |
| `681f8ae` | Animated steps, About SEO section, FaqCards FAQ |
| `3d5aab5` | Align every section to one `max-w-3xl` rail |

(Earlier this session, unrelated to `/sell`: `a23c571` mobile slider fling,
`72ddc04` + `f0d07d2` items-page filter chips.)

---

## 5. How to view / verify

- **Preview:** `https://gamevault-git-claude-ee9529-…vercel.app/sell/sell-roblox-account`
  (open logged-out; wait for Vercel "Ready" then hard-refresh).
- **SEO check:** load `/sitemap.xml` and search `/sell/` — the 6 URLs should be there.
- **Auth check:** logged-out, `/sell/new` should still redirect to login.

---

## 6. Next steps (not done)

1. **Scale breadth** — the % gains come from more pages. Expand `SELL_PAGES` to more
   games × categories (accounts / items / currency). This is the highest-leverage
   follow-up.
2. **Submit sitemap in Google Search Console** so the pages get discovered fast.
3. **Confirm the real fee numbers** — homepage says "5–10%", the older
   `sell-game-accounts` copy says accounts are "12–20% by risk band". Pages
   currently say "from 5%" + link to `/fees`; tighten once confirmed.
4. Optional: seller guides in `BlogSection`, a valuation tool, competitor-comparison
   pages, IndexNow ping on publish (see the strategy doc §3–5).

---

## 7. Sources

1. Eldorado — Sell Fortnite Account guide: https://www.eldorado.gg/blog/sell-fortnite-account-guide/
2. Programmatic SEO case studies (SUSO / The Search Initiative / Omnius): https://susodigital.com/work/saas-programmatic-seo-case-study
3. PlayerAuctions scale (active sellers / deals): https://turbosmurfs.gg/article/how-legit-is-playerauctions-top-alternatives
4. PlayerAuctions vs Eldorado traffic channels — Similarweb: https://www.similarweb.com/website/playerauctions.com/vs/eldorado.gg/
5. Eldorado — Become a Seller: https://www.eldorado.gg/become-seller

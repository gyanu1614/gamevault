# Handoff — SEO & Marketplace Growth Master Plan (C2C)

**Date:** 2026-07-26
**Branch:** `claude/gamevault-mobile-redesign-c0wz3r`
**Status:** 📐 **Plan-only — no code in this doc.** Full strategy to implement once, in order.
**Companions:** `HANDOFF_SELLER_ACQUISITION_OVERHAUL.md` (seller strategy), `HANDOFF_SELL_PAGES_BUILD.md` (what shipped).

> This is the deep plan you asked for before we build more: how C2C gaming
> marketplaces actually grew (buying **and** selling), how much programmatic SEO
> gains, how to rank better via Google Search Console, and the exact sequence for
> DropMarket. Every stat is sourced (§11).

---

## 1. The honest starting position (know the gap)

We are a **new domain** competing with entrenched incumbents. The gap is real and
must shape expectations:

| Site | Organic traffic/mo | Traffic value/mo | Domain Rating | Referring domains |
|---|---|---|---|---|
| **PlayerAuctions** | ~595K | ~$196K | 70 | — |
| **Eldorado** | ~546K | ~$144K | 71–73 | ~7,000 |
| **G2G** | ~433K | ~$133K | 63 | — |
| **DropMarket (us)** | ~0 (new) | ~$0 | low | few |

[6][7] All three rank top-10 for the **same** keyword universe [7] — so the target
keywords are known and finite; the moat is their **Domain Rating + ~7K referring
domains built over 7–25 years**, not secret keywords. PlayerAuctions has existed
since **1999** (30M deals, ~20K active sellers); Eldorado since **2018**. [3]

**Implication:** we will **not** beat "buy fortnite account" (a head term) soon.
We win by taking **long-tail, lower-competition** queries first, compounding into
topical authority and links, then contesting head terms over 12–24 months.

---

## 2. Realistic timeline (set expectations before building)

From Ahrefs' analysis of 2M+ pages and SEO-timeline research [8]:

- New pages are **indexed in days–weeks**.
- **Only 1.74%** of new pages reach top-10 **within year one**.
- New domain ranks **long-tail in 2–4 months**, builds **meaningful traffic in
  4–8 months**, contests **head terms after 12+ months**.
- New domains often sit in a **2–4 month "sandbox"** regardless of quality.
- Low-competition keywords: **3–6 months**; competitive terms: **12–24 months**.

**So the curve:** months 1–3 indexing + long-tail trickle → months 4–8 real
organic growth → months 12+ head-term contention. This is a **compounding**
program, not a launch.

---

## 3. What the gains look like (the % question, answered)

Single-template programmatic SEO — exactly our `/buy` + `/sell` engines — delivers
these documented lifts [2]:

| Case | Setup | Result |
|---|---|---|
| The Search Initiative | 1 template → **500 pages** | **+38% organic; 0 → 1,923 top-10 keywords / 12 mo** |
| SUSO Digital | ~100 pages | **+398% organic / 18 mo** |
| Omnius | template-driven | **+220% organic / quarter** |

The lever is **breadth × uniqueness**: the 500-page case is the model — many pages,
each answering a *distinct* query, each with *unique* data. Six pages barely move;
**dozens to hundreds** is where the numbers come from.

---

## 4. The two funnels we're building (buying AND selling)

Competitors monetize both; we mirror both.

| | **Buy funnel (demand)** | **Sell funnel (supply)** |
|---|---|---|
| Query | "buy roblox account", "cheapest robux" | "sell roblox account", "how much is my account worth" |
| Volume | **High** (most of the ~500K/mo competitor traffic) | Lower, but **higher-intent for supply** — our constraint |
| Our asset | `/buy/[seoSlug]` (`landingPages.ts`) | `/sell/[seoSlug]` (`sellPages.ts`) |
| Status | 10 pages live | 6 pages live |
| Goal | Liquidity + revenue | Fix the supply constraint |

A C2C marketplace is **supply-constrained first** [4], so the **sell funnel is the
priority**, but the buy funnel is where the traffic volume (and buyer liquidity)
lives — we scale both, sellers first.

---

## 5. Six growth pillars

### Pillar A — Programmatic breadth (scale the templates)
Expand `/buy` and `/sell` across the **game × category** matrix (accounts, items,
currency, top-ups, boosting). This is the single biggest lever (§3).

**Scaled-content-policy compliance is mandatory** — Google's March-2024 policy
(enforced through 2026) penalizes *volume + low value*, **not volume itself**.
pSEO survives when **each page answers a distinct query with unique data no other
page answers**. [5] Our guardrails:
- Every page carries **unique per-game About prose** + **live DB market data**
  (prices/listings) — real differentiation, not swapped nouns.
- **No near-duplicate pages**: one page per distinct (game, category, intent).
  Canonicalize/301 any overlap.
- Human-review copy; never ship spun templates.

### Pillar B — Topical authority (hub-and-spoke)
Google now weighs **entity/topical authority over keyword density** [1]. Build
clusters, not orphan pages:
- **Hub** = game page (`/{game}`), **spokes** = its buy/sell/currency/guide pages,
  all interlinked.
- Cross-link **buy ↔ sell ↔ guide ↔ item pages ↔ marketplace** (the SAB section
  already models this — reuse the pattern).
- Depth across a topic makes us rank for **both head and long-tail** variations. [1]

### Pillar C — Content depth + E-E-A-T
Thin templated pages no longer rank [1][5]. Add:
- **Seller/buyer guides** in the existing `BlogSection` ("how to sell a Roblox
  account safely", "how much is 1,000 Robux worth") → link to the money pages.
- **E-E-A-T signals**: real author bylines, an About/Trust page, visible SafeDrop
  policy, Trustpilot rating — Google favors credible, first-hand content. [10]
- **Unique data** as our edge: live prices, real listings, "updated daily"
  freshness (the SAB value pages already do this).

### Pillar D — Technical SEO & Core Web Vitals
- **Core Web Vitals** are a real (if secondary) ranking factor, judged on
  **real-user, mobile-first** data — Lighthouse scores don't count. [9] Watch the
  GSC CWV report; fix LCP/CLS/INP on the money-page templates.
- Keep sitemap + robots correct (already done for `/buy` + `/sell`), add
  **breadcrumb + Product/FAQ/HowTo schema** everywhere (partly done via
  `jsonld.ts`), fire **IndexNow** on publish (`indexnow.ts` exists — wire it in).

### Pillar E — Off-page / backlinks (close the DR gap)
This is the incumbents' actual moat (~7K referring domains [6]). Long game:
- **Digital PR** — the #1 link tactic (48.6% of SEOs rank it top) [11]: data
  stories ("what gaming accounts sell for in 2026"), price indexes, trend reports
  the gaming press links to.
- **Niche-relevant links** weigh most [11]: gaming blogs, Discords, YouTubers,
  trade communities.
- Free/earned first; paid placements only from vetted, niche-relevant publishers.

### Pillar F — Supply-side marketplace growth (the flywheel)
SEO fills the top; the marketplace loop compounds it [4][12]:
- **Seed sellers first** (supply-constrained), stay **niche-dense** (win a few
  games deeply before going wide).
- **Per-side referral programs** — "every referred seller attracts buyers, which
  attracts sellers" — a compounding flywheel [12]. Tie to the founding-seller badge.
- **Fee waivers for the first wave** + buyer↔seller single profile (convert buyers
  to sellers).

---

## 6. Google Search Console playbook (how to "rank better")

GSC is the operating console once pages are live. The cadence:

1. **Submit `sitemap.xml`** (Sitemaps report) — fastest discovery. Do this first.
2. **Index Coverage report** — fix "Crawled – not indexed" / "Discovered – not
   indexed" (usually thin/duplicate → strengthen or canonicalize). GSC's Nov-2025
   update gives more granular exclusion reasons. [13]
3. **Striking-distance optimization** (the highest-ROI GSC habit) — filter queries
   ranking **positions 11–40** with high impressions + low CTR; rewrite the
   **title + meta** to match intent, add the missing content. Small moves here turn
   page-2 into page-1. [13]
4. **CTR wins** — high-impression, low-CTR pages: sharpen titles/descriptions. [13]
5. **Core Web Vitals report** (Experience) — fix flagged mobile URLs. [13]
6. **URL Inspection** → "Request indexing" for important new/updated pages.
7. Track **query → page** drift; make sure the right page owns each query
   (internal-link to reinforce, avoid two pages competing = keyword cannibalization).

Weekly: striking-distance + coverage. Monthly: CWV + content-gap from Performance.

---

## 7. Metrics & targets

**Leading (weeks):** pages indexed, impressions, avg position, striking-distance
keyword count, CWV pass rate.
**Lagging (months):** organic sessions, top-10 keyword count, seller signups from
organic, first-sale-in-7-days, referring domains / DR.

| Milestone | Target window |
|---|---|
| All pages indexed | < 2–4 weeks |
| First long-tail top-10s | 2–4 months |
| Meaningful organic traffic | 4–8 months |
| 1,000+ ranked keywords | 12 months (breadth-dependent) |
| Head-term contention | 12–24 months |

---

## 8. Phased roadmap (implement in this order)

1. **Breadth — scale `/sell` + `/buy`** across the game×category matrix (dozens of
   pages), each with unique About + live data. *(Pillar A — biggest lever.)*
2. **Topical clustering + internal linking** — hub-spoke wiring between game hubs,
   buy, sell, currency, guides. *(Pillar B.)*
3. **GSC setup** — verify property, submit sitemap, baseline the reports. *(§6.)*
4. **Content depth** — seller/buyer guides in `BlogSection`; E-E-A-T pages. *(Pillar C.)*
5. **Technical** — schema everywhere, IndexNow on publish, CWV audit. *(Pillar D.)*
6. **Supply flywheel** — referral program, founding-seller push, community. *(Pillar F.)*
7. **Off-page** — digital-PR data stories + niche link building (ongoing). *(Pillar E.)*
8. **Operate GSC weekly** — striking-distance + coverage forever. *(§6.)*

---

## 9. Risks & how we avoid them

| Risk | Mitigation |
|---|---|
| **Scaled-content penalty** (thin near-duplicates) | Unique per-page About + live data; one page per distinct query; human review; no spun templates. [5] |
| **DR/backlink gap** vs incumbents | Win long-tail first; build links via digital PR over 12–24 mo — don't expect head terms early. [6][8] |
| **Keyword cannibalization** (buy vs sell vs guide competing) | Distinct intent per page; canonical + internal links point the right page at each query. |
| **Expecting fast results** | Communicate the 4–8 month curve up front (§2). |
| **Empty marketplace = thin pages** | Live-data sections degrade gracefully; curated content (About/guides) carries value pre-inventory. |

---

## 10. Grounding in our codebase (what already exists to build on)

- `src/lib/seo/landingPages.ts` (buy) + `src/lib/seo/sellPages.ts` (sell) — the
  two engines to scale.
- `src/app/sitemap.ts`, `src/app/robots.ts` — discovery (both wired for buy+sell).
- `src/lib/seo/jsonld.ts`, `templates.ts`, `og-template.tsx`, `page-stats.ts` —
  schema + auto-SEO + OG.
- `src/lib/seo/indexnow.ts` — IndexNow ping (wire into publish).
- `BlogSection` + `src/lib/blog/posts.ts` — guide content surface.
- The `/steal-a-brainrot` value system — the reference model for unique-data
  topical clusters + internal linking.

---

## 11. Sources

1. Topical authority / entity authority over keyword density: https://neilpatel.com/blog/topical-authority/ · https://www.journeyh.io/blog/marketplace-seo-playbook
2. Programmatic-SEO case studies (Search Initiative / SUSO / Omnius): https://susodigital.com/work/saas-programmatic-seo-case-study
3. PlayerAuctions/Eldorado scale + history: https://turbosmurfs.gg/article/how-legit-is-playerauctions-top-alternatives
4. Two-sided marketplace cold start / seed supply / liquidity: https://forkoff.xyz/blog/founder-growth/two-sided-marketplace-cold-start-2026
5. Google scaled-content-abuse policy: https://www.digitalapplied.com/blog/programmatic-seo-after-march-2026-surviving-scaled-content-ban
6. Competitor DR / traffic value / referring domains (Ahrefs): https://ahrefstop.com/websites/eldorado.gg
7. Shared keyword universe / traffic comparison (Similarweb): https://www.similarweb.com/website/playerauctions.com/vs/eldorado.gg/
8. How long to rank (Ahrefs 2M-page study / timelines): https://seosherpa.com/how-long-to-rank-on-google/
9. Core Web Vitals as ranking factor (real-user, mobile-first): https://www.rumvision.com/blog/impact-core-web-vitals-seo/
10. E-E-A-T 2025: https://digitalsandwich.agency/blog/what-actually-affects-your-google-rankings-in-2025/
11. Digital PR / backlinks (48.6% top tactic; niche relevance): https://outpaceseo.com/article/link-building/
12. Marketplace referral flywheel: https://growsurf.com/examples/marketplace-referral-programs/
13. Google Search Console optimization (striking distance, coverage, CWV): https://growthmindedmarketing.com/blog/google-search-console-optimisation/

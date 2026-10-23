# Google crawl + SEO audit — 2026-10-23

Owner problem: "even searching dropmarket doesn't show on google". Goal: fix the
Google side without hurting Bing (today's main search source).

Window: 2026-07-23 → 2026-10-22. Live checks run 2026-10-22 ~21:30 PDT against
production, read-only (curl with a Googlebot UA, GSC API, Vercel Web Analytics).
No production writes. Tools that were NOT available: Ahrefs (plan), Semrush (no
API units), Vercel Observability Plus (disabled, so no per-bot request logs).
Backlink counts below are therefore unknown — see owner step 4.

## 1. Answer in one paragraph

Google has NOT rejected the site. The home page and the main hubs are indexed
and nothing technical blocks Googlebot (robots, redirects, canonicals, sitemaps
and status codes are all clean). The problem is **crawl demand**: Google knows
most of the 1,857 sitemap URLs but has chosen not to fetch them yet
("Discovered – currently not indexed"), and it re-crawls the hubs rarely
(/adopt-me/values: last crawl 31 Jul, 83 days ago). For a domain launched in July
2026 that is driven by (a) external links/brand mentions — which we can't measure
right now — and (b) how prominently the site links its own pages. On (b) we had
real bugs: the home page and /adopt-me had **no link** to /adopt-me/values (the
site's #1 search landing page), the game sub-nav tabs were `<button>`s with no
href, and the Organization markup pointed Google at **another company's GitHub**.
Bing behaves differently: IndexNow pushes every changed URL to it, and it indexes
new domains readily — hence ~25× more Bing traffic. The brand query ranks at ~63
because Google hasn't yet tied "DropMarket" to this site as an entity.

## 2. Evidence

### 2.1 Live HTML, headers, redirects (all OK unless noted)

| Check | Result |
|---|---|
| `https://www.dropmarket.gg/` | 308 → `https://dropmarket.gg/` ✅ |
| `http://dropmarket.gg/` | 308 → https ✅ |
| `/adopt-me/values/` (trailing slash) | 308 → `/adopt-me/values` ✅ |
| Home: status / robots / X-Robots-Tag | 200 · `index, follow` · none ✅ |
| Home: canonical | `https://dropmarket.gg` (Google's canonical: `https://dropmarket.gg/` — same URL) ✅ |
| Home: title | `DropMarket - The Gamer's Marketplace` (brand first) ✅ |
| Home: JSON-LD | WebSite (name + alternateName) ✅, Organization ⚠️ (see 2.6), FAQPage (no rich result since May 2026; harmless) |
| Cache | `public, max-age=0, must-revalidate` + `x-vercel-cache: HIT` — the normal Vercel ISR header; do not change it |
| TTFB | cached 0.1–0.3 s; first render after a deploy 1.0–2.2 s (`BYPASS`/`MISS`), then HIT. Acceptable for Googlebot |
| robots.txt | allows everything public; blocks /api, /admin, account/order/checkout paths and filter/sort/utm params; lists the sitemap ✅ |

Probe of 107 random sitemap URLs (every section): **all 200, all self-canonical,
none noindex**. Only defect: the Steal an Egg item pages had **no H1** (fixed).

### 2.2 Sitemaps

| File | Status | URLs (live) | GSC "submitted" | GSC last download |
|---|---|---|---|---|
| sitemap.xml (index) | 200 | 9 children | 1,505 | 2026-10-21 |
| static | 200 | 22 | 22 | 10-22 |
| hubs | 200 | 129 | 129 | 10-22 |
| buy | 200 | 78 | 78 | 10-21 |
| sell | 200 | 241 | 240 | 10-22 |
| blog | 200 | 18 | 18 | 10-21 |
| values-adopt-me | 200 | 432 | 458 | 10-22 |
| values-murder-mystery-2 | 200 | 601 | 218 | 10-22 (grew after #230) |
| values-steal-a-brainrot | 200 | 325 | 330 | 10-21 |
| values-steal-an-egg | 200 | 11 | 12 | 10-21 |

0 errors, 0 warnings, children downloaded daily, lastmods are real change dates.
GSC's `indexed: 0` per sitemap is a **deprecated API field that always reads 0** —
it is not an indexing figure. Use the Pages report instead (owner step 5).

### 2.3 GSC URL Inspection (19 URLs)

| URL | Coverage | Last crawl |
|---|---|---|
| `/` | Submitted and indexed | 2026-10-19 |
| `/adopt-me/values` | Indexed | **2026-07-31** |
| `/adopt-me/values/bat-dragon` | Indexed | **2026-07-31** |
| `/steal-a-brainrot/values` | Indexed | 2026-09-10 |
| `/steal-a-brainrot/calculator` | Indexed | 2026-09-11 |
| `/murder-mystery-2/values` | Indexed | 2026-10-07 |
| `/adopt-me` | Indexed | 2026-09-29 |
| `/roblox` | Indexed | 2026-10-06 |
| `/escape-from-tarkov/buy-roubles` | Indexed | 2026-10-17 |
| `/browse` | Indexed | 2026-10-03 |
| `/safedrop` | Indexed | 2026-09-25 |
| `/adopt-me/blog/how-to-sell-adopt-me-pets-for-real-money` (Bing #4) | **Discovered – currently not indexed** | never |
| `/adopt-me/sell` (Bing #5) | **Discovered – currently not indexed** | never |
| `/adopt-me/blog` | **Discovered – currently not indexed** | never |
| `/tap-simulator/sell` | **Discovered – currently not indexed** | never |
| `/murder-mystery-2/values/xenoshot` | **Discovered – currently not indexed** | never |
| `/steal-a-brainrot/values/meowl` | **Discovered – currently not indexed** | never |
| `/murder-mystery-2/free-items` (Bing #8) | **URL is unknown to Google** | never |
| `/adopt-me/values/peach-owl` (new item) | **URL is unknown to Google** | never |

No sampled URL was "Crawled – not indexed", "Duplicate", "Soft 404" or blocked:
Google simply has not fetched the deep pages. Rich results: Breadcrumbs and
Product snippets PASS ("Unnamed item" is how GSC labels a BreadcrumbList — not a bug).

### 2.4 Search performance (GSC)

- Brand: "dropmarket" 1 impression at position 63; "drop marketplace" 7 at ~92;
  "drop market" 1 at 75; "dropmarketgames" 2 at 34.
- Home page, 20 Sep–21 Oct: 68 impressions, **position 6.5**, 15 clicks — improving.
- Impressions fell from 50–110/day (late Jul–mid Aug) to 5–20/day after ~17 Aug.
  The drop is two pages that had been shown deep in results: /adopt-me/values
  (430 impressions at position 62) and /escape-from-tarkov/buy-roubles (494 at 81).
  That is Google testing a new site, not a penalty (no manual-action signal; both
  pages are still indexed).
- Search referrals to the site (Vercel Web Analytics, same window): Bing-powered
  engines ~1,890 visitors, Google ~68.

### 2.5 The noindex gate is NOT hiding too much

| Section | Indexable (in sitemap) | `noindex, follow` | Note |
|---|---|---|---|
| Adopt Me items | 433 | 349 | value gate (enforce) |
| MM2 items | 602 | 478 | value gate |
| SAB items | 326 | 255 | value gate |
| Steal an Egg items | 12 | 257 | thin (~250–330 words) — correctly gated |
| /[game]/sell | 241 | 0 | all indexable (Bing earns on them) |
| Listing detail pages | 0 | all | by design since #160 |

Counted as hub-linked item URLs minus sitemap URLs; a 24-URL sample of the
excluded set all returned `noindex, follow`. Cross-check against search traffic:
**none of the 52 value-item pages that received Bing/Google/DDG/Yahoo/Ecosia
visitors is noindexed.** Verdict: leave the gate alone. Loosening it would add
~1,300 thin URLs for Google to deprioritise; tightening it would hit Bing pages.

### 2.6 Internal linking and brand signals

- **Home page** links 133 internal URLs (all from the header/footer directory and
  rails). Its only value-hub links were `/steal-a-brainrot/values` +
  `/calculator` — the footer directory showed "Value List / Calculator" for SAB
  only (`footerTools`). No link to /adopt-me/values, /murder-mystery-2/values,
  /steal-an-egg/values, any calculator but SAB's, or any game blog hub.
- **/adopt-me** (game landing) linked its blog posts and buy pages but **not**
  /adopt-me/values or /adopt-me/calculator. Same for /murder-mystery-2 and
  /steal-an-egg.
- **Game sub-nav** (on every game landing, category page and listing page): the
  category tabs were `<button onClick={router.push}>` — no `href`, so no crawl
  path from that strip to any category page.
- Item pages already link back to their hub, calculator, blog and /company ✅.
- The home page also links ~15 `?seller=…&offer=…` deep links (canonicalised to
  the category page). Minor crawl waste; left as is.
- **Organization JSON-LD** `sameAs`: `github.com/dropmarket` is a GitHub user named
  **"Drop-Market.com"**, created 2024-10-25, 0 repos — another business.
  `twitter.com/dropmarket` could not be verified as ours (the growth plan lists X
  as a future channel). No legalName, address or company number, although the
  site is DropMarket Ltd (Co. No. 17309867). This tells Google "DropMarket" is
  the same entity as an unrelated GitHub account — the opposite of what a brand
  query needs.
- **/company** exists (statutory info, indexed, position ~2.8 for its queries) but
  carried no structured data. There is no /about (404) — /company plays that role.
- IndexNow (`/api/cron/seo-indexnow`) submits to api.indexnow.org → Bing, Yandex,
  Seznam, Naver. **Google does not use IndexNow**; it relies on links + sitemaps.
- Bing sync cron (`/api/cron/seo-bing`) is idle: `BING_WEBMASTER_API_KEY` unset.

### 2.7 Site name over the result shows "dropmarket.gg", not "DropMarket"

Owner screenshot (2026-10-23): the brand result reads `dropmarket.gg` /
`https://dropmarket.gg` above the title "DropMarket - The Gamer's Marketplace".
The 2026-10-07 change fixed the title but not the site name, because Google
picks the site name separately: from the home page's WebSite markup, checked
against the title, headings, `og:site_name` and other text on the site and the
web. When it is "less confident" in the name it falls back to the domain
(Google's site-name docs). What we found:

- Home page: consistent. WebSite `name` "DropMarket", title, H1, og:site_name,
  logo alt and footer all say DropMarket ✅.
- **Every other page was missing `og:site_name`** (/adopt-me, /adopt-me/values,
  blog posts, /browse, /safedrop … — 12 of 14 checked). A page's own
  `openGraph` replaces the layout's in Next, so the siteName was dropped.
- `alternateName` held `"DropMarket.gg"`: a domain form, mis-cased. Google takes
  a domain alternate only lowercase and last, as the fallback the owner doesn't
  want.
- No other live site claims the name (drop-market.com, dropmarket.com/.io/.net
  checked), so it is a confidence problem — a new brand with few outside
  mentions, and an Organization that pointed at another company's GitHub.
- Outside sources that call the site "dropmarket.gg" (for example the Trustpilot
  profile's display name) count against us. Not checked: Trustpilot blocks
  scripted reads — owner step 9.

## 3. Fix plan (seo-human-first contract)

### 3.1 Fix — findability (this PR unless marked owner)

| # | Priority | Fix | Why / how we'll know it worked |
|---|---|---|---|
| F1 | Critical | **Footer directory links every value hub**: Adopt Me, MM2, Steal an Egg get "Value List" + their calculator (MM2: Inventory Calculator) like SAB already had (`footerTools` on; `hubToolLinks`). Every page now links the hubs. | Home HTML contains `/adopt-me/values`, `/murder-mystery-2/values`, `/steal-an-egg/values`. In GSC, /adopt-me/values "Last crawl" moves past 2026-07-31 within ~2 weeks of release. |
| F2 | Critical | **Game sub-nav category tabs are real links** (`<Link href>`; a plain click keeps the transition + delayed spinner; new-tab/modifier clicks work). | Server HTML of any game page has `href="/<game>/<category>"` in the strip. Category pages' GSC "Referring page" lists game landings. |
| F3 | High | **Hub tool tabs in the game sub-nav for every hub game** ("Values", "Calculator"/"Inventory") on the landing and every category page — the SAB pattern, generalised (`hubNavExtras`). /adopt-me → /adopt-me/values is now one click. | /adopt-me HTML links /adopt-me/values. |
| F4 | High | **Organization entity corrected**: sameAs = Discord, Trustpilot profile, Companies House record (the GitHub/Twitter claims removed); adds legalName, address, VAT ID, company number, email, phone, contactPoint, logo size. Same node on **/company** plus an AboutPage. Hub footer's unverified Twitter icon removed. Company facts now come from one module (`src/lib/config/company.ts`) shared with the legal pages. | Rich Results Test on / and /company shows one Organization with legalName. Over 1–3 months: "dropmarket" brand query position (GSC) improves from ~63. |
| F4b | High | **Site name signals**: `og:site_name` "DropMarket" on every page (`seoMeta` default; the seller shop page already set it), `<meta name="application-name" content="DropMarket">` site-wide, `alternateName` = "Drop Market" only (domain form removed) on WebSite and Organization. | Every page's HTML has `og:site_name` DropMarket. After the home page is recrawled (owner step 2), the result's top line reads "DropMarket"; Google says this takes days to weeks and isn't guaranteed for a new brand. |
| F5 | Medium | **H1 on Steal an Egg item pages** (the hero title is the H1 there; other games keep ItemPageTitle). Guard pins one H1 per item-page type. | Live SAE item HTML has one `<h1>`. |
| F6 | High (owner) | Resubmit the sitemap and request indexing for the top pages after release — owner steps 1–2. | URL Inspection shows a fresh crawl date. |
| F7 | High (owner) | Turn on the Bing sync (owner step 6) so /admin/seo shows Bing's view next to Google's and we stop flying blind on the channel that earns traffic. | /admin/seo Bing panel fills the day after. |
| F8 | Medium (owner) | Read GSC Crawl stats + Pages + Links (owner steps 3–5). They hold the numbers the API can't give: host status, crawl requests/day, response-code mix, the full "Discovered – not indexed" list, and backlink count. | — |

Dependencies: F1–F3 must ship (RELEASE) before F6, otherwise Google re-crawls the
old link graph. F4 is independent. Nothing here touches Bing-earning URLs: no
noindex, redirect or rename; the sitemap is unchanged.

### 3.2 Consider — substance (not in this PR)

| Reader problem first | Search upside second |
|---|---|
| Steal an Egg item pages say little (~250–330 words: a price and an area). A buyer learns nothing they couldn't see on the list. | They are already noindexed by the gate (257 of 269). Either give them something real (which eggs drop which pets, observed prices over time) or keep them as list-only. Do not pad. |
| A visitor searching "DropMarket" wants to know who runs it. /company is a statutory page; it doesn't say what DropMarket is or why to trust it. | A short, factual "About DropMarket" paragraph on /company (who, since when, how SafeDrop works, registered company) strengthens the entity Google is building. Owner copy call. |
| Google-only noindex for thin /[game]/sell pages (`<meta name="googlebot" content="noindex">`, Bing keeps indexing). | Would focus Google's crawl, but no data says these pages hurt Google today. Revisit only if the Pages report shows sell pages as "Crawled – currently not indexed" in bulk after F1–F3. |
| The home page sends crawlers to ~15 `?seller=&offer=` URLs. | They canonicalise correctly. Revisit only if Crawl stats show parameter URLs dominating. |

### 3.3 Declined — policy

| Declined | Pattern | Offered instead |
|---|---|---|
| Build backlinks / buy guest posts to raise authority | Off-page manipulation | Real profiles the brand owns (owner step 7); publish the value data people already cite (price index, movers) and let links follow. |
| Seed "DropMarket" mentions on Reddit/Discord/forums so Google sees the brand | Brand-mention seeding | Answer real questions in communities as DropMarket, openly, when we have the answer. |
| Expand Steal an Egg / sell pages to a word count | Padding | See Consider: make them substantive or leave them gated. |
| Change `cache-control: max-age=0` to 3600 (suggested by another session) | Not SEO; breaks event-driven ISR revalidation | Keep Vercel's ISR header; pages are already CDN HITs. |
| "Fix" breadcrumb "Unnamed item" | Not a defect | Nothing — GSC labels every BreadcrumbList that way; it PASSES. |

## 4. Owner-only steps (after RELEASE of this PR)

1. **GSC → Sitemaps**: open https://search.google.com/search-console/sitemaps?resource_id=sc-domain:dropmarket.gg, enter `sitemap.xml`, press Submit (resubmits the index; Google re-reads all 9 children).
2. **GSC → URL Inspection → Request indexing**, one per day-quota (≈10/day), in this order:
   `https://dropmarket.gg/`, `/adopt-me/values`, `/adopt-me/blog/how-to-sell-adopt-me-pets-for-real-money`, `/adopt-me/sell`, `/steal-a-brainrot/values`, `/murder-mystery-2/values`, `/murder-mystery-2/free-items`, `/steal-a-brainrot/calculator`, `/adopt-me/values/bat-dragon`, `/company`.
   Don't press "Validate fix" on any Pages report row.
3. **GSC → Settings → Crawl stats**: screenshot "Host status" (robots.txt fetch, DNS, server connectivity), "Total crawl requests" for 90 days, and "By response". Send them to me — Vercel can't show bot traffic without Observability Plus.
4. **GSC → Links**: note "Top linking sites" count and the list. This is our only backlink data (Ahrefs plan / Semrush units are out).
5. **GSC → Indexing → Pages**: export "Discovered – currently not indexed" and "Crawled – currently not indexed" (Export → CSV) so we can see the per-section split.
6. **Bing Webmaster Tools** (https://www.bing.com/webmasters):
   1. Confirm `https://dropmarket.gg/` is listed and verified (it was imported from GSC on 2026-07-14; re-import if it isn't).
   2. Sitemaps → Submit `https://dropmarket.gg/sitemap.xml` (if not already listed).
   3. Settings (gear) → API access → API Key → Generate; copy the key.
   4. Vercel → Project gamevault → Settings → Environment Variables → add `BING_WEBMASTER_API_KEY` = the key, Environment = Production. (Optional `BING_SITE_URL` only if the Bing site is not exactly `https://dropmarket.gg/`.)
   5. Redeploy (or wait for the next RELEASE). The `/api/cron/seo-bing` cron then runs daily at 07:40 UTC and fills the Bing panel on /admin/seo.
7. **Social profiles**: tell me if you own `x.com/dropmarket`. If yes, I'll add it back to `ORGANIZATION_SAME_AS`. If not, create the official profiles you will actually use (X, YouTube, TikTok — each with dropmarket.gg in the bio) and send me the URLs; only owned profiles go in the markup.
8. Optional: top up Semrush API units or the Ahrefs plan if you want backlink and SERP data in future audits.
9. **Site name ("DropMarket" instead of "dropmarket.gg")**:
   1. Request indexing for `https://dropmarket.gg/` first (step 2) — the site name is read from the home page.
   2. Trustpilot Business → Settings → company/display name: make it `DropMarket` (not `dropmarket.gg`). Do the same anywhere else you control the name: Discord server name, any directory listing.
   3. Wait 2–4 weeks after the recrawl. If it still shows the domain, tell me — Google's next step is a different alternate name, and its last resort is the domain itself, which you don't want, so we'd stop there.

## 5. What to watch (no re-audit needed)

- GSC URL Inspection on /adopt-me/values: "Last crawl" newer than 2026-07-31.
- GSC Pages report: "Discovered – currently not indexed" count falling, "Indexed" rising, week over week.
- GSC Performance → query "dropmarket": position below 20 within ~8 weeks.
- Search "dropmarket" on Google: the line above the title reads "DropMarket", not "dropmarket.gg".
- Bing (Vercel Web Analytics referrers): unchanged or up. Any drop on the Bing top-10 landing pages after release = look at this PR first.

# Values hubs — task list

Owner-approved items are marked APPROVED; nothing here is started unless marked IN PROGRESS / DONE.

## T1 — Refresh only changed prices, ignore cent wobbles (APPROVED 2026-10-04, not started)
- Adopt Me + Steal an Egg: the pricing run diffs the new prices against the previous snapshot and sends only the changed item slugs (same contract SAB already uses: sab-market-import → /api/internal/sab-market-revalidate `changedSlugs`). values-revalidate stops calling the whole-game tag.
- Change threshold: a price only counts as changed when it moves more than a set step (proposal: > 3% AND > $0.05; tune per game in config). Sub-threshold moves are stored in the DB but never revalidate a page and are not shown.
- PR #137 stock reads: move off the whole-game `values:<game>` tag onto per-item tags so stock changes refresh only that item.
- "Keep the page, change only the price box" (owner idea): page shell (art, copy, FAQ, links, chart) stays a static page that is rarely rebuilt; the price box shows the last published price in the HTML (SEO) and is refreshed from a tiny CDN-cached price JSON per item (or per game) on load. A price move then rewrites one small JSON instead of a whole page. Decide: per-item JSON vs one per-game JSON; cache seconds; what crawlers see.
- Same rule for the DB: upsert only changed rows; history point only on change or once a day.
- Acceptance: a run where nothing moved past the threshold revalidates 0 item pages (logged); ISR writes/day visible drop in Vercel billing (list_billing_charges) within a week.

## T2 — Adopt Me catalog: all pets worth > $1 (APPROVED 2026-10-04, not started)
- Cutoff (owner): keep a pet when ANY variant has a real reputable price above $1.
- Collector pages through adoptmevalues.app /values/page/N (791 pets; today page 1 only = 62).
Prefer one Eldorado Adopt Me category crawl grouped by pet over 791 per-pet searches.
- Page every adopt_me_pet_values read (PostgREST max_rows 1000 cuts at ~125 pets × 8).
- Dry run first; prod import needs owner OK. Fairy Bat Dragon should land.

## T3 — Cost hygiene
- Observability Plus: OFF (owner 2026-10-04) — owner flips it in the Vercel dashboard.
- Spend cap / alert in Vercel Spend Management.
- One pricing run per game per day by default.

## T4 — Listing → value-item matcher picks a substring pet (BUG, found 2026-10-04, not started)
- /adopt-me/values/bat-dragon "Available Now" shows the seller listing "Fairy Bat Dragon NFR". The PR #137 matcher (src/lib/value-listings/match.ts) treats a name that CONTAINS a catalogue pet name as that pet. Must prefer the longest catalogue name and reject a match when the listing title has extra words before the pet name that form another pet ("Fairy Bat Dragon" ≠ "Bat Dragon"); unknown pets (not in catalogue yet) must stay unmatched. Add a regression test with Fairy Bat Dragon / Bat Dragon.

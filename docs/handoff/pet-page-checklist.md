# Pet page checklist (Adopt Me first) — branch `feat/items-grid`

Page: `/[game]/buy-items/item/[pet]` (+ `/[variant]`, canonical to the pet page).
Rule: ✅ done · 🔨 code written, not yet checked · ⏳ waits for the owner · ⬜ not started.
"Check" = tsc + lint + tests + real page on localhost (desktop + phone). Heavy on memory: only when no other chat runs a dev server.

## A. Design (owner picks)
- [ ] A1 Trait buttons: 3–4 versions — picked = outline in the trait's colour (no full fill), round badge buttons like N/F/R, a mix. Layout = segmented Normal/Neon/Mega + Fly/Ride (lab variant A). Clear CTA, no confusion.
- [ ] A2 Picture: plain image in a card like Eldorado's (natural size, not the big stage).
- [ ] A3 Owner picks a version → wire it into the page → real page check.

## B. Pet pictures (owner: best option, no DB load, low complexity)
- [ ] B1 Dry run → show the owner the count (last run: 519 of 808 sharper from the wiki).
- [ ] B2 Owner yes → live apply: files to Storage, one picture link per pet, one-time run. The rest stay as today.
- [ ] B3 Revalidate the pet pages after the apply.

## C. Step 3 — pet page SEO
- [ ] C1 Index from 1 offer (was 5); noindex only with 0 offers.
- [ ] C2 Title "Adopt Me Parrot for Sale – From $X" (≤ 60 chars), plain description with the offer count + price.
- [ ] C3 Product + AggregateOffer JSON-LD from our own stock only (`ownStockProduct`).
- [ ] C4 Prices-by-trait table visible in the first HTML (Google reads it).
- [ ] C5 Small pet details section: rarity, egg, release, what F / R / N / M mean. Real data only.
- [ ] C6 FAQ: 3–4 real trust questions (safety, delivery, what NFR means), no filler.
- [ ] C7 "More Legendary Pets" links (same rarity, fast, server-rendered).
- [ ] C8 Sitemap: add pet pages that have offers.

## D. Step 4 — items grid
- [ ] D1 Search shows one card per trait (links to `/item/[pet]/[variant]`).
- [ ] D2 Trait filter shows that trait's price on each card.

## E. Step 5 — one-way links (market pages never send buyers to value pages)
- [ ] E1 Items page SEO copy: no links to the value list / calculators.
- [ ] E2 Pet page: no "See {Item} Value" link.
- [ ] E3 Game home "Hot New": "How To Get" → Notify Me.

## F. Checks (heavy — when the PC is free)
- [ ] F1 tsc, lint, tests (unit + guards).
- [ ] F2 Real page: desktop + phone screenshots to the owner.
- [ ] F3 Security review (user data, email).

## G. Ship (owner's word only)
- [ ] G1 Commits (local).
- [ ] G2 PRs on "merge"; release on "RELEASE" (db push first: 20261025014756, 20261026233836).
- [ ] G3 Stop the server + `pnpm db:down` when done.

## Later
- Language versions (hreflang).

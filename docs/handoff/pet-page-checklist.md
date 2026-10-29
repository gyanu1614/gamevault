# Pet page checklist (Adopt Me first) — branch `feat/items-grid`

Page: `/[game]/buy-items/item/[pet]` (+ `/[variant]`, canonical to the pet page).
Rule: ✅ done · 🔨 code written, not yet checked · ⏳ waits for the owner · ⬜ not started.
"Check" = tsc + lint + tests + real page on localhost (desktop + phone). Heavy on memory: only when no other chat runs a dev server.

## A. Design (owner picks)
- [x] A1 🔨 (lab ready: scratchpad preview/lab2.html — 1 outline tiles · 2 round badges · 3 sliding outline + check rows · 4 chip row) Trait buttons: 3–4 versions — picked = outline in the trait's colour (no full fill), round badge buttons like N/F/R, a mix. Layout = segmented Normal/Neon/Mega + Fly/Ride (lab variant A). Clear CTA, no confusion.
- [x] A2 🔨 (lab: plain wide card in 1–4, Eldorado square card in 5) Picture: plain image in a card like Eldorado's (natural size, not the big stage).
- [x] A3 🔨 Owner picked 1 (outline tiles + plain card), badges top right → in the code (fef0efff).
- [x] A4 🔨 Owner review on the real page (2026-10-28), round 1: badges always in colour (Normal gets a grey round badge); picture = left half of the left column, spec card on the right half (Item Type, Rarity, Trait, Delivery Time, Delivery Method, In Stock); Delivery Instructions card under them; seller in its own small card; smaller title; offers as full-width seller rows (shared CurrencySellerRow, trait as badges, In Stock, Delivery) and Select glides back to the top; trust badges in trust blue.
- [x] A5 🔨 Round 2: trust badges under the Delivery Instructions; instructions show 4 lines then the house expand chevron; trait picker inside the buy box with a divider; "Buy Now For" removed (price + quantity + Buy); payment logos one floating row (Visa, Mastercard, Apple Pay, Google Pay, paysafecard, USDT, BTC, +N More); "Prices By Trait" tab replaced by an N / M / F / R filter on the offers (F + R = the Fly Ride offers).

## B. Pet pictures (owner: best option, no DB load, low complexity)
- [ ] B1 Dry run → show the owner the count (last run: 519 of 808 sharper from the wiki).
- [ ] B2 Owner yes → live apply: files to Storage, one picture link per pet, one-time run. The rest stay as today.
- [ ] B3 Revalidate the pet pages after the apply.

## C. Step 3 — pet page SEO
- [x] C1 🔨 Index from 1 offer (was 5); noindex only with 0 offers.
- [x] C2 🔨 Title "Adopt Me Parrot for Sale – From $X" (≤ 60 chars), plain description with the offer count + price.
- [x] C3 🔨 Product + AggregateOffer JSON-LD from our own stock only (`ownStockProduct`).
- [x] ~~C4 Prices-by-trait table in the first HTML~~ — removed by the owner 2026-10-28 (replaced by the N / M / F / R offer filter). Product JSON-LD still carries the price range.
- [x] C5 🔨 Small pet details section: rarity, egg, release, what F / R / N / M mean. Real data only.
- [x] C6 🔨 FAQ: 3–4 real trust questions (safety, delivery, what NFR means), no filler.
- [x] C7 🔨 "More Legendary Pets" links (same rarity, fast, server-rendered).
- [x] C8 🔨 Sitemap: add pet pages that have offers (under an indexed category). Not prerendered: each renders on first visit.

## D. Step 4 — items grid
- [x] D1 🔨 Search shows one card per trait (links to `/item/[pet]/[variant]`).
- [x] D2 🔨 Trait filter shows that trait's price on each card.

## E. Step 5 — one-way links (market pages never send buyers to value pages)
- [x] E1 ✅ (already clean) Items page SEO copy: no links to the value list / calculators.
- [x] E2 ✅ (already clean) Pet page: no "See {Item} Value" link.
- [x] E3 🔨 Game home "Hot New": "How To Get" → Notify Me.

- [ ] E4 ⏳ Owner decides — other game-page links to value pages, all in the approved game page design: Price Moves rows + "Full Value List", About "Open the Value List", Hot New "All New" (→ /values?view=new), the Tools row.

## F. Checks (heavy — when the PC is free)
- [ ] F1 tsc, lint, tests (unit + guards).
- [ ] F2 Real page: desktop + phone screenshots to the owner.
- [ ] F3 Security review (user data, email).

## G. Ship (owner's word only)
- [x] G1 Commits (local): d8b778af step 3 · 2f47b806 step 4 · 5b387603 step 5 · 57fc4d4e merged origin/main (card + wallet logos; game home now uses the live PaymentsStrip and "rated sellers" wording, as main did for the old hub).
- [ ] G2 PRs on "merge"; release on "RELEASE" (db push first: 20261025014756, 20261026233836).
- [ ] G3 Stop the server + `pnpm db:down` when done.

## Later
- Language versions (hreflang).

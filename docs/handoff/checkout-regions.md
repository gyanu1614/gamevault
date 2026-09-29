# Checkout regions — flat, region-ordered method selector — handoff

**Date:** 2026-09-26 · **Branch:** `feat/checkout-regions` (worktree `../gamevault-checkout-regions`, own stack) · **PR:** https://github.com/gyanu1614/gamevault/pull/102 · No migration, no RPC change, no server change: the page still renders from `eligibleMethods()` and `createCheckout` still refuses anything the page would not show.

## What changed (approved 2026-09-26)
- **Tabs gone.** The Crypto | E-Wallet | Card (soon) bar and the country dropdown are replaced by ONE flat list of thin rectangular rows in the reference layout (brand mark tile on the left · name · tick on the right), on our light ivory/forest theme. Rows carry NO fee line and NO country note (owner call 2026-09-28): the processing fee shows only in the order summary. Gray hover, ivory fill + forest tick on the pick.
- **Region, not country.** `src/lib/payments/regions.ts` (pure, client-safe, unit-tested): Europe (EU/EEA/UK/CH + the rest of geographic Europe), Latin America, Southeast Asia, Rest of World. The buyer's region comes from the geo country (`?country=XX` still overrides for testing); a "Paying From" chip row switches region and shows only regions that have a rail (Rest of World only while current).
- **Order:** rails local to the buyer's own country → the rest of the region's rails (note = flag + country) → **Cryptocurrency last**. No rails → Cryptocurrency is the first and only row. Rest of World never spills (a US buyer sees crypto only; an Australian sees paysafecard). Romania: Trustly, paysafecard, then BLIK / P24 / EPS / MB Way / BANCOMAT Pay / PayU, then Cryptocurrency.
- **Crypto row** (orange Bitcoin tile, label "Crypto") is always last and expands inline (coin tiles → network → send warning, unchanged logic) when picked.
- **Default pick** = the first row (a local rail when there is one, else crypto); switching region re-picks the new first row unless the current pick is still listed.
- **Logos** for the 8 EU rails in `public/payments/` (sources + terms in `public/payments/ATTRIBUTION.md`: datatrans payment-logos, Wikimedia Commons, Mollie icon set). `loading.tsx` skeleton matches the rows.
- Phones: tile + name + tick only, nothing to clip; no horizontal overflow at 375 px.

## Dark theme (2026-09-28)
Checkout + pay pages moved from the ivory "Ledger" look to the marketplace's dark theme (`src/styles/tokens.css`): page `#171B21`, raised cards `#1F242C`, hover `#252B34`, borders as white alphas, text `#E9EDF2` / `#9AA6B3` / `#6C7684`, green `#2A7A50` for buttons and `#56B87F` for text/icons. The order summary is the listing page's glass card (`rgba(20,20,27,0.56)` + blur); select, tooltip, callouts, account menu, sticky bar, trust band, skeletons all follow. Logo tiles and the QR tile stay white on purpose (marks and QR codes need it).

## Copy (new / changed customer-facing strings)
| Surface | Old | New |
|---|---|---|
| Selector | tabs "Crypto" / "E-Wallet" / "Card · Soon"; "Choose Your Country" / "Paying From Another Country?"; empty states "Local Methods Are Country-Specific…", "No Local Methods for … Yet" | chip row label **"Paying From"** + region names "Europe", "Latin America", "Southeast Asia", "Rest of World" |
| Crypto row | tab "Crypto" + panel "Choose Coin" | row **"Crypto"**; "Choose Coin" kept inside the expanded picker |
| Rail rows | label + region chip + "+ $x.xx · n%" fee line | label only (fee and country note removed; the fee lives in the order summary) |
| Empty | — | "No Payment Methods Available" / "This order can’t be paid right now — please try again shortly." (only when neither crypto nor a rail is payable) |

## Tests
| Check | Result |
|---|---|
| **Full `pnpm test:full`** (reset → seed → whole suite, 2026-09-26, this worktree's stack) | **218 files passed, 1 skipped · 1972 tests passed, 2 skipped (pre-existing CoinGate live-API skips), 0 failed** |
| `regions.test` (new: membership, RO/PL/PH/BR/US/AU ordering, hand-picked region, unknown geo, switcher chips) | 10/10 |
| `buyer-method-fees` (static: page reads `eligibleMethods`, form imports no registry / fee constant) · `eu-payment-methods` | 13/13 · 7/7 |
| `tsc --noEmit` · eslint on the changed files | clean |
| DOM pass on the local dev server (Romania): 9 rows in the approved order, every logo loaded, rows 77 px / radius 10 px / forest ring on the pick; 375 px: no overflow, no clipped label, fee visible | pass |

## Manual check
`/checkout/<listing>?country=RO` (Trustly first), `?country=PL` (BLIK, P24, Trustly, paysafecard first), `?country=BR` (Pix, Boleto, then MX/CO/CL rails), `?country=US` (Cryptocurrency only + chips), no param on localhost (Rest of World: crypto + all chips). Pick Cryptocurrency → coin tiles open inline; pick a rail → its note expands. Phone width: fee under the label.

## Deliberately left
Screenshots could not be captured in this session (the app's browser pane was hidden), so the visual pass was done through the DOM (row heights 78 px, radius 10 px, forest ring on the pick, every logo loaded, no overflow at 375 px). Store-credit toggle, promo, summary and pay button are untouched. The "Card · Soon" teaser is gone on purpose (owner choice).

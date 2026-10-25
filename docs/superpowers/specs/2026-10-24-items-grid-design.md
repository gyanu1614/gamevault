# Items Page Pet Grid + Stock Alerts — Design

Status: approved in chat by the owner, 2026-10-24 (option C on
https://claude.ai/artifact/T3SWy5kcGDhcPM2Fx3qtNR, without the Buy button). Branch `feat/items-grid`, stacked on
`feat/game-home`. Neither branch ships until both the game page and the item pages are revamped.

## Goal

On values games (Adopt Me, Steal a Brainrot, MM2, Steal an Egg), the Items page (`/[game]/[items category]`) shows
**one card per item** (Eldorado-style), not one card per listing.

- A card opens that item's page, which lists every offer for it, best first.
- An item nobody sells shows **Notify Me**: an in-stock email alert.
- Games without values keep today's listings page.

## Owner decisions

| Topic | Decision |
|---|---|
| Card | C: the listing-card shape. Text left (rarity, name, form chips, offer count), picture right, footer strip with "From $X". No Buy button: the whole card links to the item page. |
| Size | 4 per row at ≥1280px, 3 at ≥1024, 2 at ≥640, 1 on phones. Picture 96px (88 on phones). Card about 150px tall. |
| One-way links | Marketplace pages never link to value pages ([[values-to-market-one-way]]). |
| Out of stock | Notify Me. Full alerts in this build: table, trigger and email. |
| House rules | 10px cards, marketplace fill, hover lightens in place, fill only, Tabler icons, type tokens ([[house-design-checklist]]). |
| Release | Not before the game page and item page revamps are done. |

## Data

**Catalogue rows**
- `loadValueListRows(game)`: the same cached rows `/values` renders. Mapped to a compact `GridItem`:
  `{ slug, name, imageUrl, rarity, itemType, isNew, rankValue }`.
- `rankValue` is used only for ordering out-of-stock items and is never shown.

**Our stock**
- `getValueStock(game)`, listing-tagged. Per item: `{ count, minPriceUsd, forms: variant codes in stock }`.

**Card target**
- `/[game]/[category]/item/[slug]` (the existing item route).

**Unlinked listings** (no `value_item_slug`, e.g. bundles)
- A small "More Listings" block under the grid, using the existing listing cards.
- Hidden when there are none.

**Recommended order**
1. In stock first: offers desc, then the cheapest price.
2. Then out of stock: New first, then `rankValue` desc.

Cheapest and Priciest sort only in-stock items by `minPriceUsd`; out-of-stock items always follow.

**Filters** (client-side, over the full list)
- Rarity, Item Type (only when the game has types), Forms (variants in stock), Price range on `minPriceUsd`.
- Search by name.
- In-stock-only is implied by the price filter.

**Pagination**
- 24 per page (4×6), state in the URL via the existing `useUrlPage`.
- The first page renders on the server.

**Payload**
- The compact list ships with the page (about 700 rows × ~120 bytes). Revisit with a lazy `items.json` if a game grows
  past ~2,000 items.

## Stock alerts

**Table:** `stock_alerts`
- Columns: `id uuid pk`, `user_id uuid → auth.users on delete cascade`, `game_id uuid → games`, `item_slug text`,
  `created_at`, `due_at timestamptz null`, `notified_at timestamptz null`.
- Unique on `(user_id, game_id, item_slug)`.
- RLS on: a user can select, insert and delete their own rows.
- No anon access, and no update for users.

**Trigger:** `trg_listings_stock_alert_due`, AFTER INSERT OR UPDATE OF `status`, `value_item_slug` on `listings`.
- When `NEW.status = 'active'` and `NEW.value_item_slug` is not null, set `due_at = now()` on matching alerts where
  `notified_at` is null.
- SECURITY DEFINER with `search_path = public`.
- Not a money seam, so no `money_fault_hook` proof points.

**Dispatch:** `sendDueStockAlerts()`, server-only, service role.
- Reads due, un-notified alerts (with a cap) and emails each user.
- Email copy: "{Item} is back on DropMarket", Buy link to the item page.
- Sets `notified_at`. One alert fires once; the user can set it again.
- Called from `revalidateListingSurfaces` (the single listing-mutation seam), fire-and-forget, never failing the
  mutation.
- Backstop: the daily cron `/api/cron/stock-alerts`, authorised like the other crons.

**Button:** client component.
- Signed out: the sign-in dialog, returning to the page.
- Signed in: the server action `setStockAlert(game, item)` (session client, RLS insert). The button becomes "Alert Set"
  and can be cancelled.
- The user's alerts for the game are read client-side (personalisation stays client-side on static pages).

**Rules**
- Migration timestamp is the real current second.
- New function grants follow the service-role default.
- The email is mocked in tests.
- Integration tests clean up every row.
- The security review runs before finishing (user data plus email).

## Item page

- **Next:** an Eldorado-style redesign. Best offer plus a buy box on top, all offers below, with form chips.
- That design is shown on the canvas first, then built.
- In this build, only its "See {Item} Value" link is removed (one-way rule).

## Build order (one commit each, localhost check after 2 and 4)

1. **Grid model** (`src/features/items-grid/model/*`): mapping, order, filters, page slice, with unit tests.
2. **Grid UI:**
   - `ItemsGridPage` (header, seller prompt, filter row, search, grid, pagination);
   - `GridCard`;
   - the items route dispatch for values games;
   - "More Listings" for unlinked listings.
3. **Stock alerts DB:** migration, table, RLS, trigger, plus integration tests on the local stack.
4. **Alerts app:**
   - the server action;
   - the Notify Me button wired to the sign-in dialog;
   - `sendDueStockAlerts`, the email template, the seam call and the cron;
   - tests and the security review.
5. **One-way fixes:** item page value link removed; game-home Hot New "How To Get" becomes Notify Me.

## Testing

**Unit**
- Grid model: mapping, Recommended / Cheapest / Priciest order, filters, pagination slice.
- Alert copy.

**Integration (local stack)**
- RLS: own rows only.
- Trigger marks due on activation.
- Dispatch sends once and sets `notified_at`, with the email mocked.

**Guards**
- Public-route caching, listing-mutations-revalidate, DB grants allow-list, table posture.

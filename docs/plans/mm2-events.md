# MM2 Events archive — plan (2026-10-05)

Goal: rank for the seasonal MM2 event searches. Examples: "mm2 halloween 2025", "mm2 christmas event items", "mm2 halloween 2026 date", "mm2 event items value". Every event page also sends traffic into our item value pages and the marketplace. Owner rules apply: SEO-first copy ([[seo-first-copy]]), the UI section lessons (no card-in-card, numbered or toned section heads, slim callouts, full-width text, specific CTAs), and only true information.

## Data
- Seed: `scripts/values-seeds/murder-mystery-2.events.json` (researched; a source per event; newest first).
- Stored in the DB so it updates without a deploy:
  - Table `values_events`, with columns:
    - `game_id`, `slug`, `name`, `season`, `year`, `status`, `starts_on`, `ends_on`, `currency`, `format`
    - `summary`, `how_items_were_obtained`, `items jsonb`, `sources jsonb`, `confidence`, `checked_at`
  - Unique key on `(game_id, slug)`. Anon read, the same posture as `values_items`. No write grants.
  - Loader: `pnpm values:mm2:events [--write] [--env=local|prod] [--yes]`.
- Read through the tagged values read client, under the `values:<game>` tag (refreshed by the existing values-revalidate route).

## Pages
1. **`/murder-mystery-2/events`** — the hub.
   - H1: "MM2 Events: Every Murder Mystery 2 Event and Its Items".
   - Subtext is answer-first: how many events, since when, what's next.
   - Top: one row for the live or next event, e.g. "Next Up: Halloween 2026", with the honest date line (not announced; last year it started Oct 18) and a link to its page.
   - Then a timeline grouped by year, newest first. Each event is one row with:
     - season icon and tint, name, dates
     - item count and set value in USD (the sum of its items' cheapest prices)
     - up to 5 item thumbnails
   - Season filter chips (Halloween · Christmas · Easter · Summer · Other), driven by the URL through `SearchParamsBridge`.
2. **`/murder-mystery-2/events/[event]`** — one page per event (closed set; `dynamicParams=false` plus `notFound()`).
   - H1: "MM2 Halloween 2025 Event: Items, Values and How to Get Them".
   - Answer paragraph: when it ran, how items were obtained, how many items, what they're worth now, and whether they can still be obtained.
   - Facts line: Dates · Currency · Format (one compact card, no stat-card sprawl).
   - Blue callout: "Set Value: $X · Every item from this event at today's prices".
   - Items grid on the shared ValueCard: price, rarity and link to the item page. Items with no page show as plain cards.
   - "How Items Were Obtained" as numbered steps when the data supports it.
   - "Buy <Event> Items" CTA: the MM2 items page.
   - Same-season rail ("Other Halloween Events") plus FAQ JSON-LD:
     - "When did MM2 Halloween 2025 start?"
     - "Can you still get Halloween 2025 items?"
     - "How much are MM2 Halloween 2025 items worth?"
3. **Upcoming page** (e.g. halloween-2026):
   - Only what's known: no fake dates and no leaks.
   - "What to expect" based on the last 3 Halloween events, and "Last year's items and their values".
   - Updated when the event launches (data reload plus revalidate).

## Wiring
- `theme.ts`: add an `events` hub flag (MM2 on). HubNav gets an "Events" tab.
- Sitemap and indexable sets: the hub plus every event page.
- Public-route-caching guard: ISR, no cookies, no searchParams.
- Item pages: a small "From the Halloween 2025 Event" link back to the event page (internal links both ways).

## Order
Data and migration → loader → hub page → event page → nav, sitemap and backlinks → checks → owner review on localhost (prod data, read-only) → PR.

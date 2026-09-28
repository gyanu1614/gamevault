# Order flows — final fix pass (handoff)

Owner brief (2026-09-27): fix EVERY item below one by one, prove each with tests
(money is involved — "bulletproof"), then PR + merge. Follow every memory /
CLAUDE.md / design rule; don't touch other chats' worktrees. This is meant to be
the final pass on order flows. Owner will review after.

## Where
- Worktree: `.claude/worktrees/dispute-cards-proof-presence`, branch
  `fix/dispute-cards-proof-presence` (off origin/main `b3e9bf97`, PR #104 merged).
- Local stack: `pnpm db:up` (slot assigned in local-stacks.json), `.env.test` points at it.
  New migrations were applied locally with psql while iterating; the final gate
  MUST be `pnpm test:reset && pnpm vitest run` (applies through the CLI).
- `.env.local` is a symlink to main's (prod keys) — only for `pnpm dev`.
- Previous worktree `order-page-mobile` (PR #104) still exists; owner's phone dev
  server ran from it on :3002. Its stack is stopped (data kept).

## Release (when all done)
1. PR → merge.
2. Main checkout `~/gamevault`: `git pull --ff-only`, then
   `npx --no-install supabase db push --dry-run` — expect ONLY this branch's migrations:
   `20260927184110_messages_system_notices_and_read_only_history`,
   `20260927185652_order_dispute_resolve_seller_copy`,
   `20260927191606_listings_buyer_can_read_ordered`.
3. Owner OK → `db push` → verify dry-run "up to date" + probe.
4. `git push origin origin/main:release` (fast-forward check first).
The pg-delta `pgdelta-target-ca.crt` error during db push is harmless.

## Rules to keep (from memory/CLAUDE.md)
- Reply in short bullets; after each fix: Did / Test / Note.
- Phone fixes phone-scoped (`max-sm:`), PC untouched unless the item is data/logic.
- Title Case UI labels; no em-dashes in NEW UI copy; never say DropMarket "holds"
  funds / escrow (use "released", "Pending release").
- Skeleton (`loading.tsx`) must match any page layout change.
- Reuse existing components; Inter only; type tokens.
- Money: single RPC seams, `money_fault_hook`, service-role-only SQL functions
  (`REVOKE … FROM PUBLIC, anon, authenticated`), `SET search_path = public`,
  migration timestamps = real current second, never edit an old migration.
- Tests touching email must `vi.mock('@/lib/email')`; integration tests use
  `makeFixture()` (throwaway.ts) and clean every row they create.
- No `head: true` count queries.

## Done (committed on this branch)
1. `89e3c715` Dispute chat cards actually post (sender_id NULL = system notice,
   migration 20260927184110), message history read-only (UPDATE only is_read/read_at),
   `postOrderSystemNotice` (src/lib/chat/post-system-notice.ts),
   `src/lib/chat/system-notice.ts`, guard `messages-history.guard.integration.test.ts`.
2. `01400eeb` Seller presence: heartbeat mounted app-wide for approved sellers
   (`src/components/presence/SellerPresenceHeartbeat.tsx` in layout-wrapper),
   `isSellerOnline` (5-min window, `src/lib/presence/online.ts`), `useSellerOnline`
   polls via React Query (seller_presence NOT in realtime publication). Dot only for sellers.
3. `59ceafd9` Mark As Delivered proof photo path saved (`recordDeliveryProof` in
   orders.ts, own order folder only), note posted to chat; evidence signed on the
   order page; latest dispute only; orders-list badge Closed/Partial.
4. (commit) order_dispute_resolve seller copy by v_post — migration
   20260927185652 (verbatim copy, only seller notify changed); guard
   `dispute-seller-copy.guard.integration.test.ts` (6).
5. (commit) No "withdraw any time" copy (email, strip, auto-release); guard
   `seller-payout-copy.guard.test.ts`.
6. `f034d18c` Partial refunds: buyer gets dispute-resolved email (+wallet note),
   seller page shows real payout (dispute_resolutions.seller_payout_amount) +
   Refunded To Buyer row; guard `dispute-resolve-action.guard.integration.test.ts`.

7. (commit) #4 Cancelled-after-payment copy (escrowStatus 'refunded'); render test
   `src/app/account/orders/[orderId]/cancelled-copy.test.ts` (vitest only picks
   *.test.ts — use createElement, set globalThis.React).
8. (commit) #5 Wallet: real statuses, buyer rows w/o seller fee, sales math
   (sale=subtotal, fee=subtotal−payout, net=payout|0 refunded|kept partial),
   statuses paid..refunded, userId prop, LoadError states; helpers
   `src/lib/wallet/wallet-rows.ts` (+tests).
9. (commit) #6 Sold tab = Payout (saleRowAmounts), titles via orderDisplayTitle
   (+ useCurrencyMeta granularity/hasBundles), seller shop name.
10. (commit) #7 Dashboards: pendingPayoutOf / isPaidOrder, delivering active,
    buyer Total Spent = lifetimeSpentOf.
11. (commit) #8 Rewards parity: auto-release + admin release award cashback +
    referral (idempotent); partial excluded; guard `order-rewards`.
12. (commit) Cancellation approval: money first via single RPC
    (cancelOrderReturnWallet paid / refundOrderToWallet delivering|delivered),
    disputed refused, request approved only after; guard `cancellation-approval`.

13. (commit) #9 listings SELECT policy for buyers of the listing (migration
    20260927191606) + guard `listings-buyer-read`.
14. (commit) #10 disputeReasonFor (case-insensitive) + test reading the modal labels.
15. (commit) #11 instructions = listing.description (+active badge), #12
    delivery_details (hidden when empty), dead ordersApi.updateStatus/deliver
    removed, #21 seller orders refetchOnMount.
16. (commit) #13 getOrder seller trust fields; buyer/seller emails removed.
17. (commit) #14 chat realtime deps via refs + removeChannel; #15 chat open while
    disputed; #16 SLA from paid_at; #17 sellerDisplayName in chat (avatar
    resolved with username seed); conversation create race; mock
    DeliveryEvidenceUpload + src/lib/actions/delivery-evidence.ts deleted.
18. (commit) Order payload redacted per role (`src/lib/orders/redact.ts`,
    page.tsx) + #18/#19/#20 list status groups (`src/lib/orders/status-groups.ts`),
    formatted titles, visible load errors.
19. `20ca9014` #21 leftovers: no fake 'processing' filters in seller-compatible;
    unused earnings transactions fetch removed (held up the wallet skeleton).
20. `3e3a9384` #22 admin orders: requireAdmin, real statuses + frozen, search by
    order no./username/shop/listing (ids resolved, metachars escaped), stats
    (In Progress / Disputed / paged revenue+fees), detail fee breakdown, dead
    links removed; guard `admin-orders` (6).
21. `2a3970d9` #23 admin disputes: search (was raw .or() interpolation), order
    number shown, https icons, Resolved (7d) by resolved_at, paged stats, no
    /seller/orders revalidate; `src/lib/db/ilike.ts`; guard `admin-disputes-list` (5).
22. `6ea8ad62` #24 review "View Order" → /admin/orders for admin; guard `admin-order-links`.
23. `cc1c57a5` #25 Trustpilot cron as service role; sender moved to
    `src/lib/trustpilot/send-invitation.ts` (not a public action); route test.
24. `2a72351f` #26 live presence on listing grids (`useSellersPresence`) + storefront.
25. `69468e8e` #27 per-role order columns in ordersApi/buyerOrdersApi; guard
    `order-list-columns` (fails with select('*')).
26. `b1e24ebe` #28 `fetchAllRows` pager (orders lists, wallet, dashboards);
    guard `dashboards-paged`.
27. `a6606936` dispute review time = "24 to 48 hours" everywhere (guard); wallet memo.

Spawned (separate chats, NOT in this PR): admin dashboard/analytics stats
(fake statuses, 1000 caps); DB-level column privacy for orders (RLS returns the
whole row to both parties — app-side narrowing only).

## Remaining (numbered as reported to the owner)
Money
5. Wallet (`src/app/account/wallet/_WalletClient.tsx`): buyer Purchases shows the
   seller's fee (:783-786) → show buyer's total only; Sales "total_amount − fee" ≠
   seller_payout (:873-874) → subtotal − seller fee = seller_payout; status labels
   (:111-116, :180, :256): delivering/delivered/disputed show "Processing",
   completed shows "Delivered"; sales query filters `processing`/`confirmed`
   (don't exist) and drops delivering/disputed/refunded; queryFns use `user!.id`
   from useAuth instead of the `userId` prop (:336, :345); errors never rendered.
6. Seller orders list (`src/app/account/orders/page.tsx:910-911`) "Total" = buyer
   total_amount → show seller_payout for the Sold tab.
7. `seller-dashboard-v2.ts:139-143` pending payout + count include unpaid
   `pending`; wallet "Total Spent" (:129-131) includes pending (dashboard
   `buyer-dashboard.ts:70` counts completed only); `buyer-dashboard.ts:39`
   ACTIVE_STATUSES misses `delivering`.
8. Referral commission never recorded for auto-complete (`src/lib/escrow/auto-release.ts`
   releaseDueOrder) or dispute release; only afterBuyerRelease calls
   `recordReferralCommission` (idempotent per order). Check cashback parity too.
   Also `order-cancellation.ts:385-445`: approved before the money step; two TS
   calls (use the single RPC `order_cancel_return_wallet` via src/lib/wallet/order-money.ts,
   mark approved after success).
Order page
9. Buyer loses listing (title/image/game) once listing sold/paused: getOrder
   (`orders.ts:58-70`) joins listing via session client; RLS hides non-active
   listings from non-owners → fetch listing via service role after access check.
10. Dispute reason always "other": `_DisputeModal.tsx:28-34` Title Case labels vs
    `orders.ts` categoryMap sentence case → normalise (case-insensitive) + test.
11. "How To Receive Your Order" never renders: `_OrderClient.tsx` reads
    `listing.delivery_instructions` (not a column) → find the real field the sell
    wizard writes (check listings schema / sell wizard) or listing `description`.
12. "Username: Not Provided" always: reads `order.delivery_info` (real column
    `delivery_details`, checkout never writes it) → read delivery_details, hide
    the row when empty.
13. Seller card: getOrder seller select lacks is_verified, seller_rating,
    total_reviews, shop_slug (`orders.ts:50-57`) → add (check columns exist).
14. Chat stops receiving live messages: `ChatInterface.tsx` realtime effect deps
    include `order` (new object every render) → depend on stable ids, use refs,
    `supabase.removeChannel`.
15. Chat read-only during a dispute on an old completed order: `isChatExpired`
    must be false while status is `disputed`.
16. SLA timer resets on first seller message: page.tsx slaStartedAt prefers
    delivering_at → use paid_at ?? created_at.
17. Chat shows seller username vs header shop name: use `sellerDisplayName`
    for the seller in OrderClient chat props.
Also: conversation insert race in page.tsx (ignored error) → on conflict re-select;
`src/components/orders/DeliveryEvidenceUpload.tsx` is a shipped mock (unused) —
delete it (+ dead actions in `src/lib/actions/delivery-evidence.ts` if unused).
Lists
18. `orders/page.tsx:240-250` filters: "In Progress" has fake `processing`, lacks
    `pending`; "Completed" includes `delivered`; refunded only under All.
19. `:866` "x2000" → formatted quantity (toLocaleString / K-M).
20. `:174-187, :804-816` hook errors ignored → error state.
21. `use-seller-orders.ts:23` add refetchOnMount 'always' (stale after delivery).
    `seller-compatible.ts:1521, :784` filter on `processing`.
Admin
22. `admin/orders/components/order-filters.tsx:8-15` + `admin-orders.ts:6`
    status options (no processing; add delivering/delivered/disputed); search
    only order_number (:116-121) → also buyer/seller username/listing title;
    `admin/orders/[orderId]/page.tsx:217` `platform_fee_percentage` → `platform_fee_rate`
    (NaN%); `:314` link `/admin/users/:id` doesn't exist → real admin user route.
23. `admin/disputes/components/disputes-table.tsx:155-168` image_url check
    (startsWith('/') fails on https) + show order number + search more than title;
    `admin-disputes.ts:575-580` "Resolved (7d)" use resolved_at; `admin-orders.ts:184-203`
    disputed count misses statuses, revenue sums capped at 1000 rows (config.toml
    max_rows) → paginate/aggregate; `orders-table.tsx:140` payout badge gets label
    not key, `frozen` unmapped; `admin-disputes.ts:481,483` revalidate `/seller/orders` (no route).
24. Admin "View Order" from reviews 404s: `ReviewsPageClient.tsx:499`,
    `ReviewCard.tsx:178` link `/orders/<id>`; `checkOrderAccess` excludes admins →
    admin links to `/admin/orders/<id>`.
Other
25. Trustpilot cron (`api/cron/send-trustpilot-invitations/route.ts:27`,
    `lib/actions/trustpilot.ts:37`) uses cookie client → service role.
26. Marketplace online dots (`_GenericListingsClient.tsx:226`,
    `_genericListingFilters.ts:134`) read raw is_online on a 24h ISR page → use
    isSellerOnline + client refresh; `SellerStorefront.tsx:83` hard-codes false.
27. `seller-compatible.ts:331, :480` `select('*')` sends the other party's private
    order fields to the browser → explicit column lists.
28. No pagination: lists capped at 1000 silently → range-loop with ORDER BY.
Minor: dispute modal "within 24 hours" vs email "24–48 hours" — align.

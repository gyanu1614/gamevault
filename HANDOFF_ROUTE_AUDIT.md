> **STATUS (updated 2026-06-30): all 9 HIGH-severity findings FIXED.**
> 1. /listings/[id] logged-out buy → opens AuthDialog in place (+ /checkout/[id] path form). ✅
> 2. /listings/[id] seller card /sellers/[id] → /shop/[username]. ✅
> 3. /buy/[seoSlug] /seller/register → /account/become-seller (page ×2 + sitemap + email). ✅
> 4. /checkout dead "Pay" button → lifted shared handlePay to CryptoPayPanel + OrderSummary, relabeled "Pay with crypto". ✅
> 5. /reviews fake mock data → redirect to /account/reviews (orphan). ✅
> 6. /account/listings/new 1624-line orphan → permanentRedirect('/sell/new'). ✅
> 7. /account/wallet/connect emerald→success, violet→lime, rounded-2xl/xl→lg. ✅
> 8. /auth/reset-password PKCE recovery-session fix (was: valid links showed "expired") + purple→lime + gray→tokens. ✅
> 9. /(marketing)/vaultshield violet/blue → lime (kept amber); color union → lime|amber. ✅
> Remaining: 30 medium + 43 low (mostly batchable UI drift + some bugs) — below.

## Summary

**Counts by severity:** 8 high · 23 medium · 30 low (61 confirmed findings across 26 routes).

**By dimension:** UI ~38 (shape/color/surface/primitive consistency) · bug ~11 · complexity ~9 · auth ~4.

**The single most important theme:** broken navigation and dead controls on the public buy path. Logged-out users hit hard `/login` bounces instead of the AuthDialog (`/listings/[id]`), seller cards and "Become a Seller" CTAs are 404 dead-ends, the most prominent "Pay" button on checkout is wired to a non-existent form, and `/reviews` ships fabricated mock reviewers. These break conversion and trust on user-facing routes and should lead the queue. Below that sits a large, mostly batchable layer of design-system drift (rounded-2xl/xl on cards, forbidden violet/blue/emerald accents, hand-rolled controls).

---

## Fix-list by route (user-journey order)

### /[gameSlug] (game browse page)
- **[medium · ui]** `page.tsx:141,280,337,339,332` — page never re-skinned: raw black-box surface (`from-black via-gray-900 to-black`), off-palette `to-blue-500/20` preview gradient, `text-white` hardcoded 9×, `rounded-xl` cards. → Re-skin to match siblings: `bg-bg-base`, `text-text-primary`, lime/neutral gradient instead of blue, and `rounded-2xl` cards (the redesign standard — NOT rounded-lg). Leave platinum `text-cyan-400` (L332) and the `rounded-2xl` logo (L159) alone; both already match the redesigned `[categorySlug]` reference.
- **[medium · ui]** `page.tsx:349-350` — price pill uses `text-white` on `bg-lime` (~1.3:1 contrast). → Change to `text-text-inverse` (the dominant 115-occurrence convention).
- **[low · bug]** `page.tsx:229-235` — "Recent Listings → View All" links to `/${gameSlug}`, the same page. → Point at a real all-listings destination or remove the affordance.
- **[low · complexity]** `[gameSlug]/` dir — no `loading.tsx` (siblings have one); three sequential awaits cause a blank pause. → Add a `loading.tsx` skeleton; parallelize the 2nd/3rd fetches (`getCategoryListingCounts`, `getFeaturedListings`) with `Promise.all` (getGameData must stay first — it gates `notFound()`).

### /browse
- **[medium · complexity]** `page.tsx:55-69` — entire public catalog (games/categories/listings) fetched client-side via react-query with `force-dynamic`; ships skeletons until resolve, hurting FMP/SEO. → Server-render the initial set with the server Supabase client; hydrate filters on the client and keep react-query for filter-driven refetches.

### /[gameSlug]/[categorySlug] (category / currency / items / bundle)
- **[medium · ui]** `page.tsx:660,672,793` — hero wrapper, game-logo tile, and ListingCard all `rounded-2xl`. → `rounded-lg` for hero/card, `rounded-md` for the small logo tile (per HANDOFF.md §5.1).
- **[low · ui]** `_ItemsPageClient.tsx:243,248,665,666` — game-logo tile and EmptyState panel/badge use `rounded-2xl`. → `rounded-lg` panels, `rounded-md` icon badge.
- **[low · ui]** `_CurrencyPageClient.tsx:1290-1377` — FAQ accordion is a private hand-rolled copy of the exported `_CurrencyMeta.FAQ`. → Import the shared `_CurrencyMeta.FAQ` like the bundle page does (DRY cleanup; a11y is already correct).
- **[low · ui]** `_BundleCurrencyPageClient.tsx:274,385,555,568,859` — card surfaces inline `bg-[rgba(20,20,27,0.56)] backdrop-blur-md`, byte-for-byte the `.card-frost` utility. → Swap to `className="card-frost"` / `card-frost-hover`. (Drop the `text-info` accent sub-claim — the multi-color TrustBand icons are intentional.)

### /[gameSlug]/[categorySlug]/[listingSlug] (listing detail)
- **[medium · bug]** `page.tsx:124-129,298` — `getListing()` writes/reads the legacy `views` column while the real counter is `view_count`; ViewTracker already increments `view_count`, so displayed views are stale and the server write is a redundant wrong-column bump. → Remove the manual update in `getListing`; read `listing.view_count` in `shapeMini`/`shaped`.

### /listings/[id] (legacy listing detail — public, reachable)
- **[high · auth]** `page.tsx:250-256` — logged-out "Buy now" does `router.push('/checkout?...')`; `/checkout` is protected, so middleware hard-redirects to a full `/login` page, losing listing context. → Import `useAuthDialog`; on click with no `user`, call `openAuth('login', { redirect: ... })` like `_ListingDetailClient.tsx:142,174`. (Match an existing checkout convention for the redirect string — the path-param `/checkout/${id}` vs this page's query-string form differ.)
- **[high · bug]** `page.tsx:288-290` — seller card links to `/sellers/${id}`, a route that doesn't exist (only `/shop/[slug]`). Every click 404s. → `href={`/shop/${listing.seller.username}`}` (username already in scope).
- **[medium · bug]** `page.tsx:388-394` — "Report this listing" button has no `onClick`; dead control. → Wire a report flow or remove until implemented.
- **[medium · ui]** `page.tsx:132,195,236,264,289,342` (+68,89) — card/panel containers use `rounded-2xl`. → `rounded-lg`.
- **[low · complexity]** `listings/[id]/` dir — no route-level `loading.tsx` (siblings ship one); relies on in-component skeleton. → Add `loading.tsx` for consistency. (Skip the `error.tsx` half — no route in the app has one.)

### /buy/[seoSlug] (SEO buy landing)
- **[high · bug]** `page.tsx:236-241,435-440` — "Sell Instead" / "Become a Seller" both link `/seller/register`, which doesn't exist. → Point to `/account/become-seller` (the real, middleware-whitelisted onboarding entry). Note: the same dead link also appears in `sitemap.ts:32` and `lib/email/index.ts:159`.
- **[medium · ui]** `page.tsx:230` — primary lime "Browse All Listings" CTA hardcodes a violet glow `rgba(139,92,246,0.6)`. → Replace with `hover:shadow-glow` (lime token).

### /cart
- **[low · ui]** `page.tsx:23` — transient redirect renders `bg-black`. → Use `bg-bg-base`, or better, convert to a server-side `redirect()` to avoid the flash entirely.

### /checkout/[id] + layout
- **[high · bug]** `CheckoutForm.tsx:893-912` — the prominent lime "Pay with Card" CTA is `<button type="submit" form="checkout-form">` but no `#checkout-form` element exists; in the enabled Card state it does nothing. The real trigger is CryptoPayPanel's own onClick. → Convert to `type="button"` calling a lifted `handlePay`, or wrap a real `<form id="checkout-form" onSubmit={handlePay}>`.
- **[medium · complexity]** `_PaymentMethodPicker.tsx` (whole file) + `CheckoutForm.tsx:39,315,1048-1069,1131` — PaymentMethodPicker imported but never rendered; `step` is frozen at 2, so step-1 markup, `StepBar`, `paymentMethodLabel`, `setPaymentMethod`, and brand-icon imports are dead. Summary CTA says "Pay with Card" while the panel is crypto-only. → Either wire the picker back in, or delete the dead code and make the CTA say "Pay with crypto" to match reality.
- **[medium · ui]** `loading.tsx:20,120` — skeleton shells use `rounded-2xl` and model an old Back-chip + StepBar layout that no longer matches the full-bleed 50/50 page. → `rounded-lg` shells; rebuild skeleton to mirror the current two-column split.
- **[low · ui]** `CheckoutForm.tsx:1451` — payment-error panel uses `rounded-2xl`. → `rounded-lg` (note: local panels use `rounded-xl`; reconcile to one).
- **[low · ui]** `CheckoutForm.tsx:434`, `_PaymentMethodPicker.tsx:159` — VaultShield fee chip and "Soon" badge use `rounded-full`. → `rounded-md`.
- **[low · complexity]** `checkout/_TrustMarquee.tsx` (entire file) — exported but never imported; footer hand-renders a static line. → Delete the file, or mount `<TrustMarquee />` if intended.

### /notifications
- **[medium · bug]** `page.tsx:120-123` — `router.replace('/login')` called in the render body (React anti-pattern, can loop) with no redirect param. → Move into `useEffect`; use `?redirect=${encodeURIComponent('/notifications')}`; render loader/null while redirecting.
- **[medium · bug]** `page.tsx:84-110` — `markAsRead`/`markAllRead` destructure `{ error }` but never check it; failures silently invalidate and show no feedback. → Check `error`, `toast.error` on failure (sonner already in app), invalidate only on success.
- **[medium · ui]** `page.tsx:36,42` — `order_placed` uses blue, `payout` uses emerald (forbidden). → `bg-info-bg/text-info` and `bg-success-bg/text-success`; fix the stray quoted `'text'` key on L42.
- **[medium · ui]** `page.tsx:126` — page wrapper is opaque `from-black via-gray-900 to-black`. → Render its own `<HeroBackdrop>` (the route has none), then transparent shell + `card-frost` panels.
- **[low · ui]** `page.tsx:157-175` — All/Unread tabs are raw `<button>`s. → Use `Tabs/TabsList/TabsTrigger` from `@/components/ui/tabs`.
- **[low · complexity]** `notifications/` dir — no `loading.tsx` while sibling account routes have one. → Add an inbox-shaped `loading.tsx`. (Skip `refetchIntervalInBackground:false` — that's already the default; no-op.)

### /account (hub)
- **[medium · ui]** `page.tsx:145,148` — cards `rounded-2xl`, icon tile `rounded-xl`. → `rounded-lg` card, `rounded-md`/`rounded-lg` icon tile.
- **[low · auth]** `page.tsx:34` — server gate redirects to `/login` with no redirect param (layout gate passes one). → `redirect(`/login?redirect=${encodeURIComponent('/account')}`)`.

### /account/messages
- **[low · complexity]** `page.tsx:91-100` — loading branch is a bare spinner instead of the existing `messages/loading.tsx` skeleton, causing a shape flash on every visit. → Reuse the loading.tsx skeleton for the in-component branch.
- **[low · ui]** `page.tsx:251` — order banner panel uses `rounded-xl`. → `rounded-lg` (sibling panels at 113/212 already use it).
- **[low · ui]** `page.tsx:347` — composer uses deprecated `onKeyPress`. → Switch to `onKeyDown` (ideally add an `isComposing` guard).

### /reviews (top-level)
- **[high · complexity]** `page.tsx:26-93` — entire page is hardcoded `mockReviews` ("// TODO: Replace with real data fetch"); every logged-in user sees fake reviewers (gamer123, proplayer) and fabricated stats. → Replace with a real Supabase fetch (reviews written + received), wire real empty states, add `loading.tsx`. (Note: this top-level `/reviews` is also effectively orphaned — all nav points to `/account/reviews`; consider deleting/redirecting instead.)
- **[medium · ui]** `page.tsx:209,223,237,251,239,253,392,393` — forbidden stat-card gradients (yellow→orange, green→emerald, blue→cyan, purple→pink) and blue/purple accent text. → Replace those gradients/accents with the lime token set. Leave `bg-primary`/`text-primary` (L182,273,285,385-386,401) alone — `--primary` already resolves to lime.
- **[medium · ui]** `page.tsx:209,223,237,251,266,292,333,347,352` — `rounded-xl` on cards/tabs/filter; opaque gradient surfaces instead of `card-frost`. → `rounded-lg`; align surfaces to `card-frost`/`bg-bg-raised`.
- **[low · ui]** `page.tsx:316-327` — rating filter is a native `<select>`. → Optional: shadcn `Select`. (Low: native `<select>` is the dominant pattern; "bg-primary ring" detail is inaccurate.)

### /account/orders
- **[low · complexity]** `page.tsx:104-108,313-322` — client-side redirect-bounce duplicating the middleware gate; bespoke full-screen loader. → Rely on the middleware gate (drop the effect) or render the standard `loading.tsx` surface.
- **[low · complexity]** `page.tsx:111-120,127-169` — always fetches both buyer + seller orders (no `enabled` gate) plus two follow-up client Supabase queries for disputes. → Gate the unused tab's fetch; fold the dispute-resolution lookup into the server/hook query.
- **[low · ui]** `page.tsx:787` + `loading.tsx:58-61` — status pills use `rounded-full`; skeleton still shows `rounded-full` filter chips while the live page uses `rounded-lg` dropdowns. → `rounded-md` pills; update skeleton to `rounded-lg` dropdown placeholders. (L837 is an avatar — correctly excluded.)

### /account/orders/[orderId]
- **[medium · ui]** `page.tsx:69` — `delivering` status uses `dot: 'bg-violet-400'` while its pill is lime; every other row matches dot to pill family. → `bg-lime`.
- **[low · bug]** `_ActionPanel.tsx:164-167` — dead component (never imported); flip-confirm onClick is a no-op TODO. → Delete the file, or wire the confirm to the real server action before rendering.
- **[low · ui]** `loading.tsx:17` — skeleton uses opaque `from-[#0a0a0f]` gradient, `max-w-6xl`, `[1fr_360px]` while the real page is transparent hero, `max-w-[1400px]`, `[1fr_412px]`. → Match the real shell (transparent, 1400px, `1fr_412px`).

### /account/wallet (+ /connect)
- **[high · ui]** `wallet/connect/page.tsx:127-136,158,192,265,280,307,338,358` (+ GlassCard) — forbidden emerald success banner / earnings card, `rounded-xl`/`rounded-2xl` on banners/cards/badges/buttons, GlassCard defaults to `rounded-xl`. → Replace emerald with `success`/lime tokens; `rounded-lg` (rounded-md small controls); pass `rounded="lg"` to GlassCard.
- **[medium · ui]** `wallet/connect/page.tsx:91,284` — spinner `border-t-violet-500`, button `focus-visible:ring-violet-500`. → `border-t-lime`, `focus-visible:ring-lime`.
- **[medium · complexity]** `wallet/connect/page.tsx:41-57` — raw `fetch` in `useEffect` with hand-rolled state (sibling wallet uses react-query); no `loading.tsx`. → Use `useQuery`; add a `loading.tsx`.
- **[medium · ui]** `wallet/page.tsx:568-569` — buyer balance card uses opaque `bg-black/40 backdrop-blur-sm`; seller cards use `card-frost`. → Swap inner surface to `card-frost`.
- **[low · ui]** `wallet/page.tsx:269,948` — status pills use `rounded-full`. → `rounded-md`.
- **[low · bug]** `wallet/page.tsx:251-257` — `failed` status mislabeled as "Cancelled"; `fetchPurchases` emits `cancelled`/`refunded` via `as any` past a too-narrow union. → Give `failed` its own label; widen `PurchaseTransaction.status` to include `cancelled`/`refunded` and drop the cast.
- **[low · complexity]** `wallet/page.tsx:95,154,178,338,340` — verbose per-fetch `console.log` in production client path (L178 dumps sales data). → Remove debug logs; keep `console.error`.
- **[low · ui]** `wallet/page.tsx:711-723` — status filter is native `<select>`. → Optional shadcn `Select`. (Low: native `<select>` is consistent across all account pages — the "loses consistency" framing is backwards.)

### /account/listings (+ /new)
- **[high · ui]** `listings/new/page.tsx` (1624 lines) — orphaned pre-redesign duplicate of `/sell/new`, URL-reachable, violating nearly every rule (`bg-black`, rounded-2xl/xl, violet/purple/cyan accents). → Convert to `permanentRedirect('/sell/new')`, exactly like the sibling `listings/[id]/edit/page.tsx` redirects to `/sell/edit/[id]`. This supersedes the individual styling fixes below.
- **[medium · complexity]** `listings/new/page.tsx:157-174` — hand-rolled `Toggle` instead of the shared Radix `Switch` (`@/components/ui/switch`). → Replace with `Switch` (maps cleanly: `enabled/onChange` → `checked/onCheckedChange`). Note: this is a LIVE middleware-gated route, not dead code — the redirect fix above is the cleaner resolution. (The platform-select pills sub-claim is a non-issue — a pill button group is fine.)
- **[medium · ui]** `listings/page.tsx:178,195,904` — StatusBadge pills and low-stock chip use `rounded-full`. → `rounded-md`. (L764/872 are genuine circular badges — correctly excluded.)
- **[low · bug]** `listings/page.tsx:293` — no-image fallback hardcodes indigo `placehold.co/.../6366f1/`. → Swap to a neutral/dark-gray or lime hex. (The view/edit/copy URL-scheme difference is intentional/documented — not a bug.)

### /account/analytics
- **[medium · bug]** `page.tsx:60-91,149,359,363` — overview cards ship hardcoded fake deltas (`+12.5%`/`+8.2%`/`+3.1%`/`+5.4%`, all `trendUp:true`); "Quick Insights" claims "Revenue increased by 12.5%" and a fabricated "higher than average sellers" benchmark. → Compute deltas from `revenueTrend`/period-over-period, or remove the trend badges and the fabricated insight copy.
- **[medium · ui]** `page.tsx:363,369,314,141,164,213,260,344` — `text-green-100`, `text-yellow-100`, `fill-yellow-400`, and `bg-gradient-to-br from-white/5...` glass cards instead of `.card-frost`. → `text-success`, `text-warning`, `fill-warning`, and `.card-frost` surfaces. (Leave the lime `from-primary` bars and #1 rank badge.)

### /account/reviews (live)
- **[low · ui]** `page.tsx:351` — Submit Response button is `from-primary to-purple-600` (lime→literal purple). → Replace `to-purple-600` with a lime token. (Skip the `fill-yellow-400`→`fill-warning` and card-frost-conversion suggestions — both match the analytics sibling; changing them would *break* consistency.)
- **[low · ui]** `page.tsx:193-216` — Received/Given tabs are hand-rolled `<button>`s. → Use the shared `@/components/ui/tabs`. (The rating filter at 219-241 is a filter grid, not tabs — leave it.)

### /account/wishlist
- **[low · ui]** `page.tsx:186-196,316,404` — game filter is native `<select>` (siblings use the shared Combobox); Buy Now buttons have a no-op `hover:bg-lime` (hover == base). → `hover:bg-lime-hover` on both buttons (real fix); optionally migrate the select to the shared Combobox.
- **[low · bug]** `page.tsx:255,347` — row navigation `router.push(`/${game?.slug}/${category?.slug}/${slug}`)` yields `/undefined/...` when nullable fields are missing (sibling listings page guards with `|| 'game'` etc.). → Guard the slugs or fall back to `/listings/[id]`. (Ignore the "logged-out" framing — useWishlist only fetches when authed.)

### /account/seller-status
- **[medium · ui]** `page.tsx:390,430,448,467,569-616` — opaque `from-black via-black/95 to-black/90` backdrop (this is a no-sidebar page expected to render its own HeroBackdrop) with `ring-4 ring-black` nodes; hand-rolled withdraw modal lacking focus-trap/escape. → Render `<HeroBackdrop>` instead of the black gradient; replace the modal with the shared Radix `Dialog` (precedent: `listings/page.tsx:675`).
- **[medium · ui]** `page.tsx:177,184,197,224,290,339-340,476` — raw `yellow-500`/`green-500`/`gray-500` literals mixed with semantic tokens in the same classNames. → `warning`, `success`, `text-tertiary`/`border-subtle`.

### /account/restrictions
- **[low · ui]** `RestrictionStatus.tsx:34,144,203,259-333` — `rounded-xl` + `bg-bg-overlay`/`bg-black/30` surfaces (not `card-frost`+`rounded-lg`); hand-rolled framer-motion history modal. → `rounded-lg` + `card-frost`; replace the modal with the shared Radix `Dialog`. (Note: issue says `rounded-2xl` but it's actually `rounded-xl`.)
- **[low · bug]** `page.tsx:17-20,53-59` — when `getUser()` returns no user the effect `return`s without `setLoading(false)`, leaving a permanent spinner on a session-race/middleware-miss. → On `!user`, `setLoading(false)` and redirect to `/login?redirect=/account/restrictions`.
- **[low · auth]** `middleware.ts:43-47` — `/account/restrictions` isn't in `isSellerOnlyRoute`, so a buyer (whose `seller_status` defaults to `'active'`) sees "Account Active" seller copy. → Add it to the seller-only route check, or gate the page on real seller-application state (note: `seller_status` is never *absent*, so the "absent" fix won't fire).

### /account/become-seller
- **[low · auth]** `AuthGate.tsx:32`, `seller-status/page.tsx:57` — redirect param hardcoded rather than derived from `usePathname()` (unlike `SellerOnlyGate`). → Derive from `usePathname()` for consistency. (Functionally fine today — both are leaf routes.)

### /account/inform-disclosure
- **[medium · ui]** `InformDisclosureClient.tsx:303-325` — consent checkbox is a clickable `<div>` with inline-SVG check; no `role=checkbox`/keyboard support on a legal consent gate. → Replace with the shared Radix `Checkbox` + `<label>` (precedent: `listings/page.tsx:627,857`).
- **[low · complexity]** `InformDisclosureClient.tsx:159` — `window.location.reload()` after submit on a server-component page. → Use `router.refresh()`.

### /account/loyalty · /tiers · /referral · /privacy
- **[low · complexity]** `loyalty/page.tsx:18` — no route-specific `loading.tsx` (sibling pattern). → Add a layout-matched `loading.tsx`. (Lower than claimed: the parent `account/loading.tsx` already covers it via Suspense.)
- **[low · ui]** `tiers/page.tsx:139` — "How tier upgrades work" panel uses `rounded-xl` + `bg-bg-overlay` while siblings use `rounded-lg` + `card-frost`. → `rounded-lg` (ideally also `card-frost` + `p-6` for full consistency).
- **[low · ui]** `referral/ReferralClient.tsx:78` — status pill uses `rounded-full`. → `rounded-md`. (The step-number badges at L229 are circular numeric badges — leave them.)
- **[low · ui]** `privacy/PrivacyClient.tsx:139` — Download JSON uses `hover:bg-lime/90`. → `hover:bg-lime-hover` (also appears in wallet/withdraw and navbar — minor app-wide nit).

### /auth/reset-password
- **[high · ui]** `page.tsx:~143,177,210` — password inputs use `focus:ring-purple-500`, submit is a `from-purple-600 to-indigo-600` gradient. → Lime tokens, or better, switch to shared `@/components/ui/{input,button}`. (Cited line numbers are off by a few.)
- **[medium · ui]** `page.tsx:~94,135-191,207` — hand-rolled form on `bg-gray-900/gray-800` greys with manual show/hide toggles instead of shared primitives. → Rewrite with `@/components/ui/{input,label,button,alert}` (as `/forgot-password` does); swap gray literals for tokens.
- **[medium · bug]** `page.tsx:~20-28` — validity gated only on a hash `access_token`, but the client uses PKCE (code via query param) and there's no `/auth/callback` handler or `PASSWORD_RECOVERY` listener, so valid recovery links wrongly show "Invalid or expired"; also never confirms a session before `updateUser`. → Confirm the recovery session via `PASSWORD_RECOVERY` event / `getSession()`; gate the form on that; surface the real `updateUser` error.

### /(marketing)/vaultshield
- **[high · ui]** `page.tsx:104,109-110,145,151,324,338,408,412,448-452` (+372 color union) — pervasively violet/blue (both forbidden) on a public marketing page: hero gradient, shield badge, feature colors, CTA panel, primary CTA button, featured pricing ring/pill, pulse badges. → Replace all violet/blue with the lime system; refactor the `'blue'|'violet'|'amber'` color union to lime-based variants (and remap amber/green for full compliance).

### /sell/new · /sell/bulk
- **[low · ui]** `SellWizard.tsx:1003,955,1536,1541,2183,2191,2870,2881,3141` + `sell/new/loading.tsx:19,46` — wizard shell `rounded-3xl`, sub-panels `rounded-2xl`. → `rounded-lg`; update loading.tsx in lockstep. Note: this is a *deliberate, documented* choice in the now-stale `HANDOFF_SELL_WIZARD_DESIGN.md:55-56`; reconcile/retire that doc, since HANDOFF.md's override clause now bans rounded-2xl/3xl.
- **[low · ui]** `BulkUpload.tsx:268,288,343,374,412` — same `rounded-3xl`/`rounded-2xl` panel pattern as the wizard. → `rounded-lg` (apply alongside the wizard for consistency).
- **[low · complexity]** `sell/bulk/page.tsx` — `force-dynamic` server component awaiting `fetchSellCategories()` with no `loading.tsx` (siblings have one). → Add `sell/bulk/loading.tsx`, e.g. `export { default } from '../new/loading'`.

---

## Quick wins vs. deeper work

**Quick wins — batchable trivial fixes (mostly one-line className/string swaps):**
- **Shape rule (rounded-* → rounded-lg/md):** listings/[id] cards, category page (660/672/793), _ItemsPageClient, checkout error panel + loading shells + chips, account hub, messages order banner, orders status pills + loading, wallet pills, listings StatusBadge/low-stock, tiers panel, referral pill, restrictions cards, sell wizard + bulk panels. One coordinated pass.
- **Forbidden-color swaps:** buy/[seoSlug] violet glow, notifications blue/emerald, orders/[orderId] violet dot, analytics green-100/yellow-100/yellow-400, account/reviews purple-600, wallet/connect violet spinner/ring, seller-status yellow/green/gray literals, listings indigo placeholder. (Reviews `/reviews` + vaultshield are larger color refactors — see deeper work.)
- **Token/hover nits:** wishlist `hover:bg-lime`→`hover:bg-lime-hover`, privacy `hover:bg-lime/90`, [gameSlug] price pill `text-white`→`text-text-inverse`.
- **Copy/labels & cleanup:** wallet "failed"→"Failed" label, notifications stray quoted `'text'` key, wallet debug `console.log` removal, delete dead files (`_TrustMarquee.tsx`, `_ActionPanel.tsx`), `onKeyPress`→`onKeyDown`.
- **Broken links (small but high-value):** seller card `/sellers/`→`/shop/${username}`, `/seller/register`→`/account/become-seller` (incl. sitemap + email), "View All" self-link, wishlist slug guards, redirect-param consistency.

**Deeper work — real refactor / migration / data wiring:**
- **`/reviews`** — wire real review data (or delete/redirect the orphan) + add loading/empty states.
- **`/account/listings/new`** — convert the 79KB orphan to `permanentRedirect('/sell/new')`.
- **Checkout** — fix the dead Pay CTA (form wiring or lifted handler) and resolve the PaymentMethodPicker dead-code/mislabel.
- **`/listings/[id]` buy flow** — wire `useAuthDialog` for the logged-out buy path.
- **`/auth/reset-password`** — fix the PKCE recovery-session validation (add callback/event handling) and rewrite with shared primitives.
- **`/browse`** — server-render initial catalog, hydrate filters.
- **`/account/analytics`** — compute real trend deltas / remove fabricated insights.
- **Surface migrations to `card-frost`** — wallet buyer card, notifications, seller-status backdrop, analytics/reviews glass cards.
- **Hand-rolled → primitive migrations** — Radix `Switch` (listings/new), `Dialog` (seller-status, restrictions), `Checkbox` (inform-disclosure), `Tabs` (notifications, account/reviews).
- **Data/perf** — listing view-count column fix; orders over-fetch + dispute queries; wallet/connect react-query migration.

---

## Dismissed (for transparency)

- **/listings/[id] cyan/emerald/amber accents** → false rule; the cited "approved" reference and navbar use the same cyan/amber, and these are intentional tier/semantic colors (collapsing to lime erases tier hierarchy).
- **/listings/[id] "Message seller" auth-bounce** → not inconsistent: the buy action uses the identical middleware redirect; no AuthDialog pattern exists in this file to be inconsistent with.
- **/buy/[seoSlug] emerald / rounded-2xl / <details> FAQ** → emerald is the sanctioned success color; rounded-2xl is the documented sub-card radius; no Radix Accordion exists to swap to (native `<details>` is fine).
- **/browse EmptyState rounded-2xl** → fabricated line number (457 doesn't exist) and would diverge from the file's own sibling filter panel (line 281), which uses the identical class.
- **/[gameSlug]/[categorySlug] currency EmptyState/SeoBlock/tooltip radii** → no rounded-lg-only rule; the file intentionally mixes radii and scopes rounded-lg to the OrderCard family.
- **/[listingSlug] _ListingDetailClient cyan tier + hand-rolled FAQ** → cyan is not in the forbidden list; remapping platinum would collide with silver. No Accordion primitive installed.
- **/checkout/[id] pervasive rounded-xl** → rounded-xl is the dominant card radius (512 uses) and checkout intentionally mirrors the sell-wizard chrome; no rounded-lg-only rule.
- **/notifications tab/card rounded-xl** → same fabricated radius rule; rounded-xl is the established card convention app-wide.
- **/reviews bg-black + raw <img> avatar** → orphaned dead page (nothing links to bare /reviews); the live /account/reviews uses raw `<img>` by design, so the suggested next/image fix is wrong. Correct action is delete/redirect.
- **/account/referral missing loading.tsx** → parent `account/loading.tsx` already provides the Suspense fallback; navigation does not block. Only a minor polish nicety, not a defect.
- **/account/become-seller AuthGate bg-black** → the account layout intentionally excludes become-seller from HeroBackdrop and the gated registration flow is solid-dark by design; the loader is consistent, and the proposed fix would create a flash.
- **/(marketing)/vaultshield rounded-2xl/rounded-full** → fabricated radius rule; rounded-full text pills and rounded-2xl panels are canonical patterns. (The color violations on this page are real and kept above.)
- **/sell/new category-tile gradients** → the per-category rose/sky/violet gradients are explicitly prescribed in the wizard's own design doc as decorative category identity; recoloring would contradict the spec.
- **/sell/new opaque wizard surface (not card-frost)** → no codebase-wide "frost over hero" rule; the marketplace route group is also hero-backed and intentionally opaque. The opaque shell is documented as matching the marketplace precedent.
- **/sell/edit/[id] layout hardcoded redirect=/sell/new** → middleware runs before layouts and sets the correct `?redirect=pathname`; the layout's hardcoded redirect is unreachable for logged-out users, so the described mis-redirect cannot occur.
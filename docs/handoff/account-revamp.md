# Account Section Revamp + Marketplace Polish (session 2026-09-29)

Branch `fix/account-section-revamp` (worktree `.claude/worktrees/account-revamp`), off
origin/main b37324c2, main merged once (12b3d6ff, brought in #125 buyer-fee-refund-policy).
Local commits only (NOT pushed, no PR yet): 01ffea51, 12b3d6ff, 0bcc7e99, 26266a2e, 1cfee3bc,
+ currency/navbar work after this doc. Owner tests on `pnpm dev -p 3003` in the worktree
(phone: http://192.168.4.35:3003).

## What the owner asked for (in order)
1. Remove the wishlist page.
2. Check every /account sidebar page's auth + redirects ("weird loaders first, then a wrong skeleton").
3. Fix the Settings page look/alignment first, then every page's skeleton.
4. Whole account section to the new design (containers, no oversized modals, motion, not AI-slop), blue VerifiedBadge.
5. Make the notification switches real ("make the buttons work").
6. Push the migration so notifications work.
7. Scroll rows: GameBoost style (chevron in the row, dark fade), not floating round buttons.
8. Filters / rows sized like GameBoost (measured on gameboost.com).
9. Phone menu (hamburger drawer) premium, no green.
10. Currency pages premium, no outlines.
11. Premium Buy Now button, navbar + every navbar dropdown, bold/premium icon library, profile
    dropdown (Seller Dashboard row, Sell button, tier label). DONE (pass 5).
12. Disable Top Up everywhere (Fortnite's currency is V-Bucks). Seller stats: drop the "(3)" review
    count; tier as an icon, not "Legendary"; refit the seller corner of item cards.
13. Buy Now: no glow/outline (hover shine instead); one-row phone buy bar; purchase sheet must sit
    above the keyboard, no box around the quantity; footer game icons missing.
14. Same-height item cards (game name on the top line when a listing has no filters); best offer
    (cheapest) pinned first; phone filter bar = the Messages tab bar; search restyled.
15. /account/tiers full revamp + check its functionality.
16. /{game} hub: owner chose "keep + rebuild as a landing hub" (2026-09-30). DONE (e579dae3).

## Design rules decided
- Account/marketplace card = fill only, no outline (owner 2026-09-28/29). Account: `rounded-lg bg-bg-raised`;
  marketplace currency cards keep the gradient `#212228 → #1A1B1F` + drop shadow but `border-0` and no inset top line.
- Hairlines `white/[0.07]` only between rows. No top "sheen"/spotlight gradients.
- Controls `rounded-md`, cards `rounded-lg`. Inputs `accountInputCls` (bg-bg-overlay, no resting border, neutral focus).
- Tabs = `SegmentedTabs` (fixed bar `bg-bg-well` + border, tabs scroll inside, sliding neutral pill, 40px bar, 14px labels).
- Scroll rows = `ScrollRow` with GameBoost cue: plain chevron in the row over a dark fade + 2px blur (`edgeColor` prop).
- Filters: 40px on phones, 42px from sm, label-width (not stretched). Search 40/42px.
- No uppercase tracking eyebrows on labels/buttons (page-header game eyebrow stays). Title Case. No em dashes in new copy.
- Green accent only for the primary CTA / selected tile; no green headings, glows or wordmark halves.

## Shipped in the branch
- Shared: `src/components/account/{AccountSurface,SegmentedTabs,SaveButton,Reveal,CardLink,OrderStatusPill,AccountSkeletons}.tsx`,
  `src/components/ui/scroll-row.tsx` (new cue), `src/app/account/_AccountRouteSkeleton.tsx`.
- Settings rebuilt (`src/app/account/settings/*`): per-card saves, identity card (round avatar, VerifiedBadge),
  Store Availability, Shop Identity (30-day cooldown, rename confirm), Payouts (balance panel, Crypto/Payoneer cards),
  Notifications (real), Security (password + 2FA), Privacy/INFORM restyled. `_settings-model.ts` + tests, `_useFormState.ts`
  (never overwrites edits; beforeunload guard).
- Every account page restyled + exact skeletons: Dashboard (seller + buyer), Orders, Offers (standard width), Messages,
  Wallet, Withdraw (+ loading.tsx), Feedback, Refer & Earn (+ loading.tsx), Account Status (+ loading.tsx), sidebar.
- Wishlist removed (route, hook, heart button, menus, buyer-dashboard count); table kept.
- Loaders: layout shows sidebar skeleton + the route's own skeleton instead of a full-screen spinner; root account
  loading.tsx moved to /dashboard; page spinners replaced (orders, reviews, dashboard, listings gate, restrictions).
- Bugs fixed: sidebar Logout had no handler (now `dm:logout` → navbar `performLogout`); buyers bounced from
  /account/dashboard by middleware (removed from seller-only list; data is caller-scoped); /account overview → redirect;
  Feedback counts/refetch-per-keystroke + dead "Given" tab; wallet dead Export button; currency page dead "Notify me"
  button; restrictions page no longer shows admin email; checkout "Account Settings" link.
- Email notification switches: table `email_preferences` (migration `20260930032755_email_preferences.sql`,
  **PUSHED TO PROD 2026-09-30 03:3x UTC**, verified anon 42501 / service 200). `src/lib/email/preferences.ts`
  (`emailAllowed`, never throws), `src/lib/actions/email-preferences.ts`, gates on new order / new message /
  withdrawal paid emails, NEW `sendNewReviewEmail` + `src/lib/actions/review-notify.ts` (author-only, <10 min,
  notify_once dedupe) called after review insert. Marketing = stored opt-in, nothing sent yet.
- Phone menu (navbar-floating mobile sheet): white wordmark, no lime glow, card sections, slim pills, neutral tiles,
  white Sign Up.
- Currency + bundle currency pages: no outlines/sheens, neutral Other Sellers heading, SegmentedTabs sort, Title Case
  buttons, phone price tile with a real Buy button.

## Pass 5+ (2026-09-30)
- Icons: `@phosphor-icons/react` added (in `optimizePackageImports`). Export names are `XxxIcon`.
- Navbar: `src/components/navbar/NavChrome.tsx` (NavIconButton bold→fill when open + popping red count,
  NavPanel fill-only shell, NavPanelHeader, navMenuRowCls) and `ProfileMenu.tsx` (seller header: avatar,
  name + VerifiedBadge, tier chip → /account/tiers, Sell (green) + View Shop; uniform 40px rows incl.
  Seller Dashboard; Wallet balance; Messages unread; real Offline switch). Tabs: sliding layoutId pill;
  mega-menu fill-only; search fill-only. `public/assets/menu-icons/*` deleted.
- Top Up: migration `20260930042146_disable_top_up_category.sql` (**NOT pushed**; global primary
  is_active=false + 47 per-game rows is_enabled=false; 1 paused genshin listing keeps its row). Hardcoded
  Top Up entries removed (navbar, phone menu, hero, mobile home, seller CTA art, sidebar Offers filter,
  FAQ copy). Local `seed:games` still re-enables per-game rows after a reset (local only).
- BuyButton: flat `bg-lime` → hover `lime-hover`, shine sweep, spring press; `FACE`/`BuySweep` exported;
  `sm` size. Currency phone bar = one 56px button "Buy Now | 100 Robux | $0.52 →".
- Purchase sheet: `src/hooks/use-keyboard-inset.ts` (visualViewport) lifts the sheet above the keyboard,
  hides description + trust row while typing; no autofocus on open; quantity field single focus style.
- Tier icons: `src/components/seller/tiers/TierIcon.tsx` (Phosphor medal ×3 / SketchLogo gem / crown,
  metal gradient via SVG child). SellerTierBadge now draws it (the PNG art never existed for metal tiers).
  SellerStats compact: `👍 100% · 34 Sold 🏅` (tier icon, `hideTier` prop); full keeps icon + word.
- Item cards: top line always rendered (filters, else game name); `h-full`; seller corner = text
  right-aligned into a 34px avatar on the right, tier icon by the name; "Yours" chip restyled.
  `_itemsSort.ts` (tested): best offer pinned first in Recommended. Footer uses `games.image_url`.
- Phone filter bar: frame `bg-bg-well` + hairline, 34px segments, ScrollRow cue inside; sm+ fill-only pills.
- /account/tiers rebuilt: `_tiers-model.ts` (+14 tests) mirrors check_seller_tier_eligibility (90-day
  counted GMV with 30% single-buyer cap, orders, positive % (no reviews passes), completion %; ranks
  only go up). `_TiersClient.tsx`: hero (floating medal, rank step, offer limit, next-rank ring, 5-rank
  rail), Progress card, How Ranks Work, All Ranks switcher (desktop list with sliding pill; phones tabs +
  swipe + prev/next). `_TiersSkeleton.tsx` + route skeleton map. `getMyTierInfo` rewritten on the RPC
  window facts. Bugs fixed: "0 / 0" legacy thresholds, "qualify for bronze" shown to Gold, listing limit
  null→20, "You Qualify" on a lower card. TierCard/TierProgressBar/TierBadge deleted.

- Game hub (/[gameSlug], every game but SAB): `_GameHub.tsx` (server), `_hubData.ts` (cookie-free loaders:
  getCategoryStats per category, currency config for icon + per-unit suffix, item/account offers without
  paused/test sellers), `_hubModel.ts` (+12 tests: cards, currency spotlight, from-labels, pitch, rails).
  Sections: GameSubNav, header (logo/name/pitch/facts), Buy {currency} card, Shop by Category (live count +
  from-price), Best Item/Account Offers (shared `OfferRail`, Embla), sell prompt, HowItWorksBand, About
  (seo.h1 + seo.intro + keyword category links), FAQ (FaqCards), BlogRail, PaymentsMarquee. Binds every
  category's listings tag; revalidate 86400. SAB landing now uses OfferRail too. Popular Games tiles still
  link to the hub (now a real landing page).

- No-outline sweep (47892c66): /sell/fees, shop (banner + storefront), /browse, /notifications, legal shell,
  SAB feature cards, currency/listing skeletons, item cards (hairline dropped). Shared `MARKET_CARD` /
  `MARKET_CARD_HOVER` in `src/lib/ui/surfaces.ts` — use it for any new marketplace card. GameSubNav:
  text-only tabs, white underline (no glow), desktop gap to navbar 47px → 15px (`md:-mt-3 md:pt-0`).
  Still old-look (not touched): sell wizard + bulk upload (big flows), FoundingSellerBadge chip.
  Note: /sell/fees still lists a "Top-ups" category rate (fee schedule reads fee_rules types).

## Checks
tsc clean; eslint 0 errors (pre-existing img warnings); unit suite 196 files / 1,589 green; security review: no findings;
web-design-guidelines pass applied. Visual checks done in the Browser pane on public pages (items, menu, currency);
account pages need a signed-in session (owner checks on phone).

## Open / owed
- Owner: localhost check → then push branch + PR. DB: email_preferences is live; the Top Up migration
  is NOT pushed (push with the release; the live navbar's Top Up menu would sit empty until deploy).
- Owner decision pending: /{game} hub (rebuild as landing hub vs redirect). Recommendation: rebuild.
- /account/tiers verified by render tests only (the pane has no signed-in session): owner to eyeball.
- Integration suites not run (local stack wouldn't start under Docker memory pressure).
- Items/listing cards still use the hairline outline finish (ask owner whether to go fill-only there too).
- Rewards (/account/loyalty) still reachable by URL; analytics page not linked.

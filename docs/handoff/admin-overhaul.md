# Admin overhaul (branch `feat/admin-overhaul`, from 2026-09-30)

Owner ask: move every `/admin` page to the new design (the account section from
PR #126), fix mobile, keep every function working, and delete what is unused.
Section by section, starting with the 2FA screen.

## Design rules (same as the account section)
- Cards: solid `bg-bg-raised`, `rounded-lg`, **no outline, gradient or glow**
  (`AccountCard` / `SettingsCard` in `src/components/account/AccountSurface.tsx`).
  Controls inside a card sit one step lighter (`bg-bg-overlay`), `rounded-md`.
- Buttons: `accountBtn.primary | secondary | danger`. Inputs: `accountInputCls`.
- Tab and filter rows: `SegmentedTabs` (scrolls sideways on phones through
  `@/components/ui/scroll-row`), never `flex-wrap`.
- Headline numbers: `StatStrip` (one panel, hairlines), not boxed stat cards.
- Icons: Phosphor (`weight="bold"`), no lucide or tabler in admin.
- Neutral focus ring (`ring-focus-soft`), never lime. Title Case labels.
- Every page gets a `loading.tsx` that matches it (`AccountSkeletons`).
- `MARKET_CARD` is the marketplace card (gradient); admin uses the flat card.

## Inventory (2026-09-30)
- 36 pages under `src/app/(admin)/admin`, plus `/admin/mfa` in `(admin-auth)`.
  None has a `loading.tsx` or `error.tsx`.
- Shell: `AdminChrome` + `Sidebar` (tabler icons, forest glass, mobile drawer
  below `lg`) + `EnhancedAdminHeader` (lucide; 384px notification panel overflows
  a 375px phone; the menu button overlaps the search box) + the forest gradient
  canvas in `layout.tsx` (`_theme/forest.ts`).
- `kit.tsx` `AdminPanel` / `StatCard` bake in `border border-border-default`
  (13 and 15 files inherit it), so restyling the kit fixes many pages at once.

### Unused / dead (remove when their section comes up)
| What | Why dead |
|---|---|
| `/admin/redesign`, `/admin/categories`, `/admin/categories-v2` | only link to each other; not in sidebar/header/dashboard. Redesign links to a 404 (`/admin/games/new`). Actions `admin-categories.ts`, `admin-global-categories.ts` only used by them. |
| `/admin/promo-codes` | a bare `redirect('/admin/promos')`; nothing links to it |
| `/admin/profile` | duplicate of the Profile tab in `/admin/settings` (keep `ProfileSettings.tsx`) |
| `_theme/forest.ts` exports `GAME_TILE_GRADIENTS`, `FOREST_STATUS_CHIPS`, `ForestChipStatus`, `AdminForestToken`; `_theme/SectionIcons.tsx` `IconBank`, `IconBriefcase` | not imported |
| `orders/components/disputes-table.tsx` | 30-line "Go to Disputes" placeholder inside Orders |
| `src/components/ui/glass-card` | admin-only; dead once games/templates move off it |
| `/admin/utils` (sidebar) | dev tooling (test listings, debug listings) — **ask the owner before removing** |

Reachable but not in the sidebar: `/activities`, `/reviews`, `/notifications`,
`/gdpr`, `/inform` (dashboard tiles, header search, bell).

## Order of work (all ✅ on feat/admin-overhaul, not pushed)
1. ✅ `/admin/mfa` 2FA screen
2. ✅ Shell: layout canvas, `AdminChrome`, `Sidebar`, `EnhancedAdminHeader`, `kit.tsx`
3. ✅ Dashboard (`CompactDashboard`)
4. ✅ Orders → order detail
5. ✅ Withdrawals, Fees & Payouts
6. ✅ Seller Applications → detail; Active Sellers → detail; Founding Sellers;
   Seller Leads; Founding Notices
7. ✅ Disputes → detail; Fraud; Moderation; Reviews (+ paging)
8. ✅ Analytics, Activities, Notifications, GDPR (+ Delete Account confirm), INFORM
9. ✅ Games → edit → templates; Blog (list/new/edit); Promos
10. ✅ Profile (Settings merged into it; `/admin/settings` redirects), Utils (restyled — **owner to decide removal**)
11. ✅ Dead code removed (89c24d25): redesign, categories, categories-v2 (+ actions),
    promo-codes redirect, forest.ts, SectionIcons, ui/glass-*, ui/pagination-controls.
    Final sweep: no lucide/tabler, no `border-border-*`, no palette colours in admin.
    Kept on purpose: promo code input caps, Founding Notices + blog previews (they mimic
    the public pages), Discord tint on founding sellers.

## Open (pre-existing, not fixed)
- Currency bundle upload spinner never shows (`setUploading(false)` runs before upload);
  upload handlers have no try/catch; wizard file inputs aren't keyboard-reachable;
  `GameWizard mode="create"` looks dead.
- `/admin/utils` "Debug Database" logs listing data to the browser console in prod.
- RLS on withdrawal_requests / withdrawal_methods / reviews checks `profiles.role='admin'`
  (task chip spawned).

## Verifying
- Local-only server on :3005 against this worktree's Supabase stack
  (`admin-overhaul-local` in `~/gamevault/.claude/launch.json`; live keys
  blanked; TOTP turned on through the gitignored `supabase/.env`).
- Owner reviews on :3004 (real data, own login + 2FA).

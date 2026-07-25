# Handoff — Beta Banner + Founding-Seller Waitlist

**Date:** 2026-07-24
**Repo/worktree:** `/Users/gyanendra/gamevault-admin-redesign`
**Branch:** `seller-app-redesign` (worktree of the main `gamevault` clone)
**Stack:** Next.js 14 App Router, Supabase (Postgres), Tailwind, Framer Motion, Radix, `@tabler/icons-react` + `lucide-react`.

> This doc is the single source of truth for the beta-banner / early-seller feature built this session. Read it top to bottom before continuing. For the broader project (design tokens, conventions, Supabase migration rules, auth audit, payment migration), see **`HANDOFF.md`** in the repo root — this feature doc is a superset only for this feature.

---

## 1. What the feature is

The site is **live but in sandbox** (PSP/payments not coded yet). To set expectations and capture seller interest, we shipped:

1. **A top announcement banner** ("Beta") on every marketing page, with a CTA.
2. **`/early-seller`** — a public "Become a Founding Seller" landing page + waitlist form (first-100-sellers campaign: lower fees / early access / founding badge).
3. **`/admin/early-sellers`** — an admin table to review, status-manage, and CSV-export the signups.

Submissions flow: **banner CTA → `/early-seller` form → `submitEarlySeller` server action → `early_seller_signups` table** (RLS-locked, service-role writes). Admin reads/updates via admin-guarded actions.

---

## 2. Current status — ✅ COMPLETE (pending user actions)

Everything is built and **`tsc --noEmit` passes with 0 errors**. Two things are on the **user**, not code:

| # | Action | Status |
|---|--------|--------|
| A | Run the migration SQL (`supabase/migrations/20260724_early_seller_signups.sql`) in Supabase SQL Editor | ✅ **User confirmed "ran it"** — table should exist |
| B | Commit + push | ✅ **DONE.** Git worktree was broken mid-session (parent `.git` in Trash — since restored, see §7). Banner + `/early-seller` page/form + migration were committed & pushed in earlier commits (`bd5bc5f`, `27bf3f9`). The admin view + this handoff were committed after the restore. |

**Verified in browser earlier this session:** banner renders on homepage (squared rocket badge, rectangular CTA), `/early-seller` renders (rectangular eyebrow, hairline-separated perk rows, all 5 form fields + submit). The admin page was built after the last browser check — it typechecks but has **not** been visually verified in-browser yet (git/preview constraints). Recommend a quick `/admin/early-sellers` visual pass once git is fixed.

---

## 3. Files (complete inventory)

### New files
| File | What |
|------|------|
| `supabase/migrations/20260724_early_seller_signups.sql` | Creates `early_seller_signups` table (RLS on, no anon policies), unique index on `lower(email)`, status index. |
| `src/lib/actions/early-seller.ts` | Server actions: `submitEarlySeller` (public, service-role upsert), `getEarlySellerSignups` (admin), `updateEarlySellerStatus` (admin). Types: `EarlySellerSignup`, `EarlySellerStatus`. |
| `src/components/beta-banner.tsx` | The `<BetaBanner>` client component. |
| `src/app/early-seller/page.tsx` | Server page — metadata/SEO shell + founding-seller pitch + perks. |
| `src/app/early-seller/_EarlySellerForm.tsx` | Client form island (username/email/discord/sells/note → `submitEarlySeller`). |
| `src/app/(admin)/admin/early-sellers/page.tsx` | Admin server wrapper — fetches signups, renders client. |
| `src/app/(admin)/admin/early-sellers/_EarlySellersClient.tsx` | Admin table: status tabs, stats, per-row status `<select>`, copy email/discord, CSV export. |

### Modified files
| File | Change |
|------|--------|
| `src/components/layout-wrapper.tsx` | Renders `<BetaBanner>` above `<Navbar>` (same chrome-less-shell guard). |
| `src/components/navbar-floating.tsx` | Reads `--beta-banner-offset` CSS var → adds it to the fixed navbar's `top` so navbar rides below the banner. See §5. |
| `src/app/(admin)/admin/components/Sidebar.tsx` | Added `IconRocket` import + "Founding Sellers" nav link (`/admin/early-sellers`, roles `admin`/`super_admin`), placed right after "Active Sellers". |

---

## 4. Database

```sql
-- supabase/migrations/20260724_early_seller_signups.sql
create table public.early_seller_signups (
  id         uuid primary key default gen_random_uuid(),
  username   text not null,
  email      text not null,
  discord    text,
  sells      text,   -- free text: what games/categories they sell
  note       text,   -- optional pitch
  ip         text,   -- abuse context, never shown publicly
  user_agent text,
  status     text not null default 'new'
               check (status in ('new','contacted','approved','rejected')),
  created_at timestamptz not null default now()
);
-- unique on lower(email) → repeat submit upserts (fixes typos, no dupes)
-- RLS ON, NO public policies → all access via service-role server actions
```

**Not in generated `Database` types.** The action file casts the Supabase client to `any` for this table (`(supabase as any).from('early_seller_signups')`). If you regenerate types, you can drop the casts. This is intentional and noted in the code comments.

---

## 5. The banner ↔ navbar coupling (the one non-obvious bit)

The navbar is `position: fixed` (floats over content, transparent over the homepage hero). The banner sits in **normal document flow** above it, so it **scrolls away naturally** with the page (Shopify/Vercel pattern). To stop the fixed navbar from overlapping the banner while it's visible:

- **`beta-banner.tsx`** publishes its remaining on-screen height to `document.documentElement` as CSS var **`--beta-banner-offset`** (rAF-throttled scroll listener, `getBoundingClientRect().bottom`, clamped ≥0). Resets to `0px` on unmount / hidden shells.
- **`navbar-floating.tsx`** — Framer animates a `--nav-top` var (`0px` scrolled / `12px` at rest), and the element's actual `top` is `calc(var(--nav-top) + var(--beta-banner-offset))`. Mobile uses `max-lg:!top-[var(--beta-banner-offset,0px)]`.

**If you touch either file, keep this contract.** Removing the banner → var goes to 0 → navbar returns to normal, no other change needed.

**Self-hide rule:** the banner hides on the same chrome-less shells `LayoutWrapper` skips — `/admin`, `/checkout`, `/dev/checkout-preview`, `/account/become-seller`, `/account/seller-status`, `/kyc/complete`. If you add a new full-canvas shell, add it to **both** the `hidden` check in `beta-banner.tsx` AND `LayoutWrapper`.

---

## 6. Design decisions (so you don't undo them)

Per user feedback this session — **"no round round"** boxes, real logos not standard icons, professional copy:

- **No pill shapes.** Beta chip = squared glyph badge (`rounded-[7px]`/`rounded-[8px]`). CTA = rectangular soft-corner button. Same on the `/early-seller` eyebrow.
- **Icons:** use `@tabler/icons-react` (installed, 3600+ icons) — `IconRocket` (beta/launch), `IconPercentage`, `IconRosetteDiscountCheck`, `IconArrowRight`. NOT lucide `Sparkles` (looked generic). The admin table uses lucide icons because the admin kit's `StatCard`/`IconChip` are typed to `LucideIcon`.
- **Color:** amber `#F5C451` (const `AMBER`) — "heads up, not an error", deliberately separate from the site's lime brand and semantic red/green. Restrained: dark glass + a thin amber accent rail on top, NOT a full amber wash.
- **Copy:** banner reads *"BETA · We're now live in early access — full launch coming soon"* + button *"Become a Founding Seller →"*. Perks on `/early-seller` are **floating hairline-separated rows**, not boxed cards.
- **Page title:** the root layout (`src/app/layout.tsx`) has `title.template = '%s | DropMarket'`, so page `metadata.title` must NOT include " | DropMarket" (that caused a doubled title bug — already fixed).

Site-wide conventions that apply here (from memory/`HANDOFF.md`): **Title Case** for UI labels; **Inter** only; prefer installed libraries over hand-rolled; mobile-first responsive.

---

## 7. Git worktree layout (RESOLVED — history for context)

**What happened:** mid-session, git broke with:
```
fatal: not a git repository: /Users/gyanendra/gamevault/.git/worktrees/gamevault-admin-redesign
```
This folder is a **linked git worktree**, not a full clone — its `.git` is a text file pointing at the shared database in `/Users/gyanendra/gamevault/.git/`. The main `/Users/gyanendra/gamevault/` folder had been moved to Trash, taking the shared `.git` with it, so every git command failed. **The user restored it from Trash and git works again** — no work was lost (files were always safe on disk; only the git link was dead).

**The layout to understand:**
- `/Users/gyanendra/gamevault/` — MAIN clone, holds the real `.git` database + `worktrees/`. **Do not delete/move this** — it breaks every linked worktree.
- `/Users/gyanendra/gamevault-admin-redesign/` (THIS, branch `seller-app-redesign`) and `/Users/gyanendra/gamevault-wallet-redesign/` — linked worktrees of it.
- `/Users/gyanendra/gamevault-sab-pages/` — a **SEPARATE full clone** of the same GitHub repo (`gyanu1614/gamevault.git`), on branch `feature/sab-brainrot-pages`. Independent — not part of the worktree set, unaffected by the break. Different feature ("another section of the website").

All share one GitHub remote: `github.com/gyanu1614/gamevault.git`.

Session commit-message style (from prior commits): imperative subject, blank line, body, then:
```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```
Workflow the user follows: commit per fix, push once per session to `seller-app-redesign` (each push = a Vercel deploy). PR to `main`.

---

## 8. Server actions API (quick reference)

`src/lib/actions/early-seller.ts`:

```ts
// PUBLIC — from the /early-seller form
submitEarlySeller(input: {username, email, discord?, sells?, note?})
  : Promise<{ok, error?}>
  // validates username + email regex, trims/caps lengths, captures ip/ua,
  // upserts on email (service-role). Never throws to the client.

// ADMIN (requireAdmin() guard; returns {ok:false,error:'Not authorized.'} if not)
getEarlySellerSignups(): Promise<{ok, signups?: EarlySellerSignup[], error?}>
updateEarlySellerStatus(id, status: 'new'|'contacted'|'approved'|'rejected')
  : Promise<{ok, error?}>
```

Admin route auth is enforced by `src/app/(admin)/layout.tsx` (checks `admin_roles` table + MFA) — the page inherits it. The actions **also** call `requireAdmin()` defensively (in-function authz — a project standard from the auth audit; server actions must not rely solely on route guards).

---

## 9. Suggested next steps (open, not started)

- **Visually verify `/admin/early-sellers`** once git/preview works (built but not browser-checked).
- **Regenerate Supabase types** to drop the `as any` casts (optional).
- **Banner dismissibility** — currently always shows. If wanted: add an X + `localStorage` flag (user chose "scrolls away" over "dismissible" this session, so this is optional).
- **Email/Discord notification** when a signup lands (not built — signups are pull-only via the admin table).
- Broader SEO backlog is tracked in `HANDOFF.md` / memory (product-type indexing guard, `seo:audit` route-health script, trust/values pages).

---

## 10. How to resume on a fresh Claude

1. Read this doc, then `HANDOFF.md` (repo root) for full project context.
2. Git is healthy (§7 was resolved). Feature is committed & pushed on `seller-app-redesign`. Check `git log --oneline -6` — the latest feature commits are the banner/early-seller/admin-view ones.
3. Confirm the migration (§4) actually applied: `select count(*) from early_seller_signups;` should not error.
4. `npx tsc --noEmit` should report **0 errors** (baseline as of this handoff).
5. Optional: start the dev server via the preview tool (NOT bash) and visually check `/`, `/early-seller`, `/admin/early-sellers`. The admin table is the one page not yet browser-verified. Note: port 3000 is usually taken by the user's own dev server — the preview tool auto-picks another port; stop it when done (don't leave a server running beside the user's).

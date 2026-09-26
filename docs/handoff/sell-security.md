# /sell security hardening — handoff

**Date:** 2026-09-25 · **Branch:** `fix/sell-security` (worktree `../gamevault-sell-security`, stack slot 34) · **PR:** https://github.com/gyanu1614/gamevault/pull/100 · **Not merged, no `db push`, nothing emailed.** `origin/main` (PR #99, `760ca791`) merged in: the validator is the server's min-order rule, #99's `resolveMinQuantity` stays the wizard's client rule (floor defaults to 1 when the game has no config — aligned), #99's category landing path kept. One commit per finding; audit = `docs/audit/sell-full-audit.md` §4–5.

## Findings closed
| ID | What holds now |
|---|---|
| ACC-03 | ONE validator (`src/lib/listings/validate.ts`) for publish / wizard edit / updateListing / bulk; `UPDATE` on `listings` revoked for anon+authenticated, seller UPDATE policies dropped; every seller edit is a server action (ownership → validate → service-role write pinned to id+seller_id). Trigger `validate_listing_write` (runs last): JWT callers cannot move a listing between games/categories; every caller needs an enabled pair on insert/pair change and `delivery_method ∈ {manual,instant}`; AUTH-034 now binds the service role too. |
| ACC-06 | price ≥ $0.01, numeric(12,4) rounding, column ceiling, per-game currency floor/ceiling; DB `CHECK (price > 0)` (NOT VALID → validated in place when no row is at 0). |
| ACC-05 | min order from `category_configs.min_quantity` (literal 100 deleted), stock < floor refused, min capped at stock, bundle_id must exist in config (bundle → min 1); DB rule min ≤ qty unless unlimited; **createCheckout refuses qty < min_quantity**. |
| ACC-11 | insert status whitelisted draft\|active (validator); JWT insert may only be born draft/pending. |
| ACC-01 | `sell_access_kind(uuid)` = seller \| seller_blocked \| admin \| applicant \| none — ONE answer for trigger, RLS, storage policy, middleware and actions. A listing becomes active only for an active seller/admin, **for every caller incl. approve_listing**; blocked seller cannot insert; **createCheckout refuses a blocked seller's listing**; publishDenialFor gates both update actions (BUG-16). |
| ACC-04 | entry-tier seller's content edit (title/description/images/template_data) of an active listing → `pending_approval`, in the trigger. Admin restrict/ban already revalidates (pinned). |
| ACC-07 | middleware: `/sell`, `/sell/*` → seller/admin/applicant pass, seller_blocked → `/account/restrictions`, else → `/account/become-seller`; `/seller*`, `/sell/fees` untouched. |
| ACC-08 | uploads need sell access; type + extension from magic bytes (JPEG/PNG/WebP), 5 MB server cap, `${user.id}/` prefix; delete refuses any other prefix; storage policy `listing_images_seller_write` requires sell access (profile-pictures unchanged). |
| ACC-02 | `assessIdentityForApproval` runs BEFORE the role grant: verified ID + verified selfie (or Didit). Gap → admin sees exactly what is missing/unverified and can **Approve Anyway** (audit-logged); `profiles.kyc_status` = approved\|pending. Nothing gates on kyc_status. |
| GRO-08 | applicant (application pending/under_review/info_requested) may use the wizard + uploads; every save is a DRAFT (RLS + trigger, every caller). On approval `submitApplicantDrafts` pushes marked drafts through the shared validator + `decidePublishStatus` (same moderation rule as publish, cap honoured); incomplete ones stay drafts; one email lists both. |

**Bonus fix (found by the guard):** `track_listing_price_change` wrote `changed_by = auth.uid()` into a NOT NULL column — every service-role price edit would have failed (23502). Now falls back to the seller.

## Migration (1 file, committed, NOT pushed)
`supabase/migrations/20260925204757_sell_security_listing_guard.sql` — revoke + policy drops, `validate_listing_write` trigger, `sell_access_kind[_of]`, price CHECK, price-history fix, listing-images policy split, applicant INSERT policy, `sell_security_version` probe. Applied from scratch by `pnpm test:full`. Grants posture allow-list carries `sell_access_kind`.

## Verification
`tsc` clean · guards: `sell-security-listing-guard` (12) · `sell-security-seller-status` (7) · `sell-security-checkout` (2) · `sell-security-access` (7) · units: validate (18), images (6), listings.update (9), listings.status (5), sell-wizard.publish (17), sell-wizard.upload (6), middleware.sell-gate (12), submit-applicant-drafts (6), admin-seller-review.approve (4), seller-verification.assess (4). Full `pnpm test:full` on a fresh stack (after the main merge): 217 files / 1962 tests passed, 2 skipped, 0 failed. Types regenerated (`--db-url`; see gotcha).

## Your decisions
1. **ACC-10 (reported, not implemented).** The public SELECT policy (`status = 'active'`) exposes every column: `approved_by, approved_at, rejected_by, rejected_at, rejection_reason, moderation_notes, changes_requested_by, changes_requested_at, metadata, template_version_used, views, sales, delivery_method_type`. Recommended: a `public_listings` view `WITH (security_invoker = true)` selecting only the marketplace columns, and `REVOKE SELECT` on the base table from `anon` (keep `authenticated` for owner/admin reads via RLS) — every public reader in `@/lib/supabase/anon` switches to the view. Needs a Step-7a-style sweep of readers; own PR.
2. **`seller_status` defaults to `'active'` for every profile.** Safest fix: leave the column, make `sell_access_kind` the only reader (done — middleware/actions no longer read it directly; only `createCheckout` and the trigger use it, both via role='seller' first). Optional follow-up migration: `ALTER COLUMN seller_status DROP DEFAULT` + set NULL where `role <> 'seller'` + set 'active' in `approveApplication`; `profiles.guard` and `restrictSeller` unaffected. Not done here to keep the diff to the audit scope.
3. **ACC-09 stays open** (listing cap / auto-approve only on single publish).
4. **Before `db push`:** `SELECT count(*) FROM listings WHERE price <= 0;` — if > 0 the CHECK stays NOT VALID (new writes still enforced); fix the rows then `ALTER TABLE listings VALIDATE CONSTRAINT listings_price_check`.
5. **Deploy order:** `db push` first (code paths write via service role either way; the old code keeps working against the new schema), then deploy.
6. View counters (`listing-views.ts`, listing page `views++`) ran as the session user and were already no-ops for non-owners; with UPDATE revoked they now return 42501 (ignored). Route through a rate-limited RPC later if the counter matters.
7. Gotcha: `pnpm db:types` (`gen types --local`) connected to a different stack on this machine and produced a stale file; regenerate with `supabase gen types typescript --db-url <this stack's db url>`.
8. UI halves left to the wizard PR: applicant wording in the wizard ("Save draft" instead of "Publish"), BUG-01/03/04/05 client fixes.

## Cleanup
`pnpm db:down --purge` in `../gamevault-sell-security` before removing the worktree.

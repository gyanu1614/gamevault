# Fee engine — PR 7 handoff (money after delivery: release, holds, disputes, withdrawals)

**Date:** 2026-09-23 · **Branch:** `feat/withdrawals-disputes` (worktree `../gamevault-fee-pr7`, from `main` @ `414ca128`) · **Not merged, no `db push` run. Nothing was emailed.** Scope starts at "seller marks delivered"; charge/payment columns and RPCs (Round B) untouched.

## Part 0 — what was there
- **Worked:** buyer confirm → `safedrop_transition(BUYER_CONFIRMED)` credited `seller_available` atomically (double-entry ledger); auto-release cron existed (`vercel.json` daily 00:00 → `releaseDueOrder`); withdrawal cancel/reject were atomic RPCs; `disputes` table + admin pages existed.
- **Missing:** no maturity hold; windows were TS constants (`PROTECTION_WINDOW_HOURS` 48/72/120–336 h); no hourly run, no pagination, no buyer reminder; `completed` was terminal (no post-completion dispute, no freeze); no saved payout details, no Payoneer, no seller-age gate; notifications had no dedupe.
- **Wrong:** `markOrderAsDelivered`/`openDispute`/`notifySellerActivity` wrote `orders.status` directly (session client / service role) and `status` was NOT a guarded column — any buyer/seller could move their own order through PostgREST within the trigger's legal moves; `createWithdrawalRequest` computed the fee in TS, used a HEAD count as the one-open guard and no lock (PAY-001 class); approve / mark-paid were two-step TS; `/fees` said min $100 while code enforced $50; `docs/handoff/fee-pr4-seller-notice.md` and `docs/pages/*` do not exist anywhere on disk (the notice was written from the PR 4/5 handoffs + this spec).

## Commits (one per part) · migrations in order
| Part | Commit | Migration |
|---|---|---|
| 1 completion/release | `aa23a3bd` | `20260923025457_order_completion_release` — settings cols, `order_completion_windows`, `seller_frozen` kind, `ledger_transactions.matures_at` (+`post_journal` 5-arg, 4-arg dropped), `completed→disputed`, `safedrop_transition` v3, guarded status columns, `order_mark_delivering/delivered`, `order_confirm_receipt`, paginated ready-list, `order_confirm_reminders_claim`, `notifications.dedupe_key`+`notify_once`, `seller_since`, `seller_withdrawal_gate`, `wallet_available_balance` |
| 2 disputes | `545e8c80` | `20260923030931_order_disputes` — `order_dispute_events`, one open dispute per order (pre-check raises on duplicates), `order_dispute_open`, `order_dispute_resolve` |
| 3 withdrawals | `54101593` | `20260923031644_withdrawal_rules` — `fee_min`, method rows (crypto 3%+$5 min $50 · Payoneer 3% min-fee $5 min $100, audited), `fee_round_cents`, `seller_payout_details`, one open withdrawal per seller (pre-check), gate v2, `withdrawal_quote/request/approve/mark_paid/reject`, `seller_payout_details_set`, `withdrawal_risk_snapshot`, `withdrawal_methods_set_fees`, `platform_money_setting_set`, `order_completion_window_set`, `updated_by` FKs → SET NULL |
| 4 pages | `66c06490` | — |
| 5 notice | `4b0acfbb` | `20260923033757_seller_notice_sends` — table + `seller_notice_claim/record` |
Workflow: `.github/workflows/auto-complete-orders.yml` (hourly `7 * * * *` → `/api/cron/auto-release-escrow`, Bearer `CRON_SECRET`); `vercel.json` daily entry kept as backstop. All new functions service-role only (+ `PR7_SERVICE_ONLY` in the grants guard).

## Order states (DB-enforced: `is_valid_order_transition` trigger + guarded `status` → RPC/service-role only)
| From → To | Event | Who | Money |
|---|---|---|---|
| paid → delivering / delivered | SELLER_DELIVERING / SELLER_DELIVERED | seller (`order_mark_delivering/delivered`) | none; `auto_release_at = delivered_at + window(category)` |
| delivered → completed | BUYER_CONFIRMED | buyer (`order_confirm_receipt`, also from paid/delivering) | escrow_held → commission + seller_available, `matures_at = +hold_hours` (24) |
| delivered → completed | AUTO_RELEASED | hourly runner | same, matures at once; reminder once at ½ window |
| paid/delivering/delivered → disputed | BUYER_DISPUTED | buyer, ≤ `dispute_window_days` (7) from delivered_at | none; escrow frozen; auto-complete blocked |
| completed → disputed | BUYER_DISPUTED (in window) / ADMIN_DISPUTED (any time) | buyer / admin (`order_dispute_open`) | seller_available → seller_frozen (may go negative) |
| disputed → completed | DISPUTE_RESOLVED_SELLER / DISPUTE_PARTIAL | admin (`order_dispute_resolve` release / refund_partial) | unfreeze / seller covers refund first (≤ payout), platform the rest, remainder back |
| disputed → refunded | DISPUTE_RESOLVED_BUYER via `order_refund_to_wallet` | admin (refund_full) | pre-completion: escrow_held → refunds; post: seller_frozen + commission → refunds; buyer wallet credited |
| pending → cancelled, paid → cancelled (buyer) | CANCELLED | unchanged (Round A) | released order → refused |
Withdrawals: `pending → approved → completed` (`withdrawal_approve` / `withdrawal_mark_paid` needs a reference) · `pending → cancelled` (seller) / `rejected` (admin) return the hold. Seller age anchor = `seller_applications.reviewed_at` (approved), fallback `profiles.created_at`.

## Copy — old → new (needs your approval)
| Surface | Old | New |
|---|---|---|
| `/fees` Withdrawals | "Minimum withdrawal: $100 · Fiat 1.5% + $2 · Crypto 3% + $10" | crypto 3% + $5 min $50 · Payoneer 3% (min fee $5) min $100 · withdrawable 24 h after confirm / at once on auto-complete · 30-day new-seller rule · 48 h payout-details pause · disputes set the amount aside, balance may go below zero |
| SafeDrop §2.3 table / refunds §2 table | currency 48 h, items 72 h, top-ups 48 h, boosting 72 h, accounts 5/7/14 d by band | currency 1 day, items 3 days, top-ups 1 day, boosting 3 days, accounts 5 days |
| SafeDrop §2.4 + new §2.5, §5.1; refunds "no action" line; buyer-terms intro | "treated as accepted" / "Sellers are paid out only after…" / "SafeDrop Buyer Protection" | "completes automatically"; dispute window **7 days from delivery, even after completion**; credit withdrawable 24 h after confirm; "SafeDrop Protection" |
| `/sell/fees` rules bullet | "Buyer fees, withdrawal fees and warranty terms are set out in Fees & Charges" | "Buyer fees and warranty terms … ; withdrawal terms are in 'Getting paid' above" (+ new live section) |
| Withdraw page | "Enter the amount and your wallet address" / "We hold the balance…" / "Your balance is held while an admin reviews" / "Bank/PayPal transfers…" | "…destination saved in your payout settings" / "set aside from your balance" / "Payoneer transfers…" |
| Settings → Payouts | crypto paragraph + "PayPal Email (Coming Soon)" input | PayoutDetailsSection (crypto wallet + Payoneer email, 48 h notice) |
| Order card (buyer, completed) | "…you can still open a dispute within the protection window." | "…until {date} — SafeDrop Protection covers you for that window." / after: "…the dispute window has closed. Need help? Contact Support." |
| Admin Mark Paid field | "Tx hash / payment reference (optional)" | "Tx hash / Payoneer payment reference (required — sent to the seller)" |
New notifications/emails (reminder, requested, payout-details changed, dispute open/resolve texts) are in the RPC bodies / `email/index.ts`, `email/fee-notice.ts` — no "escrow"/"hold funds" (guarded).

## Gate (local stack `gamevault-sab-pages`, `.env.test`; the stack was RESET by the Round B worktree mid-session — my 4 migrations re-applied by psql)
`tsc` clean · `check-public-route-caching` 40 OK · new guards: order-completion 12 · dispute-money 9 · withdrawal-rules 10 · fee-legal-withdrawal-parity 3 · fee-notice 6 · state-machine 40 · confirm-receipt + mark-paid unit tests repointed · existing: money-atomicity 18 (parks open requests between cases — one-open index), db-p0-grants 57, table-posture 9, fee-copy 22, fee-checkout-snapshot, cron-cadence/parity. **Full `pnpm test`: 183 files, 1616 passed, 2 skipped, 3 failed — all three in `fee-preview-parity.guard` (pre-existing on main: PR #87 × #88, the 5-open-pending-orders cap refuses the matrix's 6th checkout; Round B's `cdacb3ed` already fixes that test — not duplicated here to avoid a conflict).**

## Manual steps for Gyanu
1. **Order:** merge/deploy Round B first if it lands first (no shared files/functions; both touch `orders` guards only via different columns). `supabase db push` from this branch applies the 4 migrations in filename order **with** the deploy: the new TS calls `order_mark_delivered/confirm_receipt/withdrawal_*`; old code against the new DB still works (RPCs additive; `post_journal` 4-arg callers resolve to the new default). Pre-checks that ABORT the push: an order with >1 open dispute, a seller with >1 open withdrawal — resolve, then re-push.
2. **GitHub:** the workflow uses the existing `CRON_SECRET` secret — nothing to add; enable Actions for `auto-complete-orders.yml` and run it once (`workflow_dispatch`) → 200 with `{reminders, processed}`.
3. **Admin → Fees & Payouts** (`/admin/fees`, new sidebar link): verify hold 24 h, dispute 7 d, seller gate 30 d, freeze 48 h, windows items 72 / account 120 / currency 24 / top_up 24 / service 72 / gift_card 24, methods crypto 3%+$5/$50 · Payoneer 3%/min $5/$100. Every save writes `fee_config_audit`.
4. **Notice:** `/admin/fees` → "Dry Run" (recipients = `role='seller' AND seller_status='active'` with an email; start date read from `min(starts_at) WHERE note LIKE 'PR4:%'` — on prod today that is **2026-10-08**, not 7 Oct) → check the preview → type `SEND`. Second click sends nothing (claimed rows); failures stay claimed (`seller_notice_sends.error`), delete the row to retry.
5. After push: `SELECT proname FROM pg_proc WHERE proname IN ('order_confirm_receipt','withdrawal_quote','order_dispute_resolve');` → 3; `SELECT method_name, fee_percentage, fee_fixed, fee_min, min_withdrawal FROM withdrawal_methods;`.

## Deliberately left
- Existing pending withdrawals keep their old fee snapshot (correct). Legacy `payment_details` on old rows stays plaintext; new rows carry the saved destination (same posture, flagged).
- `PROTECTION_WINDOW_HOURS`/`protectionWindowHours` in `src/lib/fees` are now unread by orders (checkout keeps a `void` ref) — delete in a cleanup PR with `fees.test.ts`.
- Payout details are stored plaintext (crypto addresses are public; Payoneer email low-sensitivity) — say if you want AES-GCM like the delivery codes.
- Reminder/completion emails on the hourly path are best-effort after the atomic claim; a Resend outage loses that one reminder (auto-complete still happens).

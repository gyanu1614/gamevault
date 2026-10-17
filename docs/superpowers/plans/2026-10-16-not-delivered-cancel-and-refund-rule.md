# "Cancel – Not Delivered" + Store-Credit Refund Rule — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **STATUS: PLAN ONLY — owner said "don't build yet".** Both migrations below are DRAFTS shown for the owner's OK (CLAUDE.md + memory `prod-money-extra-careful`: flag every migration before writing it). Nothing here exists in the repo yet.

**Goal:** (1) Every refund lands in the Wallet as store credit for the **item price**. The full amount, service fee included, goes back to the original payment method only when the buyer requests it from the Wallet. (2) On an overdue order the buyer presses **Cancel – Not Delivered**. The seller is notified and gets 1 hour to reply in the order chat or start delivery. A response keeps the order open; no response and it cancels and refunds itself.

**Architecture:** Two PRs, each with one migration, built in order in their own worktrees.
- **PR 1** changes the money rule inside the existing seams: `order_refund_buyer_credit`, `refund_to_source_*`, `order_seller_fault_record`, `order_dispute_resolve`. It adds a "Refund To Card" list on the Wallet page.
- **PR 2** adds an `order_not_delivered_claims` table and three service-role RPCs that call the PR 1 seams (`order_cancel_return_wallet` / `order_refund_to_wallet` with fault `seller`). A 15-minute sweep backs them up: a GitHub Actions step plus a daily Vercel backstop. The order page also finalizes on view when the hour runs out.

**Tech stack:** Supabase Postgres (plpgsql, ledger `post_journal` / `wallet_credit` / `wallet_spend`), Next.js 14 server actions, Vitest integration guards against the worktree's local stack, Resend via `src/lib/email/shell.ts`.

**Spec:** `docs/payments/refund-fee-research-2026-10-16.md` (§1 today's flows, §8 the late-delivery comparison) + the owner's decisions below.

## Owner decisions this plan implements (2026-10-16)

- "When an order is cancelled, the refund is sent to wallet, where they can either use it or request a refund on card. In store credit they get $70, but if they want refund to card, they can see the amount they will get, using order ID, we show the total, and they can request." There is **no choice screen at cancel time**.
- "Cancel – Not Delivered" button for overdue orders: seller notified, **1-hour grace**, then auto-cancel.
- "If the seller responds before 1 hr, the order stays open; if the seller doesn't even read the message, auto cancel." A **response** is any of these inside the hour:
  - a reply in the order chat
  - "Start delivery"
  - "Mark As Delivered"
  - the seller cancelling

  A response closes the report and the order stays open. If the item still doesn't arrive, the buyer opens a dispute as today.

Worked example: $70 item + $4.97 service fee = $74.97 paid.

| Event | Store Balance gets | DropMarket keeps (`fee_kept`) | Card refund on request |
|---|---|---|---|
| Any cancel/refund (buyer, seller, platform, dispute won, not delivered) | $70.00 | $4.97 | **$74.97** ($70 credit + $4.97 kept fee paid back) |
| Order paid fully with store credit (fee $0) | full amount | $0 | n/a (store credit) |
| Partial dispute refund (admin amount) | admin amount | — | admin amount |

## Open decisions (defaults used in this plan — owner may flip)

- **D2 — 5-faults-in-7-days seller fee.** Today the seller is charged the buyer's fees from their 5th fault, because we refunded those fees. Under the new rule we keep the fees whenever the buyer takes store credit. Charging the seller as well would collect the fee twice, and Seller Agreement 11.1 says "DropMarket does not levy punitive fines". **Default: charge the seller only when the buyer's card refund is actually sent.** Alternative: always charge, as a penalty. That needs a Seller Agreement change and a one-line change in Task 1.2.
- **D3 — settled by the owner (2026-10-16):** a chat reply or "Start delivery" inside the hour keeps the order open.
- **D5 — Does only READING the buyer's message count?** **Default: no — the seller must reply or start delivery.** A read receipt is set just by opening the chat, so it can't tell "on it" from "saw it and left". Owner to confirm.
- **D4 — Crypto orders.** BTCPay has no refund API, so a card-route request fails after 6 tries today. **Default: mark `btcpay`/`coingate` `refundable = false`.** The Wallet then shows "Store credit only", and crypto cash refunds stay a support job (Refund Policy 9.1).
- **Legal note (from the research, not a blocker):** $70 store credit by default, with the full amount on request, is the Eldorado model. Whether that default counts as the buyer's "express agreement" is lawyer question 5 in the research doc. The full card refund always stays available, so the statutory route exists.

## Global constraints

- pnpm only; every worktree runs `pnpm install` then `pnpm db:up`; test gate `pnpm test:full` (CLAUDE.md).
- Migration filename timestamp = `date +%Y%m%d%H%M%S` at the moment of writing. It must sort after `20261013173721_blog_codes_post_type.sql` (latest on `origin/main` 1aa2e800); re-check `git ls-tree origin/main supabase/migrations/ | tail -3` first.
- Every new SQL function: `SECURITY DEFINER SET search_path = public`, `REVOKE ALL … FROM PUBLIC, anon, authenticated`, `GRANT EXECUTE … TO service_role`. None is granted to `authenticated`, so `db-p0-grants` needs no allow-list change.
- Money steps carry `PERFORM money_fault_hook('<fn>:<point>')`. A new money seam is ONE RPC, never two calls from TypeScript.
- Tests that touch email `vi.mock('@/lib/email')`. Integration tests create rows only through `makeFixture()` and clean up every row they cause (ledger, notifications, faults, claims).
- Copy: Title Case labels; never "escrow"/"holds the money"/"withdraw" for buyer store credit. Store credit is not e-money (memory `no-escrow-hold-language`). Buyer button label: **"Refund To Card"** (the owner said "withdrawal"; this label keeps store credit out of cash-balance wording).
- `'use server'` files export only async functions. Files stay under ~400 lines; `_WalletClient.tsx` (952) and `_StatusStrip.tsx` (589) get NEW sibling components, not more code.
- Release only on the owner's word RELEASE; `supabase db push` before the deploy.

## File map

**PR 1 — refund rule**
- Create `supabase/migrations/<ts>_refund_credit_item_price.sql` — M1 (below)
- Modify `src/lib/legal/documents.ts` — Terms 9.4, Buyer Terms 6.1, SafeDrop 2.1, Refund Policy 7.1/7.2/12.2, Seller Agreement 2.2
- Modify `src/app/account/orders/[orderId]/_OrderDetailsCard.tsx` (~L370–385), `_StatusStrip.tsx` (L144, L338), `_RequestCancelModal.tsx` (L58)
- Modify `src/app/(admin)/admin/orders/components/cancellation-requests-table.tsx` (L44–47, L219–223)
- Modify `src/lib/actions/orders.ts` (L629 + seller-cancel message), `src/lib/actions/order-cancellation.ts` (L453), `src/lib/fees/index.ts` (L90–95 comment)
- Create `src/lib/actions/refund-to-card.ts` — `listMyRefundToCard()`
- Create `src/app/account/wallet/_RefundToCardCard.tsx`; modify `src/app/account/wallet/_WalletClient.tsx` (mount it under the Store Balance card)
- Modify tests: `src/test/guards/refund-policy.guard.integration.test.ts`, `refund-to-source.guard.integration.test.ts`, `checkout-fix-a.guard.integration.test.ts`, `src/lib/wallet/wallet-rows.test.ts`, the `cancelled-copy` / `details-card` / `fee-copy` guards that pin the old sentences

**PR 2 — Cancel – Not Delivered**
- Create `supabase/migrations/<ts>_order_not_delivered_claims.sql` — M2 (below)
- Create `src/lib/orders/not-delivered.ts` (pure eligibility) + `not-delivered.test.ts`
- Create `src/lib/orders/not-delivered-finalize.ts` (server-only: RPC + comms, shared by action and cron)
- Create `src/lib/actions/not-delivered.ts` (`'use server'`)
- Create `src/lib/email/not-delivered.ts` (seller warning email)
- Create `src/app/api/cron/not-delivered-sweep/route.ts`; modify `vercel.json`, `.github/workflows/reconcile-payments.yml`
- Create `src/app/account/orders/[orderId]/_NotDeliveredPanel.tsx`; modify `_StatusStrip.tsx` (overdue branch L263–282), `_OrderClient.tsx`, `page.tsx`
- Modify `src/lib/chat/system-notice.ts` (`by: 'seller' | 'system'`), `src/components/chat/MessageList.tsx` (L304–311)
- Modify `src/lib/legal/documents.ts` Refund Policy 12.2 (cancel route sentence)
- Create `src/test/guards/not-delivered.guard.integration.test.ts`, `src/app/api/cron/not-delivered-sweep/route.test.ts`

---

# PR 1 — Store credit = item price; card refund = full amount

Worktree: `git worktree add .claude/worktrees/feat+refund-credit-item-price -b feat/refund-credit-item-price origin/main`, then `pnpm install && pnpm db:up && pnpm test:reset`. Copy this plan file into the worktree (it is untracked in the main checkout).

### Task 1.1: Failing guard expectations for the new rule

**Files:**
- Modify: `src/test/guards/refund-policy.guard.integration.test.ts`
- Modify: `src/test/guards/refund-to-source.guard.integration.test.ts`

**Interfaces:**
- Consumes: existing fixture helpers in these files (`paidOrder()` = $20 crypto order: subtotal 2000, marketplace 40, processing 102, total 2142).
- Produces: the expectations Task 1.2's SQL must satisfy.

- [ ] **Step 1: Change the seller- and platform-fault expectations in `refund-policy.guard.integration.test.ts`.** Every policy refund now credits 2000 and keeps 142:

```ts
  it('seller fault: the item price is credited, the fees are kept, a fault is recorded with no fee yet', async () => {
    const id = await paidOrder()
    const before = await wallet(fx!.admin.id)
    const r = await rpc('order_cancel_return_wallet', { p_order_id: id, p_dedupe_key: 'seller_cancel:x', p_allow_paid: true, p_attempt_close: 'void', p_fault: 'seller' })
    expect(Number(r.credited_minor)).toBe(2000)
    expect(Number(r.fee_kept_minor)).toBe(142)
    expect((await wallet(fx!.admin.id)) - before).toBe(2000n)
    expect(await txn(`fee_kept:${id}`)).not.toBeNull()
    const f = await faultRow(id)
    expect(f.source).toBe('seller_cancel')
    expect(Number(f.fee_charged_minor)).toBe(0)
  })

  it('platform fault (default): the item price is credited, the fees are kept, nothing recorded', async () => {
    const id = await paidOrder()
    const r = await rpc('order_refund_to_wallet', { p_order_id: id, p_dedupe_key: 'oversold' })
    expect(Number(r.credited_minor)).toBe(2000)
    expect(Number(r.fee_kept_minor)).toBe(142)
    expect(await faultRow(id)).toBeNull()
  })

  it('5th seller fault in 7 days: fee_due is recorded, nothing is charged until a card refund is sent', async () => {
    // existing loop that creates 5 seller-fault cancels for fx.seller
    const ids: string[] = []
    for (let i = 0; i < 5; i++) {
      const id = await paidOrder()
      await rpc('order_cancel_return_wallet', { p_order_id: id, p_dedupe_key: `seller_cancel:${i}`, p_allow_paid: true, p_attempt_close: 'void', p_fault: 'seller' })
      ids.push(id)
    }
    const last = (await fx!.svc.from('order_seller_faults').select('fee_due_minor, fee_charged_minor, fee_txn_id').eq('order_id', ids[4]).single()).data as any
    expect(Number(last.fee_due_minor)).toBe(142)
    expect(Number(last.fee_charged_minor)).toBe(0)
    expect(last.fee_txn_id).toBeNull()
    expect(await txn(`seller_fault_fee:${ids[4]}`)).toBeNull()
  })

  it('not_delivered dedupe keys record the fault as not_delivered', async () => {
    const id = await paidOrder()
    await rpc('order_cancel_return_wallet', { p_order_id: id, p_dedupe_key: `not_delivered:${id}`, p_allow_paid: true, p_attempt_close: 'void', p_fault: 'seller' })
    expect((await faultRow(id)).source).toBe('not_delivered')
  })
```

Delete the old "seller fault: full credit" and "5th fault charges seller_available" cases that these replace. Keep the buyer-fault case: it already expects 2000 / 142.

- [ ] **Step 2: Add the card-route expectations in `refund-to-source.guard.integration.test.ts`.** Use its existing Payssion-paid helper, or the btcpay helper if it seeds a refundable method. The request amount = credit + kept fee:

```ts
  it('request: amount = store credit + kept fee (2142), fee_minor = 142; only the credit must be unspent', async () => {
    const id = await paidRefundableOrder()            // existing helper in this file
    await rpc('order_refund_to_wallet', { p_order_id: id, p_dedupe_key: 'seller_cancel:rts', p_fault: 'seller' })
    const r = await rpc('refund_to_source_request', { p_order_id: id, p_buyer_id: fx!.admin.id })
    expect(r.ok).toBe(true)
    expect(Number(r.amount_minor)).toBe(2142)
    const row = (await fx!.svc.from('refund_to_source_requests').select('amount_minor, fee_minor').eq('id', r.request_id).single()).data as any
    expect(Number(row.amount_minor)).toBe(2142)
    expect(Number(row.fee_minor)).toBe(142)
  })

  it('approve: spends 2000 of store credit and pays the 142 fee from platform_commission; outbox carries 2142', async () => {
    const { requestId, orderId } = await requestedRefund()   // helper: refunded order + request, as above
    const before = await wallet(fx!.admin.id)
    const a = await rpc('refund_to_source_approve', { p_request_id: requestId, p_admin_id: fx!.admin.id })
    expect(a.approved).toBe(true)
    expect(before - (await wallet(fx!.admin.id))).toBe(2000n)
    expect(await txn(`refund_to_source_fee:${requestId}`)).not.toBeNull()
    const ob = (await fx!.svc.from('provider_cancel_outbox').select('amount_minor').eq('request_id', requestId).single()).data as any
    expect(Number(ob.amount_minor)).toBe(2142)
    expect(orderId).toBeTruthy()
  })

  it('fail: reverses both legs — 2000 back to store credit, 142 back to platform_commission', async () => {
    const { requestId } = await approvedRefund()      // helper: request + approve
    const before = await wallet(fx!.admin.id)
    const f = await rpc('refund_to_source_fail', { p_request_id: requestId, p_error: 'test' })
    expect(f.failed).toBe(true)
    expect((await wallet(fx!.admin.id)) - before).toBe(2000n)
    expect(await txn(`refund_to_source_fee_reversal:${requestId}`)).not.toBeNull()
  })

  it('sent (outbox ok) on a fee_due order charges the seller once', async () => {
    const { requestId, orderId } = await approvedRefundWithFeeDue()  // helper: 5 faults then card refund on the 5th
    const ob = (await fx!.svc.from('provider_cancel_outbox').select('id').eq('request_id', requestId).single()).data as any
    await rpc('provider_cancel_outbox_mark', { p_id: ob.id, p_ok: true, p_outcome: 'rf_test', p_error: null })
    expect(await txn(`seller_fault_fee:${orderId}`)).not.toBeNull()
    await rpc('provider_cancel_outbox_mark', { p_id: ob.id, p_ok: true, p_outcome: 'rf_test', p_error: null })
    const n = (await fx!.svc.from('ledger_transactions').select('id', { count: 'exact' }).eq('idempotency_key', `seller_fault_fee:${orderId}`)).count
    expect(n).toBe(1)
  })
```

Write the helpers `requestedRefund`, `approvedRefund` and `approvedRefundWithFeeDue` in the file, built from the calls shown above. Register every order id in `made[]` so `afterAll` cleans its ledger rows, notifications, faults and requests.

- [ ] **Step 3: Run and watch them fail**

Run: `pnpm vitest run src/test/guards/refund-policy.guard.integration.test.ts src/test/guards/refund-to-source.guard.integration.test.ts`
Expected: FAIL. The seller and platform cases credit 2142, `fee_due_minor` does not exist, and the request amount is 2000.

- [ ] **Step 4: Commit the red tests** — `git commit -m "test(refunds): store credit = item price, card refund = full amount"`

### Task 1.2: ⚠️ Migration M1 — `<ts>_refund_credit_item_price.sql` (owner OK required before writing)

**Files:**
- Create: `supabase/migrations/<ts>_refund_credit_item_price.sql`

**Interfaces:**
- Produces: `order_seller_faults.fee_due_minor`, source `'not_delivered'`, `refund_to_source_requests.fee_minor`, `order_seller_fault_charge(uuid) → jsonb`, `refund_to_source_quotes(uuid) → SETOF jsonb`. Changed bodies: `order_refund_buyer_credit`, `order_seller_fault_record`, `refund_to_source_request`, `refund_to_source_approve`, `refund_to_source_fail`, `provider_cancel_outbox_mark`, `order_dispute_resolve`. **No signature changes.** The live build keeps calling the same names and arguments.

- [ ] **Step 1: Write the migration.** Section by section:

```sql
-- Refund rule (owner 2026-10-16, docs/payments/refund-fee-research-2026-10-16.md):
-- every policy refund credits the ITEM price (subtotal − promo) as store
-- credit — spent with no service fee, it buys the same item again — and the
-- buyer's fees move refunds → platform_commission (fee_kept:<order>), for
-- EVERY fault. A refund to the original payment method (requested from the
-- Wallet) pays the full amount: the store credit + the kept fee.
-- The 5-in-7-days seller fee is now charged only when that card refund is
-- SENT (the only time we actually pay the buyer's fee back).

-- ── 1. Columns ───────────────────────────────────────────────────────────────
ALTER TABLE public.order_seller_faults
  ADD COLUMN IF NOT EXISTS fee_due_minor bigint NOT NULL DEFAULT 0 CHECK (fee_due_minor >= 0);
ALTER TABLE public.order_seller_faults DROP CONSTRAINT IF EXISTS order_seller_faults_source_check;
ALTER TABLE public.order_seller_faults ADD CONSTRAINT order_seller_faults_source_check
  CHECK (source IN ('seller_cancel', 'admin_cancel', 'dispute', 'not_delivered'));
COMMENT ON COLUMN public.order_seller_faults.fee_due_minor IS
  'Buyer fees this fault would charge the seller (threshold reached). Posted by order_seller_fault_charge only when the buyer''s card refund is sent.';
ALTER TABLE public.refund_to_source_requests
  ADD COLUMN IF NOT EXISTS fee_minor bigint NOT NULL DEFAULT 0 CHECK (fee_minor >= 0);
COMMENT ON COLUMN public.refund_to_source_requests.fee_minor IS
  'Part of amount_minor paid from platform_commission (the kept service fee); amount_minor − fee_minor comes out of the buyer''s store credit.';
```

Before writing section 1, confirm the inline CHECK's real name: `psql "$SUPABASE_DB_URL" -c "\d order_seller_faults"`. Expected `order_seller_faults_source_check`. If it differs, use the name shown.

```sql
-- ── 2. Fault record: count + fee_due, no charge here ─────────────────────────
-- Body from 20260930005449 §2 verbatim except: 'not_delivered' accepted, and
-- the threshold branch stores fee_due_minor instead of posting the journal.
CREATE OR REPLACE FUNCTION public.order_seller_fault_record(p_order_id uuid, p_source text)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_o        RECORD;
  v_s        RECORD;
  v_existing RECORD;
  v_count    integer;
  v_fee      bigint;
BEGIN
  IF p_source NOT IN ('seller_cancel', 'admin_cancel', 'dispute', 'not_delivered') THEN
    RAISE EXCEPTION 'order_seller_fault_record: source must be seller_cancel|admin_cancel|dispute|not_delivered, got %', p_source USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO v_o FROM orders WHERE id = p_order_id;
  IF NOT FOUND OR v_o.seller_id IS NULL THEN
    RETURN jsonb_build_object('recorded', false, 'fee_due_minor', 0);
  END IF;
  SELECT * INTO v_existing FROM order_seller_faults WHERE order_id = p_order_id;
  IF FOUND THEN
    RETURN jsonb_build_object('recorded', false, 'fee_due_minor', v_existing.fee_due_minor, 'fee_charged_minor', v_existing.fee_charged_minor);
  END IF;
  SELECT * INTO v_s FROM platform_fee_settings WHERE id;
  PERFORM pg_advisory_xact_lock(hashtextextended('seller_fault:' || v_o.seller_id::text, 0));
  INSERT INTO order_seller_faults (order_id, seller_id, source) VALUES (p_order_id, v_o.seller_id, p_source);
  SELECT COUNT(*) INTO v_count FROM order_seller_faults
   WHERE seller_id = v_o.seller_id
     AND occurred_at > now() - make_interval(days => v_s.seller_fault_fee_window_days);
  v_fee := ROUND((COALESCE(v_o.platform_fee, 0) + COALESCE(v_o.payment_processing_fee, 0)) * 100)::bigint;

  PERFORM money_fault_hook('order_seller_fault_record:after_insert');

  IF v_count >= v_s.seller_fault_fee_threshold AND v_fee > 0 THEN
    UPDATE order_seller_faults SET fee_due_minor = v_fee WHERE order_id = p_order_id;
  ELSE
    v_fee := 0;
  END IF;
  RETURN jsonb_build_object('recorded', true, 'count_in_window', v_count, 'fee_due_minor', v_fee);
END;
$$;

-- ── 3. Charge a due seller fee (called when the card refund is sent) ─────────
CREATE OR REPLACE FUNCTION public.order_seller_fault_charge(p_order_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_f   RECORD;
  v_o   RECORD;
  v_s   RECORD;
  v_txn uuid;
  v_cur char(3);
  v_n   integer;
BEGIN
  SELECT * INTO v_f FROM order_seller_faults WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_f.fee_due_minor <= 0 OR v_f.fee_txn_id IS NOT NULL THEN
    RETURN jsonb_build_object('charged', false, 'fee_charged_minor', COALESCE(v_f.fee_charged_minor, 0));
  END IF;
  SELECT * INTO v_o FROM orders WHERE id = p_order_id;
  SELECT * INTO v_s FROM platform_fee_settings WHERE id;
  v_cur := UPPER(COALESCE(v_o.currency, 'USD'))::char(3);
  v_txn := post_journal('seller_fault_fee:' || p_order_id::text, jsonb_build_array(
    jsonb_build_object('owner_type','seller','owner_id',v_f.seller_id::text,'kind','seller_available','direction','debit','amount_minor',v_f.fee_due_minor,'currency',v_cur),
    jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','platform_commission','direction','credit','amount_minor',v_f.fee_due_minor,'currency',v_cur)),
    'SELLER_FAULT_FEE', p_order_id);
  PERFORM money_fault_hook('order_seller_fault_charge:after_journal');
  UPDATE order_seller_faults SET fee_charged_minor = v_f.fee_due_minor, fee_txn_id = v_txn WHERE order_id = p_order_id;
  UPDATE profiles SET seller_balance = COALESCE(seller_balance, 0) - (v_f.fee_due_minor::numeric / 100) WHERE id = v_f.seller_id;
  SELECT COUNT(*) INTO v_n FROM order_seller_faults
   WHERE seller_id = v_f.seller_id AND occurred_at > v_f.occurred_at - make_interval(days => v_s.seller_fault_fee_window_days)
     AND occurred_at <= v_f.occurred_at;
  PERFORM notify_once(v_f.seller_id, 'seller_fault_fee', 'Non-Delivery Fee Applied',
    'This was cancelled order number ' || v_n || ' on your account in ' || v_s.seller_fault_fee_window_days ||
    ' days, and the buyer took their refund to their payment method. The buyer''s fees on order #' ||
    COALESCE(v_o.order_number, UPPER(LEFT(p_order_id::text, 8))) ||
    ' ($' || to_char(v_f.fee_due_minor::numeric / 100, 'FM999999990.00') || ') were charged to your balance.',
    '/account/orders/' || p_order_id::text, 'seller_fault_fee:' || p_order_id::text);
  RETURN jsonb_build_object('charged', true, 'fee_charged_minor', v_f.fee_due_minor, 'fee_txn_id', v_txn);
END;
$$;
REVOKE ALL ON FUNCTION public.order_seller_fault_charge(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_seller_fault_charge(uuid) TO service_role;

-- ── 4. The buyer credit leg: item price for every fault ──────────────────────
-- Body from 20260930005449 §3 except: the policy credit is the item price for
-- every fault (explicit partial amounts unchanged), the remainder is kept for
-- every fault, and not_delivered:% keys map to the not_delivered source.
CREATE OR REPLACE FUNCTION public.order_refund_buyer_credit(
  p_order_id uuid, p_fault text, p_amount_minor bigint, p_dedupe_key text DEFAULT NULL)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_o          RECORD;
  v_cur        char(3);
  v_total      bigint;
  v_item       bigint;
  v_policy     boolean;
  v_credit     bigint;
  v_kept       bigint := 0;
  v_wallet_txn uuid;
  v_kept_txn   uuid;
  v_fault      jsonb := NULL;
  v_source     text;
BEGIN
  IF p_fault IS NULL OR p_fault NOT IN ('buyer', 'seller', 'platform') THEN
    RAISE EXCEPTION 'order_refund_buyer_credit: p_fault must be buyer|seller|platform, got %', COALESCE(p_fault, '<null>') USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO v_o FROM orders WHERE id = p_order_id;
  v_cur   := UPPER(COALESCE(v_o.currency, 'USD'))::char(3);
  v_total := ROUND(COALESCE(v_o.total_amount, 0) * 100)::bigint;
  v_item  := GREATEST(ROUND((COALESCE(v_o.subtotal, 0) - COALESCE(v_o.promo_discount, 0)) * 100)::bigint, 0);
  v_policy := NOT (p_amount_minor IS NOT NULL AND p_amount_minor > 0 AND p_amount_minor < v_total);
  v_credit := CASE WHEN v_policy THEN LEAST(v_item, v_total) ELSE p_amount_minor END;

  IF v_o.buyer_id IS NOT NULL AND v_credit > 0 THEN
    v_wallet_txn := wallet_credit(v_o.buyer_id, v_credit, v_cur, 'refunds',
                                  'wallet_refund:' || p_order_id::text, 'REFUND_TO_WALLET', p_order_id);
  END IF;

  PERFORM money_fault_hook('order_refund_buyer_credit:after_credit');

  -- The fees: kept on every policy refund (a card refund pays them back).
  v_kept := v_total - v_credit;
  IF v_kept > 0 AND (v_policy OR p_fault = 'buyer') THEN
    v_kept_txn := post_journal('fee_kept:' || p_order_id::text, jsonb_build_array(
      jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','refunds','direction','debit','amount_minor',v_kept,'currency',v_cur),
      jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','platform_commission','direction','credit','amount_minor',v_kept,'currency',v_cur)),
      'BUYER_FEE_KEPT', p_order_id);
  ELSE
    v_kept := 0;
  END IF;

  IF p_fault = 'seller' THEN
    v_source := CASE
      WHEN p_dedupe_key LIKE 'dispute:%' THEN 'dispute'
      WHEN p_dedupe_key LIKE 'cancel_request:%' THEN 'admin_cancel'
      WHEN p_dedupe_key LIKE 'not_delivered:%' THEN 'not_delivered'
      ELSE 'seller_cancel' END;
    v_fault := order_seller_fault_record(p_order_id, v_source);
  END IF;

  RETURN jsonb_build_object(
    'wallet_txn_id', v_wallet_txn, 'credited_minor', v_credit, 'fault', p_fault,
    'fee_kept_minor', v_kept, 'fee_kept_txn_id', v_kept_txn,
    'fault_fee_minor', 0,
    'fault_fee_due_minor', COALESCE((v_fault->>'fee_due_minor')::bigint, 0),
    'fault_count_in_window', (v_fault->>'count_in_window')::integer);
END;
$$;
```

```sql
-- ── 5. refund_to_source_request: amount = credit + kept fee ─────────────────
-- Body from 20260930010758 §3 verbatim except: v_kept (sum of the
-- platform_commission credit on fee_kept:<order>) is added to amount_minor and
-- stored in fee_minor; the unspent check stays on the credit only; the
-- notification names the full amount.
--   … after `IF v_credited <= 0 THEN … END IF;` insert:
--   SELECT COALESCE(SUM(le.amount_minor), 0) INTO v_kept
--     FROM ledger_transactions lt
--     JOIN ledger_entries le ON le.transaction_id = lt.id
--     JOIN ledger_accounts la ON la.id = le.account_id
--    WHERE lt.idempotency_key = 'fee_kept:' || p_order_id::text
--      AND la.kind = 'platform_commission' AND le.direction = 'credit';
--   … INSERT … (amount_minor, fee_minor, …) VALUES (v_credited + v_kept, v_kept, …)
--   … notify text: 'We received your request to refund $' || to_char((v_credited + v_kept)::numeric / 100, 'FM999999990.00') ||
--       ' for order #… to your original payment method. Support reviews it within 24 to 48 hours; the store credit stays in your Store Balance until then.'
--   … RETURN … 'amount_minor', v_credited + v_kept, 'credit_minor', v_credited, 'fee_minor', v_kept
-- (declare v_kept bigint := 0; the existing v_fee RECORD keeps its name.)

-- ── 6. refund_to_source_approve: two legs ────────────────────────────────────
-- Body from 20260930010758 §4 verbatim except:
--   balance check:  IF v_balance < (v_r.amount_minor - v_r.fee_minor) THEN … (unchanged branch)
--   spend:          v_txn := wallet_spend(v_r.buyer_id, v_r.amount_minor - v_r.fee_minor, v_r.currency, 'provider_float',
--                                         'refund_to_source:' || p_request_id::text, 'REFUND_TO_SOURCE', v_r.order_id);
--   then:           IF v_r.fee_minor > 0 THEN
--                     PERFORM post_journal('refund_to_source_fee:' || p_request_id::text, jsonb_build_array(
--                       jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','platform_commission','direction','debit','amount_minor',v_r.fee_minor,'currency',v_r.currency),
--                       jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','provider_float','direction','credit','amount_minor',v_r.fee_minor,'currency',v_r.currency)),
--                       'REFUND_TO_SOURCE_FEE', v_r.order_id);
--                   END IF;
--                   PERFORM money_fault_hook('refund_to_source_approve:after_fee');
--   outbox:         provider_refund_outbox_enqueue(…, v_r.amount_minor, …)   -- full amount, unchanged call

-- ── 7. refund_to_source_fail: reverse both legs ─────────────────────────────
-- Body from 20260930010758 §4 verbatim except:
--   v_txn := wallet_credit(v_r.buyer_id, v_r.amount_minor - v_r.fee_minor, v_r.currency, 'provider_float',
--                          'refund_to_source_reversal:' || p_request_id::text, 'REFUND_TO_SOURCE_REVERSED', v_r.order_id);
--   IF v_r.fee_minor > 0 THEN
--     PERFORM post_journal('refund_to_source_fee_reversal:' || p_request_id::text, jsonb_build_array(
--       jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','provider_float','direction','debit','amount_minor',v_r.fee_minor,'currency',v_r.currency),
--       jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','platform_commission','direction','credit','amount_minor',v_r.fee_minor,'currency',v_r.currency)),
--       'REFUND_TO_SOURCE_FEE_REVERSED', v_r.order_id);
--   END IF;
--   buyer notice: 'We could not send your refund back to your payment method. Your store credit is back in your Store Balance; support will follow up.'

-- ── 8. provider_cancel_outbox_mark: charge a due seller fee once the refund is sent ──
-- Body from 20260930010758 §5 verbatim; in the branch where kind = 'refund'
-- AND p_ok marks the request 'sent', add right after that UPDATE:
--   PERFORM order_seller_fault_charge(v_row.order_id);

-- ── 9. order_dispute_resolve: report what was credited ───────────────────────
-- Body from 20260930005449 §6 verbatim except, in the refund_full branch:
--   v_t := order_refund_to_wallet(v_order.id, 'dispute:' || p_dispute_id::text, NULL, 'seller');
--   v_refund := COALESCE((v_t->>'credited_minor')::bigint, v_gross);
-- and the buyer refund_full message becomes:
--   'Your dispute for order #' || v_ref || ' was resolved in your favour — $' || to_char(v_refund::numeric / 100, 'FM999999990.00') ||
--   ' was added to your Store Balance (spend it with no service fee). To get $' || to_char(v_gross::numeric / 100, 'FM999999990.00') ||
--   ' back to your payment method instead, request it from your Wallet.'

-- ── 10. Wallet list: refunded orders that can go back to the card ────────────
CREATE OR REPLACE FUNCTION public.refund_to_source_quotes(p_buyer_id uuid)
  RETURNS TABLE (order_id uuid, order_number text, credit_minor bigint, fee_minor bigint, total_minor bigint,
                 currency char(3), method_label text, refundable boolean, request_status text, refunded_at timestamptz)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id, o.order_number,
         wr.credit, COALESCE(fk.kept, 0), wr.credit + COALESCE(fk.kept, 0),
         UPPER(COALESCE(o.currency, 'USD'))::char(3),
         pmf.label, COALESCE(pmf.refundable, false), r.status, wr.created_at
    FROM orders o
    JOIN LATERAL (
      SELECT lt.created_at, SUM(le.amount_minor) AS credit
        FROM ledger_transactions lt
        JOIN ledger_entries le ON le.transaction_id = lt.id
        JOIN ledger_accounts la ON la.id = le.account_id
       WHERE lt.idempotency_key = 'wallet_refund:' || o.id::text
         AND la.kind = 'user_wallet' AND le.direction = 'credit' AND la.owner_id = p_buyer_id
       GROUP BY lt.created_at) wr ON true
    LEFT JOIN LATERAL (
      SELECT SUM(le.amount_minor) AS kept
        FROM ledger_transactions lt
        JOIN ledger_entries le ON le.transaction_id = lt.id
        JOIN ledger_accounts la ON la.id = le.account_id
       WHERE lt.idempotency_key = 'fee_kept:' || o.id::text
         AND la.kind = 'platform_commission' AND le.direction = 'credit') fk ON true
    LEFT JOIN LATERAL (
      SELECT pa.provider, pa.pm_id FROM payment_attempts pa
       WHERE pa.order_id = o.id AND pa.status = 'paid' AND pa.provider_charge_id IS NOT NULL
       ORDER BY pa.created_at DESC LIMIT 1) pa ON true
    LEFT JOIN payment_method_fees pmf ON pmf.method = COALESCE(pa.pm_id, pa.provider)
    LEFT JOIN refund_to_source_requests r ON r.order_id = o.id
   WHERE o.buyer_id = p_buyer_id AND o.status IN ('refunded', 'cancelled') AND pa.provider IS NOT NULL
   ORDER BY wr.created_at DESC
   LIMIT 50;
$$;
REVOKE ALL ON FUNCTION public.refund_to_source_quotes(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_to_source_quotes(uuid) TO service_role;

-- ── 11. D4: crypto rails cannot refund provider-side ────────────────────────
UPDATE public.payment_method_fees SET refundable = false WHERE method IN ('btcpay', 'coingate');
```

Sections 5–9 are function bodies copied verbatim from the cited migration sections, with only the listed edits applied. Open the cited file and copy each function whole. Don't retype it. Re-issue the REVOKE/GRANT lines after each `CREATE OR REPLACE`.

- [ ] **Step 2: Apply on the worktree stack** — `pnpm test:reset` (never `supabase db reset` directly). Expected: sanity counts pass.
- [ ] **Step 3: Run the Task 1.1 tests** — `pnpm vitest run src/test/guards/refund-policy.guard.integration.test.ts src/test/guards/refund-to-source.guard.integration.test.ts`. Expected: PASS.
- [ ] **Step 4: Add fault-point proofs** to `src/test/guards/money-atomicity.guard.integration.test.ts`, using its `withFault` helper:

```ts
  itFault('refund_to_source_approve:after_fee leaves the credit unspent and no outbox row', async () => {
    const { requestId } = await requestedRefund()
    const err = withFault('refund_to_source_approve:after_fee',
      `SELECT public.refund_to_source_approve('${requestId}', '${fx!.admin.id}')`)
    expect(err).toMatch(/money_fault/)
    expect(await txn(`refund_to_source:${requestId}`)).toBeNull()
    expect(await txn(`refund_to_source_fee:${requestId}`)).toBeNull()
  })
  itFault('order_seller_fault_charge:after_journal leaves no seller_fault_fee row', async () => {
    const orderId = await orderWithFeeDue()
    const err = withFault('order_seller_fault_charge:after_journal', `SELECT public.order_seller_fault_charge('${orderId}')`)
    expect(err).toMatch(/money_fault/)
    expect(await txn(`seller_fault_fee:${orderId}`)).toBeNull()
  })
```

Run them. Expected: PASS.

- [ ] **Step 5: Regenerate types** — `pnpm db:types --db-url "$(grep -E '^SUPABASE_DB_URL' .env.test | cut -d= -f2-)"` (memory `db-types-ignores-worktree-stack`). Then `pnpm type-check`. Expected: clean.
- [ ] **Step 6: Commit** — `git add supabase/migrations/*_refund_credit_item_price.sql src/types/database.ts src/test/guards/money-atomicity.guard.integration.test.ts && git commit -m "feat(refunds): store credit = item price, card refund pays the kept fee back (M1)"`

### Task 1.3: Wallet "Refund To Card" list

**Files:**
- Create: `src/lib/actions/refund-to-card.ts`
- Create: `src/app/account/wallet/_RefundToCardCard.tsx`
- Modify: `src/app/account/wallet/_WalletClient.tsx` (render `<RefundToCardCard />` directly under the Store Balance card, about L575–590)
- Test: `src/lib/actions/refund-to-card.test.ts`

**Interfaces:**
- Consumes: SQL `refund_to_source_quotes(p_buyer_id)` (Task 1.2), the existing `requestRefundToSource(orderId)` in `src/lib/actions/refund-to-source.ts:50`.
- Produces: `listMyRefundToCard(): Promise<RefundToCardRow[]>`, where `RefundToCardRow = { orderId: string; orderNumber: string; creditMinor: number; feeMinor: number; totalMinor: number; currency: string; methodLabel: string | null; state: 'available' | 'store_credit_only' | 'credit_spent' | 'requested' | 'sent' | 'rejected' | 'failed' }`.

- [ ] **Step 1: Failing unit test** for the row mapping (pure function `toRefundToCardRow`, exported from a non-`'use server'` helper in the same folder: `src/lib/actions/refund-to-card-rows.ts`):

```ts
import { describe, it, expect } from 'vitest'
import { toRefundToCardRow } from './refund-to-card-rows'

describe('toRefundToCardRow', () => {
  const base = { order_id: 'o1', order_number: 'DM-AB12-CD34', credit_minor: 7000, fee_minor: 497, total_minor: 7497, currency: 'USD', method_label: 'Trustly', refundable: true, request_status: null }
  it('a refundable, unrequested order with unspent credit is available at the full total', () => {
    expect(toRefundToCardRow(base, 7000)).toMatchObject({ orderNumber: 'DM-AB12-CD34', creditMinor: 7000, totalMinor: 7497, state: 'available' })
  })
  it('a non-refundable method is store credit only', () => {
    expect(toRefundToCardRow({ ...base, refundable: false }, 7000).state).toBe('store_credit_only')
  })
  it('spent credit cannot be sent back', () => {
    expect(toRefundToCardRow(base, 6999).state).toBe('credit_spent')
  })
  it('an existing request shows its status', () => {
    expect(toRefundToCardRow({ ...base, request_status: 'pending' }, 7000).state).toBe('requested')
    expect(toRefundToCardRow({ ...base, request_status: 'sent' }, 7000).state).toBe('sent')
  })
})
```

Run: `pnpm vitest run src/lib/actions/refund-to-card.test.ts` — Expected: FAIL (module missing).

- [ ] **Step 2: Implement** `refund-to-card-rows.ts`:

```ts
export type RefundToCardState = 'available' | 'store_credit_only' | 'credit_spent' | 'requested' | 'sent' | 'rejected' | 'failed'
export interface RefundToCardRow {
  orderId: string; orderNumber: string; creditMinor: number; feeMinor: number; totalMinor: number
  currency: string; methodLabel: string | null; state: RefundToCardState
}
export function toRefundToCardRow(r: any, walletBalanceMinor: number): RefundToCardRow {
  const status = r.request_status as string | null
  const state: RefundToCardState =
    status === 'pending' || status === 'approved' ? 'requested'
    : status === 'sent' ? 'sent'
    : status === 'rejected' ? 'rejected'
    : status === 'failed' ? 'failed'
    : !r.refundable ? 'store_credit_only'
    : walletBalanceMinor < Number(r.credit_minor) ? 'credit_spent'
    : 'available'
  return {
    orderId: r.order_id, orderNumber: r.order_number ?? String(r.order_id).slice(0, 8).toUpperCase(),
    creditMinor: Number(r.credit_minor), feeMinor: Number(r.fee_minor), totalMinor: Number(r.total_minor),
    currency: r.currency, methodLabel: r.method_label ?? null, state,
  }
}
```

and `refund-to-card.ts`:

```ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { toRefundToCardRow, type RefundToCardRow } from './refund-to-card-rows'

/** The buyer's refunded orders and what each would send back to the card. */
export async function listMyRefundToCard(): Promise<RefundToCardRow[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const svc = createServiceRoleClient() as any
  const [{ data: rows }, { data: bal }] = await Promise.all([
    svc.rpc('refund_to_source_quotes', { p_buyer_id: user.id }),
    svc.rpc('user_wallet_balance', { p_user_id: user.id, p_currency: 'USD' }),
  ])
  return (rows ?? []).map((r: any) => toRefundToCardRow(r, Number(bal ?? 0)))
}
```

Copy the `createServiceRoleClient` import path from `src/lib/actions/refund-to-source.ts`.

- [ ] **Step 3: Run the test** — Expected: PASS.
- [ ] **Step 4: `_RefundToCardCard.tsx`** — a client component following the `card-surface-system` rules: no card-in-card, MUI icons, Title Case, near-black card tokens. It loads `listMyRefundToCard()` once on mount and renders nothing when the list is empty. Each row: order number · "Store credit $70.00" · "To card $74.97" · a primary button **Refund To Card** when `state === 'available'`, which calls `requestRefundToSource(orderId)`, toasts the result and reloads the list. Other states show text: "Store Credit Only" / "Credit Already Spent" / "Requested — Reviewed Within 48 Hours" / "Sent To Your Payment Method" / "Declined" / "Could Not Be Sent". Heading: **Refund To Card**. Caption: "Store credit buys the same item with no service fee. Prefer your money back? Send any refunded order to your original payment method — you get the full amount you paid, service fee included." Skeleton rows match the row height (memory `skeletons-match-the-page`); inputs and buttons ≥16px / 44px on touch.
- [ ] **Step 5: Mount it** in `_WalletClient.tsx` for buyers and sellers alike (both can hold store credit).
- [ ] **Step 6: `pnpm type-check`, then commit** — `git commit -m "feat(wallet): Refund To Card list with the full amount per refunded order"`

### Task 1.4: Copy — order page, admin, notifications, legal

**Files:** as listed in the File map (PR 1 copy rows).

- [ ] **Step 1: Update the guards that pin sentences first** (`cancelled-copy`, `details-card`, `fee-copy`, `checkout-fix-a`). Pin the new sentences below. Run them and watch them fail.
- [ ] **Step 2: Order page** (`_OrderDetailsCard.tsx` ~L370–385, `_StatusStrip.tsx` L144/L338). Refunded or cancelled-paid orders show:
  "The item price ($70.00) was added to your Store Balance — spend it with no service fee. Want the full $74.97 back to your payment method instead? Request it from your Wallet."
  Build the amounts from the page's credited/kept ledger read (`page.tsx` L314–330 already reads `wallet_refund:` / `fee_kept:`). Wire "Wallet" as a link to `/account/wallet`. Remove the buyer-fault-only branch: every refund now reads the same.
- [ ] **Step 3: `_RequestCancelModal.tsx` L58** →
  "Tell us why. DropMarket reviews it; if approved, the item price goes to your Store Balance as store credit, and you can request the full amount back to your payment method from your Wallet."
- [ ] **Step 4: Admin** `cancellation-requests-table.tsx` L44–47 comment and L219–223. The Seller At Fault box's helper text becomes:
  "On: counts against the seller's non-delivery record. The buyer's refund is the same either way (item price as store credit, full amount on request to their card)."
- [ ] **Step 5: Notifications.** In `orders.ts:629`, the seller-cancel message and `order-cancellation.ts:453`, append:
  " Want the full $X back to your payment method? Request it from your Wallet."
  X = `order.total_amount`.
- [ ] **Step 6: Legal** (`src/lib/legal/documents.ts`). Replace these clause texts:
  - **Terms 9.4:** "Approved refunds are issued as store credit to your Store Balance for the item price, and you can ask from your Wallet for the full amount you paid, service fee included, to go back to your original payment method instead, per the Refund & Dispute Policy. Store credit is a non-transferable credit against future purchases on the Platform, spendable with no service fee, and is not redeemable for cash except as set out in that Policy; it is not e-money and no interest accrues."
  - **Buyer Terms 6.1:** "Approved refunds are credited to your Store Balance as store credit for the item price. You can ask from your Wallet for the full amount you paid, service fee included, to go back to your original payment method instead. The amount, timing and conditions are set out in the Refund & Dispute Policy, Section 7."
  - **SafeDrop 2.1, last sentence:** "If the Order is cancelled for non-delivery you get the item price back straight away as store credit to your Store Balance, or the full amount you paid, service fee included, to your original payment method on request from your Wallet (see the Refund & Dispute Policy, Sections 7 and 12)."
  - **Refund Policy 7.1:** "**Store credit by default.** Approved refunds are credited instantly to your Store Balance as **DropMarket store credit for the item price**. Store credit is spent at checkout with no service fee, so it buys the same item again at the same price. Store credit is a non-transferable credit note against future purchases: it is not e-money, accrues no interest, and cannot be exchanged for cash except as set out in 7.2."
  - **Refund Policy 7.2:** "**Refund to your original payment method.** From your Wallet you can ask for any refunded Order to go back to the payment method you used. That refund is the **full amount you paid, service fee included**. We review each request within 24 to 48 hours; approved refunds usually arrive within **5–10 business days** depending on your payment method. A request can only be made while that Order's store credit is still unspent, and only for payment methods whose provider supports refunds (a method that does not is marked "Store credit only" on the Fees & Charges page). Nothing in this clause limits refunds you are entitled to under the Consumer Rights Act 2015, which are always available in full to your original payment method. DropMarket does not hold buyer cash balances."
  - **Refund Policy 12.2, second sentence:** "An Order cancelled for non-delivery is refunded as store credit for the item price, or in full, service fee included, to your original payment method on request from your Wallet (see Section 7)."
  - **Seller Agreement 2.2, fee sentence:** "From the **fifth** such cancellation within any rolling **7-day** period, where the Buyer takes their refund to their original payment method, the Buyer's fees on that Order are charged to the Seller's Store Balance, which may go below zero until later sales cover it."
- [ ] **Step 7: Run the copy guards plus `pnpm type-check`.** Expected: PASS. Then commit: `git commit -m "copy(refunds): item price as store credit, full amount to card on request"`

### Task 1.5: PR 1 gate

- [ ] `pnpm test:full` on the worktree stack. Expected: all green.
- [ ] Browser check on localhost (one dev server at a time — memory `one-dev-server-at-a-time`): a refunded order page plus the Wallet "Refund To Card" list, desktop and phone width.
- [ ] security-guidance pass (payment code). PR with the migration called out in the description. Owner merges; at release: `supabase db push` → deploy (memory `release-needs-db-push-first`). `db:down --purge` the stack.

---

# PR 2 — Cancel – Not Delivered (after PR 1 is merged)

Worktree off the updated `origin/main`: `feat/cancel-not-delivered`, `pnpm install && pnpm db:up && pnpm test:reset`.

### Task 2.1: Pure eligibility

**Files:**
- Create: `src/lib/orders/not-delivered.ts`
- Test: `src/lib/orders/not-delivered.test.ts`

**Interfaces:**
- Consumes: `parseDeliveryMinutes` from `src/lib/utils/delivery-time.ts` (fallback 60, the same as `page.tsx:413`).
- Produces: `notDeliveredEligibility(o): { eligible: true; dueAt: string } | { eligible: false; reason: 'status' | 'not_overdue'; dueAt?: string }`, `NOT_DELIVERED_GRACE_MINUTES_DEFAULT = 60`.

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest'
import { notDeliveredEligibility } from './not-delivered'

const paidAt = '2026-10-16T10:00:00.000Z'
const at = (min: number) => Date.parse(paidAt) + min * 60_000

describe('notDeliveredEligibility', () => {
  it('a 20-minute listing is not eligible at minute 19', () => {
    expect(notDeliveredEligibility({ status: 'paid', paid_at: paidAt, created_at: paidAt, deliveryTime: '20min', now: at(19) }))
      .toEqual({ eligible: false, reason: 'not_overdue', dueAt: '2026-10-16T10:20:00.000Z' })
  })
  it('is eligible once the delivery time has passed', () => {
    expect(notDeliveredEligibility({ status: 'paid', paid_at: paidAt, created_at: paidAt, deliveryTime: '20min', now: at(21) }))
      .toEqual({ eligible: true, dueAt: '2026-10-16T10:20:00.000Z' })
  })
  it('delivering orders are eligible too; delivered ones are not', () => {
    expect(notDeliveredEligibility({ status: 'delivering', paid_at: paidAt, created_at: paidAt, deliveryTime: '20min', now: at(30) }).eligible).toBe(true)
    expect(notDeliveredEligibility({ status: 'paid', delivered_at: paidAt, paid_at: paidAt, created_at: paidAt, deliveryTime: '20min', now: at(30) }))
      .toEqual({ eligible: false, reason: 'status' })
  })
  it('falls back to 60 minutes for an unparseable delivery time, like the order page', () => {
    expect(notDeliveredEligibility({ status: 'paid', paid_at: paidAt, created_at: paidAt, deliveryTime: 'soon', now: at(59) }).eligible).toBe(false)
    expect(notDeliveredEligibility({ status: 'paid', paid_at: paidAt, created_at: paidAt, deliveryTime: 'soon', now: at(61) }).eligible).toBe(true)
  })
})
```

Run: `pnpm vitest run src/lib/orders/not-delivered.test.ts` — Expected: FAIL.

- [ ] **Step 2: Implement**

```ts
/**
 * Can the BUYER press "Cancel – Not Delivered"? Only while the seller still
 * owes the delivery (paid / delivering, not marked delivered) and only once
 * the listing's delivery time — counted from payment, exactly as the order
 * page's progress bar counts it — has run out.
 */
import { parseDeliveryMinutes } from '@/lib/utils/delivery-time'

export const NOT_DELIVERED_GRACE_MINUTES_DEFAULT = 60

export type NotDeliveredEligibility =
  | { eligible: true; dueAt: string }
  | { eligible: false; reason: 'status' | 'not_overdue'; dueAt?: string }

export function notDeliveredEligibility(o: {
  status: string
  delivered_at?: string | null
  paid_at?: string | null
  created_at: string
  deliveryTime?: string | null
  now?: number
}): NotDeliveredEligibility {
  if (!['paid', 'delivering'].includes(o.status) || o.delivered_at) return { eligible: false, reason: 'status' }
  const start = Date.parse(o.paid_at ?? o.created_at)
  const dueAt = new Date(start + parseDeliveryMinutes(o.deliveryTime) * 60_000).toISOString()
  if ((o.now ?? Date.now()) < Date.parse(dueAt)) return { eligible: false, reason: 'not_overdue', dueAt }
  return { eligible: true, dueAt }
}
```

- [ ] **Step 3: Run** — Expected: PASS. **Commit** — `git commit -m "feat(orders): not-delivered eligibility"`

### Task 2.2: ⚠️ Migration M2 — `<ts>_order_not_delivered_claims.sql` (owner OK required before writing)

**Files:**
- Create: `supabase/migrations/<ts>_order_not_delivered_claims.sql`
- Test: `src/test/guards/not-delivered.guard.integration.test.ts`

**Interfaces:**
- Consumes: `order_cancel_return_wallet(…, p_fault => 'seller')`, `order_refund_to_wallet(…, 'seller')` (PR 1 semantics: $70 credit, $4.97 kept, fault source `not_delivered` via the `not_delivered:<order>` key).
- Produces: table `order_not_delivered_claims`; `platform_fee_settings.not_delivered_grace_minutes`; RPCs `order_not_delivered_open(uuid, uuid, timestamptz) → jsonb`, `order_not_delivered_withdraw(uuid, uuid) → jsonb`, `order_not_delivered_finalize(uuid) → jsonb` (keys `finalized`, `outcome` ∈ `auto_cancelled|seller_responded|delivered|disputed|cancelled`, `reason` ∈ `no_open_claim|grace|refused`, `credited_minor`, `total_minor`, `grace_ends_at`), `order_not_delivered_due(integer) → SETOF uuid`, `order_not_delivered_mark_responded(uuid, text, timestamptz) → boolean`, trigger `trg_messages_not_delivered_response` (AFTER INSERT ON messages).

- [ ] **Step 1: Failing guard test** (same scaffolding as `refund-policy.guard.integration.test.ts`: `makeFixture`, `paidOrder()`, `made[]` cleanup, `vi.mock('@/lib/email', () => ({}))`). Add `order_not_delivered_claims`, `messages` (by the order's conversation) and `conversations` (by `order_id`) deletes to `afterAll`.

```ts
const past = (min: number) => new Date(Date.now() - min * 60_000).toISOString()
const ageClaim = async (orderId: string) =>
  fx!.svc.from('order_not_delivered_claims').update({ grace_ends_at: past(1) }).eq('order_id', orderId)
const claim = async (orderId: string) =>
  (await fx!.svc.from('order_not_delivered_claims').select('*').eq('order_id', orderId).maybeSingle()).data as any

it('open is refused before the delivery time passes and for someone else\'s order', async () => {
  const id = await paidOrder()
  expect((await rpc('order_not_delivered_open', { p_order_id: id, p_buyer_id: fx!.admin.id, p_due_at: new Date(Date.now() + 60_000).toISOString() })).reason).toBe('not_overdue')
  expect((await rpc('order_not_delivered_open', { p_order_id: id, p_buyer_id: fx!.seller.id, p_due_at: past(5) })).reason).toBe('not_owner')
})

it('open starts a 60-minute grace and notifies the seller once', async () => {
  const id = await paidOrder()
  const r = await rpc('order_not_delivered_open', { p_order_id: id, p_buyer_id: fx!.admin.id, p_due_at: past(5) })
  expect(r.ok).toBe(true)
  const mins = (Date.parse(r.grace_ends_at) - Date.now()) / 60_000
  expect(mins).toBeGreaterThan(58); expect(mins).toBeLessThanOrEqual(60)
  const again = await rpc('order_not_delivered_open', { p_order_id: id, p_buyer_id: fx!.admin.id, p_due_at: past(5) })
  expect(again.already).toBe(true)
  const { count } = await fx!.svc.from('notifications').select('id', { count: 'exact' }).eq('user_id', fx!.seller.id).eq('type', 'order_not_delivered').like('link', `%${id}%`)
  expect(count).toBe(1)
})

it('finalize inside the grace does nothing', async () => {
  const id = await paidOrder()
  await rpc('order_not_delivered_open', { p_order_id: id, p_buyer_id: fx!.admin.id, p_due_at: past(5) })
  const f = await rpc('order_not_delivered_finalize', { p_order_id: id })
  expect(f).toMatchObject({ finalized: false, reason: 'grace' })
  expect(await txn(`wallet_refund:${id}`)).toBeNull()
})

it('finalize after the grace cancels: $item to Store Balance, fee kept, fault not_delivered', async () => {
  const id = await paidOrder()
  await rpc('order_not_delivered_open', { p_order_id: id, p_buyer_id: fx!.admin.id, p_due_at: past(5) })
  await ageClaim(id)
  const before = await wallet(fx!.admin.id)
  const f = await rpc('order_not_delivered_finalize', { p_order_id: id })
  expect(f).toMatchObject({ finalized: true, outcome: 'auto_cancelled' })
  expect(Number(f.credited_minor)).toBe(2000)
  expect(Number(f.total_minor)).toBe(2142)
  expect((await wallet(fx!.admin.id)) - before).toBe(2000n)
  expect(await txn(`fee_kept:${id}`)).not.toBeNull()
  expect((await faultRow(id)).source).toBe('not_delivered')
  expect((await claim(id)).status).toBe('auto_cancelled')
  const replay = await rpc('order_not_delivered_finalize', { p_order_id: id })
  expect(replay).toMatchObject({ finalized: false, reason: 'no_open_claim' })
  expect((await wallet(fx!.admin.id)) - before).toBe(2000n)
})

it('a delivery inside the grace closes the claim with no refund', async () => {
  const id = await paidOrder()
  await rpc('order_not_delivered_open', { p_order_id: id, p_buyer_id: fx!.admin.id, p_due_at: past(5) })
  await rpc('safedrop_transition', { p_order_id: id, p_event: 'DELIVERED', p_dedupe_key: `test:${id}`, p_reason: null, p_amount_minor: null })
  await ageClaim(id)
  const f = await rpc('order_not_delivered_finalize', { p_order_id: id })
  expect(f).toMatchObject({ finalized: true, outcome: 'delivered' })
  expect(await txn(`wallet_refund:${id}`)).toBeNull()
})

// Order chat helper: the order's conversation (create it if the fixture has none) + a message.
const say = async (orderId: string, senderId: string | null) => {
  let { data: cv } = await fx!.svc.from('conversations').select('id').eq('order_id', orderId).maybeSingle() as any
  if (!cv) cv = (await (fx!.svc.from('conversations').insert as any)({ order_id: orderId, buyer_id: fx!.admin.id, seller_id: fx!.seller.id, listing_id: fx!.listingId }).select('id').single()).data
  await (fx!.svc.from('messages').insert as any)({ conversation_id: cv.id, sender_id: senderId, content: 'on it' })
}

it('a seller chat reply inside the hour closes the report at once; finalize then refunds nothing', async () => {
  const id = await paidOrder()
  await rpc('order_not_delivered_open', { p_order_id: id, p_buyer_id: fx!.admin.id, p_due_at: past(5) })
  await say(id, fx!.seller.id)
  const c = await claim(id)
  expect(c.status).toBe('seller_responded')
  expect(c.response_kind).toBe('message')
  expect(await rpc('order_not_delivered_finalize', { p_order_id: id })).toMatchObject({ finalized: false, reason: 'no_open_claim' })
  expect(await txn(`wallet_refund:${id}`)).toBeNull()
})

it('buyer messages and system notices do not count as a seller response', async () => {
  const id = await paidOrder()
  await rpc('order_not_delivered_open', { p_order_id: id, p_buyer_id: fx!.admin.id, p_due_at: past(5) })
  await say(id, fx!.admin.id)
  await say(id, null)
  expect((await claim(id)).status).toBe('open')
})

it('a seller reply AFTER the hour is too late: the order still auto-cancels', async () => {
  const id = await paidOrder()
  await rpc('order_not_delivered_open', { p_order_id: id, p_buyer_id: fx!.admin.id, p_due_at: past(5) })
  await ageClaim(id)
  await say(id, fx!.seller.id)
  expect((await claim(id)).status).toBe('open')
  expect(await rpc('order_not_delivered_finalize', { p_order_id: id })).toMatchObject({ finalized: true, outcome: 'auto_cancelled' })
})

it('Start delivery inside the hour counts as a response', async () => {
  const id = await paidOrder()
  await rpc('order_not_delivered_open', { p_order_id: id, p_buyer_id: fx!.admin.id, p_due_at: past(5) })
  await rpc('safedrop_transition', { p_order_id: id, p_event: 'DELIVERING', p_dedupe_key: `test:start:${id}`, p_reason: null, p_amount_minor: null })
  const f = await rpc('order_not_delivered_finalize', { p_order_id: id })
  expect(f).toMatchObject({ finalized: true, outcome: 'seller_responded' })
  expect((await claim(id)).response_kind).toBe('started_delivery')
})

it('withdraw stops it; the sweep list only returns open claims past their grace', async () => {
  const a = await paidOrder(); const b = await paidOrder()
  for (const id of [a, b]) await rpc('order_not_delivered_open', { p_order_id: id, p_buyer_id: fx!.admin.id, p_due_at: past(5) })
  expect((await rpc('order_not_delivered_withdraw', { p_order_id: a, p_buyer_id: fx!.admin.id })).ok).toBe(true)
  await ageClaim(a); await ageClaim(b)
  const due: string[] = (await rpc('order_not_delivered_due', { p_limit: 50 })) ?? []
  expect(due).toContain(b); expect(due).not.toContain(a)
})

itFault('a fault after the refund leaves the claim open and no credit', async () => {
  const id = await paidOrder()
  await rpc('order_not_delivered_open', { p_order_id: id, p_buyer_id: fx!.admin.id, p_due_at: past(5) })
  await ageClaim(id)
  const err = withFault('order_not_delivered_finalize:after_refund', `SELECT public.order_not_delivered_finalize('${id}')`)
  expect(err).toMatch(/money_fault/)
  expect(await txn(`wallet_refund:${id}`)).toBeNull()
  expect((await claim(id)).status).toBe('open')
})
```

Check the real `safedrop_transition` argument names in the latest migration that defines it (`git grep -l "FUNCTION public.safedrop_transition" supabase/migrations | tail -1`), and the event names the seller's Start Delivery and Mark As Delivered paths use (the tests assume `DELIVERING` / `DELIVERED`) (`grep -n "safedrop_transition\|DELIVERED" src/lib/actions/orders.ts`). Use exactly those.

Run: `pnpm vitest run src/test/guards/not-delivered.guard.integration.test.ts` — Expected: FAIL (functions missing).

- [ ] **Step 2: Write the migration**

```sql
-- "Cancel – Not Delivered" (owner 2026-10-16). Once a paid order's delivery
-- time has passed the buyer can report it; the seller is notified and gets
-- not_delivered_grace_minutes (60) to deliver. Still not delivered after
-- that → the order is cancelled through the existing money seams as a
-- SELLER fault (store credit = item price, fee kept, fault source
-- not_delivered). The claim row is the state; every RPC is service-role only
-- and idempotent. Driven by the order page (finalize on view) and a 15-min
-- sweep (/api/cron/not-delivered-sweep).

ALTER TABLE public.platform_fee_settings
  ADD COLUMN IF NOT EXISTS not_delivered_grace_minutes integer NOT NULL DEFAULT 60 CHECK (not_delivered_grace_minutes BETWEEN 5 AND 1440);

CREATE TABLE IF NOT EXISTS public.order_not_delivered_claims (
  order_id       uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  buyer_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seller_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  due_at         timestamptz NOT NULL,
  opened_at      timestamptz NOT NULL DEFAULT now(),
  grace_ends_at  timestamptz NOT NULL,
  status         text NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open', 'withdrawn', 'seller_responded', 'delivered', 'disputed', 'cancelled', 'auto_cancelled')),
  responded_at   timestamptz,
  response_kind  text CHECK (response_kind IN ('message', 'started_delivery')),
  closed_at      timestamptz,
  credited_minor bigint
);
CREATE INDEX IF NOT EXISTS order_not_delivered_claims_due_idx
  ON public.order_not_delivered_claims (grace_ends_at) WHERE status = 'open';
ALTER TABLE public.order_not_delivered_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.order_not_delivered_claims FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.order_not_delivered_claims TO service_role;
COMMENT ON TABLE public.order_not_delivered_claims IS
  'One per order: the buyer reported non-delivery after the delivery time; auto-cancel at grace_ends_at unless delivered first. Service-role only.';

CREATE OR REPLACE FUNCTION public.order_not_delivered_open(p_order_id uuid, p_buyer_id uuid, p_due_at timestamptz)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_o     RECORD;
  v_c     RECORD;
  v_grace integer;
  v_ends  timestamptz;
  v_ref   text;
  v_span  text;
BEGIN
  SELECT * INTO v_o FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_o.buyer_id IS DISTINCT FROM p_buyer_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_owner');
  END IF;
  IF v_o.status NOT IN ('paid', 'delivering') OR v_o.delivered_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_open', 'status', v_o.status);
  END IF;
  IF p_due_at IS NULL OR now() < p_due_at THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_overdue', 'due_at', p_due_at);
  END IF;
  SELECT * INTO v_c FROM order_not_delivered_claims WHERE order_id = p_order_id FOR UPDATE;
  IF FOUND AND v_c.status = 'open' THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'grace_ends_at', v_c.grace_ends_at);
  END IF;
  IF FOUND AND v_c.status <> 'withdrawn' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'closed', 'status', v_c.status);
  END IF;
  SELECT not_delivered_grace_minutes INTO v_grace FROM platform_fee_settings WHERE id;
  v_grace := COALESCE(v_grace, 60);
  v_ends := now() + make_interval(mins => v_grace);
  INSERT INTO order_not_delivered_claims (order_id, buyer_id, seller_id, due_at, grace_ends_at)
  VALUES (p_order_id, v_o.buyer_id, v_o.seller_id, p_due_at, v_ends)
  ON CONFLICT (order_id) DO UPDATE
    SET status = 'open', opened_at = now(), due_at = EXCLUDED.due_at, grace_ends_at = EXCLUDED.grace_ends_at, closed_at = NULL;
  v_ref  := COALESCE(v_o.order_number, UPPER(LEFT(p_order_id::text, 8)));
  v_span := CASE WHEN v_grace % 60 = 0 THEN (v_grace / 60) || CASE WHEN v_grace = 60 THEN ' hour' ELSE ' hours' END ELSE v_grace || ' minutes' END;
  PERFORM notify_once(v_o.seller_id, 'order_not_delivered', 'Reply Now Or The Order Cancels',
    'The buyer reported order #' || v_ref || ' as not delivered. Reply in the order chat or start delivery within ' || v_span ||
    ', or the order is cancelled, the buyer is refunded, and it counts against your record.',
    '/account/orders/' || p_order_id::text, 'not_delivered:' || p_order_id::text || ':' || extract(epoch FROM v_ends)::bigint || ':seller');
  PERFORM notify_once(v_o.buyer_id, 'order_not_delivered', 'Seller Notified',
    'We asked the seller to reply or deliver order #' || v_ref || ' within ' || v_span ||
    '. If they don''t respond by then, the order is cancelled and refunded to your Store Balance automatically.',
    '/account/orders/' || p_order_id::text, 'not_delivered:' || p_order_id::text || ':' || extract(epoch FROM v_ends)::bigint || ':buyer');
  RETURN jsonb_build_object('ok', true, 'already', false, 'grace_ends_at', v_ends, 'grace_minutes', v_grace);
END;
$$;
REVOKE ALL ON FUNCTION public.order_not_delivered_open(uuid, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_not_delivered_open(uuid, uuid, timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.order_not_delivered_withdraw(p_order_id uuid, p_buyer_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_c RECORD;
BEGIN
  UPDATE order_not_delivered_claims SET status = 'withdrawn', closed_at = now()
   WHERE order_id = p_order_id AND buyer_id = p_buyer_id AND status = 'open'
  RETURNING * INTO v_c;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_open_claim');
  END IF;
  PERFORM notify_once(v_c.seller_id, 'order_not_delivered', 'Buyer Is Waiting',
    'The buyer withdrew the non-delivery report and is waiting for the order. Please deliver it as soon as you can.',
    '/account/orders/' || p_order_id::text, 'not_delivered:' || p_order_id::text || ':' || extract(epoch FROM v_c.grace_ends_at)::bigint || ':withdrawn');
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.order_not_delivered_withdraw(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_not_delivered_withdraw(uuid, uuid) TO service_role;

-- The seller responded (chat reply / Start delivery) inside the hour: the
-- report closes, the order stays open, the buyer is told. Idempotent.
CREATE OR REPLACE FUNCTION public.order_not_delivered_mark_responded(p_order_id uuid, p_kind text, p_at timestamptz)
  RETURNS boolean
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_c   RECORD;
  v_ref text;
BEGIN
  UPDATE order_not_delivered_claims
     SET status = 'seller_responded', responded_at = p_at, response_kind = p_kind, closed_at = now()
   WHERE order_id = p_order_id AND status = 'open' AND p_at < grace_ends_at
  RETURNING * INTO v_c;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  SELECT COALESCE(order_number, UPPER(LEFT(id::text, 8))) INTO v_ref FROM orders WHERE id = p_order_id;
  PERFORM notify_once(v_c.buyer_id, 'order_not_delivered', 'Seller Responded',
    CASE p_kind WHEN 'started_delivery' THEN 'The seller started delivering order #' || v_ref || '.'
                ELSE 'The seller replied about order #' || v_ref || ' — check the order chat.' END ||
    ' Your order stays open. If it still doesn''t arrive, open a dispute from the order page.',
    '/account/orders/' || p_order_id::text, 'not_delivered:' || p_order_id::text || ':' || extract(epoch FROM v_c.grace_ends_at)::bigint || ':responded');
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.order_not_delivered_mark_responded(uuid, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_not_delivered_mark_responded(uuid, text, timestamptz) TO service_role;

-- A seller chat message closes an open report at once (the buyer's countdown
-- stops). Cheap: only seller-sent rows on order conversations with an open
-- claim do any work; system notices (sender_id NULL) never count.
CREATE OR REPLACE FUNCTION public.trg_messages_not_delivered_response() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order uuid;
BEGIN
  SELECT cv.order_id INTO v_order FROM conversations cv
   WHERE cv.id = NEW.conversation_id AND cv.seller_id = NEW.sender_id AND cv.order_id IS NOT NULL;
  IF v_order IS NOT NULL AND EXISTS (SELECT 1 FROM order_not_delivered_claims WHERE order_id = v_order AND status = 'open') THEN
    PERFORM order_not_delivered_mark_responded(v_order, 'message', NEW.created_at);
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.trg_messages_not_delivered_response() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_messages_not_delivered_response ON public.messages;
CREATE TRIGGER trg_messages_not_delivered_response AFTER INSERT ON public.messages
  FOR EACH ROW WHEN (NEW.sender_id IS NOT NULL)
  EXECUTE FUNCTION public.trg_messages_not_delivered_response();

CREATE OR REPLACE FUNCTION public.order_not_delivered_finalize(p_order_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_o      RECORD;
  v_c      RECORD;
  v_r      jsonb;
  v_status text;
  v_key    text := 'not_delivered:' || p_order_id::text;
  v_ref    text;
  v_total  bigint;
  v_credit bigint;
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  SELECT * INTO v_o FROM orders WHERE id = p_order_id FOR UPDATE;
  SELECT * INTO v_c FROM order_not_delivered_claims WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_c.status <> 'open' THEN
    RETURN jsonb_build_object('finalized', false, 'reason', 'no_open_claim', 'status', v_c.status);
  END IF;
  -- The order moved on (delivered, disputed, cancelled by seller/admin): close to match.
  IF v_o.delivered_at IS NOT NULL OR v_o.status NOT IN ('paid', 'delivering') THEN
    v_status := CASE
      WHEN v_o.delivered_at IS NOT NULL OR v_o.status IN ('delivered', 'completed') THEN 'delivered'
      WHEN v_o.status = 'disputed' THEN 'disputed'
      ELSE 'cancelled' END;
    UPDATE order_not_delivered_claims SET status = v_status, closed_at = now() WHERE order_id = p_order_id;
    RETURN jsonb_build_object('finalized', true, 'outcome', v_status);
  END IF;
  -- The seller responded inside the hour (the message trigger normally closes
  -- the claim at once; this catches "Start delivery" and any missed trigger).
  IF v_o.delivering_at IS NOT NULL AND v_o.delivering_at >= v_c.opened_at AND v_o.delivering_at < v_c.grace_ends_at THEN
    PERFORM order_not_delivered_mark_responded(p_order_id, 'started_delivery', v_o.delivering_at);
    RETURN jsonb_build_object('finalized', true, 'outcome', 'seller_responded');
  END IF;
  IF EXISTS (SELECT 1 FROM messages m JOIN conversations cv ON cv.id = m.conversation_id
              WHERE cv.order_id = p_order_id AND m.sender_id = v_o.seller_id
                AND m.created_at >= v_c.opened_at AND m.created_at < v_c.grace_ends_at) THEN
    PERFORM order_not_delivered_mark_responded(p_order_id, 'message', now());
    RETURN jsonb_build_object('finalized', true, 'outcome', 'seller_responded');
  END IF;
  IF now() < v_c.grace_ends_at THEN
    RETURN jsonb_build_object('finalized', false, 'reason', 'grace', 'grace_ends_at', v_c.grace_ends_at);
  END IF;

  IF v_o.status = 'paid' THEN
    v_r := order_cancel_return_wallet(p_order_id, v_key, true, NULL, NULL, 'void', NULL, 'seller');
  ELSE
    v_r := order_refund_to_wallet(p_order_id, v_key, NULL, 'seller');
  END IF;
  IF COALESCE((v_r->>'refused')::boolean, false) THEN
    RETURN jsonb_build_object('finalized', false, 'reason', 'refused');
  END IF;

  PERFORM money_fault_hook('order_not_delivered_finalize:after_refund');

  v_total  := ROUND(COALESCE(v_o.total_amount, 0) * 100)::bigint;
  v_credit := COALESCE((v_r->>'credited_minor')::bigint, v_total);
  UPDATE order_not_delivered_claims SET status = 'auto_cancelled', closed_at = now(), credited_minor = v_credit
   WHERE order_id = p_order_id;
  v_ref := COALESCE(v_o.order_number, UPPER(LEFT(p_order_id::text, 8)));
  PERFORM notify_once(v_o.buyer_id, 'order_refunded', 'Order Cancelled, Refunded',
    'Order #' || v_ref || ' was not delivered in time. $' || to_char(v_credit::numeric / 100, 'FM999999990.00') ||
    ' was added to your Store Balance — spend it with no service fee. Want the full $' || to_char(v_total::numeric / 100, 'FM999999990.00') ||
    ' back to your payment method? Request it from your Wallet.',
    '/account/wallet', v_key || ':buyer');
  PERFORM notify_once(v_o.seller_id, 'order_not_delivered', 'Order Cancelled — Not Delivered',
    'Order #' || v_ref || ' was cancelled because it was not delivered in time. The buyer was refunded and this counts against your record.',
    '/account/orders/' || p_order_id::text, v_key || ':seller');
  RETURN v_r || jsonb_build_object('finalized', true, 'outcome', 'auto_cancelled', 'credited_minor', v_credit, 'total_minor', v_total);
END;
$$;
REVOKE ALL ON FUNCTION public.order_not_delivered_finalize(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_not_delivered_finalize(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.order_not_delivered_due(p_limit integer DEFAULT 50)
  RETURNS SETOF uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT order_id FROM order_not_delivered_claims
   WHERE status = 'open' AND grace_ends_at <= now()
   ORDER BY grace_ends_at
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
$$;
REVOKE ALL ON FUNCTION public.order_not_delivered_due(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_not_delivered_due(integer) TO service_role;
```

Confirm the 8-argument positional order of `order_cancel_return_wallet` against PR 1's definition: (p_order_id, p_dedupe_key, p_allow_paid, p_provider, p_provider_charge_id, p_attempt_close, p_provider_void_outcome, p_fault).

- [ ] **Step 3: `pnpm test:reset`, run the guard.** Expected: PASS (all 11).
- [ ] **Step 4: Regenerate types** (`pnpm db:types --db-url …` as in Task 1.2), `pnpm type-check`.
- [ ] **Step 5: Commit** — `git commit -m "feat(orders): not-delivered claims + 1-hour auto-cancel seam (M2)"`

### Task 2.3: Server seam — actions, finalize + comms, seller email

**Files:**
- Create: `src/lib/orders/not-delivered-finalize.ts`
- Create: `src/lib/actions/not-delivered.ts`
- Create: `src/lib/email/not-delivered.ts`
- Modify: `src/lib/chat/system-notice.ts` (`by: 'seller' | 'system'`), `src/components/chat/MessageList.tsx` L304–311
- Test: `src/lib/orders/not-delivered-finalize.test.ts`

**Interfaces:**
- Consumes: RPCs from Task 2.2; `notDeliveredEligibility` (2.1); `sendOrderRefundedEmail` (`src/lib/email/index.ts:615`); `sendTransactionalEmail`, `escapeHtmlText` (`src/lib/email/index.ts:78/84`); `emailShell`, `emailText`, `emailButton` (`src/lib/email/shell.ts`); `postOrderSystemNotice` (`src/lib/chat/post-system-notice.ts:14`); `createServiceRoleClient`.
- Produces:
  - `finalizeNotDelivered(orderId: string): Promise<{ outcome: 'auto_cancelled' | 'seller_responded' | 'delivered' | 'disputed' | 'cancelled' | null; reason?: string }>` (server-only module)
  - actions `openNotDeliveredClaim(orderId)`, `withdrawNotDeliveredClaim(orderId)`, `finalizeNotDeliveredClaim(orderId)`, `getNotDeliveredClaim(orderId): Promise<{ status: string; graceEndsAt: string } | null>`
  - `sendNotDeliveredSellerEmail({ to, name, orderNumber, orderUrl, graceMinutes })`

- [ ] **Step 1: Failing unit test for `finalizeNotDelivered`'s comms rule.** Comms fire only on `auto_cancelled`, and a comms failure never throws:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/lib/email', () => ({ sendOrderRefundedEmail: vi.fn().mockResolvedValue({ success: true }) }))
vi.mock('@/lib/chat/post-system-notice', () => ({ postOrderSystemNotice: vi.fn().mockResolvedValue(undefined) }))
const rpc = vi.fn()
const from = vi.fn()
vi.mock('@/lib/supabase/service-role', () => ({ createServiceRoleClient: () => ({ rpc, from }) }))
import { finalizeNotDelivered } from './not-delivered-finalize'
import { sendOrderRefundedEmail } from '@/lib/email'
import { postOrderSystemNotice } from '@/lib/chat/post-system-notice'

const buyerRow = { data: { email: 'b@example.test', username: 'b', full_name: null }, error: null }
const orderRow = { data: { order_number: 'DM-AB12-CD34', buyer_id: 'u1', listing: { title: 'Item', game: { slug: 'g' } } }, error: null }
const chain = (row: any) => ({ select: () => ({ eq: () => ({ single: async () => row }) }) })

describe('finalizeNotDelivered', () => {
  beforeEach(() => { vi.clearAllMocks(); from.mockImplementation((t: string) => chain(t === 'orders' ? orderRow : buyerRow)) })
  it('auto_cancelled → refund email for the credited amount + a system notice', async () => {
    rpc.mockResolvedValue({ data: { finalized: true, outcome: 'auto_cancelled', credited_minor: 7000, total_minor: 7497 }, error: null })
    expect((await finalizeNotDelivered('o1')).outcome).toBe('auto_cancelled')
    expect(sendOrderRefundedEmail).toHaveBeenCalledWith(expect.objectContaining({ amount: 70, destination: 'your Store Balance (wallet)' }))
    expect(postOrderSystemNotice).toHaveBeenCalledWith('o1', expect.objectContaining({ type: 'order_cancelled', by: 'system' }))
  })
  it('grace / no claim → no comms', async () => {
    rpc.mockResolvedValue({ data: { finalized: false, reason: 'grace' }, error: null })
    expect((await finalizeNotDelivered('o1')).outcome).toBeNull()
    expect(sendOrderRefundedEmail).not.toHaveBeenCalled()
  })
  it('an email failure does not throw', async () => {
    rpc.mockResolvedValue({ data: { finalized: true, outcome: 'auto_cancelled', credited_minor: 7000, total_minor: 7497 }, error: null })
    ;(sendOrderRefundedEmail as any).mockRejectedValueOnce(new Error('resend down'))
    await expect(finalizeNotDelivered('o1')).resolves.toMatchObject({ outcome: 'auto_cancelled' })
  })
})
```

Copy the import path for `createServiceRoleClient` from `src/lib/actions/refund-to-source.ts` and use the same path in the mock. Run it. Expected: FAIL.

- [ ] **Step 2: Implement `not-delivered-finalize.ts`**

```ts
import 'server-only'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

type Outcome = 'auto_cancelled' | 'seller_responded' | 'delivered' | 'disputed' | 'cancelled'

/** Run the finalize seam; on an auto-cancel send the buyer's refund email
 *  and the chat notice. The money already moved in SQL — comms never throw. */
export async function finalizeNotDelivered(orderId: string): Promise<{ outcome: Outcome | null; reason?: string }> {
  const svc = createServiceRoleClient() as any
  const { data, error } = await svc.rpc('order_not_delivered_finalize', { p_order_id: orderId })
  if (error) throw new Error(`order_not_delivered_finalize: ${error.message}`)
  if (!data?.finalized) return { outcome: null, reason: data?.reason }
  const outcome = data.outcome as Outcome
  if (outcome !== 'auto_cancelled') return { outcome }
  try {
    const { postOrderSystemNotice } = await import('@/lib/chat/post-system-notice')
    await postOrderSystemNotice(orderId, { type: 'order_cancelled', by: 'system', reason: 'Not Delivered In Time' })
    const { data: order } = await svc.from('orders')
      .select('order_number, buyer_id, listing:listings(title, game:games(slug))').eq('id', orderId).single()
    const { data: buyer } = await svc.from('profiles').select('email, username, full_name').eq('id', order?.buyer_id).single()
    if (buyer?.email) {
      const { sendOrderRefundedEmail } = await import('@/lib/email')
      await sendOrderRefundedEmail({
        to: buyer.email, name: buyer.full_name || buyer.username || 'Gamer',
        orderNumber: order?.order_number || orderId.slice(0, 8).toUpperCase(),
        listingTitle: order?.listing?.title ?? 'your order', gameSlug: order?.listing?.game?.slug ?? null,
        amount: Number(data.credited_minor) / 100, destination: 'your Store Balance (wallet)',
      })
    }
  } catch (e) {
    console.error('[NotDelivered] comms failed (refund already done):', e)
  }
  return { outcome }
}
```

Check the `orders → listings → games` select shape against `src/lib/actions/orders.ts` (seller-cancel email, ~L740). Use the same relation names.

- [ ] **Step 3: `system-notice.ts`** — `by: 'seller' | 'system'`. **`MessageList.tsx` L304–311**: title becomes `notice.by === 'system' ? 'Order Cancelled — Not Delivered' : 'Order Cancelled By The Seller'`, and the body line stays "The buyer was refunded to their Store Balance."
- [ ] **Step 4: `src/lib/email/not-delivered.ts`** (pattern: `src/lib/email/fee-notice.ts`):

```ts
import { emailShell, emailText, emailButton } from '@/lib/email/shell'
import { escapeHtmlText, sendTransactionalEmail } from '@/lib/email'

export async function sendNotDeliveredSellerEmail(a: { to: string; name: string; orderNumber: string; orderUrl: string; graceMinutes: number }) {
  const span = a.graceMinutes % 60 === 0 ? `${a.graceMinutes / 60} hour${a.graceMinutes === 60 ? '' : 's'}` : `${a.graceMinutes} minutes`
  const subject = `Reply about order #${a.orderNumber} within ${span} or it cancels`
  const html = emailShell({
    preview: `The buyer reported order #${a.orderNumber} as not delivered.`,
    icon: 'order',
    heading: 'Reply now or the order cancels',
    body: [
      emailText(`Hi ${escapeHtmlText(a.name)}, the buyer reported order <strong>#${escapeHtmlText(a.orderNumber)}</strong> as not delivered. Reply to the buyer in the order chat, or start delivery, within <strong>${span}</strong>.`),
      emailText('If you don\'t respond by then, the order is cancelled, the buyer is refunded, and it counts against your record.'),
      emailButton('Open The Order', a.orderUrl),
    ].join(''),
  })
  return sendTransactionalEmail({ to: a.to, subject, html })
}
```

Check that `'order'` is a valid `EmailIcon` (`src/lib/email/shell.ts:54`). If it isn't, use the closest existing icon.

- [ ] **Step 5: `src/lib/actions/not-delivered.ts`** (`'use server'`, async exports only):

```ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { notDeliveredEligibility } from '@/lib/orders/not-delivered'
import { finalizeNotDelivered } from '@/lib/orders/not-delivered-finalize'
import { checkRateLimit } from '@/lib/security/rate-limit'

async function viewer() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
async function orderFor(orderId: string) {
  const { data } = await (createServiceRoleClient() as any).from('orders')
    .select('id, buyer_id, seller_id, status, delivered_at, paid_at, created_at, order_number, listing:listings(delivery_time)')
    .eq('id', orderId).single()
  return data as any
}

export async function openNotDeliveredClaim(orderId: string): Promise<{ success: boolean; error?: string; graceEndsAt?: string }> {
  const user = await viewer()
  if (!user) return { success: false, error: 'Not authenticated' }
  const limited = await checkRateLimit('order_action', `user:${user.id}`)
  if (!limited.allowed) return { success: false, error: 'Too many attempts. Try again in a minute.' }
  const o = await orderFor(orderId)
  if (!o || o.buyer_id !== user.id) return { success: false, error: 'Order not found' }
  const elig = notDeliveredEligibility({ status: o.status, delivered_at: o.delivered_at, paid_at: o.paid_at, created_at: o.created_at, deliveryTime: o.listing?.delivery_time })
  if (!elig.eligible) return { success: false, error: elig.reason === 'not_overdue' ? 'The delivery time has not passed yet.' : 'This order can no longer be cancelled this way.' }
  const svc = createServiceRoleClient() as any
  const { data, error } = await svc.rpc('order_not_delivered_open', { p_order_id: orderId, p_buyer_id: user.id, p_due_at: elig.dueAt })
  if (error || !data?.ok) return { success: false, error: 'Could not report this order. Please try again.' }
  if (!data.already) {
    try {
      const { data: seller } = await svc.from('profiles').select('email, username, full_name').eq('id', o.seller_id).single()
      if (seller?.email) {
        const { sendNotDeliveredSellerEmail } = await import('@/lib/email/not-delivered')
        await sendNotDeliveredSellerEmail({
          to: seller.email, name: seller.full_name || seller.username || 'Seller',
          orderNumber: o.order_number || orderId.slice(0, 8).toUpperCase(),
          orderUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://dropmarket.gg'}/account/orders/${orderId}`,
          graceMinutes: Number(data.grace_minutes ?? 60),
        })
      }
    } catch (e) { console.error('[NotDelivered] seller email failed:', e) }
  }
  return { success: true, graceEndsAt: data.grace_ends_at }
}

export async function withdrawNotDeliveredClaim(orderId: string): Promise<{ success: boolean }> {
  const user = await viewer()
  if (!user) return { success: false }
  const { data } = await (createServiceRoleClient() as any).rpc('order_not_delivered_withdraw', { p_order_id: orderId, p_buyer_id: user.id })
  return { success: !!data?.ok }
}

/** Buyer or seller of the order, once the countdown hits zero on their screen. */
export async function finalizeNotDeliveredClaim(orderId: string): Promise<{ outcome: string | null }> {
  const user = await viewer()
  if (!user) return { outcome: null }
  const o = await orderFor(orderId)
  if (!o || (o.buyer_id !== user.id && o.seller_id !== user.id)) return { outcome: null }
  const r = await finalizeNotDelivered(orderId)
  return { outcome: r.outcome }
}

export async function getNotDeliveredClaim(orderId: string): Promise<{ status: string; graceEndsAt: string } | null> {
  const user = await viewer()
  if (!user) return null
  const { data } = await (createServiceRoleClient() as any).from('order_not_delivered_claims')
    .select('status, grace_ends_at, buyer_id, seller_id').eq('order_id', orderId).maybeSingle()
  if (!data || (data.buyer_id !== user.id && data.seller_id !== user.id)) return null
  return { status: data.status, graceEndsAt: data.grace_ends_at }
}
```

Use the real rate-limit helper's name, signature and an existing bucket name. Find them with `grep -n "export" src/lib/security/rate-limit*.ts` and `grep -rn "checkRateLimit('" src/lib/actions | head`. Add a bucket the same way checkout's was added if none fits.

- [ ] **Step 6: Run the unit tests + `pnpm type-check`.** Expected: PASS. **Commit** — `git commit -m "feat(orders): not-delivered actions, finalize comms, seller email"`

### Task 2.4: The 15-minute sweep

**Files:**
- Create: `src/app/api/cron/not-delivered-sweep/route.ts`, `route.test.ts`
- Modify: `vercel.json` (daily backstop), `.github/workflows/reconcile-payments.yml` (second step in the same job, so no extra Actions minutes)

**Interfaces:**
- Consumes: `isCronAuthorized` (`src/lib/security/cron-auth.ts:30`), RPC `order_not_delivered_due`, `finalizeNotDelivered`.

- [ ] **Step 1: Failing route test**

```ts
import { describe, it, expect, vi } from 'vitest'
vi.mock('@/lib/email', () => ({}))
const rpc = vi.fn().mockResolvedValue({ data: ['o1', 'o2'], error: null })
vi.mock('@/lib/supabase/service-role', () => ({ createServiceRoleClient: () => ({ rpc }) }))
const finalize = vi.fn().mockResolvedValue({ outcome: 'auto_cancelled' })
vi.mock('@/lib/orders/not-delivered-finalize', () => ({ finalizeNotDelivered: finalize }))
import { GET } from './route'

const req = (auth?: string) => new Request('https://x/api/cron/not-delivered-sweep', { headers: auth ? { authorization: auth } : {} }) as any

describe('not-delivered sweep', () => {
  it('401 without the cron secret', async () => {
    process.env.CRON_SECRET = 's3cret'
    expect((await GET(req())).status).toBe(401)
  })
  it('finalizes every due claim and reports counts', async () => {
    process.env.CRON_SECRET = 's3cret'
    const res = await GET(req('Bearer s3cret'))
    expect(res.status).toBe(200)
    expect(finalize).toHaveBeenCalledTimes(2)
    expect(await res.json()).toMatchObject({ due: 2, autoCancelled: 2, errors: 0 })
  })
})
```

Expected: FAIL.

- [ ] **Step 2: Implement the route**

```ts
/**
 * Not-delivered sweep (every 15 min via .github/workflows/reconcile-payments.yml;
 * daily Vercel backstop — Hobby rejects sub-daily Vercel crons). Finalizes every
 * "Cancel – Not Delivered" claim whose grace has run out. Idempotent: the order
 * page finalizes on view too, and a replay is a no-op in SQL.
 */
import { NextRequest, NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/security/cron-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request.headers)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { createServiceRoleClient } = await import('@/lib/supabase/service-role')
  const { finalizeNotDelivered } = await import('@/lib/orders/not-delivered-finalize')
  const { data, error } = await (createServiceRoleClient() as any).rpc('order_not_delivered_due', { p_limit: 50 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const ids: string[] = data ?? []
  let autoCancelled = 0, errors = 0
  for (const id of ids) {
    try {
      const r = await finalizeNotDelivered(id)
      if (r.outcome === 'auto_cancelled') autoCancelled++
    } catch (e) {
      errors++
      console.error('[NotDeliveredSweep]', id, e)
    }
  }
  return NextResponse.json({ due: ids.length, autoCancelled, errors }, { status: errors ? 500 : 200 })
}
```

- [ ] **Step 3: Wire the schedule.** In `vercel.json` add `{ "path": "/api/cron/not-delivered-sweep", "schedule": "25 1 * * *" }`. In `.github/workflows/reconcile-payments.yml`, add a second step to the existing job that copies the first step's `curl` with the URL `https://dropmarket.gg/api/cron/not-delivered-sweep`.
- [ ] **Step 4: Run the test** — Expected: PASS. **Commit** — `git commit -m "feat(cron): 15-minute not-delivered sweep"`

### Task 2.5: Order page UI

**Files:**
- Create: `src/app/account/orders/[orderId]/_NotDeliveredPanel.tsx`
- Modify: `_StatusStrip.tsx` overdue branch (L263–282), `_OrderClient.tsx`, `page.tsx`

**Interfaces:**
- Consumes: `openNotDeliveredClaim`, `withdrawNotDeliveredClaim`, `finalizeNotDeliveredClaim`, `getNotDeliveredClaim` (2.3); `OrderModal`, `modalButton` from `./_OrderModal`.
- Produces: `StatusStrip` gains `notDeliveredCTA?: React.ReactNode` (rendered beside `DisputeCTA` in the overdue branch only).

- [ ] **Step 1: `page.tsx`** — after the order loads, `const notDelivered = await getNotDeliveredClaim(order.id)` and pass `notDelivered` to `_OrderClient`. This is the private account page; no public-route caching rule applies.
- [ ] **Step 2: `_NotDeliveredPanel.tsx`** (client):
  - **Buyer, no open claim, `overdue`:** button **Cancel – Not Delivered** (amber, same size rules as `DisputeCTA`). It opens `OrderModal`: title "Cancel – Not Delivered"; description "We'll ask the seller to reply or deliver within 1 hour. If they don't respond, this order is cancelled automatically: $70.00 goes to your Store Balance (spend it with no service fee), and you can request the full $74.97 back to your payment method from your Wallet." The amounts come from the order's `subtotal − promo_discount` and `total_amount`. Footer: "Keep Waiting" (ghost) / "Cancel – Not Delivered" (primary) → `openNotDeliveredClaim` → `router.refresh()`.
  - **Buyer, open claim:** line "Seller has until {local time} to reply or deliver. Otherwise this order cancels and refunds automatically." Live countdown, plus a text button "Keep Waiting Instead" → `withdrawNotDeliveredClaim`.
  - **Buyer, `seller_responded`:** line "The seller replied and is working on your order. Still not delivered? Open a dispute." with `DisputeCTA`. No countdown, and the Cancel – Not Delivered button does not come back for this order.
  - **Seller, open claim:** amber panel "The buyer reported this order as not delivered. Reply in the chat or start delivery by {local time}, or it cancels and counts against your record." Live countdown. The existing Mark As Delivered CTA stays where it is.
  - **Countdown reaching 0, either role:** call `finalizeNotDeliveredClaim(orderId)` once, guarded by a ref, then `router.refresh()`.
  - Use `formatOverdue`-style time text from `_DeliveryProgressBar.tsx`. Focus rings per `neutral-focus-states`; touch targets ≥44px.
- [ ] **Step 3: `_StatusStrip.tsx`** — in the overdue branch, render `{notDeliveredCTA}` before `<DisputeCTA …>`. Caption: "The delivery time has passed. Cancel for a refund, or open a dispute." With an open claim the panel replaces the strip's caption (pass `notDeliveredCTA` = the countdown line).
- [ ] **Step 4: `_OrderClient.tsx`** — build the `<NotDeliveredPanel>` with `role`, `overdue`, `notDelivered`, amounts and `orderId`, and pass it down. The seller view mounts it above the status strip.
- [ ] **Step 5: `pnpm type-check`.** Browser check on localhost with a fake-provider paid order on the worktree stack and a `20min` listing. Shorten the wait with `UPDATE order_not_delivered_claims SET grace_ends_at = now() + interval '1 minute'` in local psql only. Check desktop + phone (375px), buyer + seller views, and the refund landing in the Wallet's Refund To Card list.
- [ ] **Step 6: Commit** — `git commit -m "feat(order-page): Cancel – Not Delivered with seller countdown"`

### Task 2.6: Legal line + PR 2 gate

- [ ] **Refund Policy 12.2** — add after the first sentence: "Once the stated delivery time has passed you can also choose **Cancel – Not Delivered** on the Order page: the Seller is notified and has one hour to reply or start delivery; if they do not respond, the Order is cancelled and refunded automatically. If they respond but the item still does not arrive, open a dispute (see Section 7)." **SafeDrop 2.1** — add the same route in one sentence.
- [ ] `pnpm test:full` green; security-guidance pass; PR with M2 called out. Owner merges; at release `supabase db push` → deploy. Stop the dev server and `db:down --purge`.

---

## Self-review

- **Spec coverage:**
  - item-price store credit: Task 1.2 §4
  - full amount to card by order: §5–7 + Task 1.3
  - seller notified: 2.2 open + 2.3 email
  - 1-hour grace: `not_delivered_grace_minutes` = 60
  - seller response keeps it open: `trg_messages_not_delivered_response` + finalize's `delivering_at` check
  - auto-cancel: 2.2 finalize + 2.4 sweep + 2.5 on-view
  - full refund on card request: PR 1
  - migrations flagged: header + ⚠️ on 1.2/2.2
- **Placeholder scan:** sections 5–9 of M1 name the exact source function and the exact edits (the repo's own "body verbatim except" convention). Every other step carries its code.
- **Type consistency:**
  - `credited_minor` / `total_minor` / `fee_minor` keys are used the same way in SQL, `finalizeNotDelivered`, and the tests.
  - `RefundToCardRow.state` values match `toRefundToCardRow`.
  - The `order_not_delivered_*` RPC names match across 2.2, 2.3 and 2.4.

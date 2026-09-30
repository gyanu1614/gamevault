# Buyer Service Fee + Refund Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One "Service fee" row (max($0.30, 2%) marketplace + method processing, $1 minimum order, zero for store credit), one Store Balance, fault-aware refunds (buyer-fault = item only; seller/platform = full; 5-in-7-days non-delivery fee to sellers), and an admin-approved refund-to-original-method flow through the Payssion refund API.

**Architecture:** Every fee and refund number is computed in SQL (`buyer_fee_quote`, `order_create_pending`, `order_refund_to_wallet`, `order_cancel_return_wallet`); TypeScript only routes, displays and snapshots what SQL returns. Three migrations, each re-creating the affected functions in full with the same or default-extended signatures so old and new app code both work during deploy. Provider refunds ride the existing outbox (claim → provider call → mark) with a new `kind='refund'`.

**Tech Stack:** Next.js 15 server actions, Supabase (plpgsql, PostgREST rpc), vitest integration guards against this worktree's local stack (`pnpm test:reset`, slot 1, `.env.test`), psql fault injection (`money_fault_hook`).

**Spec:** `docs/design/buyer-fee-refund-policy.md`

## Global Constraints

- pnpm only. Worktree `.claude/worktrees/feat+buyer-fee-refund-policy`, branch `feat/buyer-fee-refund-policy`, local stack slot 1 (`SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres` in `.env.test`).
- Migration file names use the real UTC second: `date -u +%Y%m%d%H%M%S`; three files, created in order (A fees, B refunds, C refund-to-source).
- New SQL functions: `REVOKE ALL … FROM PUBLIC, anon, authenticated; GRANT EXECUTE … TO service_role;` `SECURITY DEFINER SET search_path = public`. Every new money function keeps a `PERFORM money_fault_hook('<fn>:<point>')` between its steps.
- Money seams stay ONE RPC per action. Never compose two money RPCs in TypeScript.
- Zero downtime: a function whose signature grows is `DROP`ped and re-created with `DEFAULT`s so PostgREST named-parameter calls from the old build still resolve. `order_create_pending` keeps its 19-arg signature.
- No TypeScript computes a buyer fee (`fee-checkout-single-path` guard). No `head: true` counts.
- Copy: Title Case for UI labels; never "escrow"/"holding funds"; "SafeDrop Protection"; no percentage at checkout; the `fee-copy` guard pins the `/fees` Buyer section to exactly `['2%']` and requires the "Lowest fees for buyers and sellers" line.
- Tests that create rows: `makeFixture()` from `src/test/guards/throwaway.ts`, `vi.mock('@/lib/email')`, clean every row in `afterAll`. In-RPC fault tests use `withFault(point, sql)` (psql, local only).
- Gate before PR: `pnpm typecheck` (tsc), `pnpm test:full`, `pnpm db:types` regenerated and committed, handoff `docs/handoff/buyer-fee-refund-policy.md`.

---

### Task 1: Migration A — service fee in `buyer_fee_quote` + `order_create_pending`

**Files:**
- Create: `supabase/migrations/<ts>_buyer_service_fee.sql`
- Test: `src/test/guards/buyer-service-fee.guard.integration.test.ts`

**Interfaces:**
- Produces: `buyer_fee_quote(p_method text, p_subtotal_minor bigint, p_currency text, p_promo_minor bigint DEFAULT 0, p_wallet_minor bigint DEFAULT 0) RETURNS jsonb` with keys `ok, reason, method, label, provider, marketplace_minor, fee_minor (processing), service_fee_minor, total_minor (order total before store credit), charge_minor (what the provider is asked for), wallet_applied_minor, pct_effective, fee_currency, refundable, instant_clearing`.
- Produces: `buyer_fee_quote_many(p_methods text[], p_subtotal_minor bigint, p_currency text, p_promo_minor bigint DEFAULT 0, p_wallet_minor bigint DEFAULT 0)`.
- Produces: `order_create_pending` (same 19 args) — ignores `p_platform_fee_rate`/`p_platform_fee`, quotes marketplace + processing itself, returns additionally `marketplace_minor`, `service_fee_minor`.
- Produces: `platform_fee_settings.buyer_marketplace_pct numeric(5,2) DEFAULT 2.00`, `buyer_marketplace_min_minor bigint DEFAULT 30`, `buyer_min_order_total_minor bigint DEFAULT 100`.

- [ ] **Step 1: Write the failing guard test**

```ts
// src/test/guards/buyer-service-fee.guard.integration.test.ts
/**
 * Buyer service fee (docs/design/buyer-fee-refund-policy.md): marketplace
 * max($0.30, 2%) + method processing on the charged amount, $1.00 minimum
 * order, zero for store credit — all inside buyer_fee_quote, snapshotted by
 * order_create_pending. Reads only; the one order it creates is removed.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { hasEnv, makeFixture, type Fixture } from './throwaway'

let fx: Fixture | null = null
const q = async (method: string, sub: number, promo = 0, wallet = 0) => {
  const { data, error } = await (fx!.svc.rpc as any)('buyer_fee_quote', {
    p_method: method, p_subtotal_minor: sub, p_currency: 'USD', p_promo_minor: promo, p_wallet_minor: wallet,
  })
  if (error) throw new Error(error.message)
  return data as Record<string, any>
}

describe.skipIf(!hasEnv)('buyer_fee_quote — service fee policy', () => {
  beforeAll(async () => { fx = await makeFixture() })
  afterAll(async () => { await fx?.cleanup() })

  it('crypto $20: marketplace 2% = $0.40, processing 5% of (20.40) = $1.02, total $21.42', async () => {
    const r = await q('btcpay', 2000)
    expect(r.ok).toBe(true)
    expect(Number(r.marketplace_minor)).toBe(40)
    expect(Number(r.fee_minor)).toBe(102)
    expect(Number(r.service_fee_minor)).toBe(142)
    expect(Number(r.total_minor)).toBe(2142)
    expect(Number(r.charge_minor)).toBe(2142)
  })
  it('crypto $5: the $0.30 minimum beats 2% ($0.10)', async () => {
    const r = await q('btcpay', 500)
    expect(Number(r.marketplace_minor)).toBe(30)
  })
  it('crypto $0.50: the marketplace fee is raised so the total reaches $1.00', async () => {
    const r = await q('btcpay', 50)
    expect(Number(r.total_minor)).toBeGreaterThanOrEqual(100)
    expect(Number(r.total_minor)).toBeLessThanOrEqual(103)
    expect(Number(r.marketplace_minor) + Number(r.fee_minor) + 50).toBe(Number(r.total_minor))
  })
  it('wallet: zero marketplace, zero processing, total = subtotal − promo, nothing to charge', async () => {
    const r = await q('wallet', 2000, 300)
    expect(Number(r.marketplace_minor)).toBe(0)
    expect(Number(r.fee_minor)).toBe(0)
    expect(Number(r.total_minor)).toBe(1700)
    expect(Number(r.charge_minor)).toBe(0)
  })
  it('partial store credit: processing is charged on the remainder only', async () => {
    const full = await q('btcpay', 2000)
    const part = await q('btcpay', 2000, 0, 1000)
    expect(Number(part.marketplace_minor)).toBe(40)
    expect(Number(part.wallet_applied_minor)).toBe(1000)
    // 5% of (2040 − 1000) = 52
    expect(Number(part.fee_minor)).toBe(52)
    expect(Number(part.fee_minor)).toBeLessThan(Number(full.fee_minor))
    expect(Number(part.charge_minor)).toBe(2040 - 1000 + 52)
  })
  it('promo reduces the processing base and the total', async () => {
    const r = await q('btcpay', 2000, 500)
    expect(Number(r.fee_minor)).toBe(77) // 5% of 1540 = 77
    expect(Number(r.total_minor)).toBe(2000 + 40 + 77 - 500)
  })
  it('the 3-arg call still works (old build during deploy)', async () => {
    const { data, error } = await (fx!.svc.rpc as any)('buyer_fee_quote', { p_method: 'btcpay', p_subtotal_minor: 2000, p_currency: 'USD' })
    expect(error).toBeNull()
    expect(Number(data.total_minor)).toBe(2142)
  })
  it('order_create_pending snapshots marketplace → platform_fee and processing → payment_processing_fee', async () => {
    const { data, error } = await (fx!.svc.rpc as any)('order_create_pending', {
      p_buyer_id: fx!.buyer.id, p_seller_id: fx!.seller.id, p_listing_id: fx!.listingId, p_quantity: 1,
      p_unit_price: 20, p_subtotal: 20, p_platform_fee_rate: 0, p_platform_fee: 0, p_seller_payout: 18,
      p_seller_commission_pct: 10, p_seller_fee_trace: {}, p_currency: 'USD', p_promo_code_id: null, p_promo_discount: 0,
      p_wallet_minor: 0, p_provider: 'btcpay', p_pm_id: null, p_fallback_expires_at: new Date(Date.now() + 3600e3).toISOString(),
      p_buyer_fee_method: 'btcpay',
    })
    expect(error).toBeNull()
    const orderId = data.order_id as string
    try {
      const { data: o } = await fx!.svc.from('orders').select('platform_fee, payment_processing_fee, buyer_fee_amount, total_amount').eq('id', orderId).single()
      expect(Number((o as any).platform_fee)).toBe(0.4)
      expect(Number((o as any).payment_processing_fee)).toBe(1.02)
      expect(Number((o as any).buyer_fee_amount)).toBe(1.02)
      expect(Number((o as any).total_amount)).toBe(21.42)
      expect(Number(data.marketplace_minor)).toBe(40)
    } finally {
      await fx!.svc.from('payment_attempts').delete().eq('order_id', orderId)
      await fx!.svc.from('orders').delete().eq('id', orderId)
    }
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run src/test/guards/buyer-service-fee.guard.integration.test.ts`
Expected: FAIL — `marketplace_minor` undefined / `p_promo_minor` unknown parameter.

- [ ] **Step 3: Write the migration**

`ts=$(date -u +%Y%m%d%H%M%S)`; create `supabase/migrations/${ts}_buyer_service_fee.sql`:

```sql
-- Buyer service fee (docs/design/buyer-fee-refund-policy.md, 2026-09-29).
-- ONE quote computes marketplace max($0.30, 2%) + method processing on the
-- charged amount, tops the total up to $1.00, and is zero for store credit.
-- order_create_pending snapshots both parts; TypeScript computes nothing.

-- ── 1. config ───────────────────────────────────────────────────────────────
ALTER TABLE public.platform_fee_settings
  ADD COLUMN IF NOT EXISTS buyer_marketplace_pct        numeric(5,2) NOT NULL DEFAULT 2.00 CHECK (buyer_marketplace_pct >= 0 AND buyer_marketplace_pct <= 50),
  ADD COLUMN IF NOT EXISTS buyer_marketplace_min_minor  bigint       NOT NULL DEFAULT 30   CHECK (buyer_marketplace_min_minor >= 0),
  ADD COLUMN IF NOT EXISTS buyer_min_order_total_minor  bigint       NOT NULL DEFAULT 100  CHECK (buyer_min_order_total_minor >= 0);
COMMENT ON COLUMN public.platform_fee_settings.buyer_marketplace_pct IS 'Buyer marketplace fee % of the subtotal (SafeDrop Protection). Zero for fully store-credit orders.';
COMMENT ON COLUMN public.platform_fee_settings.buyer_marketplace_min_minor IS 'Minimum marketplace fee, minor units of the order currency (GameBoost-style floor).';
COMMENT ON COLUMN public.platform_fee_settings.buyer_min_order_total_minor IS 'Minimum order total (before store credit); the marketplace fee is raised to reach it. Not applied to store-credit orders.';

-- Store credit: zero everything. (row seeded in 20260923185256)
UPDATE public.payment_method_fees SET floor_pct = 0, buffer_pct = 0, min_fee_minor = 0,
  note = 'Store credit: zero service fee (owner 2026-09-29). Fully wallet-paid orders only.'
 WHERE method = 'wallet';

-- ── 2. buyer_fee_quote (5-arg, defaults) ────────────────────────────────────
DROP FUNCTION IF EXISTS public.buyer_fee_quote(text, bigint, text);
CREATE OR REPLACE FUNCTION public.buyer_fee_quote(
  p_method text, p_subtotal_minor bigint, p_currency text,
  p_promo_minor bigint DEFAULT 0, p_wallet_minor bigint DEFAULT 0)
  RETURNS jsonb
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r            public.payment_method_fees%ROWTYPE;
  s            public.platform_fee_settings%ROWTYPE;
  v_cur        char(3) := UPPER(COALESCE(p_currency, 'USD'))::char(3);
  v_rate_fee   numeric; v_rate_quote numeric; v_conv numeric;
  v_sub        bigint := GREATEST(COALESCE(p_subtotal_minor, 0), 0);
  v_promo      bigint := LEAST(GREATEST(COALESCE(p_promo_minor, 0), 0), GREATEST(COALESCE(p_subtotal_minor, 0), 0));
  v_wallet_req bigint := GREATEST(COALESCE(p_wallet_minor, 0), 0);
  v_mkt        bigint := 0;
  v_base       numeric;     -- what the provider is asked for, before its own fee
  v_fixed      numeric; v_denom numeric; v_gross numeric; v_fee numeric;
  v_fee_minor  bigint := 0;
  v_total      bigint; v_charge bigint; v_applied bigint := 0;
  v_pct        numeric;
  v_pass       int;
  refusal      jsonb;
BEGIN
  SELECT * INTO r FROM public.payment_method_fees WHERE method = p_method;
  SELECT * INTO s FROM public.platform_fee_settings WHERE id;
  refusal := jsonb_build_object('ok', false, 'method', p_method, 'fee_minor', NULL, 'total_minor', NULL,
                                'marketplace_minor', NULL, 'service_fee_minor', NULL, 'charge_minor', NULL,
                                'pct_effective', NULL, 'fee_currency', NULL, 'refundable', NULL, 'instant_clearing', NULL);
  IF NOT FOUND THEN RETURN refusal || jsonb_build_object('reason', 'no_fee_row'); END IF;
  refusal := refusal || jsonb_build_object('fee_currency', r.fee_currency, 'refundable', r.refundable, 'instant_clearing', r.instant_clearing, 'label', r.label, 'provider', r.provider);
  IF NOT r.selectable THEN RETURN refusal || jsonb_build_object('reason', 'not_selectable'); END IF;
  IF NOT (v_cur::text = ANY (r.currencies)) THEN RETURN refusal || jsonb_build_object('reason', 'currency_unsupported'); END IF;
  SELECT usd_per_unit INTO v_rate_fee   FROM public.currency_rates WHERE currency = r.fee_currency;
  SELECT usd_per_unit INTO v_rate_quote FROM public.currency_rates WHERE currency = v_cur;
  IF v_rate_fee IS NULL OR v_rate_quote IS NULL THEN RETURN refusal || jsonb_build_object('reason', 'fx_rate_missing'); END IF;
  v_conv  := v_rate_fee / v_rate_quote;

  -- Store credit pays nothing: no marketplace fee, no processing, no minimum.
  IF r.method = 'wallet' THEN
    v_total := GREATEST(v_sub - v_promo, 0);
    RETURN jsonb_build_object(
      'ok', true, 'reason', NULL, 'method', r.method, 'label', r.label, 'provider', r.provider,
      'marketplace_minor', 0, 'fee_minor', 0, 'service_fee_minor', 0,
      'total_minor', v_total, 'charge_minor', 0, 'wallet_applied_minor', v_total,
      'pct_effective', 0, 'fee_currency', r.fee_currency, 'refundable', r.refundable, 'instant_clearing', r.instant_clearing);
  END IF;

  -- Marketplace: max(min, pct × subtotal), one rounding through fee_round_cents.
  v_mkt := GREATEST(s.buyer_marketplace_min_minor,
                    (public.fee_round_cents(v_sub * s.buyer_marketplace_pct / 100 / 100) * 100)::bigint);

  -- Two passes: the second only runs when the $1.00 top-up moved the base.
  FOR v_pass IN 1..2 LOOP
    v_applied := LEAST(v_wallet_req, GREATEST(v_sub + v_mkt - v_promo, 0));
    v_base    := GREATEST(v_sub + v_mkt - v_promo - v_applied, 0);
    IF v_base > 0 THEN
      v_fixed := r.provider_fixed_minor * v_conv;
      v_denom := 1 - (r.provider_pct + r.fx_markup_pct + r.buffer_pct) / 100;
      v_gross := (v_base + v_fixed) / v_denom;
      v_fee   := GREATEST(r.floor_pct / 100 * v_base, v_gross - v_base);
      v_fee   := GREATEST(v_fee, r.min_fee_minor * v_conv);
      v_fee_minor := (public.fee_round_cents(v_fee / 100) * 100)::bigint;
    ELSE
      v_fee_minor := 0;
    END IF;
    v_total := v_sub + v_mkt + v_fee_minor - v_promo;
    EXIT WHEN v_pass = 2 OR v_total >= s.buyer_min_order_total_minor;
    -- Below the minimum order: raise the marketplace fee by the gap, re-quote.
    v_mkt := v_mkt + (s.buyer_min_order_total_minor - v_total);
  END LOOP;
  v_charge := v_total - v_applied;

  IF r.max_total_minor IS NOT NULL AND (v_total / v_conv) > r.max_total_minor THEN
    RETURN refusal || jsonb_build_object('reason', 'over_cap');
  END IF;
  -- B4: provider minimum on the ACTUAL charge, 5% headroom over currency_rates.
  IF r.min_total_minor IS NOT NULL AND v_charge > 0 AND (v_charge / v_conv) < r.min_total_minor * 1.05 THEN
    RETURN refusal || jsonb_build_object('reason', 'under_min');
  END IF;
  v_pct := CASE WHEN v_sub > 0 THEN ROUND(v_fee_minor::numeric / v_sub * 100, 2) ELSE NULL END;
  RETURN jsonb_build_object(
    'ok', true, 'reason', NULL, 'method', r.method, 'label', r.label, 'provider', r.provider,
    'marketplace_minor', v_mkt, 'fee_minor', v_fee_minor, 'service_fee_minor', v_mkt + v_fee_minor,
    'total_minor', v_total, 'charge_minor', v_charge, 'wallet_applied_minor', v_applied,
    'pct_effective', v_pct, 'fee_currency', r.fee_currency, 'refundable', r.refundable, 'instant_clearing', r.instant_clearing);
END;
$$;
REVOKE ALL ON FUNCTION public.buyer_fee_quote(text, bigint, text, bigint, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buyer_fee_quote(text, bigint, text, bigint, bigint) TO service_role;
COMMENT ON FUNCTION public.buyer_fee_quote(text, bigint, text, bigint, bigint) IS
  'THE buyer fee quote: marketplace max(min, pct×subtotal) + method processing on (subtotal+marketplace−promo−store credit), total topped up to the minimum order; zero for wallet. total_minor = order total before store credit; charge_minor = what the provider is asked for. Service-role only.';

DROP FUNCTION IF EXISTS public.buyer_fee_quote_many(text[], bigint, text);
CREATE OR REPLACE FUNCTION public.buyer_fee_quote_many(
  p_methods text[], p_subtotal_minor bigint, p_currency text, p_promo_minor bigint DEFAULT 0, p_wallet_minor bigint DEFAULT 0)
  RETURNS SETOF jsonb
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.buyer_fee_quote(m.method, p_subtotal_minor, p_currency, p_promo_minor, p_wallet_minor)
  FROM unnest(p_methods) WITH ORDINALITY AS m(method, ord)
  ORDER BY m.ord
$$;
REVOKE ALL ON FUNCTION public.buyer_fee_quote_many(text[], bigint, text, bigint, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buyer_fee_quote_many(text[], bigint, text, bigint, bigint) TO service_role;

-- ── 3. order_create_pending — same 19 args; marketplace + processing from the quote
-- Body: copy 20260924070515 §4 verbatim and change ONLY these lines:
--   · after v_balance is known, quote with the wallet the buyer can actually apply:
--       v_balance := CASE WHEN COALESCE(p_wallet_minor,0) > 0 THEN COALESCE(user_wallet_balance(p_buyer_id, v_currency), 0) ELSE 0 END;
--       v_quote := public.buyer_fee_quote(p_buyer_fee_method, v_subtotal_minor, v_currency,
--                    ROUND(COALESCE(p_promo_discount,0)*100)::bigint, LEAST(COALESCE(p_wallet_minor,0), v_balance));
--   · v_mkt_minor := (v_quote->>'marketplace_minor')::bigint;  v_total_minor := (v_quote->>'total_minor')::bigint;
--     (p_platform_fee / p_platform_fee_rate are IGNORED — the quote is the marketplace fee)
--   · INSERT: platform_fee_rate = s.buyer_marketplace_pct, platform_fee = v_mkt_minor/100.0
--   · wallet hold: v_applied := LEAST(p_wallet_minor, v_balance, v_total_minor) (unchanged), wallet_spend unchanged
--   · RETURN adds 'marketplace_minor', v_mkt_minor, 'service_fee_minor', v_mkt_minor + v_fee_minor
--   · PERFORM money_fault_hook('order_create_pending:after_quote') stays right after the quote.
```

Write the full `order_create_pending` body (copy from `20260924070515_eu_payment_methods.sql` lines 130–300, apply the bullets above, keep every existing `money_fault_hook` and the REVOKE/GRANT lines with the 19-type signature).

- [ ] **Step 4: Apply and run the test**

Run: `pnpm test:reset && pnpm vitest run src/test/guards/buyer-service-fee.guard.integration.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Fix the guards the new totals break**

Run: `pnpm vitest run src/test/guards/buyer-fee-quote.guard.integration.test.ts src/test/guards/buyer-method-fees.guard.integration.test.ts src/test/guards/eu-payment-methods.guard.integration.test.ts src/test/guards/money-atomicity.guard.integration.test.ts`
Update expectations only where the policy changed:
- `buyer-fee-quote`: "wallet quotes like crypto (5%)" → wallet quotes 0/0; the processing base is now `subtotal + marketplace`, so recompute the Pix/GCash/Trustly/EPS example numbers from the SQL with `p_promo_minor=0, p_wallet_minor=0` (assert the printed values after one run, then pin them).
- `buyer-method-fees` line ~231: `total_amount === subtotal + platform_fee + buyer_fee − promo` still holds; replace any `fee.marketplaceAmount`/`buyerFee` use with the order's `platform_fee` column; the wallet case asserts `buyer_fee_amount = 0`.
- `eu-payment-methods`: `CHEAP = 0.50` → total tops up to $1.00; EPS/MB Way `under_min` still refuses (€1.05 = $1.23 > $1.00): keep the test, note the arithmetic in its comment.
- `money-atomicity`: untouched semantics (default fault = full refund) — should pass.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/*_buyer_service_fee.sql src/test/guards/buyer-service-fee.guard.integration.test.ts src/test/guards/buyer-fee-quote.guard.integration.test.ts src/test/guards/buyer-method-fees.guard.integration.test.ts src/test/guards/eu-payment-methods.guard.integration.test.ts docs/design/buyer-fee-refund-policy.md docs/superpowers/plans/2026-09-29-buyer-fee-refund-policy.md
git commit -m "fees: buyer service fee in SQL — marketplace max(\$0.30, 2%) + processing on the charged amount, \$1 minimum order, zero for store credit"
```

---

### Task 2: TypeScript stops computing the buyer fee; checkout re-quotes on promo / store credit

**Files:**
- Modify: `src/lib/fees/index.ts` (delete `BUYER_MARKETPLACE_FEE_PCT`, `MARKETPLACE_FEE_LABEL`, `PROCESSING_FEE_LABEL`, `BuyerFee`, `buyerFee`; add `export const SERVICE_FEE_LABEL = 'Service fee'`)
- Modify: `src/lib/fees/fees.test.ts` (drop the buyerFee cases)
- Modify: `src/lib/payments/eligibility.ts` (`MethodQuote` gains `marketplaceMinor`, `serviceFeeMinor`, `chargeMinor`, `walletAppliedMinor`; `EligibilityInput` gains `promoMinor?: bigint`, `walletMinor?: bigint`, passed to `buyer_fee_quote_many`)
- Modify: `src/lib/actions/checkout.ts` (remove `buyerFee`/`totalMinorFor`; pass promo + wallet into `eligibleMethods`; `chosen = walletRow` when `walletReqMinor >= walletRow.quote.totalMinor`; `totalAmountMajor = Number(chosen.quote.totalMinor)/100`; `platformFeeRate: 0, platformFee: 0` in `createPendingOrder`; new exported action `quoteCheckoutMethods`)
- Modify: `src/app/checkout/[id]/CheckoutForm.tsx` (one Service fee row; quotes state refreshed by `quoteCheckoutMethods`)
- Modify: `src/app/checkout/[id]/loading.tsx` if the summary skeleton lists two fee rows.
- Test: `src/lib/payments/eligibility.test.ts` (exists? if not, create for the mapping), `src/test/guards/fee-checkout-single-path.guard.test.ts` (add: `buyerFee`/`BUYER_MARKETPLACE_FEE_PCT` must not exist anywhere in `src/`).

**Interfaces:**
- Consumes: Task 1 quote keys.
- Produces: `quoteCheckoutMethods(input: { listingId: string; quantity: number; promoCode?: string; walletMinor: number }): Promise<{ success: true; methods: ClientMethod[] } | { success: false; error: string }>` in `src/lib/actions/checkout.ts` — session user required, subtotal from the listing, promo validated server-side, wallet clamped to the user's balance, `eligibleMethods({ …, promoMinor, walletMinor })`, returns `toClientMethods(...)`.

- [ ] **Step 1: Extend the guard**

Add to `src/test/guards/fee-checkout-single-path.guard.test.ts`:
```ts
  it('no TypeScript computes the buyer fee (buyerFee / BUYER_MARKETPLACE_FEE_PCT are gone)', () => {
    const offenders = walk('src').filter((p) => /\bbuyerFee\s*\(|\bBUYER_MARKETPLACE_FEE_PCT\b|\bMARKETPLACE_FEE_LABEL\b|\bPROCESSING_FEE_LABEL\b/.test(readFileSync(p, 'utf8')))
    expect(offenders).toEqual([])
  })
```
(reuse the file's existing `walk`/`read` helpers; if none, copy the pattern from its "no source file references the retired commission symbols" test.)

- [ ] **Step 2: Run it, expect FAIL listing `CheckoutForm.tsx`, `checkout.ts`, `lib/fees/index.ts`.**

- [ ] **Step 3: lib/fees + eligibility**

In `eligibility.ts`:
```ts
export interface MethodQuote {
  marketplaceMinor: number
  feeMinor: number          // processing
  serviceFeeMinor: number   // marketplace + processing
  totalMinor: number        // order total before store credit
  chargeMinor: number       // what the provider is asked for
  walletAppliedMinor: number
  pctEffective: number | null
}
export interface EligibilityInput { buyerId: string | null; currency: string; country: string | null; subtotalMinor: bigint; promoMinor?: bigint; walletMinor?: bigint }
// rpc: p_promo_minor: (input.promoMinor ?? 0n).toString(), p_wallet_minor: (input.walletMinor ?? 0n).toString()
// mapping: marketplaceMinor: Number(q.marketplace_minor), serviceFeeMinor: Number(q.service_fee_minor), chargeMinor: Number(q.charge_minor), walletAppliedMinor: Number(q.wallet_applied_minor)
```

- [ ] **Step 4: checkout.ts**

Replace the fee block:
```ts
const subtotal = round2(listing.price * quantity)
const promo = await resolveCheckoutPromo(input.promoCode, subtotal, validatePromoCode)
if (!promo.ok) return { success: false, error: promo.error }
const promoDiscount = promo.discount
const promoCodeId = promo.promoCodeId
const walletReqMinor = (input.walletAmount ?? 0) > 0 ? fromDecimal(Math.max(0, input.walletAmount ?? 0).toFixed(2), ORDER_CURRENCY).amountMinor : 0n
const eligibility = await eligibleMethods({
  buyerId: user.id, currency: ORDER_CURRENCY, country: null,
  subtotalMinor: fromDecimal(subtotal.toFixed(2), ORDER_CURRENCY).amountMinor,
  promoMinor: fromDecimal(promoDiscount.toFixed(2), ORDER_CURRENCY).amountMinor,
  walletMinor: walletReqMinor,
})
const requested = pickMethod(eligibility, requestedMethod)
if (!requested.ok) return { success: false, error: requested.error }
let chosen: EligibleMethod = requested.method
const walletRow = eligibility.methods.find((m) => m.kind === 'wallet')
if (walletRow && walletReqMinor > 0n && walletReqMinor >= BigInt(walletRow.quote.totalMinor)) chosen = walletRow
const totalAmountMajor = chosen.quote.totalMinor / 100
```
Keep the seller-fee resolution (`resolveSellerFee`, `commission`, `sellerPayout`) exactly as it is. `createPendingOrder({ …, platformFeeRate: 0, platformFee: 0, … })` with a comment "ignored by the RPC since <migration>: the quote is the marketplace fee". Delete `totalMinorFor`.

Add:
```ts
export async function quoteCheckoutMethods(input: { listingId: string; quantity: number; promoCode?: string; walletMinor: number }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: listing } = await supabase.from('listings').select('id, price, min_quantity, status').eq('id', input.listingId).maybeSingle()
  if (!listing) return { success: false as const, error: 'Listing not found' }
  const quantity = Math.max(1, Math.floor(input.quantity || 1))
  const subtotal = round2(Number(listing.price) * quantity)
  const promo = await resolveCheckoutPromo(input.promoCode, subtotal, validatePromoCode)
  const promoDiscount = promo.ok ? promo.discount : 0
  let walletMinor = 0n
  if (user && input.walletMinor > 0) {
    const { getMyWalletBalance } = await import('@/lib/actions/wallet-ledger')
    const bal = await getMyWalletBalance()
    const have = BigInt(Math.round((bal.balance?.available_balance ?? 0) * 100))
    walletMinor = BigInt(Math.max(0, Math.floor(input.walletMinor))) < have ? BigInt(Math.floor(input.walletMinor)) : have
  }
  const eligibility = await eligibleMethods({ buyerId: user?.id ?? null, currency: ORDER_CURRENCY, country: null,
    subtotalMinor: fromDecimal(subtotal.toFixed(2), ORDER_CURRENCY).amountMinor,
    promoMinor: fromDecimal(promoDiscount.toFixed(2), ORDER_CURRENCY).amountMinor, walletMinor })
  return { success: true as const, methods: toClientMethods(eligibility.methods) }
}
```

- [ ] **Step 5: CheckoutForm**

- `const [quotedMethods, setQuotedMethods] = useState<ClientMethod[]>(methods)`; derive `allLocalRows`, `cryptoMethod`, `walletQuote` from `quotedMethods` instead of `methods`.
- `useEffect` on `[quantity, promoDiscount, useWallet, walletBalance]` (skip the first render; 250 ms debounce; ignore stale responses with a request counter): `quoteCheckoutMethods({ listingId: listing.id, quantity, promoCode: promoResult?.valid ? promoResult.code : undefined, walletMinor: useWallet ? Math.round(walletBalance * 100) : 0 })` → `setQuotedMethods(r.methods)`.
- Money math becomes:
```ts
const methodQuote = payMethod == null ? null : payMethod === 'crypto' ? cryptoMethod?.quote ?? null : allLocalRows.find((r) => r.id === payMethod)?.quote ?? null
const walletCoversAll = useWallet && walletQuote != null && Math.round(walletBalance * 100) >= walletQuote.totalMinor
const activeQuote = walletCoversAll ? walletQuote : methodQuote
const serviceFee = (activeQuote?.serviceFeeMinor ?? 0) / 100
const walletAmount = useWallet ? (activeQuote ? (activeQuote.totalMinor - activeQuote.chargeMinor) / 100 : 0) : 0
const total = activeQuote ? Math.max(activeQuote.totalMinor - Math.round(walletAmount * 100), 0) / 100 : Math.max(subtotal - promoDiscount, 0)
```
- `moneySummary` rows: Subtotal · `Row label={SERVICE_FEE_LABEL} value={`+$${serviceFee.toFixed(2)}`} infoTitle="Service Fee" info={walletCoversAll ? 'No service fee when you pay with store credit.' : 'Covers payment processing and keeps SafeDrop Protection running.'}` (no `infoBadge`) · Discount · Store Credit · Total. Delete the marketplace and processing rows and both imports.
- `createCheckout({ …, walletAmount, … })` unchanged.

- [ ] **Step 6: typecheck + tests**

Run: `pnpm typecheck && pnpm vitest run src/lib/fees src/lib/payments src/test/guards/fee-checkout-single-path.guard.test.ts src/test/guards/fee-copy.guard.test.ts src/app/checkout`
Expected: PASS. Fix any `fee-copy` pin that referenced `MARKETPLACE_FEE_LABEL`.

- [ ] **Step 7: Browser check** (dev server on this worktree's port via `.claude/launch.json`): checkout shows one "Service fee" row, toggling Store Credit re-quotes (fee drops), promo re-quotes, Pay Now creates the order and the order total equals the displayed total. Screenshot desktop + phone.

- [ ] **Step 8: Commit** `git commit -am "checkout: one Service fee row from the SQL quote; re-quote on promo and store credit; TypeScript computes no buyer fee"`

---

### Task 3: Migration B — fault-aware refunds, seller faults, buyer withdrawal gate

**Files:**
- Create: `supabase/migrations/<ts>_refund_policy.sql`
- Test: `src/test/guards/refund-policy.guard.integration.test.ts`

**Interfaces:**
- Produces: `order_refund_to_wallet(p_order_id uuid, p_dedupe_key text DEFAULT NULL, p_amount_minor bigint DEFAULT NULL, p_fault text DEFAULT 'platform')`; `order_cancel_return_wallet(… 7 existing args …, p_fault text DEFAULT 'platform')`; both return the transition jsonb plus `credited_minor`, `fee_kept_minor`, `fault`.
- Produces: `order_seller_fault_record(p_order_id uuid, p_source text) RETURNS jsonb {recorded, count_in_window, fee_charged_minor, fee_txn_id}`; table `order_seller_faults`.
- Produces: `platform_fee_settings.seller_fault_fee_threshold int DEFAULT 5`, `seller_fault_fee_window_days int DEFAULT 7`.
- Produces: `seller_withdrawal_gate` reason `'not_a_seller'` for `profiles.role <> 'seller'`.
- Produces: `order_dispute_resolve` passes `'seller'` on `refund_full`; its buyer notification no longer says "withdraw it".

- [ ] **Step 1: Write the failing guard test**

```ts
// src/test/guards/refund-policy.guard.integration.test.ts
/**
 * Refund policy (docs/design/buyer-fee-refund-policy.md): buyer-fault refunds
 * return the item price and keep the fees (refunds → platform_commission);
 * seller / platform faults refund in full; the 5th seller fault in 7 days
 * charges that order's buyer fees to the seller. Every row removed in afterAll.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { hasEnv, makeFixture, type Fixture } from './throwaway'
vi.mock('@/lib/email', () => ({}))

let fx: Fixture | null = null
const CUR = 'USD'
const made: string[] = []
const wallet = async (uid: string) => BigInt((await fx!.svc.rpc('user_wallet_balance', { p_user_id: uid, p_currency: CUR } as any)).data ?? 0)
const sellerAvail = async (uid: string) => BigInt((await fx!.svc.rpc('seller_available_balance', { p_seller_id: uid, p_currency: CUR } as any)).data ?? 0)
const txn = async (key: string) => (await fx!.svc.from('ledger_transactions').select('id').eq('idempotency_key', key).maybeSingle()).data

/** A PAID $20 crypto order: subtotal 2000, marketplace 40, processing 102, total 2142, escrow held. */
async function paidOrder(): Promise<string> {
  const { data, error } = await (fx!.svc.rpc as any)('order_create_pending', {
    p_buyer_id: fx!.buyer.id, p_seller_id: fx!.seller.id, p_listing_id: fx!.listingId, p_quantity: 1,
    p_unit_price: 20, p_subtotal: 20, p_platform_fee_rate: 0, p_platform_fee: 0, p_seller_payout: 18,
    p_seller_commission_pct: 10, p_seller_fee_trace: {}, p_currency: CUR, p_promo_code_id: null, p_promo_discount: 0,
    p_wallet_minor: 0, p_provider: 'btcpay', p_pm_id: null, p_fallback_expires_at: new Date(Date.now() + 3600e3).toISOString(),
    p_buyer_fee_method: 'btcpay',
  })
  if (error) throw new Error(error.message)
  const id = data.order_id as string
  made.push(id)
  const { error: e2 } = await (fx!.svc.rpc as any)('order_confirm_payment', { p_order_id: id, p_dedupe_key: `test:${id}`, p_provider: 'btcpay', p_provider_charge_id: `chg_${id}` })
  if (e2) throw new Error(e2.message)
  return id
}

describe.skipIf(!hasEnv)('refund policy — fault-aware credits', () => {
  beforeAll(async () => { fx = await makeFixture() })
  afterAll(async () => {
    for (const id of made) {
      await (fx!.svc.rpc as any)('ledger_test_cleanup_by_order', { p_order_id: id })
      await fx!.svc.from('order_seller_faults').delete().eq('order_id', id)
      await fx!.svc.from('payment_attempts').delete().eq('order_id', id)
      await fx!.svc.from('orders').delete().eq('id', id)
    }
    await fx?.cleanup()
  })

  it('buyer fault: the item price is credited, the fees move to platform_commission', async () => {
    const id = await paidOrder()
    const before = await wallet(fx!.buyer.id)
    const { data, error } = await (fx!.svc.rpc as any)('order_cancel_return_wallet', { p_order_id: id, p_dedupe_key: 'buyer', p_allow_paid: true, p_attempt_close: 'void', p_fault: 'buyer' })
    expect(error).toBeNull()
    expect(Number(data.credited_minor)).toBe(2000)
    expect(Number(data.fee_kept_minor)).toBe(142)
    expect((await wallet(fx!.buyer.id)) - before).toBe(2000n)
    expect(await txn(`fee_kept:${id}`)).not.toBeNull()
  })
  it('seller fault: full credit, a fault row, no fee charged below the threshold', async () => {
    const id = await paidOrder()
    const before = await wallet(fx!.buyer.id)
    const { data } = await (fx!.svc.rpc as any)('order_refund_to_wallet', { p_order_id: id, p_dedupe_key: 'seller', p_fault: 'seller' })
    expect(Number(data.credited_minor)).toBe(2142)
    expect((await wallet(fx!.buyer.id)) - before).toBe(2142n)
    const { data: f } = await fx!.svc.from('order_seller_faults').select('fee_charged_minor').eq('order_id', id).single()
    expect(Number((f as any).fee_charged_minor)).toBe(0)
  })
  it('default (platform) fault: full credit, nothing kept, no fault row', async () => {
    const id = await paidOrder()
    const { data } = await (fx!.svc.rpc as any)('order_refund_to_wallet', { p_order_id: id, p_dedupe_key: 'plat' })
    expect(Number(data.credited_minor)).toBe(2142)
    expect(await txn(`fee_kept:${id}`)).toBeNull()
    expect((await fx!.svc.from('order_seller_faults').select('order_id').eq('order_id', id)).data).toEqual([])
  })
  it('the 5th seller fault in 7 days charges that order’s buyer fees to seller_available', async () => {
    // two faults exist from the tests above (seller test) → make it 4 first
    const ids: string[] = []
    for (let i = 0; i < 4; i++) ids.push(await paidOrder())
    for (const id of ids.slice(0, 3)) await (fx!.svc.rpc as any)('order_refund_to_wallet', { p_order_id: id, p_dedupe_key: 's', p_fault: 'seller' })
    const before = await sellerAvail(fx!.seller.id)
    const { data } = await (fx!.svc.rpc as any)('order_refund_to_wallet', { p_order_id: ids[3], p_dedupe_key: 's', p_fault: 'seller' })
    expect(Number(data.fault_fee_minor)).toBe(142)
    expect(before - (await sellerAvail(fx!.seller.id))).toBe(142n)
    expect(await txn(`seller_fault_fee:${ids[3]}`)).not.toBeNull()
  })
  it('replaying a refund does not credit twice or keep the fee twice', async () => {
    const id = await paidOrder()
    await (fx!.svc.rpc as any)('order_refund_to_wallet', { p_order_id: id, p_dedupe_key: 'b', p_fault: 'buyer' })
    const before = await wallet(fx!.buyer.id)
    const { data } = await (fx!.svc.rpc as any)('order_refund_to_wallet', { p_order_id: id, p_dedupe_key: 'b', p_fault: 'buyer' })
    expect(data.changed).toBe(false)
    expect(await wallet(fx!.buyer.id)).toBe(before)
  })
  it('a buyer account is refused by the withdrawal gate: not_a_seller', async () => {
    const { data } = await (fx!.svc.rpc as any)('seller_withdrawal_gate', { p_seller_id: fx!.buyer.id })
    expect(data.eligible).toBe(false)
    expect(data.reason).toBe('not_a_seller')
  })
})
```
(Check `order_confirm_payment`'s current parameter names in `20260923031025_pay_late_payment_credit.sql` before running; adjust the call.)

- [ ] **Step 2: Run, expect FAIL (`p_fault` unknown).**

- [ ] **Step 3: Write the migration**

```sql
-- Refund policy (docs/design/buyer-fee-refund-policy.md): fault-aware buyer
-- credits, seller faults + the 5-in-7-days non-delivery fee, buyer
-- withdrawal gate. Default p_fault = 'platform' = today's full refund, so a
-- caller that is not updated keeps its behaviour.

ALTER TABLE public.platform_fee_settings
  ADD COLUMN IF NOT EXISTS seller_fault_fee_threshold   integer NOT NULL DEFAULT 5 CHECK (seller_fault_fee_threshold >= 1),
  ADD COLUMN IF NOT EXISTS seller_fault_fee_window_days integer NOT NULL DEFAULT 7 CHECK (seller_fault_fee_window_days >= 1);

CREATE TABLE IF NOT EXISTS public.order_seller_faults (
  order_id           uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  seller_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source             text NOT NULL CHECK (source IN ('seller_cancel', 'admin_cancel', 'dispute')),
  occurred_at        timestamptz NOT NULL DEFAULT now(),
  fee_charged_minor  bigint NOT NULL DEFAULT 0,
  fee_txn_id         uuid REFERENCES public.ledger_transactions(id)
);
CREATE INDEX IF NOT EXISTS order_seller_faults_seller_idx ON public.order_seller_faults (seller_id, occurred_at DESC);
ALTER TABLE public.order_seller_faults ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.order_seller_faults FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.order_seller_faults TO service_role;
COMMENT ON TABLE public.order_seller_faults IS 'One row per order the seller failed (cancel / dispute lost). Drives the rolling non-delivery fee. Service-role only.';

-- Record a seller fault; from the threshold-th fault inside the window,
-- charge that order's buyer fees (platform_fee + payment_processing_fee)
-- to the seller. Idempotent per order.
CREATE OR REPLACE FUNCTION public.order_seller_fault_record(p_order_id uuid, p_source text)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_o RECORD; v_s RECORD; v_count int; v_fee bigint; v_txn uuid; v_cur char(3); v_existing RECORD;
BEGIN
  SELECT * INTO v_o FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_o.seller_id IS NULL THEN RETURN jsonb_build_object('recorded', false); END IF;
  SELECT * INTO v_existing FROM order_seller_faults WHERE order_id = p_order_id;
  IF FOUND THEN
    RETURN jsonb_build_object('recorded', false, 'fee_charged_minor', v_existing.fee_charged_minor, 'fee_txn_id', v_existing.fee_txn_id);
  END IF;
  SELECT * INTO v_s FROM platform_fee_settings WHERE id;
  PERFORM pg_advisory_xact_lock(hashtextextended('seller_fault:' || v_o.seller_id::text, 0));
  INSERT INTO order_seller_faults (order_id, seller_id, source) VALUES (p_order_id, v_o.seller_id, p_source);
  SELECT COUNT(*) INTO v_count FROM order_seller_faults
   WHERE seller_id = v_o.seller_id AND occurred_at > now() - make_interval(days => v_s.seller_fault_fee_window_days);
  v_fee := ROUND((COALESCE(v_o.platform_fee, 0) + COALESCE(v_o.payment_processing_fee, 0)) * 100)::bigint;
  v_cur := UPPER(COALESCE(v_o.currency, 'USD'))::char(3);
  PERFORM money_fault_hook('order_seller_fault_record:after_insert');
  IF v_count >= v_s.seller_fault_fee_threshold AND v_fee > 0 THEN
    v_txn := post_journal('seller_fault_fee:' || p_order_id::text, jsonb_build_array(
      jsonb_build_object('owner_type','seller','owner_id',v_o.seller_id::text,'kind','seller_available','direction','debit','amount_minor',v_fee,'currency',v_cur),
      jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','platform_commission','direction','credit','amount_minor',v_fee,'currency',v_cur)),
      'SELLER_FAULT_FEE', p_order_id);
    UPDATE order_seller_faults SET fee_charged_minor = v_fee, fee_txn_id = v_txn WHERE order_id = p_order_id;
    UPDATE profiles SET seller_balance = COALESCE(seller_balance, 0) - (v_fee::numeric / 100) WHERE id = v_o.seller_id;
    PERFORM notify_once(v_o.seller_id, 'seller_fault_fee', 'Non-Delivery Fee Applied',
      'This is your ' || v_count || 'th cancelled order in ' || v_s.seller_fault_fee_window_days || ' days. The buyer''s fees on order #' ||
      COALESCE(v_o.order_number, LEFT(p_order_id::text, 8)) || ' ($' || to_char(v_fee::numeric / 100, 'FM999999990.00') || ') were charged to your balance.',
      '/account/orders/' || p_order_id::text, 'seller_fault_fee:' || p_order_id::text);
  ELSE
    v_fee := 0;
  END IF;
  RETURN jsonb_build_object('recorded', true, 'count_in_window', v_count, 'fee_charged_minor', v_fee, 'fee_txn_id', v_txn);
END; $$;
REVOKE ALL ON FUNCTION public.order_seller_fault_record(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_seller_fault_record(uuid, text) TO service_role;

-- The buyer credit + fee-kept leg shared by both refund seams. Assumes
-- safedrop_transition already moved gross escrow_held → refunds.
CREATE OR REPLACE FUNCTION public.order_refund_buyer_credit(p_order_id uuid, p_fault text, p_amount_minor bigint)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_o RECORD; v_total bigint; v_item bigint; v_credit bigint; v_kept bigint := 0; v_cur char(3);
  v_wallet_txn uuid; v_kept_txn uuid; v_fault jsonb := NULL;
BEGIN
  IF p_fault NOT IN ('buyer', 'seller', 'platform') THEN
    RAISE EXCEPTION 'order_refund_buyer_credit: p_fault must be buyer|seller|platform, got %', p_fault USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO v_o FROM orders WHERE id = p_order_id;
  v_cur   := UPPER(COALESCE(v_o.currency, 'USD'))::char(3);
  v_total := ROUND(COALESCE(v_o.total_amount, 0) * 100)::bigint;
  v_item  := GREATEST(ROUND((COALESCE(v_o.subtotal, 0) - COALESCE(v_o.promo_discount, 0)) * 100)::bigint, 0);
  v_credit := CASE
    WHEN p_amount_minor IS NOT NULL AND p_amount_minor > 0 AND p_amount_minor < v_total THEN p_amount_minor
    WHEN p_fault = 'buyer' THEN LEAST(v_item, v_total)
    ELSE v_total END;
  IF v_o.buyer_id IS NOT NULL AND v_credit > 0 THEN
    v_wallet_txn := wallet_credit(v_o.buyer_id, v_credit, v_cur, 'refunds', 'wallet_refund:' || p_order_id::text, 'REFUND_TO_WALLET', p_order_id);
  END IF;
  PERFORM money_fault_hook('order_refund_buyer_credit:after_credit');
  v_kept := v_total - v_credit;
  IF v_kept > 0 AND p_fault = 'buyer' THEN
    v_kept_txn := post_journal('fee_kept:' || p_order_id::text, jsonb_build_array(
      jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','refunds','direction','debit','amount_minor',v_kept,'currency',v_cur),
      jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','platform_commission','direction','credit','amount_minor',v_kept,'currency',v_cur)),
      'BUYER_FEE_KEPT', p_order_id);
  END IF;
  IF p_fault = 'seller' THEN
    v_fault := order_seller_fault_record(p_order_id, 'seller_cancel');
  END IF;
  RETURN jsonb_build_object('wallet_txn_id', v_wallet_txn, 'credited_minor', v_credit, 'fee_kept_minor', CASE WHEN p_fault = 'buyer' THEN v_kept ELSE 0 END,
                            'fee_kept_txn_id', v_kept_txn, 'fault', p_fault, 'fault_fee_minor', COALESCE((v_fault->>'fee_charged_minor')::bigint, 0));
END; $$;
REVOKE ALL ON FUNCTION public.order_refund_buyer_credit(uuid, text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_refund_buyer_credit(uuid, text, bigint) TO service_role;

-- order_refund_to_wallet: + p_fault; a provider refund event for an order
-- already refunded/cancelled with its wallet credit posted is a no-op
-- (the refund-to-source flow ends with exactly that webhook).
DROP FUNCTION IF EXISTS public.order_refund_to_wallet(uuid, text, bigint);
CREATE OR REPLACE FUNCTION public.order_refund_to_wallet(p_order_id uuid, p_dedupe_key text DEFAULT NULL, p_amount_minor bigint DEFAULT NULL, p_fault text DEFAULT 'platform')
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order RECORD; v_transition jsonb; v_leg jsonb;
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_refund_to_wallet: order % not found', p_order_id USING ERRCODE = 'no_data_found'; END IF;
  IF v_order.status IN ('refunded', 'cancelled') AND EXISTS (SELECT 1 FROM ledger_transactions WHERE idempotency_key = 'wallet_refund:' || p_order_id::text) THEN
    RETURN jsonb_build_object('order_id', p_order_id, 'status', v_order.status, 'changed', false, 'reason', 'already_refunded');
  END IF;
  v_transition := safedrop_transition(p_order_id, 'REFUNDED', p_dedupe_key, NULL, NULL);
  PERFORM money_fault_hook('order_refund_to_wallet:after_transition');
  v_leg := order_refund_buyer_credit(p_order_id, p_fault, p_amount_minor);
  RETURN v_transition || v_leg;
END; $$;
REVOKE ALL ON FUNCTION public.order_refund_to_wallet(uuid, text, bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_refund_to_wallet(uuid, text, bigint, text) TO service_role;
COMMENT ON FUNCTION public.order_refund_to_wallet(uuid, text, bigint, text) IS
  'Money layer: safedrop_transition(REFUNDED) + fault-aware buyer credit (buyer fault = item price, fees kept; seller/platform = full) in one transaction. Idempotent. Service-role only.';

-- order_cancel_return_wallet: + p_fault on the paid branch. Body = 20260923030139 §6 verbatim
-- with the paid branch's wallet_credit(...) replaced by
--   v_leg := order_refund_buyer_credit(p_order_id, p_fault, NULL);
--   RETURN v_transition || v_leg || jsonb_build_object('refused', false, 'from_paid', true);
DROP FUNCTION IF EXISTS public.order_cancel_return_wallet(uuid, text, boolean, text, text, text, text);
CREATE OR REPLACE FUNCTION public.order_cancel_return_wallet(
  p_order_id uuid, p_dedupe_key text DEFAULT NULL, p_allow_paid boolean DEFAULT false,
  p_provider text DEFAULT NULL, p_provider_charge_id text DEFAULT NULL,
  p_attempt_close text DEFAULT NULL, p_provider_void_outcome text DEFAULT NULL, p_fault text DEFAULT 'platform')
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
-- …full body copied from 20260923030139_pay_provider_cancel_outbox.sql lines 194–330, paid branch edited as above…
$$;
REVOKE ALL ON FUNCTION public.order_cancel_return_wallet(uuid, text, boolean, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_cancel_return_wallet(uuid, text, boolean, text, text, text, text, text) TO service_role;

-- order_dispute_resolve: refund_full is a seller fault. Re-create the body
-- from 20260927185652 verbatim with:
--   v_t := order_refund_to_wallet(v_order.id, 'dispute:' || p_dispute_id::text, NULL, 'seller');
-- and, inside order_seller_fault_record's INSERT the source will read
-- 'seller_cancel' — acceptable; the dispute id is on the ledger event.
-- Buyer notification copy: '… was added to your Store Balance. Spend it at checkout with no service fee.'

-- Withdrawal gate: buyers contact support.
CREATE OR REPLACE FUNCTION public.seller_withdrawal_gate(p_seller_id uuid) RETURNS jsonb
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role text; v_since TIMESTAMPTZ := seller_since(p_seller_id); v_days INT; v_freeze INT; v_unlock TIMESTAMPTZ; v_changed TIMESTAMPTZ; v_until TIMESTAMPTZ;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = p_seller_id;
  IF v_role IS DISTINCT FROM 'seller' THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'not_a_seller', 'seller_since', NULL, 'unlock_at', NULL, 'min_age_days', NULL, 'freeze_until', NULL);
  END IF;
  -- …rest verbatim from 20260923031644 §4…
END; $$;
```
Also re-create `order_dispute_resolve` in full (copy 20260927185652 lines 14–end, two edits above).

- [ ] **Step 4: Apply + run**

Run: `pnpm test:reset && pnpm vitest run src/test/guards/refund-policy.guard.integration.test.ts src/test/guards/money-atomicity.guard.integration.test.ts src/test/guards/order-disputes*.test.ts src/test/guards/withdrawal*.test.ts`
Expected: PASS. Add one `itFault` case: `withFault('order_refund_buyer_credit:after_credit', "SELECT order_refund_to_wallet('<id>', 'f', NULL, 'buyer')")` leaves the order `paid`, no `wallet_refund` txn, no `fee_kept` txn.

- [ ] **Step 5: Commit** `git commit -m "refunds: fault-aware credits (buyer = item price, fees kept), seller faults + 5-in-7-days non-delivery fee, buyer withdrawal gate"`

---

### Task 4: TypeScript callers pass the fault; copy loses "withdraw it"

**Files:**
- Modify: `src/lib/wallet/order-money.ts` (`refundOrderToWallet(orderId, dedupeKey?, amountMinor?, fault: 'buyer'|'seller'|'platform' = 'platform')`; `cancelOrderReturnWallet(orderId, dedupeKey?, opts?: { …, fault?: RefundFault })` → `p_fault`)
- Modify: `src/lib/orders/seller-cancel-reasons.ts` (export `sellerCancelFault(reason): 'buyer'|'seller'` — `buyer_requested`, `buyer_unresponsive` → `'buyer'`, else `'seller'`)
- Modify: `src/lib/actions/orders.ts` (`cancelOrder` → `fault: 'buyer'`; `sellerCancelOrder` → `fault: sellerCancelFault(reason)`; `logOrderAction` metadata gains `fault`)
- Modify: `src/lib/actions/order-cancellation.ts` (`processCancellationRequest(requestId, action, adminNotes, fault: 'buyer'|'seller' = 'buyer')` → passes it; `getPendingCancellationRequests` unchanged)
- Modify: `src/app/(admin)/admin/orders/components/cancellation-requests-table.tsx` (approve modal gains a checkbox "Seller At Fault — refund the buyer's fees too, count against the seller")
- Modify copy: `src/app/account/orders/[orderId]/_OrderDetailsCard.tsx:297,306`, `_StatusStrip.tsx:143-144,338`, `src/lib/email/index.ts:704` → "…added to your Store Balance. Spend it at checkout with no service fee." Refunded caption for buyer-fault cancels: "Order cancelled. The item price was added to your Store Balance; the service fee is not refunded when you cancel a paid order."  (needs `fault` on the order page: read `orders.status` + `order_seller_faults`? Simpler: `_OrderDetailsCard` gets `refundedMinor` from the `wallet_refund:<id>` ledger txn via the page loader, and says "Amount Refunded" = that number.)
- Test: `src/app/account/orders/[orderId]/cancelled-copy.test.ts` (update pinned strings), `src/test/guards/buyer-copy-payout-timing.guard.test.ts` (run).

- [ ] **Step 1: Update `cancelled-copy.test.ts` expectations first (fail), then edit copy, typecheck, run** `pnpm vitest run src/app/account/orders src/test/guards/buyer-copy-payout-timing.guard.test.ts src/lib/actions`.
- [ ] **Step 2: Commit** `git commit -m "orders: refund callers pass the fault; admin cancel approval marks seller fault; refund copy says Store Balance, never withdraw"`

---

### Task 5: Migration C — refund to original payment method (request → admin approve → Payssion refund via outbox)

**Files:**
- Create: `supabase/migrations/<ts>_refund_to_source.sql`
- Modify: `src/lib/payments/cancel-outbox.ts` (branch on `kind`)
- Create: `src/lib/actions/refund-to-source.ts` (`requestRefundToSource(orderId)`, `getMyRefundToSourceRequest(orderId)`, admin `listRefundToSourceRequests()`, `approveRefundToSource(id)`, `rejectRefundToSource(id, notes)`)
- Test: `src/test/guards/refund-to-source.guard.integration.test.ts`

**Interfaces:**
- Produces table `refund_to_source_requests(id uuid pk, order_id uuid unique, buyer_id uuid, amount_minor bigint, currency char(3), provider text, provider_charge_id text, status text CHECK IN ('pending','approved','sent','failed','rejected'), admin_id uuid, admin_notes text, provider_refund_id text, outbox_id uuid, created_at, decided_at, updated_at)`; RLS: buyer SELECT own rows; service role all.
- Produces RPCs (service-role): `refund_to_source_request(p_order_id, p_buyer_id) → {ok, reason?, request_id, amount_minor}` (reasons: `not_owner`, `not_refunded`, `no_provider_charge`, `not_refundable`, `credit_spent`, `exists`); `refund_to_source_approve(p_request_id, p_admin_id) → {approved, outbox_id}` (wallet_spend → `provider_float`, key `refund_to_source:<id>`, enqueue kind refund); `refund_to_source_reject(p_request_id, p_admin_id, p_notes)`; `refund_to_source_fail(p_request_id, p_error)` (reverse: `wallet_credit(buyer, amount, cur, 'provider_float', 'refund_to_source_reversal:<id>')`, status failed, `admin_alert_once`).
- Produces outbox columns `kind text NOT NULL DEFAULT 'void' CHECK (kind IN ('void','refund'))`, `amount_minor bigint`, `currency char(3)`, `request_id uuid`; unique `(provider, provider_charge_id, kind)`; `provider_cancel_outbox_enqueue` re-created with the 3-column conflict target; new `provider_refund_outbox_enqueue(p_request_id, p_order_id, p_provider, p_provider_charge_id, p_amount_minor, p_currency)`; `provider_cancel_outbox_mark` re-created: `kind='refund'` + ok → request `sent`, `provider_refund_id = p_outcome`; `kind='refund'` + cap → `refund_to_source_fail`.
- Worker: `if (row.kind === 'refund') { const p = getProvider(row.provider); if (!p.refund) throw new Error(`${row.provider}: refund unsupported`); const r = await p.refund(row.provider_charge_id, { amountMinor: BigInt(row.amount_minor), currency: row.currency }, `rts:${row.request_id}`); ok = true; outcome = r.refundId }`.

- [ ] **Step 1: Failing test** — request eligibility (a refunded Payssion-paid fixture order with `provider_charge_id` set on its `paid` attempt and `refundable=true`): `refund_to_source_request` → pending; a second call → `exists`; a buyer whose credit was spent → `credit_spent`; approve → wallet down by amount, outbox row `kind='refund'`, status `approved`; `drainProviderCancelOutbox({orderId})` with `getProvider` mocked to `fakeProvider` → status `sent`, `provider_refund_id` set; a provider that throws 6× → `failed`, wallet restored, one `admin_notifications` row. Clean: requests, outbox rows, ledger via `ledger_test_cleanup_by_order`, attempts, orders.
- [ ] **Step 2: Migration + worker + actions.** `requireAdmin()` for the admin actions (`@/lib/actions/admin-permissions`); after approve, `drainCancelOutboxForOrder(orderId)`.
- [ ] **Step 3: Run** the new guard + `money-atomicity` + `pay-*` guards that touch the outbox (`grep -l provider_cancel_outbox src/test/guards`).
- [ ] **Step 4: Commit** `git commit -m "refunds: refund-to-original-method requests, admin approval, Payssion refund through the outbox with reversal on failure"`

---

### Task 6: Buyer + admin UI for refund-to-source; wallet page = one Store Balance

**Files:**
- Modify: `src/app/account/orders/[orderId]/page.tsx` (load `getMyRefundToSourceRequest` + eligibility hint), `_OrderDetailsCard.tsx` (replace the mailto with a "Refund To Original Payment Method" button → `requestRefundToSource`; status lines: "Request sent — support reviews it within 24 to 48 hours." / "Approved — the refund is on its way to your payment method (5 to 10 business days)." / "Sent." / "Declined: <notes>")
- Create: `src/app/(admin)/admin/orders/components/refund-requests-table.tsx` (copy the cancellation table's shape: order, buyer, amount, method, Approve / Reject with notes)
- Modify: `OrdersPageClient.tsx` (tab `refunds`, badge count)
- Modify: `src/app/account/wallet/_WalletClient.tsx` (seller: "Store Balance" = `earningsStats.available_balance + walletBalance.available_balance` with Withdraw; "Pending Sales"; buyer: "Store Balance", caption "Spend it at checkout with no service fee. To withdraw, contact support." with a `mailto:support@dropmarket.gg` link), `src/app/account/wallet/withdraw/page.tsx` (`profile.role !== 'seller'` → redirect `/account/wallet`), `src/lib/actions/payout-details.ts` (`savePayoutDetails` refuses non-sellers), `src/app/account/wallet/loading.tsx` (skeleton matches).
- Test: `src/app/account/wallet/*.test.ts` if present; `details-card.test.ts` for the new button states.

- [ ] Steps: tests first for the details card states → implement → `pnpm typecheck` → browser pass (wallet page as buyer and as seller; order page after a refund; admin refunds tab) → screenshots → commit `git commit -m "wallet: one Store Balance; buyers withdraw via support; refund-to-source button + admin tab"`.

---

### Task 7: Public + legal copy, guards, docs, types, gate, PR

**Files:**
- Modify: `src/lib/legal/documents.ts` — Fees "Buyer fee" section (one Service fee line: marketplace **2%** of the item price with a $0.30 minimum, orders under $1.00 are rounded up to $1.00, zero on store credit; the live method table stays); Refund Policy 7.1 (store credit to your Store Balance; seller-fault and SafeDrop refunds in full; a cancel of a paid order at the buyer's request refunds the item price, the service fee is not returned), 7.2 (request from the order page; approved refunds go to the original method within 5–10 business days; not available for methods the provider cannot refund); Terms 9.4; SafeDrop 2.1 / 12.2 wording; Seller section: "From the fifth cancelled order you are responsible for within any 7-day period, the buyer's fees on that order are charged to your Store Balance."
- Modify: `src/lib/fees/buyer-public-rates.ts` (`describeMethodFee` text: processing "on the amount charged"; head unchanged), `src/app/(legal)/fees/page.tsx` unchanged.
- Modify: `src/test/guards/fee-copy.guard.test.ts` (buyer section still exactly `['2%']`; add: Buyer fee section must mention `$0.30` and `$1.00`; must not mention "Processing fee" as a separate checkout line? — keep it simple: assert `SERVICE_FEE_LABEL` is imported by CheckoutForm).
- Modify: `src/test/guards/db-p0-grants.guard.integration.test.ts` only if it enumerates function signatures (run it).
- Run: `pnpm db:types` (worktree stack: `supabase gen types typescript --db-url postgresql://postgres:postgres@127.0.0.1:54422/postgres > src/types/database.generated.ts && node scripts/merge-db-types.mjs`).
- Create: `docs/handoff/buyer-fee-refund-policy.md` (what changed, the three migrations, deploy order: **db push first** — the new RPC defaults are backward compatible, then deploy; copy approval table; gate numbers; owner to-dos: none beyond release).
- Update: `docs/checkout.md` §7/§9 fee paragraphs; memory `checkout-b4-state.md`/new `buyer-fee-refund-policy-state.md` + `MEMORY.md` line.

- [ ] `pnpm typecheck && pnpm test:full` green; `NEXT_DIST_DIR=.next-check pnpm build` (or tsc gate if Stripe env blocks the build) — record numbers in the handoff.
- [ ] Commit, push `feat/buyer-fee-refund-policy`, open the PR (title "Buyer service fee + refund policy + refund-to-source"), body from the handoff, ending with the attribution line.

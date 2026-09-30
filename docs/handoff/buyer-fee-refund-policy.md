# Handoff — buyer service fee + refund policy + refund-to-source

Branch `feat/buyer-fee-refund-policy` (worktree `.claude/worktrees/feat+buyer-fee-refund-policy`, local stack slot 1). Owner decisions taken in chat on 2026-09-29 after comparing Eldorado (8% + $0.30, one row, $1 minimum) and GameBoost (marketplace floor $0.33 / cap €5 + a 3.9% processor row), and reading the Payssion rate sheet's `Refund fee` column ($1 / €1 per provider refund on every rail we run; paysafecard, QR Ph and Maya cannot be refunded; no free window after payment).

## What changed

### 1. The buyer fee is ONE SQL quote (migration `20260930003955_buyer_service_fee.sql`)

| Part | Rule |
|---|---|
| Marketplace | `max($0.30, 2% × subtotal)` — `platform_fee_settings.buyer_marketplace_pct` / `buyer_marketplace_min_minor` |
| Processing | the method's grossed-up provider cost (unchanged formula) on **what the provider is charged**: subtotal + marketplace − promo − store credit applied |
| Minimum order | the order total (before store credit) is raised to **$1.00** by raising the marketplace fee — `buyer_min_order_total_minor` |
| Store credit | **zero** marketplace, zero processing, no minimum (the `wallet` fee row is 0/0/0) |
| Partial store credit | the credit covers item + marketplace first; processing is charged on the remainder only |

- `buyer_fee_quote(p_method, p_subtotal_minor, p_currency, p_promo_minor DEFAULT 0, p_wallet_minor DEFAULT 0)` returns `marketplace_minor`, `fee_minor` (processing), `service_fee_minor`, `total_minor` (**order total before store credit** — was subtotal + fee), `charge_minor`, `wallet_applied_minor`. `buyer_fee_quote_many` mirrors it. The 3-arg calls still resolve (defaults).
- `order_create_pending` keeps its 19-arg signature; `p_platform_fee_rate` / `p_platform_fee` are ignored (TypeScript passes 0). It quotes for the store credit the buyer can actually apply and snapshots marketplace → `orders.platform_fee`, processing → `payment_processing_fee` / `buyer_fee_amount`. Returns `marketplace_minor` + `service_fee_minor` too.
- TypeScript computes nothing: `lib/fees` lost `buyerFee`, `BUYER_MARKETPLACE_FEE_PCT`, the two labels and the refund helpers; it exports `SERVICE_FEE_LABEL = 'Service fee'`. `fee-checkout-single-path` guard pins their absence.
- `eligibleMethods({ …, promoMinor, walletMinor })`; `MethodQuote` gained `marketplaceMinor`, `serviceFeeMinor`, `chargeMinor`, `walletAppliedMinor`.
- Checkout: one **"Service fee"** row, no percentage, tooltip "Covers payment processing and keeps SafeDrop Protection running." (store credit: "No service fee when you pay with store credit."). New server action `quoteCheckoutMethods` re-quotes when the promo, the store-credit toggle or the quantity changes (250 ms debounce, stale answers dropped). `createCheckout` routes to the wallet row when the requested credit ≥ the wallet row's `totalMinor`, and takes the order total from the chosen quote.
- Order page: the "Fees" row is now "Service Fee" (split still in the popover).

Worked numbers (crypto, 5% floor): $20 → $0.40 + $1.02 = $21.42; $5 → $0.30 + $0.27 = $5.57; $0.50 → topped up to $1.00; $20 with $10 credit → processing on $10.40 = $0.52.

### 2. Refunds are fault-aware (migration `20260930005449_refund_policy.sql`)

`order_refund_to_wallet(…, p_fault text DEFAULT 'platform')` and `order_cancel_return_wallet(…, p_fault text DEFAULT 'platform')` — DROP + CREATE with defaults, old named-parameter calls still resolve. Shared leg `order_refund_buyer_credit`.

| Fault | Callers | Credit | Also |
|---|---|---|---|
| `buyer` | buyer cancels a paid order (`cancelOrder`); seller cancel with reason `buyer_requested` / `buyer_unresponsive`; admin approves a buyer request with "Seller At Fault" **off** (default) | subtotal − promo | fees kept: `refunds → platform_commission` (`fee_kept:<order>`) |
| `seller` | seller cancel (out of stock, cannot deliver, price error, other); admin approves with "Seller At Fault" **on**; dispute `refund_full` | full total | row in `order_seller_faults`; from the **5th** fault in a rolling **7 days** (`platform_fee_settings.seller_fault_fee_threshold` / `_window_days`) that order's buyer fees are charged `seller_available → platform_commission` (`seller_fault_fee:<order>`), mirrored into `profiles.seller_balance`, seller notified |
| `platform` (default) | oversold at payment, provider REFUND_COMPLETED webhook, anything not updated | full total | nothing recorded |

- Cancelling a **pending** (unpaid) order returns the wallet hold in full as before.
- `order_refund_to_wallet` is a no-op (`changed:false, reason:'already_refunded'`) on an order already refunded/cancelled whose `wallet_refund:<order>` credit exists — the refund-to-source flow ends with exactly that provider webhook.
- `order_dispute_resolve` re-created verbatim with `'seller'` on `refund_full` and Store Balance copy.
- Withdrawals: `seller_withdrawal_gate` refuses `not_a_seller` (`profiles.role <> 'seller'`); `withdrawal_quote` carries the support copy; `savePayoutDetails` refuses non-sellers; the withdraw page shows the message.
- `OrderMoneyResult` gained `creditedMinor` / `feeKeptMinor`; the cancel comms use the credited amount.

### 3. Refund to the original payment method (migration `20260930010758_refund_to_source.sql`)

Never automatic. `refund_to_source_requests` (one per order, service-role only) + RPCs `refund_to_source_request` (eligibility: owner, order refunded/cancelled with the `wallet_refund` credit, a `paid` attempt with `provider_charge_id`, fee row `refundable`, credit still unspent), `_approve` (ONE transaction: `user_wallet → provider_float` `refund_to_source:<id>` + outbox row `kind='refund'`), `_reject`, `_fail` (reverses the debit `refund_to_source_reversal:<id>`, status failed, `admin_alert_once`, buyer notified).

- `provider_cancel_outbox` gained `kind` (`void` | `refund`), `amount_minor`, `currency`, `request_id`; unique key is now `(provider, provider_charge_id, kind)`. `provider_cancel_outbox_mark` marks a refund row's request `sent` (with `provider_refund_id`) or, at the 6-attempt cap, calls `refund_to_source_fail`.
- Worker `lib/payments/cancel-outbox.ts` branches on `kind`: `provider.refund(chargeId, {amountMinor, currency}, 'rts:<request>')`. Only Payssion implements `refund()` (`/api/v1/refunds`); CoinGate throws, BTCPay has none → they fail to the cap and reverse.
- Buyer: order page SafeDrop card → "Prefer a refund to your original payment method? **Request It**" (`requestRefundToSource`), then the request's state line. Admin: `/admin/orders` → **Refund Requests** tab (approve → drains inline; reject with a note the buyer sees).
- Actions: `src/lib/actions/refund-to-source.ts`.

### 4. Balances

Wallet page: sellers see **Store Balance** (released sales + store credit) with Withdraw, and **Pending Sales**; buyers see **Store Balance** with "Spend it at checkout with no service fee. To withdraw it, contact support." Skeleton matches. The ledger keeps `seller_available` and `user_wallet` apart underneath.

### 5. Copy

Order page, status strip, status card, chat notice, timeline, refund email, cancel modals, dispute notifications: "Store Balance", never "withdraw it"; a buyer-fault refund says the service fee is not refunded. Legal: Fees "Buyer fee" (one service fee, 2% with $0.30 minimum, $1.00 minimum order, zero on store credit), Refund Policy 7.1/7.2 (fault rule; request from the order page), Terms 9.4, SafeDrop 2.1/2.5/12.2, Seller Agreement 2.2 (the 5-in-7-days fee). `/fees` method table: "at least N% of the amount charged".

## Copy approval table

| Where | Text |
|---|---|
| Checkout summary | **Service fee** · tooltip "Covers payment processing and keeps SafeDrop Protection running." / "No service fee when you pay with store credit." |
| Wallet (seller) | **Store Balance** — "Released sales and store credit. Spend it at checkout with no service fee, or withdraw it." · **Pending Sales** |
| Wallet (buyer) | **Store Balance** — "Refunds and credit. Spend it at checkout with no service fee. To withdraw it, contact support." |
| Order page, refunded | "Your refund was added to your Store Balance as store credit. Spend it at checkout on any listing with no service fee." |
| Order page, buyer-fault cancel | "The item price was added to your Store Balance as store credit. The service fee is not refunded when you cancel a paid order." |
| Refund-to-source | "Prefer a refund to your original payment method? Request It" → "Refund to your payment method requested — support reviews it within 24 to 48 hours…" |
| Seller notification (5th fault) | "Non-Delivery Fee Applied — This is cancelled order number N on your account in the last 7 days. The buyer's fees on order #… were charged to your balance." |
| Admin approve modal | checkbox **Seller At Fault** with its explanation |

## Deploy

1. `supabase db push` (three migrations; every new/changed RPC keeps or defaults its signature, so the live build keeps working).
2. Deploy `main` → `release`.
No data backfill. `platform_fee_settings` gets its new columns with defaults; the `wallet` fee row is updated in the migration.

## Gate

`pnpm type-check` clean. Guards added: `buyer-service-fee` (9), `refund-policy` (11), `refund-to-source` (8). Updated: `buyer-fee-quote`, `buyer-method-fees`, `eu-payment-methods`, `checkout-fix-b`, `fee-checkout-single-path`, `fee-copy`, `details-card`, `cancelled-copy`, `buyer-public-rates`, `fees.test`. `src/types/database.ts` regenerated from the worktree stack. Full `pnpm test:full` result: see the PR description.

## Not done / next

- No browser pass against a real signed-in checkout (the worktree has no `.env.local`); the SQL + server-action guards cover the money, the dev preview page covers the summary layout.
- Admin can edit `buyer_marketplace_pct` / `_min_minor` / `buyer_min_order_total_minor` / `seller_fault_fee_*` only by SQL for now (no admin UI).
- Original-method refunds for crypto rails would need BTCPay pull payments; today they fail to the cap and reverse (admin alert).

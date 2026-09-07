# Handoff — Admin Payout Queue

**For the chat that owns `src/app/(admin)/**`.** Written by the accounts-fixes
chat, which built the seller side but does not touch admin paths.

Branch with the seller-side work: `accounts-fixes` (uncommitted at time of
writing). Nothing here is started.

---

## What already exists — do not rebuild

| Piece | Location | State |
|---|---|---|
| `withdrawal_requests` table | production | Live. Full state machine columns. |
| `withdrawal_methods` table | production | Live. Migration below adds `coin`/`chain`. |
| `approveWithdrawalRequest()` | `src/lib/actions/withdrawals.ts` | Implemented |
| `rejectWithdrawalRequest()` | `src/lib/actions/withdrawals.ts` | Implemented |
| `getAllWithdrawalRequests(filters?)` | `src/lib/actions/withdrawals.ts` | Implemented |
| Ledger hold / release | `withdrawal_debit` RPC, idempotent | Implemented |

**Approve/reject are already wired — but only from
`src/app/(admin)/admin/active-sellers/[id]/SellerDetailClient.tsx`.** An admin
has to know *which seller* to open before they can action a payout, so there is
no way to see the queue. That is the gap.

**Pending migration (not yet applied):**
`supabase/migrations/20260905120000_crypto_payout_methods.sql` — adds
`coin`, `chain`, `coming_soon`, `sort_order` to `withdrawal_methods`, adds the
three USDT rails, switches fiat to coming-soon, drops the minimum to $50.
Apply before building against `coin`/`chain`.

---

## What to build

A dedicated queue at `/admin/payouts`, linked from the admin sidebar, with a
pending-count badge.

### The list

Default filter `status = pending`, oldest first (a payout queue is a FIFO
obligation, not a feed). Filters for every status, plus search by seller.

Per row: seller (avatar + shop name, linking to their admin detail page),
amount, fee, **net amount**, method (`display_name`), truncated address with
copy button, age of request.

Flag rows visually where:
- the seller's KYC is not approved
- this is the seller's **first** payout
- the destination address has **never been used by this seller before**
- the amount is a large multiple of their lifetime volume

### The review drawer

Opens from a row; must show enough to approve safely without leaving:

- **Seller** — username, shop name, KYC status, `seller_tier`, account age,
  lifetime sales, completed orders, dispute/refund count, active restrictions
- **This request** — amount, fee breakdown, net, method, coin, chain, full
  address, requested-at
- **Address history** — previous payouts to this same address, and any *other*
  addresses this seller has used
- **Balance** — available vs held, and confirmation the hold for this request
  exists in the ledger
- **Actions** — Approve, Reject (reason required), plus a free-text
  `admin_notes`

### Marking sent

`approveWithdrawalRequest` moves the row out of `pending`. The crypto is sent
**manually, off-platform**. So the queue needs a second step to record what
actually happened:

- `transaction_hash` — required to reach `completed`
- optionally the network fee actually paid

Do not let a request sit in `approved` with no hash; that is the state where
money has left and nothing records it. Consider a distinct "Approved — awaiting
tx hash" view.

---

## Things that will bite you

1. **`status` has seven values** — `pending | approved | processing |
   completed | rejected | cancelled | failed`. `failed` is real: a send can
   bounce. Rejecting must release the ledger hold; confirm
   `rejectWithdrawalRequest` does this before trusting it.

2. **Idempotency.** The hold uses key `withdrawal:<requestId>`. Any release or
   re-debit must be idempotent too, or a double-click refunds twice.

3. **Approving is irreversible in practice.** Crypto sends have no chargeback.
   Put a typed confirmation on approve showing coin, chain and the *full*
   address — not truncated. Truncated addresses are exactly how wrong-address
   sends get approved.

4. **The seller side now validates coin↔network and address format**
   (`src/lib/crypto/address-validation.ts`, 18 passing tests). **Older rows
   predate it.** One live row reads
   `{ method_name: "btc", network: "Trc20", wallet_address: "$sejsjsjwjh28383" }`
   — Bitcoin over Tron, junk address. It is `cancelled`, so harmless, but the
   admin UI should re-run `validatePayoutAddress()` on display and show a loud
   warning rather than assuming stored rows are safe.

5. **One open request per seller** is now enforced on create. Do not assume it
   held historically.

6. **Do not show the raw `payment_details` blob.** Render only `wallet_address`,
   `network`, `coin`. Older rows may carry other keys.

---

## Suggested order

1. Apply the migration
2. List + filters (read-only) — useful immediately, zero risk
3. Review drawer with seller context
4. Approve/reject wired to the existing actions
5. Tx-hash capture → `completed`
6. Risk flags

Steps 1–2 alone remove the "open every seller to find payouts" problem.

---

## Open questions for the owner

- Does rejection notify the seller by email? There is a shared email shell at
  `src/lib/email/shell.ts`.
- Should approval require 2FA re-auth for the admin? Supabase MFA is available
  (`src/lib/actions/mfa.ts`), and this is the highest-value action in the panel.
- Any per-day or per-request cap before a second approver is needed?

# Refund of the buyer service fee — research + recommendation (2026-10-16)

Owner's question: "I ordered a $70 item, the fee was $4.97, I paid $74.97. I should be refunded $70, right?"

Research only. No code, SQL or copy has changed. Not legal advice: section 4 lists what a UK consumer-law lawyer should confirm.

> **Owner decision (2026-10-16):** Eldorado model — every refund lands in the Wallet as store credit for the item price ($70); the full amount ($74.97) goes back to the card on request from the Wallet, by order. Plus a "Cancel – Not Delivered" button with a 1-hour seller grace. Plan: `docs/superpowers/plans/2026-10-16-not-delivered-cancel-and-refund-rule.md` (not built; two migrations flagged).

## 1. What happens today (code on `origin/main` 1aa2e800)

The $4.97 is one "Service fee" from `buyer_fee_quote`: marketplace part max($0.30, 2% × $70) = **$1.40**, plus processing on $71.40 at the 5% minimum = **$3.57**. (5% is the floor every method pays; crypto and the low-cost e-wallets land on it. I could not read the real order: prod reads were blocked in this session.)

Every refund goes through one SQL leg, `order_refund_buyer_credit` (migration `20260930005449_refund_policy.sql`), reached from `order_refund_to_wallet` / `order_cancel_return_wallet` with a `p_fault`.

| Case | Who sets it | Back to buyer (Store Balance) | DropMarket keeps | Seller |
|---|---|---|---|---|
| Seller cancels: out of stock / can't deliver / price error / other | seller (`sellerCancelFault`) | **$74.97** | $0 | fault recorded; 5th in 7 days → seller charged $4.97 |
| Dispute decided for the buyer (`refund_full`) | admin | **$74.97** | $0 | same |
| Buyer's cancel request approved, **Seller At Fault ticked** | admin | **$74.97** | $0 | same |
| Sold out before payment landed / provider refund webhook | system (`platform`) | **$74.97** | $0 | — |
| Buyer cancels a paid order before delivery | buyer (`cancelOrder`, `fault: 'buyer'`) | **$70.00** | **$4.97** (`fee_kept:<order>`) | — |
| Seller cancels with reason "buyer requested" / "buyer unresponsive" | seller | **$70.00** | **$4.97** | — |
| Buyer's cancel request approved, **Seller At Fault not ticked (the default)** | admin | **$70.00** | **$4.97** | — |
| Partial dispute refund | admin | the amount the admin sets | — | — |
| Unpaid (pending) order cancelled | anyone | nothing was charged; any store credit used comes back in full | — | — |

Refund to the original payment method (migration `20260930010758_refund_to_source.sql`): never automatic. The buyer asks from the order page while the credit is unspent; an admin approves; the **credited amount** ($74.97 or $70) goes back through the provider. DropMarket pays Payssion $1/€1 per refund and does not get the original processing cost back. QR Ph, Maya and paysafecard cannot be refunded. **Crypto cannot be refunded this way at all**: BTCPay has no `refund()`, so the request fails after 6 attempts and the credit goes back to the Store Balance (admin alert). Refund Policy 9.1 promises a crypto cash refund to an address the buyer gives, but today that is a manual job.

**So, to the owner's question:** today you get $70 back only if *you* cancelled (or asked to cancel and the admin left "Seller At Fault" off). If the seller failed, you get $74.97.

## 2. What other marketplaces do (own help/terms pages, read 2026-10-15)

| Site | Buyer fee | Seller at fault: fee back? | Buyer cancels before delivery: fee back? | Where the refund goes |
|---|---|---|---|---|
| **Eldorado.gg** | 8% + $0.30 payment fee | No on a balance refund ($9.43 paid → $8.45 back); **yes** if refunded to the card | same rule (no separate buyer cancel) | Eldorado balance; original method on request, fee included |
| **GameBoost** | processing fee | help doc says yes (store credit "full amount"); its ToS §9.5.1 says minus processor fees — contradicts itself | not stated | store credit first; original method on request |
| **G2G** | "order handling fee" | No — handling fee not refunded once the order is verified | No (same exclusion) | buyer **chooses**: store credit (instant) or original method |
| **PlayerAuctions** | 4.99% + $0.39 service fee | not stated (protection add-on is not refunded) | not stated | **original method by default** |
| **U7Buy** | card 3.6% + $0.50 | No — "non-refundable in all scenarios" | No | buyer **chooses**: balance or original method |
| **Z2U** | "Service Charge" per method | No on credits; its cancel FAQ says the fee comes back only via original-method refund | No on credits | Z2U credits; original method on request, bank fee deducted |
| **eBay UK** | Buyer Protection fee (£0.10 + 7%/4%/2% tiers) | **Yes, in full**; pro-rated on partial refunds | **Yes, in full** (cancellation named) | original method |
| **Vinted** | Buyer Protection / "Vinted fee" | **Yes** | **Yes** (item + shipping + Vinted fee) | original method / Vinted balance if paid that way |
| **Etsy** | no buyer fee | full refund incl. tax + shipping | not stated | not stated (may use Etsy Credit) |

Sources: Eldorado [refund policy](https://intercom.help/eldoradogg/en/articles/8409020-refund-and-return-policy), [fees](https://intercom.help/eldoradogg/en/articles/8409025-fees) · GameBoost [terms](https://gameboost.com/legal/terms), [store credits doc](https://docs.gameboost.com/documentation/for-customers/payment-and-refund/store-credits-and-gb-coins.md) · G2G [terms](https://www.g2g.com/terms-of-service), [refunds](https://support.g2g.com/support/solutions/articles/5000804285-how-does-g2g-handle-refunds-returns-and-cancellations-smoothly-), [handling fee](https://support.g2g.com/support/solutions/articles/5000826294-what-is-the-order-handling-fee-) · PlayerAuctions [payments](https://support.playerauctions.com/hc/en-us/articles/4402166845849-PlayerAuctions-Buyer-Payments), [refund](https://support.playerauctions.com/hc/en-us/articles/115009688707-PlayerAuctions-Refund) · U7Buy [refund promise §10](https://www.u7buy.com/refund-promise), [fees](https://www.u7buy.com/help-center/buying/payment-processing-fees) · Z2U [refund policy §7–9](https://www.z2u.com/faq/Buying-RefundPolicy.html), [cancel FAQ](https://www.z2u.com/faq/how-to-cancel-an-order-and-initiate-a-refund-on-z2u.html) · eBay UK [Buyer Protection](https://www.ebay.co.uk/help/buying/paying-items/buyer-protection?id=5594) · Vinted [refunds](https://www.vinted.com/help/750-receiving-a-refund), [policy](https://www.vinted.com/help/465) (US pages; UK pages sit behind a bot check) · Etsy [buyer policy](https://www.etsy.com/legal/buyers/). Eldorado and eBay were re-checked by hand.

**Pattern:** the offshore game-item sites (G2G, U7Buy, Z2U, Eldorado-to-balance) keep the fee even when the seller fails. The UK/EU-regulated C2C sites (eBay UK, Vinted) give it back in full on any cancel or seller failure and pay to the original method. Eldorado and Z2U both give the fee back when the refund goes to the card — the card route is where keeping it stops working. Nobody charges a separate cancel fee. **DropMarket is a UK company, so the eBay/Vinted rules are the ones that apply to us.**

## 3. The legal floor (UK company, UK/EU consumers)

Sources: CCR 2013 [reg 34](https://www.legislation.gov.uk/uksi/2013/3134/regulation/34), [36](https://www.legislation.gov.uk/uksi/2013/3134/regulation/36), [37](https://www.legislation.gov.uk/uksi/2013/3134/regulation/37), [38](https://www.legislation.gov.uk/uksi/2013/3134/regulation/38), [40](https://www.legislation.gov.uk/uksi/2013/3134/regulation/40) · CRA 2015 [s.45](https://www.legislation.gov.uk/ukpga/2015/15/section/45), [s.56](https://www.legislation.gov.uk/ukpga/2015/15/section/56), [s.57](https://www.legislation.gov.uk/ukpga/2015/15/section/57), [Sch 2](https://www.legislation.gov.uk/ukpga/2015/15/schedule/2/part/1) · DMCC Act 2024 [s.226](https://www.legislation.gov.uk/ukpga/2024/13/section/226), [s.230](https://www.legislation.gov.uk/ukpga/2024/13/section/230) + [CMA209 price transparency](https://www.gov.uk/government/publications/price-transparency-cma209/providing-clear-and-accurate-information-about-prices-summary) · Payment Surcharges Regs 2012 [reg 4](https://www.legislation.gov.uk/uksi/2012/3110/regulation/4), [6A](https://www.legislation.gov.uk/uksi/2012/3110/regulation/6A) · EU [CRD Art 13/16](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:52021XC1229(04)), [Digital Content Directive Art 16/18](https://www.legislation.gov.uk/eudr/2019/770/article/18) · [Visa Core Rules Apr 2026](https://usa.visa.com/dam/VCOM/download/about-visa/visa-rules-public.pdf) §1.5.4.14 (ID# 0003076), §5.4.2.5, dispute conditions 13.1/13.3/13.7.

**Not allowed to keep the fee:**
- **Seller or platform at fault** (non-delivery, not as described, dispute lost). The fee is the price of our own service, and that service failed (CRA ss.56–57). We already refund in full. ✅
- **Buyer cancels before delivery starts, seller is a business (trader).** The buyer still has the 14-day cancellation right. Before delivery starts, nothing has removed it (reg 37 only ends it once supply starts with consent). Reg 34 says reimburse **"all payments"** within 14 days. The only deductions allowed are for goods. Our fee contract is "ancillary" and ends at no cost to the buyer (reg 38). ❌ Today we keep $4.97.
- **Buyer cancels before delivery, seller is a private person.** The item sale is outside consumer law. Our own service to the buyer is still a trader-to-consumer distance service. Reg 36(4) would let us keep a proportionate share only if checkout recorded the buyer's express request to start early plus an acknowledgement. **Our checkout records neither** (it only says "By paying you agree to our Terms of Service and Refund Policy"), so reg 36(6) says the buyer owes nothing. ❌ Weak today.
- **Calling a refund "full" while keeping the fee.** That is a misleading action under the DMCC Act, with CMA fines up to 10% of turnover. Our copy only says "full" where we do refund in full. ✅

**Refund route:**
- A statutory refund (CCR reg 34(7), CRA s.45/56, EU DCD Art 18) must go back the **same way the buyer paid, unless the buyer expressly agreed otherwise**, and with **no fee** to the buyer. Consent can't come from a default or a pre-ticked option (reg 40). Store credit as the automatic default is therefore not enough on its own. The safe pattern is an active choice at refund time, which is what G2G and U7Buy do.
- **Cards (when a card rail goes live):** Visa requires the refund to go to the same card. In-store credit is allowed only in narrow cases such as no receipt, a returned gift or a declined credit. In the Europe Region, cancellations of distance sales fall under dispute condition 13.7 because of the 14-day right, so a kept fee can be charged back.

**Likely allowed (with proper disclosure):**
- Keeping a fee after the cancellation right has lawfully ended, for example once delivery started with the buyer's recorded consent. After delivery the buyer's route is a dispute anyway.
- Store credit when the buyer picks it.
- Keeping part of our own service fee on a private-seller cancel, only with the checkout acknowledgement in place and only after a lawyer confirms it (see §6).

## 4. Recommendation

One rule a buyer can understand: **no item, no fee.**

| Case ($70 item + $4.97 fee = $74.97) | Today | Recommended |
|---|---|---|
| Seller cancels / doesn't deliver / not as described / dispute won | $74.97 | **$74.97** (no change) |
| Sold out before payment / platform error | $74.97 | **$74.97** (no change) |
| Buyer changes their mind before delivery starts | $70.00 | **$74.97** |
| Buyer asks to cancel; admin approves | $70.00 or $74.97 (checkbox) | **$74.97** either way; the checkbox only decides whether it counts against the seller |
| Partial refund (e.g. half the item was wrong) | admin picks any amount | admin refunds half the item **and half the fee** ($37.49), like eBay and Visa |
| After delivery, buyer just changed their mind | no refund | no refund (no change) |

**Where it goes:** the buyer picks, with nothing pre-selected:
- "Store Balance — instant, spend it with no service fee"
- "Original payment method — 5 to 10 business days"

For a cancel the buyer starts, the choice sits in the cancel dialog. For a refund the seller or admin starts, it lands as store credit with a one-tap "Send it to my payment method instead" (lawyer to confirm that counts as express agreement). We absorb Payssion's $1/€1: the law says the buyer can't be charged for the refund.

**What it costs:** on each change-of-mind cancel we give up $4.97 and lose what the provider already took on $71.40. That is about $1.80–$3.60 on the Payssion e-wallets and close to zero on self-hosted crypto. If the buyer asks for the card route, add $1. Repeat cancellers are handled with an account flag, not by keeping fees. Most buyers pick instant credit at G2G and U7Buy, and the money stays on the site.

**If you still want to keep something on change-of-mind cancels**, the only defensible version is to keep the **processing part only ($3.57 → buyer gets $71.40)**. It applies only when the seller is a private person, only after the checkout acknowledgement is built, and only after a lawyer signs off. With a business seller, everything goes back regardless.

## 5. What changes if you say yes (nothing written yet)

**⚠️ One money migration — flagged before writing** (CLAUDE.md money seams; worktree per change; tests on the worktree stack):
- `CREATE OR REPLACE public.order_refund_buyer_credit` (from `20260930005449_refund_policy.sql` §3). On the `buyer` fault it credits the full total and posts no `fee_kept:<order>` journal. The signature is unchanged, so the live build keeps working. `buyer` stays a valid fault value: it now means "full refund, nothing counted against the seller". No backfill. Orders that already have a `fee_kept` row keep their old wording, because the order page reads that ledger key.
- **Optional, your call:** a one-off goodwill re-credit of fees kept on buyer cancels since 2026-09-30. I couldn't count them: prod reads were blocked in this session.
- **Tests:** `refund-policy.guard.integration.test.ts` (buyer-fault expectations), `checkout-fix-a.guard.integration.test.ts` (buyer-cancel credit + copy), `wallet-rows.test.ts`, `order-rewards.guard.integration.test.ts` (check), plus the money-atomicity fault points.

**Code / copy:**
- `src/app/(admin)/admin/orders/components/cancellation-requests-table.tsx`: the "Seller At Fault" text changes to "counts against the seller's record; the buyer gets everything back either way". Default the box to on when the order is past its delivery time.
- `src/app/account/orders/[orderId]/_RequestCancelModal.tsx`: drop "The service fee is only refunded when the seller is at fault."
- `src/app/account/orders/[orderId]/_OrderDetailsCard.tsx` (lines ~372, ~382): the fee-kept sentences stay for old orders only.
- `src/lib/actions/orders.ts` (cancel comment), `src/lib/actions/order-cancellation.ts` (fault doc), `src/lib/fees/index.ts` (§5 comment).
- **Legal** (`src/lib/legal/documents.ts`): Terms 9.4 (drop "the item price where you cancel a paid Order yourself"), Refund Policy 7.1 (one rule: everything back on any cancel before delivery) and 7.2 (the buyer's choice of route). Fees and Seller Agreement 2.2 need no change.
- **Emails / notifications:** cancel and approval messages already print the credited amount (`orders.ts:629`, `order-cancellation.ts:453`), so nothing changes. The refund email (`src/lib/email/index.ts:666`) is fine.

**Second PR (refund route choice):** cancel dialog choice plus a one-tap "send to payment method" on refunded orders. This uses the existing `refund_to_source_request` with no new money RPC. Admin approval becomes a fraud check inside 14 days, not a discretion. Copy: Refund Policy 7.1/7.2, Buyer Terms 6.1.

## 6. Found on the way (separate decisions)

1. **Checkout does not capture the cancellation-right consent the legal docs say it does** (Terms 10.2, Refund Policy 8.2 claim "captured at checkout"). Without an explicit "start delivery now, I understand I lose my 14-day right once delivery starts" plus a confirmation email (CCR reg 37), a buyer from a business seller can cancel within 14 days **even after delivery** and owe nothing. This is a bigger risk than the fee. The fix: one checkbox line at checkout, a timestamp on the order (migration) and a line in the order email. The wording is yours to set.
2. **Crypto refunds to the original method can't work.** BTCPay has no refund API, so the request fails after 6 tries and the money goes back to the Store Balance. Refund Policy 9.1 promises a refund to an address the buyer gives, and that needs a manual admin step.
3. **Method-dependent processing fee = a payment surcharge in law.** For UK consumer cards and e-wallets, where both payment providers are UK-based, any such fee is banned (Surcharges Regs reg 6A). Elsewhere it is capped at our actual cost (reg 4). The 5% floor sits above cost on cheaper rails (QRIS 2.5%, Trustly 2.5% + €0.35). Payssion's location may keep many rails outside reg 6A; a lawyer must say. Visa's rules also require any surcharge to be refunded in the Europe Region.
4. **Headline price.** The DMCC Act and CMA209 §§4.4 and 5.22 say mandatory per-order fees belong in the price shown. Listings show $70 while checkout adds at least the $1.40 marketplace part. Ask the lawyer whether listings need a "from $71.40" style total.

## 7. Questions for a UK consumer-law lawyer

1. Is our service fee a separate CCR service contract with the buyer? When is it "fully performed"?
2. Under the commercial-agent model, is the fee a payment the business seller "received" (reg 34) or "paid for the digital content" (CRA s.45)?
3. Could DropMarket be treated as the seller in private-seller sales if the buyer isn't clearly told the seller is private (EU *Wathelet* C-149/15; Omnibus Art 6a for EU buyers)?
4. Are game items and accounts "digital content", and is boosting a "service"?
5. Does credit-first plus one-tap "send to payment method" count as "expressly agreed" to store credit? Does holding a Store Balance raise e-money questions?
6. Where are Payssion and the crypto rail "located" for the surcharge rules? Does the reg 4 cost cap apply to crypto?
7. Do we direct business at EU countries (Rome I Art 6)? Which Art 6a marketplace disclosures do we owe?
8. Does the listing price need to include the mandatory marketplace part (DMCC s.230)?

## 8. Scenario: 20-minute listing, seller offline (added 2026-10-16)

$70 item + $4.97 fee. The seller misses the 20 minutes. Each site's own help pages, read 2026-10-15/16.

| Site | Buyer's move once time is up | Who decides, how fast | Money back | Where | Seller hit |
|---|---|---|---|---|---|
| **DropMarket today** | Open Dispute only (no cancel on paid orders; Request Cancellation only for 6 h+ listings) | seller 12 h → evidence 24 h → admin, normally ≤3 days | **$74.97** | Store Balance; card on request + admin OK | fault logged; from the 5th in 7 days the seller pays the $4.97 |
| Eldorado | dispute right away (12 h wait for instant accounts / gift cards) | Resolution Team, up to 3 days | $70 to balance / $74.97 to card | balance | offers removed if often late |
| GameBoost | ticket/dispute; seller 12 h to reply, 24 h to fix | staff discretion | unclear (ToS: credit minus processor fees) | balance; card via support ≤7 days | penalties, listings removed |
| igitems | claim after 15 min, or cancel with no reason | auto-escalates if seller silent 24 h | **full, no fee kept**; +5% bonus (max $10) if taken as balance | buyer picks within 5 days (default: card) | not stated |
| U7Buy | instant cancel if the seller hasn't started; else dispute | "usually instant" / seller 72 h | $70 (fee kept) | balance 3–6 h / card 24–48 h | penalty |
| G2G | cancellation request | seller 48 h or auto-cancel | $70 (handling fee kept) | buyer picks | may penalise; seller may compensate buyer |
| Z2U | system auto-cancels 24 h past the promised time | automatic | $70 (fee kept) | credits; card on request | fines, suspension |
| PlayerAuctions | one-click penalty-free cancel | refund next business day | "full refund" (fee not stated) | 1–5 business days | 10% of the refund taken from the seller + offers hidden |

Sources: Eldorado [dispute process](https://support.eldorado.gg/en/articles/8409016-what-is-the-process-of-order-dispute), [seller rules](https://intercom.help/eldoradogg/en/articles/8408997-seller-rules) · GameBoost [refund policy](https://docs.gameboost.com/documentation/for-customers/payment-and-refund/gameboost-refund-and-warranty-policy), [disputes](https://docs.gameboost.com/documentation/for-customers/order-help/order-disputes-how-they-work), [seller guide](https://docs.gameboost.com/documentation/for-sellers/seller-guide) · igitems [refund policy](https://igitems.com/legal/refund-policy) (re-checked by hand) · U7Buy [order cycle](https://www.u7buy.com/help-center/buying/order-cycle), [refund promise](https://www.u7buy.com/refund-promise) · G2G [delivery window](https://support.g2g.com/support/solutions/articles/5000750032), [refunds](https://help.g2g.com/en/articles/10000057-how-does-g2g-handle-refunds-returns-and-cancellations-smoothly) · Z2U [order status](https://www.z2u.com/faq/Order-Status.html), [seller rules](https://www.z2u.com/faq/seller-rules.html) · PlayerAuctions [cancel](https://support.playerauctions.com/hc/en-us/articles/115009859168), [refund penalty](https://support.playerauctions.com/hc/en-us/articles/115012912887) (403 on re-check; agent-read only).

**Takeaways:** no site refunds the instant time runs out, but most let the buyer get out fast (one click or auto-cancel). For a clear no-show we are the slowest: dispute only, up to ~4 days. On money we are already at the generous end ($74.97, like igitems). Our seller penalty is the softest; PlayerAuctions takes 10% every time.

/**
 * V46 — Legal & policy pack (footer documents).
 *
 * 17 cross-referenced documents for DropMarket Ltd (England & Wales).
 * MODEL C (12 Jul 2026): Terms of Use, Refund & Dispute Policy, and
 * SafeDrop Protection Terms are published to the disclosed-commercial-
 * agent model (PSRs 2017 Sch 1 Pt 2 para 2(b)): DropMarket collects
 * payment as each Seller's agent; buyer-facing copy promises OUTCOMES,
 * never custody. Buyer Terms, Seller Agency Agreement, AML have been
 * minimally aligned; the remaining docs await the Model C redraft
 * round. Content is data here; rendering lives in
 * components/legal/LegalPage.tsx + one thin route per doc.
 *
 * ⚠️ NOT LEGAL ADVICE — solicitor sign-off pending on the pack (see
 * per-doc comments + the Solicitor Enquiry Pack). Fee schedule (Fees)
 * is published and in force.
 *
 * 4 Oct 2026 (v1.1, owner instruction "fix all the legal content gaps,
 * remove CoinGate"): CoinGate / Tazapay removed; processors named from
 * ./payment-processors; every protection, dispute and payout number
 * rendered from ./protection-windows (the values the money layer
 * enforces); Buyer Terms restructured; Privacy, Cookie, Complaints, IP,
 * Prohibited, Acceptable Use, Trust & Safety, Company Information filled
 * out. Per-document dates: `lastUpdated` / `version` on each changed doc.
 */

import {
  CANCEL_REQUEST_MIN_DELIVERY_HOURS,
  COMPLETION_HOLD_HOURS,
  DISPUTE_DECISION_DAYS,
  DISPUTE_EVIDENCE_HOURS,
  DISPUTE_WINDOW_DAYS,
  PAYOUT_DETAILS_FREEZE_HOURS,
  PROTECTION_WINDOW_HOURS as WIN,
  SELLER_RESPONSE_HOURS,
  WITHDRAWAL_MIN_ACCOUNT_AGE_DAYS,
  hoursAsDays,
} from './protection-windows'
import {
  PAYMENT_PROCESSORS,
  PAYMENT_PROCESSORS_PHRASE,
  PAYOUT_PROVIDERS,
} from './payment-processors'

export const LEGAL_ENTITY = {
  name: 'DropMarket Ltd',
  companyNumber: '17309867',
  /** Identical to the site footer (src/components/footer.tsx). */
  registeredOffice: '82A James Carter Road, Mildenhall, Suffolk, IP28 7DE, United Kingdom',
  vatNumber: '287522083',
  phone: '+44 7476 562276',
  jurisdiction: 'England & Wales',
  website: 'dropmarket.gg',
  email: 'support@dropmarket.gg',
  effectiveDate: '1 July 2026',
  /** Default for documents that carry no `lastUpdated` of their own. */
  lastUpdated: '12 July 2026',
  /** Default for documents that carry no `version` of their own. */
  version: 'v1.0',
} as const

/** The date every document changed in the 4 Oct 2026 round carries. */
const UPDATED_2026_10_04 = { lastUpdated: '4 October 2026', version: 'v1.1' } as const

/** Privacy + Cookie Policy: optional analytics cookies and session replay, only on Accept. */
const UPDATED_2026_10_10 = { lastUpdated: '10 October 2026', version: 'v1.3' } as const

export type LegalBlock =
  | { t: 'p'; md: string }
  | { t: 'ul'; items: string[] }
  | { t: 'table'; head: string[]; rows: string[][] }
  | { t: 'note'; md: string }

export interface LegalSection {
  h?: string
  blocks: LegalBlock[]
}

export interface LegalDoc {
  slug: string
  title: string
  /** Meta description + card blurb. */
  description: string
  /** This document's own "Last Updated" (falls back to LEGAL_ENTITY.lastUpdated). */
  lastUpdated?: string
  /** This document's own version label (falls back to LEGAL_ENTITY.version). */
  version?: string
  sections: LegalSection[]
}

const p = (md: string): LegalBlock => ({ t: 'p', md })
const ul = (items: string[]): LegalBlock => ({ t: 'ul', items })
const note = (md: string): LegalBlock => ({ t: 'note', md })

// ── Shared facts, written once ─────────────────────────────────────────────
const E = LEGAL_ENTITY
/** "DropMarket Ltd · Company No. … · Registered in England & Wales · <office> · support@…" */
const ENTITY_LINE = `${E.name} · Company No. ${E.companyNumber} · Registered in ${E.jurisdiction} · ${E.registeredOffice} · ${E.email}`
const DISPUTE_WINDOW = `${DISPUTE_WINDOW_DAYS} days from delivery`
const HOLD = `${COMPLETION_HOLD_HOURS} hours`
/** Contact section shared by the documents that carry one in their own text. */
const contactSection = (h: string, lead: string): LegalSection => ({
  h,
  blocks: [
    p(`${lead} Email **${E.email}** or call **${E.phone}**. You can also write to us at our registered office: ${E.registeredOffice}.`),
    p(`${E.name} · Company No. ${E.companyNumber} · Registered in ${E.jurisdiction} · VAT No. ${E.vatNumber}.`),
  ],
})
/** Governing-law section matching Terms of Use Section 20. */
const governingLawSection = (h: string, what: string): LegalSection => ({
  h,
  blocks: [
    p(
      `${what} and any non-contractual obligations arising from them are governed by the law of **England and Wales**. The **courts of England and Wales** have exclusive jurisdiction, except that a consumer resident elsewhere keeps any mandatory protections and jurisdiction rights of their local law. Nothing here requires arbitration.`,
    ),
  ],
})

/** "processes payments …" → "Processes payments …" for table cells. */
const sentence = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1)
/** The personal data each payment provider receives (Privacy Policy recipients table). */
const PROCESSOR_DATA: Record<string, string> = {
  Payssion: 'Order reference, amount, payment method, and the details you enter on Payssion’s payment page',
  'BTCPay Server': 'Order reference, amount, payment address and transaction ID',
  Payoneer: 'Payoneer account email and payout amount',
}

// ── Reporting, statements of reasons, appeals, Online Safety Act ─────────────
// Shared by the Prohibited Items, Acceptable Use and Trust & Safety documents
// so the three never describe the process differently.
const reportingSection = (h: string): LegalSection => ({
  h,
  blocks: [
    p(
      `Report a listing, user, review or message that you think breaks our rules or the law by emailing **${E.email}** with the link to it and a short description of the problem. For an active Order you can also raise it in the Order chat or open a dispute. If you think a child is at risk, contact the police first; child sexual abuse material can also be reported to the Internet Watch Foundation (iwf.org.uk).`,
    ),
    p(
      'We review reports as soon as we can and act quickly on anything that appears illegal. Depending on what we find, we may remove or hide content, restrict features, suspend or close an account, withhold payouts under the Seller Agency Agreement, or report the matter to the authorities where the law requires it.',
    ),
  ],
})

const appealsSection = (h: string): LegalSection => ({
  h,
  blocks: [
    p(
      '**Statement of reasons.** When we remove or restrict a listing or other content, or suspend, restrict or close an account, we tell the user affected what we did, which rule it relates to and the main facts we relied on, unless the law or the need to prevent fraud stops us.',
    ),
    p(
      `**Appeals.** You can appeal within **14 days** by replying to that message or emailing ${E.email} with “Appeal” in the subject and anything you want us to consider. Where we can, someone who was not involved in the original decision reviews the appeal, and we aim to reply within **7 days**. If we got it wrong, we reverse the decision. Appealing does not stop you using the Complaints process or your legal rights.`,
    ),
  ],
})

const onlineSafetySection = (h: string): LegalSection => ({
  h,
  blocks: [
    p(
      'Users can post listings, reviews and messages that other users see, so DropMarket is a user-to-user service under the **Online Safety Act 2023**. The Platform is for adults: you must be 18 or over to use it (Terms of Use, Section 3). We take proportionate steps against illegal content: identity verification before anyone can sell, review of new sellers’ listings, the reporting route in this document, and prompt removal of illegal content once we know about it. Content harmful to children is prohibited.',
    ),
  ],
})

export const LEGAL_DOCS: LegalDoc[] = [
  /**
   * Terms of Use — v2 Model C (12 Jul 2026): DropMarket collects payment
   * as each Seller's disclosed commercial agent (PSRs 2017 Sch 1 Pt 2
   * para 2(b)); buyer's debt discharged on DropMarket's receipt; store
   * credit = credit note. Supersedes the Model A draft.
   *
   * Editorial deviations from the source drafts (log for solicitor):
   * §1.4 discharge aligned verbatim to §9.2 ("when … in full"); §2.1
   * adds a "Payment Processor"/"PSP" alias the drafts use undefined;
   * "(to source)" dropped from §12.2 + refunds Stage 5 outcomes (store-
   * credit default); refunds §2/§3 window text follows the 5/7/14 risk-
   * band decision; refunds §7 restructured store-credit-first with the
   * credit-note characterisation harmonised to Terms §9.4, "does not
   * hold buyer balances" scoped to CASH balances, "or issue cash
   * refunds itself" removed; refunds §9.1 scoped to cash refunds;
   * refunds §10.1 "protects your purchase" (not "payment"); safedrop
   * §2.1 "in full" scoped to store credit; safedrop §5.2 draft pinpoint
   * "Art. 4" dropped pending the final agreement's numbering;
   * "release to Seller" → "payout to the Seller" in dispute outcomes;
   * "Seller Agreement" unified to "Seller Agency Agreement" pack-wide.
   * Pending solicitor sign-off (tracked here, stripped from the public
   * text): agent-of-payee/discharge wording vs PSP contract + PSRs 2017
   * (§1.4, §9.2); publisher-personnel clause enforceability (§3.5); P2B
   * statement-of-reasons duties (§5.5); unclaimed PSP balances (§5.7);
   * HMRC/OECD platform-reporting scope (§6.5); trademark referential-use
   * (§8.3); DMCC facilitator duties (§10.3); VAT deemed-supplier / OSS
   * (§11.3); recovery clause vs unfair-terms rules (§12.3); content-
   * licence scope (§13.2); liability cap reasonableness (§16.3);
   * indemnity vs consumers (§17); PSP third-party rights (§21.6).
   */
  {
    slug: 'terms',
    title: 'Terms of Use',
    description:
      'The master terms governing use of the DropMarket platform: our venue role, SafeDrop Protection and payments, eligibility, accounts, consumer rights, liability, and governing law.',
    ...UPDATED_2026_10_04,
    sections: [
      {
        h: '1. Introduction',
        blocks: [
          p(
            '1.1. DropMarket Ltd (“**DropMarket**”, “we”, “us”, “our”) operates the online marketplace available at dropmarket.gg and any associated applications and services (the “**Platform**”). The Platform is a **venue** that allows independent sellers to offer, sell, and deliver gaming virtual goods and services to independent buyers.',
          ),
          p(
            '1.2. **DropMarket is not a party to any sale.** We do not own, create, buy, sell, or supply any item listed on the Platform. Each contract of sale is formed **directly between the Buyer and the Seller**. DropMarket provides the Platform, the SafeDrop payment-protection flow, dispute-handling tools, and related services — nothing in these Terms makes DropMarket the seller, reseller, or supplier of any Listing.',
          ),
          p(
            '1.3. These Terms of Use, together with the policies listed in Section 2.2 (the “**Policies**”), form the agreement between you and DropMarket governing your access to and use of the Platform (together, the “**Agreement**”). By accessing or using the Platform you agree to this Agreement. If you do not agree, do not use the Platform.',
          ),
          p(
            '1.4. **Summary of how money moves (binding description).** Each sale on the Platform is a contract between the Buyer and the Seller. DropMarket acts as the **disclosed commercial agent of the Seller**, appointed under the Seller Agency Agreement, with authority to conclude the sale and to **collect the Buyer’s payment in the name of and on behalf of the Seller**. The Buyer’s payment obligation to the Seller is **fully discharged when DropMarket (or its payment processor on DropMarket’s behalf) receives the Buyer’s payment in full**. From that moment, the amounts collected (less DropMarket’s fees and any amounts due under the Policies) are owed by DropMarket to the Seller as their agent, recorded in the Seller Balance, and paid out per Section 9. **DropMarket is not a bank, e-money issuer, or authorised payment institution; it collects payments solely as commercial agent of Sellers under the agency exclusion in the Payment Services Regulations 2017.**',
          ),
          p(
            `1.5. The payment methods available to you are shown at checkout, and ${PAYMENT_PROCESSORS_PHRASE} are listed on the Fees & Charges page. Payments processed by a third-party provider are also subject to that provider’s own terms, which you accept when transacting.`,
          ),
        ],
      },
      {
        h: '2. Definitions and Policies',
        blocks: [
          p('2.1. In this Agreement (and identically in every Policy):'),
          ul([
            '“**Buyer**” — a User purchasing or seeking to purchase through the Platform.',
            '“**Seller**” — a User listing or selling through the Platform.',
            '“**User**” / “you” — any person accessing the Platform, registered or not.',
            '“**Account**” — a registered user account on the Platform.',
            '“**Listing**” — an offer to sell an item or service published by a Seller.',
            '“**Order**” — a Buyer’s purchase of a Listing.',
            '“**SafeDrop**” — DropMarket’s protection programme described in the SafeDrop Protection Terms: a refund guarantee for non-delivery or material misdescription, and the payout-timing rules applied to Sellers.',
            '“**Payment Processor**” / “**PSP**” — the providers through which DropMarket accepts payments and executes payouts, as listed on the Fees & Charges page (including, for crypto payments, the BTCPay Server software DropMarket hosts itself).',
            '“**Protection Window**” — the per-category period after delivery at the end of which an Order the Buyer has not confirmed or disputed completes automatically (see the SafeDrop Protection Terms).',
            `“**Dispute Window**” — the **${DISPUTE_WINDOW}** in which a Buyer may open a dispute, whether or not the Order has completed (see the Refund & Dispute Policy).`,
            '“**Seller Balance**” — the record in a Seller’s Account of amounts DropMarket owes the Seller as their commercial agent following completed sales, net of fees and deductions under the Policies.',
            '“**Platform Content**” — all content made available by DropMarket on the Platform (text, graphics, logos, software, data, and design).',
          ]),
          p(
            '2.2. The following Policies are incorporated into this Agreement: Buyer Terms; Seller Agency Agreement; SafeDrop Protection Terms; Refund & Dispute Policy; Prohibited Items & Conduct Policy; Acceptable Use Policy; Privacy Policy; Cookie Policy; AML/KYC Policy; Risk Disclosure; Fees & Charges; Chargeback & Payment Policy; Complaints Handling / Dispute Resolution; IP / Copyright / Notice-and-Takedown Policy; Community Guidelines / Trust & Safety. If a Policy conflicts with these Terms, the more specific document prevails for its subject matter.',
          ),
        ],
      },
      {
        h: '3. Eligibility',
        blocks: [
          p(
            '3.1. You may use the Platform only if you are **at least 18 years old**, capable of forming a binding contract, and not barred from using the Platform under the laws of any applicable jurisdiction (including UK, EU, UN, and US sanctions and export-control regimes).',
          ),
          p(
            '3.2. If you use the Platform on behalf of a company or other legal entity, you warrant that you are authorised to bind that entity, and “you” includes that entity.',
          ),
          p(
            '3.3. You warrant that you are acting on your own behalf, control your own login credentials, and are not acting for an undisclosed third party.',
          ),
          p(
            '3.4. We may verify age, identity, and eligibility at any time (see Section 6 and the AML/KYC Policy) and may refuse, suspend, or close any Account at our reasonable discretion where eligibility is not established.',
          ),
          p(
            '3.5. No employee, contractor, agent, or affiliate of any game publisher or developer acting in that capacity is authorised to access the Platform or use the Services for investigation, enforcement, or evidence-gathering purposes without our prior written consent.',
          ),
        ],
      },
      {
        h: '4. Changes to these Terms',
        blocks: [
          p(
            '4.1. We may amend this Agreement or any Policy. For material changes we will give **at least 14 days’ prior notice** by posting the amended version on the Platform and notifying registered Users via the Platform or email. Changes take effect on the stated effective date; your continued use after that date constitutes acceptance. Changes do not apply retroactively to Orders already placed.',
          ),
          p(
            '4.2. Where a change is required by law, by a PSP, or for security reasons, it may take effect immediately with notice as soon as practicable.',
          ),
        ],
      },
      {
        h: '5. Accounts',
        blocks: [
          p(
            '5.1. **Registration.** You must provide true, accurate, current, and complete information and keep it updated. We may refuse registration at our reasonable discretion.',
          ),
          p(
            '5.2. **Single Account.** Each User may hold **one** Account unless we authorise otherwise in writing. Creating, controlling, or using multiple Accounts — including after suspension — is prohibited. We may suspend or terminate duplicate Accounts and may withhold instruction of payouts pending investigation of duplicate-account activity.',
          ),
          p(
            '5.3. **No Account transfer.** Accounts, usernames, and credentials are personal to you and may not be sold, gifted, assigned, or otherwise transferred. **The prohibition on account sale applies to DropMarket Accounts, not to game accounts lawfully listed for sale on the Platform in accordance with the Prohibited Items & Conduct Policy.**',
          ),
          p(
            '5.4. **Security.** You are responsible for the confidentiality of your credentials and all activity under your Account, including enabling two-factor authentication where offered. Notify support@dropmarket.gg immediately of any suspected compromise. We are not liable for losses caused by your failure to secure your Account.',
          ),
          p(
            '5.5. **Suspension and termination by us.** We may suspend, restrict, or terminate an Account, remove Listings, or withhold instruction of payouts where, acting reasonably: (a) you breach this Agreement or any Policy; (b) we suspect fraud, money laundering, sanctions exposure, or other unlawful activity; (c) information you provided appears untrue or incomplete; (d) required verification is not completed; (e) your conduct creates risk or possible legal exposure for DropMarket, our payment processors, or other Users; or (f) we are required to do so by law, a regulator, or a PSP. Where we suspend or terminate a Seller who is a business user, we will provide a statement of reasons unless prohibited by law or legitimate fraud-prevention grounds.',
          ),
          p(
            '5.6. **Closing your Account.** You may close your Account at any time via support. Closure does not affect open Orders, accrued fees, pending disputes, or amounts recoverable under Section 12, and Sections that by their nature survive (including 12, 15–20) continue to apply. Any remaining Seller Balance will be paid out via the PSP after completion of open Orders and any required verification.',
          ),
          p(
            '5.7. **Inactive Accounts.** If an Account shows no login activity for 12 consecutive months, we may designate it inactive, delist its Listings, and contact the User to arrange payout of any remaining Seller Balance. We do not charge inactivity fees.',
          ),
        ],
      },
      {
        h: '6. Verification, AML and sanctions',
        blocks: [
          p(
            '6.1. Sellers must complete identity verification (KYC) **before listing or receiving payouts**, and Buyers may be required to verify identity for higher-value Orders or where risk indicators arise, per the AML/KYC Policy.',
          ),
          p(
            '6.2. We (and our payment processors) may require additional documentation at any time — including government ID, proof of address, source of funds, and proof of ownership of the payout account — and may delay Listings, releases, or payout instructions pending verification.',
          ),
          p(
            '6.3. Payouts may only be made to a bank account, payment account, or wallet **registered in the name of the Account holder**. Payouts to third parties are prohibited.',
          ),
          p(
            '6.4. We screen Users and transactions against applicable sanctions lists (UN, UK OFSI, EU, US OFAC) and will refuse, block, or report transactions as required by law. We may disclose information to law enforcement, regulators, and the PSP as described in the Privacy Policy, and may file reports required under the Proceeds of Crime Act 2002 and related legislation without notice to you.',
          ),
          p(
            '6.5. We may report Seller information and transaction data to HMRC (and equivalent authorities) under the UK’s digital-platform reporting rules implementing the OECD Model Reporting Rules for Digital Platforms.',
          ),
        ],
      },
      {
        h: '7. The marketplace; transaction risks',
        blocks: [
          p(
            '7.1. **Venue only.** We provide the Platform and tools; we do not manufacture, inspect, warehouse, or deliver items, and we do not guarantee the existence, quality, safety, legality, or description of any Listing, the truth or accuracy of Seller content, the ability of any Seller to deliver, or the ability of any Buyer to pay.',
          ),
          p(
            '7.2. **Binding sales.** When a Buyer places an Order for a Listing, a binding contract of sale is formed between Buyer and Seller on the terms of the Listing and this Agreement. Sellers must deliver promptly per the Seller Agency Agreement; Buyers should confirm delivery or raise a dispute within the Protection Window, and may raise a dispute at any time until the Dispute Window closes.',
          ),
          p(
            '7.3. **Transaction risks.** Buying and selling gaming virtual goods involves risks, including: misdescribed or defective items; delayed or failed delivery; account recovery by a prior owner; publisher enforcement (Section 8); fraud by counterparties acting under false pretences; and price volatility of crypto assets. **You use the Platform at your own risk and assume these transaction risks**, subject always to your statutory rights (Section 10) and the protections in the SafeDrop Protection Terms and Refund & Dispute Policy.',
          ),
          p(
            '7.4. We use verification, SafeDrop Protection, ratings, and monitoring to reduce these risks, but we cannot eliminate them and do not underwrite them, except as expressly stated in the Refund & Dispute Policy.',
          ),
        ],
      },
      {
        h: '8. Publisher EULAs, RMT risk, and non-affiliation',
        blocks: [
          p(
            '8.1. Items traded on the Platform are virtual goods, currencies, accounts, and services connected to third-party games. **Buying or selling such assets, or transferring account access, may breach the End-User Licence Agreement or terms of service of the relevant game publisher** and may result in warnings, suspension, permanent ban, or confiscation/clawback of items or accounts by the publisher.',
          ),
          p(
            '8.2. **You accept this risk.** DropMarket is not liable for publisher enforcement actions, and such actions do not, by themselves, entitle a Buyer to a refund outside the terms of the Refund & Dispute Policy (see the Risk Disclosure for details, including category-specific warranty terms).',
          ),
          p(
            '8.3. **Non-affiliation.** DropMarket is not affiliated, associated, authorised, endorsed by, or in any way officially connected with any game publisher or developer, including (without limitation) Roblox Corporation; Epic Games, Inc.; Riot Games, Inc.; Valve Corporation; Activision Blizzard, Inc.; Electronic Arts Inc.; Take-Two Interactive Software, Inc.; miHoYo/HoYoverse; Mojang AB; Supercell Oy; Jagex Ltd; Tencent; and Krafton, Inc. All game names, marks, emblems, and images are trademarks or registered trademarks of their respective owners. References to games and in-game items on the Platform are made solely to **identify the goods and services to which Listings relate**, consistent with honest practices in industrial and commercial matters (see s.11(2) Trade Marks Act 1994 and, for EEA users, Article 14 of Regulation (EU) 2017/1001). Official publisher websites are linked from the game category pages.',
          ),
        ],
      },
      {
        h: '9. SafeDrop, payments, payouts and crypto',
        blocks: [
          p(
            '9.1. **All Orders are covered by SafeDrop.** The Buyer pays DropMarket (as the Seller’s commercial agent) at checkout via the available payment methods. If an Order is not delivered or is not as described, the Buyer is entitled to a refund per the Refund & Dispute Policy. When sale proceeds become available to the Seller is set out in Section 9.3 and the SafeDrop Protection Terms.',
          ),
          p(
            '9.2. **Discharge.** The Buyer’s payment obligation to the Seller is fully discharged when DropMarket (or its payment processor on DropMarket’s behalf) receives the Buyer’s payment in full.',
          ),
          p(
            `9.3. **Seller Balance and payouts.** When an Order completes (the Buyer confirms delivery, the Protection Window closes without a dispute, or a dispute resolves in the Seller’s favour), the net sale proceeds become available in the Seller Balance: **${HOLD} after the Buyer confirms**, or at once when the Order completes automatically. A dispute opened within the Dispute Window sets that Order’s amount aside until it is decided. The Seller may then request a payout from their Account; payouts are made to the Seller’s verified payout method. A minimum payout amount and payout fees apply (see Fees & Charges). We may delay payouts pending verification, dispute resolution, chargeback exposure, or as required by law. Seller Balances do not accrue interest.`,
          ),
          p(
            '9.4. **Refunds.** Approved refunds are issued as store credit to your Store Balance by default (in full where the Seller or the Platform is at fault; the item price where you cancel a paid Order yourself), with refunds to the original payment method available on request from the order page, per the Refund & Dispute Policy. Store credit is a non-transferable credit against future purchases on the Platform, spendable with no service fee, and is not redeemable for cash except as set out in that Policy; it is not e-money and no interest accrues.',
          ),
          p(
            '9.5. **Crypto payments.** Where crypto/stablecoin payment is offered, it is received through BTCPay Server, payment software DropMarket hosts itself; the price is set in US dollars and the crypto amount to send is shown at checkout. **Crypto transactions are irreversible once broadcast**; send exactly the displayed amount on the displayed network within the displayed time. Underpayments, overpayments, wrong-network transfers, and late payments are handled per the payment page’s instructions and the Refund & Dispute Policy; recovery may be impossible and reasonable recovery costs may be deducted where recovery is attempted.',
          ),
          p(
            '9.6. **Card payments.** Card payments (where available) are subject to card-scheme rules, including chargeback rules — see the Chargeback & Payment Policy.',
          ),
          p(
            '9.7. **Currency and pricing.** Prices are displayed in the currency shown at checkout, **inclusive of all mandatory charges** (Digital Markets, Competition and Consumers Act 2024 — no drip pricing). Applicable Buyer service fees and payment fees are itemised before payment.',
          ),
        ],
      },
      {
        h: '10. Consumer rights',
        blocks: [
          p(
            '10.1. Nothing in this Agreement excludes or limits rights that cannot lawfully be excluded. Where a Seller acts as a **trader** and a Buyer as a **consumer**, the Consumer Rights Act 2015 and the Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013 apply between them: digital content must be of satisfactory quality, fit for purpose, and as described.',
          ),
          p(
            '10.2. The 14-day distance-cancellation right for digital content is **lost once supply begins with the consumer’s express consent and acknowledgement** that the right is lost (CCR Reg. 37); this consent is captured at checkout before delivery begins.',
          ),
          p(
            '10.3. Sellers are responsible for identifying themselves accurately as trader or private seller. The Platform displays this status on Listings.',
          ),
        ],
      },
      {
        h: '11. Fees and taxes',
        blocks: [
          p(
            '11.1. DropMarket charges Sellers a commission on completed sales and may charge Buyers service and payment-processing fees, all as published on the Fees & Charges page. Fee changes follow Section 4 (14 days’ notice; promotions excepted).',
          ),
          p(
            '11.2. Fees are deducted before amounts are credited to the Seller Balance, or charged at checkout, as described on the Fees & Charges page.',
          ),
          p(
            '11.3. **Taxes.** Users are responsible for their own taxes arising from their sales and purchases, including income tax and VAT where applicable. Listing prices must be stated on an all-taxes-included basis. DropMarket does not provide tax advice and is not responsible for Users’ tax obligations, except any collection or reporting obligation imposed on DropMarket by law (see 6.5).',
          ),
        ],
      },
      {
        h: '12. User disputes, reversals, and recovery',
        blocks: [
          p(
            '12.1. **Platform-first dispute process.** Buyer–Seller disputes about an Order must be raised through the Platform’s dispute process within the Dispute Window (see Refund & Dispute Policy). We investigate transaction disputes (delivery, description) — we do not adjudicate the general quality, safety, or legality of items beyond their Listing description. Users agree to cooperate with the process and not to escalate to external channels in respect of an open, pending dispute before the process completes; this does not limit any User’s legal rights, statutory complaints channels, or recourse to the courts or to their payment provider.',
          ),
          p(
            '12.2. **Outcomes.** Dispute outcomes may include: payout to the Seller; full or partial refund to Buyer; redelivery; or cancellation. Outcomes are implemented through our payment systems.',
          ),
          p(
            '12.3. **Recovery from Sellers.** Where a refund, chargeback, reversal, or fine imposed by a card scheme or payment processor results from a Seller’s failure to deliver, misdescription, breach of this Agreement, or fraud, the Seller must reimburse the amounts involved (including payment-processor/chargeback fees reasonably incurred). The Seller authorises us to debit or withhold such amounts from the Seller Balance or future release entitlements; if the Balance is insufficient, the Seller must pay the shortfall within 14 days of notice, failing which we may use lawful collection mechanisms. Recoverable amounts are limited to **amounts we or our payment processors actually incur or are liable for, plus reasonable administrative costs** — we do not levy punitive fines.',
          ),
          p(
            '12.4. **Buyer misuse.** Raising chargebacks on delivered, confirmed Orders instead of using the dispute process, false dispute claims, and friendly fraud may lead to Account suspension and recovery of amounts owed — see the Chargeback & Payment Policy. This does not limit a consumer’s statutory or card-scheme rights in respect of genuine claims.',
          ),
        ],
      },
      {
        h: '13. Listings and User content',
        blocks: [
          p(
            '13.1. Sellers must list accurately and completely: item, scope, delivery method and time, region restrictions, and all material terms. Listings must be placed in the correct category with accurate tags and must be removed promptly when no longer available. Specific listing warranties (including for game accounts: personal, non-commercial origin; no cheat/hack-derived goods; no stolen or fraudulently obtained items) are set out in the Seller Agency Agreement and Prohibited Items & Conduct Policy.',
          ),
          p(
            '13.2. You retain ownership of content you post. You grant DropMarket a worldwide, non-exclusive, royalty-free, sublicensable licence to host, display, reproduce, and use your content for operating, promoting, and improving the Platform, for as long as the content remains on the Platform plus a reasonable archival period, and you waive moral rights to the extent permitted by law solely for those purposes.',
          ),
          p(
            '13.3. You warrant that your content and Listings do not infringe third-party rights and that you have all rights needed to sell what you list. We may remove any content or Listing at our reasonable discretion, including content we consider unlawful, infringing, misleading, or in breach of the Policies.',
          ),
          p(
            '13.4. Prohibited content and conduct are set out in the Prohibited Items & Conduct Policy and Acceptable Use Policy, and include (without limitation): fraudulent or deceptive listings; stolen or unlawfully obtained goods; cheat/hack software and cheat-derived goods or services; malware; harassment or hate; spam; sanctions-violating transactions; content harmful to minors; and circumvention of Platform fees (off-platform dealing to avoid fees).',
          ),
        ],
      },
      {
        h: '14. Platform IP and licence to you',
        blocks: [
          p(
            '14.1. The Platform and Platform Content are owned by or licensed to DropMarket and protected by intellectual-property laws. “DropMarket”, “SafeDrop”, and associated logos are our marks; unauthorised use is prohibited.',
          ),
          p(
            '14.2. We grant you a limited, revocable, non-exclusive, non-transferable licence to access and use the Platform for its intended purpose. You must not: copy, scrape, or systematically retrieve Platform Content (including via robots or AI training pipelines) without written permission; reverse engineer the Platform except as permitted by law; interfere with its integrity or security; or use it to build or support a competing service.',
          ),
        ],
      },
      {
        h: '15. Disclaimers',
        blocks: [
          p(
            '15.1. The Platform and Services are provided **“as is” and “as available”**. To the fullest extent permitted by law, we exclude all implied warranties, conditions, and terms, including satisfactory quality, fitness for purpose, and non-infringement, in respect of the Platform itself — this does not affect the Buyer–Seller statutory rights described in Section 10.',
          ),
          p(
            '15.2. We do not warrant uninterrupted or error-free operation, that defects will be corrected, or that the Platform is free of viruses or harmful components. We may modify, suspend, or discontinue features with reasonable notice where practicable; we are not liable for the consequences of doing so except as required by law.',
          ),
          p(
            '15.3. Third-party content and third-party websites linked from the Platform are the responsibility of their providers; we do not endorse and are not liable for them.',
          ),
        ],
      },
      {
        h: '16. Limitation of liability',
        blocks: [
          p(
            '16.1. **Nothing in this Agreement excludes or limits our liability** for death or personal injury caused by our negligence; fraud or fraudulent misrepresentation; or any liability that cannot lawfully be excluded or limited (including, where applicable, under the Consumer Rights Act 2015).',
          ),
          p(
            '16.2. Subject to 16.1, we are not liable for: acts or omissions of Buyers or Sellers; publisher enforcement (bans, clawbacks, confiscations); account recovery by prior owners; PSP outages or delays outside our control; loss of profits, revenue, business, goodwill, or data; or indirect, special, incidental, or consequential loss.',
          ),
          p(
            '16.3. Subject to 16.1, **our total aggregate liability** to you arising out of or in connection with any Order is limited to the greater of (a) the total fees and commission DropMarket actually earned on that Order, and (b) £100; and our total aggregate liability for all claims in any 12-month period is limited to the total fees you paid to DropMarket in that period.',
          ),
        ],
      },
      {
        h: '17. Indemnity',
        blocks: [
          p(
            'To the extent permitted by law, you will indemnify DropMarket, its directors, officers, and employees against losses, liabilities, and reasonable costs (including legal costs) arising from: your breach of this Agreement or the Policies; your Listings, content, items, or services; your infringement of third-party rights; or your violation of law — except to the extent caused by our own breach or negligence. We may assume the defence of any matter subject to this indemnity, in which case you will cooperate. This clause does not apply to consumers to the extent it would be unenforceable against them.',
          ),
        ],
      },
      {
        h: '18. Force majeure',
        blocks: [
          p(
            'We are not liable for delay or failure caused by events beyond our reasonable control, including internet or telecommunications failures, power failures, PSP or banking-system outages, blockchain network congestion or forks, strikes, civil disturbance, war, governmental action, or acts of God.',
          ),
        ],
      },
      {
        h: '19. Notices',
        blocks: [
          p(
            'We may give notice via the Platform, your Account, or the email address on your Account; notice is deemed received when posted to the Platform or sent by email. You may give notice to support@dropmarket.gg or by post to our registered office. Keep your contact details current.',
          ),
        ],
      },
      {
        h: '20. Governing law and jurisdiction',
        blocks: [
          p(
            '20.1. This Agreement and any non-contractual obligations arising from it are governed by the law of **England and Wales**.',
          ),
          p(
            '20.2. The **courts of England and Wales** have exclusive jurisdiction, except that a consumer resident in another country retains any mandatory protections and jurisdiction rights of their local law.',
          ),
          p(
            '20.3. Complaints are handled first through the Complaints Handling / Dispute Resolution policy. Nothing in this Agreement requires arbitration, prevents you from bringing individual claims, or waives collective rights that cannot lawfully be waived.',
          ),
        ],
      },
      {
        h: '21. Miscellaneous',
        blocks: [
          p(
            '21.1. **Entire agreement.** This Agreement (including the Policies) is the entire agreement between you and DropMarket regarding the Platform and supersedes prior agreements on the same subject.',
          ),
          p('21.2. **Severability.** If any provision is held invalid, it is severed and the remainder continues in force.'),
          p('21.3. **No waiver.** Failure to enforce a provision is not a waiver of it.'),
          p(
            '21.4. **Assignment.** You may not assign this Agreement. We may assign it to an affiliate or in connection with a merger, acquisition, or sale of assets, with notice to you.',
          ),
          p(
            '21.5. **Relationship.** Except for the limited payment-collection agency described in Sections 1.4 and 9.2, nothing creates any agency, partnership, joint venture, or employment relationship between you and DropMarket.',
          ),
          p(
            '21.6. **Third-party rights.** Except for the PSP (which may rely on Sections 1.4, 9, and 12), no third party has rights under the Contracts (Rights of Third Parties) Act 1999 to enforce this Agreement.',
          ),
          p('21.7. **Language.** These Terms are drafted in English; translations are provided for convenience only.'),
        ],
      },
      {
        h: '22. Contact',
        blocks: [
          p(
            ENTITY_LINE,
          ),
        ],
      },
    ],
  },

  /**
   * Buyer Terms — v1.1 (4 Oct 2026): numbered structure, governing law and
   * contact added; payout-timing sentence replaced by Order-state wording
   * (no-escrow rule: confirmation completes the ORDER, it is not a payment
   * event); dispute window aligned with order_dispute_open (7 days from
   * delivery, completed or not) and Refund & Dispute Policy Section 5.
   */
  {
    slug: 'buyer-terms',
    title: 'Buyer Terms',
    description:
      'How SafeDrop protects buyers: what is covered, what is not, protection and dispute windows, refunds, and how your statutory rights sit alongside the platform protection.',
    ...UPDATED_2026_10_04,
    sections: [
      {
        h: '1. About these Buyer Terms',
        blocks: [
          p(
            '1.1. These Buyer Terms apply whenever you buy on DropMarket. They form part of the Terms of Use and should be read with the SafeDrop Protection Terms and the Refund & Dispute Policy. Words with capitals (Order, Listing, Protection Window, Dispute Window) have the meanings given in the Terms of Use.',
          ),
          p(
            '1.2. Each purchase is a contract between you and the Seller. DropMarket runs the marketplace and acts as the Seller’s commercial agent to take your payment; your payment obligation to the Seller is complete when DropMarket receives your payment in full (Terms of Use, Section 1.4).',
          ),
        ],
      },
      {
        h: '2. SafeDrop Protection',
        blocks: [
          p(
            '2.1. Every Order is covered by **SafeDrop Protection** at no extra cost: if your Order is not delivered or is not as described, you get your money back (see the Refund & Dispute Policy).',
          ),
        ],
      },
      {
        h: '3. Checking and confirming your Order',
        blocks: [
          p(
            '3.1. When the Seller marks your Order delivered, inspect the item and either **Confirm Delivery** or open a dispute. Confirm Delivery when you have what you ordered: the Order is then complete.',
          ),
          p(
            `3.2. If you do neither, the Order completes automatically when the **Protection Window** for its category ends: ${hoursAsDays(WIN.currency)} for in-game currency, top-ups and gift cards, ${hoursAsDays(WIN.items)} for items, ${hoursAsDays(WIN.service)} after completion for boosting and coaching, and ${hoursAsDays(WIN.account)} for game accounts, each counted from delivery.`,
          ),
        ],
      },
      {
        h: '4. Disputes',
        blocks: [
          p(
            `4.1. You can open a dispute from the Order page for **${DISPUTE_WINDOW}**, even after the Order has completed (whether you confirmed it or it completed automatically). If the Seller has not delivered, you can open a dispute once the Seller’s stated delivery time has passed.`,
          ),
          p(
            '4.2. Disputes follow the process in the Refund & Dispute Policy, Section 5. Keep all communication and delivery inside the Order chat: it is the evidence your claim is decided on.',
          ),
        ],
      },
      {
        h: '5. What is covered and what is not',
        blocks: [
          ul([
            '**Covered:** non-delivery; items materially not as described; (for accounts) ban / recovery / clawback within the account Protection Window caused by the Seller or prior owner.',
            '**Not covered:** change of mind after supply has begun with your consent; misuse; losses caused by your own acts or failure to secure an account (change email/password, enable 2FA immediately).',
          ]),
        ],
      },
      {
        h: '6. Refunds',
        blocks: [
          p(
            '6.1. Approved refunds are credited to your Store Balance as store credit by default, and you can ask from the Order page for a refund to your original payment method instead. The amount, timing and conditions are set out in the Refund & Dispute Policy, Section 7.',
          ),
        ],
      },
      {
        h: '7. Chargebacks and friendly fraud',
        blocks: [
          p(
            '7.1. **Friendly-fraud:** initiating a chargeback while a SafeDrop dispute could resolve the matter, or after receiving the item, is a breach of these Terms and may lead to account termination and recovery of resulting losses. This does not affect your right to dispute a genuinely unauthorised payment with your bank or payment provider.',
          ),
        ],
      },
      {
        h: '8. Your statutory rights',
        blocks: [
          p(
            '8.1. **Your statutory rights** (where you are a consumer buying from a trader Seller) are unaffected and sit alongside SafeDrop. Nothing in these Buyer Terms limits rights that cannot lawfully be excluded.',
          ),
        ],
      },
      governingLawSection('9. Governing law and jurisdiction', '9.1. These Buyer Terms'),
      contactSection('10. Contact', '10.1. Questions about an Order: use the Order chat for an active Order, or contact us.'),
    ],
  },

  {
    slug: 'seller-agreement',
    title: 'Seller Agency Agreement',
    description:
      'The commercial agency agreement between DropMarket Ltd and the Seller: the disclosed commercial-agent appointment, authority to conclude sales and collect payment, fees, payouts, reserves and clawbacks, delivery, KYC/AML and sanctions, tax and platform reporting, confidentiality, anti-circumvention, and termination — under the PSRs 2017 commercial-agent exclusion.',
    sections: [
      {
        blocks: [
          p(
            '*This Seller Agency Agreement (the “**Agreement**”) is made between (1) **DropMarket Ltd**, a company registered in England & Wales (the “**Platform**” or “**DropMarket**”), and (2) the person who accepts these terms during onboarding (the “**Seller**”), together the “**Parties**”. Capitalised terms have the meaning given in the Terms of Use unless defined here. Governing law: England & Wales.*',
          ),
        ],
      },
      {
        h: '1. Appointment as disclosed commercial agent',
        blocks: [
          p(
            '1.1. The Seller appoints DropMarket as its **disclosed commercial agent**, and DropMarket accepts the appointment, to: (a) display and promote the Seller’s Listings; (b) **negotiate and conclude contracts of sale with Buyers in the name of and on behalf of the Seller so as to bind the Seller**; and (c) issue confirmations of transactions and **collect Buyers’ payments on the Seller’s behalf** — in each case without prior reference to the Seller.',
          ),
          p(
            '1.2. **DropMarket acts for the Seller only**, and never as agent for any Buyer, in respect of each contract of sale and each payment. The Seller acknowledges that DropMarket owes no agency duties to Buyers.',
          ),
          p(
            '1.3. **Discharge of debt on receipt.** The Buyer’s payment obligation to the Seller is **fully and finally discharged at the moment DropMarket (or its payment processor on DropMarket’s behalf) receives the Buyer’s payment in full**. From that moment the amounts collected, less DropMarket’s commission, fees and any deductions under the Policies, are owed by DropMarket to the Seller as its agent and are recorded in the Seller Balance. The Seller’s recourse for payment of the Seller Balance is against DropMarket only, and not against the Buyer.',
          ),
          p(
            '1.4. The contract of sale is formed directly between the Seller and the Buyer; the Seller is the actual seller and supplier of the item or service for all purposes, including consumer-law, quality and title obligations. DropMarket is not a party to that contract and assumes no liability under it.',
          ),
          p(
            '1.5. The Seller remains free to market and sell the same or similar digital goods and services through other channels. The appointment is **non-exclusive**.',
          ),
        ],
      },
      {
        h: '2. Seller obligations and warranties',
        blocks: [
          p('2.1. The Seller warrants and undertakes, for every Listing and sale, that:'),
          ul([
            'it holds full legal right, title and authority to sell the item, and good title will pass to the Buyer free of third-party rights;',
            'the item is genuine, lawfully obtained (not stolen, hacked, fraudulently obtained, or the subject of a chargeback), and accurately described;',
            'the Listing and the sale comply with all applicable laws and, to the extent applicable, with the relevant game publisher’s terms;',
            'it will deliver exactly as described, within the stated delivery time, and provide any proof of delivery reasonably required;',
            'for accounts, it will fully transfer ownership, **unbind all personal identifiers** (phone, linked socials, recovery email) and provide original registration details before delivery;',
            'it will communicate with Buyers only via Platform chat, and will comply with the Prohibited Items & Conduct Policy, the Acceptable Use Policy and the AML / KYC Policy.',
          ]),
          p(
            '2.2. **Cancellations the Seller causes.** Where an Order is cancelled because the Seller cannot or does not deliver (including a cancellation the Seller makes for stock, timing or pricing reasons, a cancellation approved because the Seller was unresponsive, and a dispute decided in the Buyer’s favour), the Buyer is refunded in full and the cancellation is recorded against the Seller. From the **fifth** such cancellation within any rolling **7-day** period, the Buyer’s fees on that Order are charged to the Seller’s Store Balance, which may go below zero until later sales cover it. A cancellation the Buyer asks for is not counted.',
          ),
        ],
      },
      {
        h: '3. Fees, commission and payouts',
        blocks: [
          p(
            '3.1. In consideration of the services, the Seller shall pay DropMarket **commission** on each contract of sale concluded on the Seller’s behalf, at the rate set out in Fees & Charges and notified to the Seller (the “**Commission Notice**”), which forms part of this Agreement. DropMarket may vary the rate on notice.',
          ),
          p(
            '3.2. **Commission becomes due to DropMarket as soon as, and to the extent that, DropMarket receives the price from the Buyer**, and DropMarket is authorised to **deduct its commission and fees from the collected funds** before crediting the Seller Balance.',
          ),
          p(
            '3.3. Net sale proceeds are credited to the Seller Balance in accordance with the Terms of Use and the SafeDrop Protection Terms. Payouts are made on the Seller’s request to the Seller’s verified payout method; DropMarket may set minimum payout thresholds and payout schedules.',
          ),
          p(
            '3.4. DropMarket may provide the Seller with a statement showing the number and value of contracts concluded on the Seller’s behalf and the commission applied.',
          ),
        ],
      },
      {
        h: '4. Reserves, clawbacks and set-off',
        blocks: [
          p(
            '4.1. Chargeback, reversal and fraud losses arising from a Seller’s transactions are borne by the **Seller**. DropMarket may withhold, hold a **rolling reserve**, set off, or claw back amounts from the Seller Balance, from future payout entitlements, or by direct recovery, to cover refunds, chargebacks, reversals, fines, scheme fees, or losses arising from the Seller’s transactions, breach or fraud.',
          ),
          p(
            '4.2. Where a refund is due to a Buyer, DropMarket may process it as the Seller’s agent and recover the amount from the Seller under clause 4.1. If the Seller Balance is insufficient, the Seller shall pay the shortfall within 14 days of notice.',
          ),
        ],
      },
      {
        h: '5. KYC, AML and sanctions',
        blocks: [
          p(
            '5.1. Before listing or receiving any payout, the Seller must complete identity verification (KYC, and business verification where applicable) via DropMarket’s provider, and pass sanctions, PEP and adverse-media screening. DropMarket may re-verify at any time and may suspend Listings or withhold payout pending verification.',
          ),
          p(
            '5.2. The Seller warrants it is not subject to, nor owned or controlled by any person subject to, applicable sanctions (including UK, EU, UN and OFAC), and is not located in a sanctioned territory. DropMarket may freeze, suspend or terminate on a sanctions or AML concern.',
          ),
        ],
      },
      {
        h: '6. Tax and platform reporting',
        blocks: [
          p(
            '6.1. The **Seller is solely responsible** for determining, invoicing (where required), reporting and paying all taxes (including VAT/sales tax) arising from the Seller’s sales, and shall inform DropMarket of its tax residency and status via the KYC questionnaire and of any change. All sums under this Agreement are inclusive of any applicable tax payable by the Seller.',
          ),
          p(
            '6.2. If a tax authority enforces payment of the Seller’s tax, or imposes a fine on DropMarket, based on the Seller’s sales, DropMarket may report to the Seller and **recover those sums from amounts collected on the Seller’s behalf**.',
          ),
          p(
            '6.3. **Digital-platform reporting (DAC7 / UK rules).** DropMarket is a reporting platform operator under the UK’s digital-platform reporting rules (OECD Model Reporting Rules; rules in force from 1 January 2024, annual report to HMRC due 31 January following the reportable period). The Seller shall provide the identity, tax-identification and other information DropMarket must collect, verify and report, and DropMarket will make the reported information available to the Seller.',
          ),
        ],
      },
      {
        h: '7. Confidentiality and data protection',
        blocks: [
          p(
            '7.1. Each Party shall keep confidential all non-public data and documents obtained in performing this Agreement, and treat them as business secrets, both during and after the term.',
          ),
          p(
            '7.2. Personal data provided in connection with this Agreement is processed in accordance with DropMarket’s Privacy Policy and applicable UK data-protection law (UK GDPR / Data Protection Act 2018).',
          ),
        ],
      },
      {
        h: '8. Anti-circumvention and non-solicitation',
        blocks: [
          p(
            '8.1. The Seller shall not solicit, or transact off-Platform with, Buyers introduced to it directly or indirectly through DropMarket or its platforms. If the Seller, after such introduction, concludes any sale or similar arrangement with a Buyer so as to bypass DropMarket, the Seller is in material breach, and DropMarket may exercise its remedies under clause 9.',
          ),
        ],
      },
      {
        h: '9. Suspension, breach and termination',
        blocks: [
          p(
            '9.1. On a breach of this Agreement or the Policies (including a prohibited action, an anti-circumvention breach, or suspected fraud, AML or sanctions concern), DropMarket may, at its reasonable discretion and in proportion to the breach: (i) suspend Listings or the Seller’s account; (ii) **withhold or block payouts** pending investigation for a reasonable period; (iii) terminate this Agreement; and/or (iv) recover from the Seller Balance or future entitlements any amounts DropMarket or its payment processors actually incur or are liable for, plus reasonable administrative costs. DropMarket does not levy punitive fines.',
          ),
          p(
            '9.2. Either Party may terminate this Agreement on notice. On termination, contracts already concluded on the Seller’s behalf, funds in transit, reserves and clawback rights are handled in accordance with clauses 3 and 4; and the clauses on fees, refunds, chargebacks, reserves, tax, confidentiality, indemnity and governing law survive.',
          ),
        ],
      },
      {
        h: '10. Indemnity and liability',
        blocks: [
          p(
            '10.1. The Seller indemnifies DropMarket against losses, claims and costs (including third-party and Buyer claims, chargebacks, IP claims, and taxes) arising from the Seller’s items, delivery, conduct, or breach of this Agreement.',
          ),
          p(
            '10.2. Nothing in this Agreement limits either Party’s liability where liability cannot lawfully be limited. Subject to that, and as between the Parties (business to business), each Party’s liability is limited as set out in the Terms of Use.',
          ),
        ],
      },
      {
        h: '11. General',
        blocks: [
          p(
            '11.1. The Seller’s Guide / Partner Rules and the Policies referenced in the Terms of Use are incorporated into and form an integral part of this Agreement, as updated from time to time. This Agreement is governed by the laws of England & Wales, and the Parties submit to the courts of England & Wales. If any provision is invalid, the remainder continues in effect. DropMarket may vary this Agreement on notice; continued use after the effective date constitutes acceptance.',
          ),
        ],
      },
    ],
  },
  // Seller Agency Agreement — pending solicitor sign-off (tracked here,
  // stripped from the public text and from what sellers e-sign on /founding,
  // owner 2026-10-08). Open points for counsel: the interaction of the
  // SafeDrop protection flow with the discharge-on-receipt / non-escrow
  // requirement of the PSRs-2017 commercial-agent exclusion; the express
  // "authority to conclude/bind" wording (clause 1.1); the Commercial Agents
  // (Council Directive) Regulations 1993 position for the "goods" legs; and
  // the consumer-facing cancellation/waiver mechanics in the Terms of Use.

  /**
   * SafeDrop Protection Terms — v1 Model C (12 Jul 2026).
   * Wording discipline: buyer-facing text promises OUTCOMES (refund,
   * money back); seller-facing text describes PAYOUT TIMING. No custody
   * verbs — this preserves the commercial-agent exclusion. Pending
   * solicitor sign-off: CRA-interaction clause (§6).
   * v1.1 (4 Oct 2026): windows rendered from ./protection-windows; the
   * non-delivery route matches the code (overdue dispute / cancellation
   * request, no automatic cancellation); warranty upgrades removed (none
   * are sold); governing law + contact added.
   */
  {
    slug: 'safedrop',
    title: 'SafeDrop Protection Terms',
    description:
      'How SafeDrop Protection works: what’s covered, category protection windows, how disputes are decided, and when sellers are paid out.',
    ...UPDATED_2026_10_04,
    sections: [
      {
        h: '1. What SafeDrop is',
        blocks: [
          p(
            '1.1. **SafeDrop is DropMarket’s protection programme.** Every Order placed on DropMarket is automatically covered: there is nothing to opt into, no extra step at checkout and no paid upgrade.',
          ),
          p(
            '1.2. **The promise, in one sentence:** *if your Order is not delivered, or is not as described in the Listing, you get your money back.*',
          ),
          p(
            '1.3. SafeDrop covers the transaction on the Platform. It applies to Orders placed and completed through DropMarket checkout and the Order chat. Deals taken off-platform are not covered — see Section 7.',
          ),
        ],
      },
      {
        h: '2. What SafeDrop covers',
        blocks: [
          p(
            `2.1. **Non-delivery.** You do not receive the item or service within the Seller’s stated delivery time. Once that time has passed you can open a dispute from the Order page; where the stated delivery time is ${CANCEL_REQUEST_MIN_DELIVERY_HOURS} hours or longer you can instead ask us to cancel the Order. If the Order is cancelled for non-delivery you are refunded in full, service fee included, as store credit to your Store Balance, or to your original payment method on request from the order page (see the Refund & Dispute Policy, Sections 7 and 12).`,
          ),
          p(
            '2.2. **Not as described.** The item or service you receive materially differs from the Listing (wrong item, missing described features, incorrect account attributes, undisclosed defects). Raise a dispute within the Dispute Window (Section 2.5) and, if upheld, you receive a full refund or redelivery.',
          ),
          p(
            '2.3. **Category Protection Windows.** The period after delivery in which you must confirm the Order or open a dispute:',
          ),
          {
            t: 'table',
            head: ['Category', 'Protection Window'],
            rows: [
              ['In-game currency', hoursAsDays(WIN.currency)],
              ['Items', hoursAsDays(WIN.items)],
              ['Top-ups / gift cards', hoursAsDays(WIN.top_up)],
              ['Boosting / coaching', `${hoursAsDays(WIN.service)} after completion`],
              ['Game accounts', hoursAsDays(WIN.account)],
            ],
          },
          p(
            '2.4. If you take no action before your Protection Window closes, the Order completes automatically. This does not affect your statutory rights (Section 6).',
          ),
          p(
            `2.5. **Dispute Window.** Whether or not the Order has completed, you can open a dispute for **${DISPUTE_WINDOW}**. Disputes opened after the Order completed set the Seller’s amount aside while we review; a refund decided in your favour is credited in full to your Store Balance.`,
          ),
        ],
      },
      {
        h: '3. What SafeDrop does not cover',
        blocks: [
          p(
            '3.1. Change of mind after delivery of a conforming item; in-game outcomes (bans, nerfs, publisher actions) occurring after delivery, except as set out in Section 3.2; buyer-caused changes (you changed the login, played on the account, or altered it before claiming non-conformity); items lost through your own credential sharing; and losses from off-platform dealing.',
          ),
          p(
            `3.2. **Publisher enforcement risk** (account recovery by a previous owner, publisher bans) is covered only where the Seller or a previous owner caused it and it happens within the account Protection Window (${hoursAsDays(WIN.account)} from delivery), per the Refund & Dispute Policy.`,
          ),
        ],
      },
      {
        h: '4. How disputes work (summary)',
        blocks: [
          p(
            `4.1. Contact the Seller in the Order chat → the Seller has ${SELLER_RESPONSE_HOURS} hours to resolve → escalate to a Dispute → both parties have **${DISPUTE_EVIDENCE_HOURS} hours** to submit evidence in the Order chat → our Resolution Team decides, normally within ${DISPUTE_DECISION_DAYS} days. Full process: Refund & Dispute Policy, Section 5.`,
          ),
          p(
            '4.2. Keep all communication and delivery inside the Order chat — it is the evidence record your claim is decided on.',
          ),
        ],
      },
      {
        h: '5. What SafeDrop means for Sellers',
        blocks: [
          p(
            `5.1. **Payout timing.** Sale proceeds are credited to your Seller Balance when the Buyer confirms delivery (withdrawable ${HOLD} later) or when the Protection Window closes (withdrawable at once), or when a dispute resolves in your favour. A dispute opened within the ${DISPUTE_WINDOW_DAYS}-day Dispute Window sets that Order’s amount aside until it is decided — see the Terms of Use, Section 9, and your Seller Agency Agreement.`,
          ),
          p(
            '5.2. **Guaranteed payout.** Once the Dispute Window has closed without an open or upheld claim, your payout entitlement for that Order is final, except in cases of fraud, chargeback recovery under the Seller Agency Agreement, or breach of the Prohibited Items Policy.',
          ),
          p(
            `5.3. Deliver within your stated time, document delivery in the Order chat, and respond to disputes within the ${SELLER_RESPONSE_HOURS}-hour grace period — these three habits resolve nearly all claims in the Seller’s favour where delivery genuinely occurred.`,
          ),
        ],
      },
      {
        h: '6. Your statutory rights',
        blocks: [
          p(
            'Nothing in these terms limits rights you have under the Consumer Rights Act 2015, the Consumer Contracts Regulations 2013, or other applicable consumer law. Where an item is faulty or misdescribed, statutory remedies (including full cash refund to your original payment method) remain available regardless of the Protection Window.',
          ),
        ],
      },
      {
        h: '7. Off-platform dealing',
        blocks: [
          p(
            'SafeDrop applies only to Orders transacted through DropMarket. Moving a deal off-platform (external payment, external delivery arrangements) voids protection for both parties and breaches the Terms. If a counterparty asks you to pay or deliver outside DropMarket, decline and report it.',
          ),
        ],
      },
      governingLawSection('8. Governing law and jurisdiction', '8.1. These SafeDrop Protection Terms'),
      contactSection('9. Contact', '9.1. Questions about SafeDrop or a claim: use the Order chat for an active Order, or contact us.'),
    ],
  },

  {
    slug: 'refunds',
    title: 'Refund & Dispute Policy',
    description:
      'When refunds apply, category protection windows, the five-stage dispute process, store-credit and cash refund mechanics, and how chargebacks are handled.',
    ...UPDATED_2026_10_04,
    sections: [
      {
        blocks: [
          p(
            'This policy forms part of, and should be read with, the Terms of Use, the SafeDrop Protection Terms, the Buyer Terms, the Seller Agency Agreement, and the Chargeback & Payment Policy. Where this policy conflicts with a Buyer’s non-excludable statutory rights, those statutory rights prevail.',
          ),
        ],
      },
      {
        h: '1. Overview',
        blocks: [
          p(
            '1.1. DropMarket is a **venue** connecting independent Buyers and Sellers of gaming digital goods and services. Each sale is a contract between the Buyer and the Seller; DropMarket is not the seller of any item.',
          ),
          p(
            '1.2. Every Order is covered by **SafeDrop Protection**: if your Order is not delivered, or is not as described, you are entitled to a refund under this Policy.',
          ),
          p(
            `1.3. **The default rule:** all sales are final once delivery is confirmed by the Buyer, **except** where the item is not delivered, is materially not as described (raised within the Dispute Window of ${DISPUTE_WINDOW}), or where the Buyer has non-excludable statutory rights (Consumer Rights Act 2015). This policy explains exactly when a refund applies, how to claim one, and how disputes are decided.`,
          ),
          p(
            `1.4. **For Sellers: when sale proceeds become available.** The Buyer’s payment discharges the Buyer’s debt to the Seller when DropMarket receives it (Terms of Use, Section 1.4). The net proceeds become available in the Seller Balance when the Order completes: **${HOLD} after the Buyer confirms delivery**, or **at once** when the Order completes automatically at the end of its Protection Window or a dispute is decided in the Seller’s favour. A dispute opened within the Dispute Window sets that Order’s amount aside until it is decided. Withdrawals then follow the Fees & Charges page: new sellers can withdraw ${WITHDRAWAL_MIN_ACCOUNT_AGE_DAYS} days after approval, and changing payout details pauses withdrawals for ${PAYOUT_DETAILS_FREEZE_HOURS} hours.`,
          ),
        ],
      },
      {
        h: '2. Protection Windows by category',
        blocks: [
          p(
            'Every Order carries a Protection Window: the period after delivery in which the Buyer should check the Order and confirm it or open a dispute. If the Buyer does neither, the Order completes automatically when the window ends. Windows differ by category because the risk profile differs.',
          ),
          {
            t: 'table',
            head: ['Category', 'Protection Window (confirm/dispute)', 'Notes'],
            rows: [
              [
                'Game accounts',
                `${hoursAsDays(WIN.account)} from delivery`,
                'Covers ban / recovery / clawback caused by the Seller or a prior owner.',
              ],
              [
                'In-game currency / gold',
                `${hoursAsDays(WIN.currency)} from delivery`,
                'Short window; value is consumed on use.',
              ],
              ['In-game items', `${hoursAsDays(WIN.items)} from delivery`, 'Non-delivery / not-as-described.'],
              ['Top-ups / gift cards', `${hoursAsDays(WIN.top_up)} from delivery`, 'Non-delivery / not-as-described.'],
              [
                'Boosting / coaching',
                `${hoursAsDays(WIN.service)} after the Seller marks the service complete`,
                'Performance/completion-based; protects deliverables, not competitive outcomes.',
              ],
              [
                'Digital game keys',
                `${hoursAsDays(WIN.gift_card)} from delivery`,
                'Non-refundable once revealed/redeemed unless invalid, duplicated, or not as described.',
              ],
            ],
          },
          p(
            `If a Buyer takes no action before the Window closes, the Order completes automatically. A dispute can still be opened for ${DISPUTE_WINDOW} (the **Dispute Window**); the Seller’s amount for that Order is set aside while it is reviewed — subject always to the statutory rights in Section 8.`,
          ),
        ],
      },
      {
        h: '3. When a refund IS available (eligibility)',
        blocks: [
          p(
            'An Order may be refunded, in full or in part, where one or more of the following applies and is raised within the Dispute Window (or, for non-delivery, once the Seller’s stated delivery time has passed):',
          ),
          ul([
            '**Non-delivery** — the Seller failed to deliver, or failed to deliver in full, within the guaranteed delivery time stated on the listing.',
            '**Not as described** — the item materially differs from the listing (for example: wrong quantity; account lacking stated content, rank, or full email access; item not matching the described specification).',
            '**Faulty or non-functional** — the item does not work as described (for example: an invalid or already-redeemed key; a top-up not credited; an account whose login credentials do not work at delivery).',
            '**Account access failure** — for account Orders, the Buyer was not given full access as described (for example: no email access, or the email cannot be changed to the Buyer’s own), provided the Buyer has not altered the account (see Section 4).',
            '**Account recovery / clawback** — for account Orders within the account’s Protection Window, the account is recovered, banned, or clawed back due to the Seller’s or a prior owner’s actions (not the Buyer’s).',
            '**Duplicate or erroneous charge** — a technical or payment error resulted in a duplicate or incorrect charge.',
            '**Statutory right** — the Buyer is a consumer with a non-excludable right to a remedy under the Consumer Rights Act 2015 or other applicable law (see Section 8).',
          ]),
          p(
            'Where a claim is upheld, the remedy may be a full refund, a partial refund, a redelivery/replacement, or a repair, depending on the nature of the issue and the Buyer’s statutory rights.',
          ),
        ],
      },
      {
        h: '4. When a refund is NOT available (exclusions)',
        blocks: [
          p(
            'To protect Sellers from abuse and to keep the marketplace fair, an Order is **not** eligible for refund where any of the following applies — except to the extent a Buyer has a non-excludable statutory right:',
          ),
          ul([
            '**Buyer’s remorse** — the Buyer changed their mind, made a mistaken purchase, or no longer wants the item, where the item was delivered as described.',
            '**Buyer negligence at checkout** — the Buyer provided wrong information (e.g. incorrect game, server, account name, region, or top-up ID) or failed to verify listing details before purchase.',
            '**Buyer-caused account changes** — for “not as described” account claims, the Buyer changed the login details, played on the account, made purchases on it, or otherwise altered it after delivery.',
            '**Buyer-caused ban** — the account was banned or restricted due to the Buyer’s own actions after delivery (e.g. botting, use of cheats, toxic behaviour, or contacting the game developer).',
            '**Window expired** — the issue was not raised within the Dispute Window and no statutory right applies.',
            '**Consumed / redeemed** — the item’s value was consumed or the key was revealed/redeemed, and no fault existed at the point of delivery.',
            '**Device/requirements** — the Buyer’s device or account does not meet the minimum requirements stated in the listing.',
            '**Off-platform dealing** — the transaction, or part of it, was conducted or completed outside DropMarket, defeating SafeDrop protection.',
            '**Prohibited-conduct forfeiture** — the claim arises from the Buyer’s own breach of the Terms of Use or Prohibited Items & Conduct Policy.',
          ]),
        ],
      },
      {
        h: '5. How to request a refund or raise a dispute (the process)',
        blocks: [
          p('We use a **platform-first, stage-based** process. Most issues resolve at Stage 1.'),
          p(
            '**Stage 1 — Contact the Seller (fastest route).** Raise the issue in the Order chat and give the Seller the chance to fix it (redeliver, correct, or agree a refund). Provide clear evidence at this stage (see Section 6). Many issues are resolved here without a formal dispute.',
          ),
          p(
            `**Stage 2 — Seller grace period.** The Seller has **${SELLER_RESPONSE_HOURS} hours** to respond and attempt a resolution before the matter can be escalated.`,
          ),
          p(
            `**Stage 3 — Raise a Dispute.** If the Seller is unresponsive, uncooperative, or the issue is unresolved, open a formal Dispute from the Order page. You can do this for **${DISPUTE_WINDOW}**, including after the Order has completed (whether you confirmed it or it completed automatically); for non-delivery, you can do it once the Seller’s stated delivery time has passed. While a Dispute is open the Order cannot complete, and if it had already completed, the Order’s amount is set aside in the Seller Balance until the Dispute is decided.`,
          ),
          p(
            `**Stage 4 — Evidence & cooperation window.** Both parties have **${DISPUTE_EVIDENCE_HOURS} hours** to submit evidence in the Order chat and cooperate toward a resolution. If a party fails to engage within the stated window, the Dispute may be decided against the non-responding party.`,
          ),
          p(
            `**Stage 5 — Decision by DropMarket.** Our Resolution Team reviews the evidence and makes a fair, final determination. Most Disputes are resolved within **${DISPUTE_DECISION_DAYS} days**. Outcomes may include: payout to the Seller; full or partial refund to the Buyer; redelivery; or cancellation. The outcome is implemented through our payment systems.`,
          ),
        ],
      },
      {
        h: '6. Evidence requirements',
        blocks: [
          p(
            'To assess a claim fairly, we may require the Buyer and/or Seller to provide evidence, which may include: order and delivery timestamps; screenshots or video of the item, account state, or error; login/delivery logs; proof of the described specification; and any communication relevant to the Order. Claims raised without sufficient evidence, or where evidence is shared on external platforms instead of in the Order chat, may not be upheld. **DropMarket investigates transaction issues (delivery, description, functionality); it does not adjudicate the general quality, legality, or safety of items beyond their listing description.**',
          ),
        ],
      },
      {
        h: '7. How refunds are paid',
        blocks: [
          p(
            '7.1. **Store credit by default.** Approved refunds are issued as **DropMarket store credit** to your Store Balance, credited instantly and usable on any purchase on the Platform with no service fee. Where the Seller is at fault (non-delivery, an item not as described, a dispute decided in your favour) or the Platform is (an item sold out before your payment landed), the refund is **in full, including the service fee**. Where you cancel a paid Order at your own request, the **item price** is refunded and the service fee is not. Store credit is a non-transferable credit note against future purchases: it is not e-money, accrues no interest, and cannot be exchanged for cash except as set out in 7.2.',
          ),
          p(
            '7.2. **Refund to your original payment method.** Once a refund sits in your Store Balance you may ask, from the order page, for it to be sent back to the payment method you used. We review each request within 24 to 48 hours; approved refunds are sent for the amount credited and usually arrive within **5–10 business days** depending on your payment method. A request can only be made while the credited amount is still unspent, and only for payment methods whose provider supports refunds (a method that does not is marked “Store credit only” on the Fees & Charges page). Nothing in this clause limits refunds you are entitled to under the Consumer Rights Act 2015, which are always available in full to your original payment method. DropMarket does not hold buyer cash balances.',
          ),
          p(
            '7.3. **Partial refunds.** Where only part of an Order is affected, a proportionate partial refund may be issued.',
          ),
        ],
      },
      {
        h: '8. Your statutory rights (consumers)',
        blocks: [
          p(
            '8.1. Nothing in this policy removes or limits rights that cannot lawfully be excluded. Where the Buyer is a **consumer** and the Seller is acting as a **trader**, the **Consumer Rights Act 2015** applies: digital content must be of satisfactory quality, fit for purpose, and as described, and the consumer may be entitled to repair, replacement, price reduction, or refund if it is not.',
          ),
          p(
            '8.2. **Distance cancellation (CCR 2013).** For digital content, the 14-day distance-cancellation right is **lost once supply begins with the consumer’s express consent and acknowledgement** that the right is lost (CCR Reg. 37). This consent is captured at checkout before delivery begins.',
          ),
          p(
            '8.3. The Seller is responsible for identifying accurately whether they act as a trader or a private seller; this status is shown on the listing.',
          ),
        ],
      },
      {
        h: '9. Crypto refund mechanics',
        blocks: [
          p(
            '9.1. **Crypto payments are irreversible once broadcast.** Where an Order was paid in crypto/stablecoin (received through BTCPay Server, the payment software DropMarket hosts), approved cash refunds are made in crypto/stablecoin to an address you provide (or as store credit) at the US-dollar value received, and the crypto amount may differ from what you sent because of exchange-rate movement between purchase and refund.',
          ),
          p(
            '9.2. Underpayments, overpayments, wrong-network transfers, and late payments are handled per the instructions on the payment page; recovery may be impossible, and reasonable recovery costs may be deducted where recovery is attempted.',
          ),
        ],
      },
      {
        h: '10. Chargebacks and payment disputes',
        blocks: [
          p(
            '10.1. **Contact us first.** If you have an issue with an Order, use the Dispute process above rather than filing a chargeback with your bank or card issuer. The Dispute process is faster, and SafeDrop already protects your purchase.',
          ),
          p(
            '10.2. **Chargebacks on completed Orders.** Filing a chargeback on an Order that was delivered and confirmed (Completed), instead of using the Dispute process, is treated as a breach of the Terms and may lead to suspension and recovery of amounts owed. This does **not** limit your right to dispute a genuinely **unauthorised** transaction (e.g. card used without your permission) with your bank — that right exists independently.',
          ),
          p(
            '10.3. **Friendly fraud.** False “item not received” claims, false “not as described” claims, and chargeback abuse are investigated and may lead to account termination and loss recovery.',
          ),
          p(
            '10.4. Detailed chargeback handling (evidence, representment, seller liability) is set out in the Chargeback & Payment Policy.',
          ),
        ],
      },
      {
        h: '11. Seller reimbursement and recovery',
        blocks: [
          p(
            '11.1. Where a refund, reversal, chargeback, or scheme fine results from a Seller’s failure to deliver, misdescription, breach, or fraud, the Seller reimburses the amounts involved (including reasonable payment-processor/chargeback fees actually incurred). The Seller authorises DropMarket to debit or withhold such amounts from the Seller Balance or future release entitlements; shortfalls are payable within 14 days of notice. Recoverable amounts are limited to what DropMarket or its payment processors actually incur, plus reasonable administrative cost — **DropMarket does not levy punitive fines**.',
          ),
          p(
            '11.2. Legitimate Sellers are not penalised for payment fraud outside their control; DropMarket handles PSP/chargeback communication on the Seller’s behalf where appropriate.',
          ),
        ],
      },
      {
        h: '12. Cancellations before delivery',
        blocks: [
          p(
            `12.1. **Cancellation requests.** Where the Listing’s stated delivery time is ${CANCEL_REQUEST_MIN_DELIVERY_HOURS} hours or longer, a Buyer may ask DropMarket to cancel the Order from the Order page while it has not been marked delivered, starting one hour after payment. We review each request; the Seller may also cancel an Order it cannot fulfil. Once the Order is marked delivered, cancellation is subject to the outcome of a Dispute.`,
          ),
          p(
            '12.2. **Non-delivery.** Each Listing states the Seller’s delivery time. If the Seller does not deliver within that time, the Buyer can open a Dispute from the Order page (or, for longer delivery times, request cancellation under 12.1). An Order cancelled for non-delivery is refunded **in full as store credit**, service fee included (see Section 7), and the Buyer is notified on screen. A refund to the original payment method is available instead on request from the order page, per Section 7.',
          ),
        ],
      },
      {
        h: '13. Fraud, abuse, and final decisions',
        blocks: [
          p(
            '13.1. DropMarket may refuse a refund, reverse a refund, suspend an Account, or take other action where it reasonably determines a claim is fraudulent, abusive, or made in bad faith.',
          ),
          p(
            '13.2. Determinations by the Resolution Team are final for the purposes of the platform’s internal process; this does not affect a Buyer’s or Seller’s statutory rights or access to the Complaints process, their payment provider, or the courts.',
          ),
        ],
      },
      {
        h: '14. Contact',
        blocks: [
          p(
            `Questions about a refund or dispute: ${E.email} (or the Order chat for an active Order). ${ENTITY_LINE}.`,
          ),
        ],
      },
    ],
  },

  {
    slug: 'prohibited',
    title: 'Prohibited Items & Conduct Policy',
    description:
      'What may be traded on DropMarket, what is banned outright, the publisher-EULA and account-security acknowledgements every user accepts, and how to report a breach or appeal a decision.',
    ...UPDATED_2026_10_04,
    sections: [
      {
        h: 'Permitted (subject to publisher terms and law)',
        blocks: [
          p('Game accounts; in-game currency/gold; in-game items; boosting/coaching; digital game keys.'),
        ],
      },
      {
        h: 'Prohibited — zero tolerance',
        blocks: [
          ul([
            'Anything involving minors or child sexual abuse material (immediate removal and reporting).',
            'Illegal goods or services, weapons, drugs, stolen data or accounts, hacked or fraudulently obtained items.',
            'Counterfeit or IP-infringing goods; illicitly obtained cheats or malware.',
            'Money laundering, sanctions evasion, terrorist financing.',
            'Fraud, chargeback abuse, and off-platform payment circumvention.',
            'Harassment, hate speech; sharing personal contact details to move a trade off-platform.',
          ]),
        ],
      },
      {
        h: 'Acknowledgements',
        blocks: [
          p(
            '**Publisher-EULA acknowledgement:** Sellers accept the RMT risk where a sale may breach a publisher EULA. **Account-sharing risk:** account Buyers must secure the account immediately (change email/password, enable 2FA).',
          ),
        ],
      },
      reportingSection('Reporting a breach'),
      appealsSection('Statement of reasons and appeals'),
      onlineSafetySection('Online Safety Act 2023'),
    ],
  },
  {
    slug: 'acceptable-use',
    title: 'Acceptable Use Policy',
    description:
      'The conduct rules for using DropMarket: no off-platform payments, no scraping or bots, no fake reviews, no security abuse, and how to report a breach or appeal a decision.',
    ...UPDATED_2026_10_04,
    sections: [
      {
        blocks: [
          p('Users must not:'),
          ul([
            'Post unlawful content.',
            'Circumvent SafeDrop or arrange off-platform payment.',
            'Scrape or use bots without written permission.',
            'Post **fake or incentivised reviews** (a banned commercial practice under the DMCC Act 2024 since 6 April 2025).',
            'Manipulate pricing or listings.',
            'Attempt to compromise Platform security.',
          ]),
          p('Breach may lead to content removal, suspension, withheld payouts and legal action.'),
        ],
      },
      reportingSection('Reporting a breach'),
      appealsSection('Statement of reasons and appeals'),
    ],
  },
  /**
   * Privacy Policy — v1.1 (4 Oct 2026): processors named from the code
   * (Supabase, Vercel, Resend, Sentry, Didit, Payssion, BTCPay on Hetzner,
   * Payoneer, Trustpilot); CoinGate / Tazapay removed; retention table
   * (AML 5 years = AML / KYC Policy; tax records 6 years); rights + ICO.
   * No ICO registration number is claimed: none is on record.
   */
  {
    slug: 'privacy',
    title: 'Privacy Policy',
    description:
      'How DropMarket Ltd collects, uses, shares and protects personal data under UK GDPR and the DPA 2018, including KYC data, the providers we use, how long we keep data, transfers and your rights.',
    ...UPDATED_2026_10_10,
    sections: [
      {
        h: 'Who we are',
        blocks: [
          p(
            `**Controller:** ${E.name} (Company No. ${E.companyNumber}), ${E.registeredOffice}. **Contact:** ${E.email} or ${E.phone}.`,
          ),
        ],
      },
      {
        h: 'Categories of personal data',
        blocks: [
          p(
            'Identity and contact data (name, username, email address, phone number where given); account credentials (passwords are stored only in hashed form by our sign-in provider); **KYC data** (ID documents; selfie/liveness/biometric verification via provider; sanctions and PEP screening results); tax-identification data Sellers give for platform reporting; transaction, order and payout data (payout details are stored encrypted); device, cookie and usage data; on-platform communications and chat; dispute records.',
          ),
        ],
      },
      {
        h: 'Lawful bases (UK GDPR Art. 6) — mapped to purpose',
        blocks: [
          ul([
            '**Performance of a contract** — operating your account and the marketplace, processing Orders.',
            '**Legal obligation** — AML/KYC checks, sanctions screening, tax and platform reporting to HMRC, statutory record-keeping.',
            '**Legitimate interests** — fraud prevention, Platform security, service improvement, dispute handling (balanced against your rights).',
            '**Consent** — optional analytics cookies and session replay (only if you click Accept on the cookie bar; see the Cookie Policy) and any direct marketing (both withdrawable at any time).',
          ]),
        ],
      },
      {
        h: 'Recipients',
        blocks: [
          p('We share personal data only with the providers below, each for the job described, and only as much as that job needs. We do not sell personal data.'),
          {
            t: 'table',
            head: ['Recipient', 'What they do for us', 'Data involved'],
            rows: [
              ['Supabase', 'Database, sign-in and file storage for the Platform', 'Account, Order, chat, dispute and verification-status data; uploaded files'],
              ['Vercel', 'Hosts the website and provides cookieless, aggregated page analytics', 'Request data such as IP address, browser and pages visited'],
              ['Resend', 'Sends account and Order emails', 'Name, email address and the content of the email'],
              ['Sentry', 'Error monitoring', 'Technical details of errors (page, browser and device type)'],
              ['PostHog (EU hosting)', 'Product analytics: which pages, buttons and buying or selling steps people use; with your consent, also cookies and a masked replay of your visit', 'Request data such as IP address and browser, pages visited (without personal details in the address), clicks and steps taken, your account ID if you are signed in, and, if you accepted, a replay of the page with everything you type masked'],
              ['Didit', 'Identity verification and sanctions / PEP / adverse-media screening for Sellers', 'ID document, selfie and liveness check, name, date of birth, address'],
              ...PAYMENT_PROCESSORS.map((x) => [x.name, sentence(x.role), PROCESSOR_DATA[x.name] ?? 'Order reference and amount']),
              ['Hetzner Online (Germany)', 'Hosts the server that runs BTCPay Server', 'Order reference, amount, payment address and transaction ID'],
              ...PAYOUT_PROVIDERS.map((x) => [x.name, sentence(x.role), PROCESSOR_DATA[x.name] ?? 'Payout amount']),
              ['Trustpilot', 'Invites you to review a completed Order', 'Name, email address and Order reference'],
            ],
          },
          p(
            'We also share data with professional advisers (such as lawyers and accountants), and with regulators or authorities where the law requires it (HMRC, ICO, NCA, law enforcement).',
          ),
        ],
      },
      {
        h: 'International transfers',
        blocks: [
          p(
            `Some of these providers process data outside the UK (for example in the EEA or the United States). Where they do, transfers rely on **UK adequacy regulations** where available, or the **UK International Data Transfer Agreement (IDTA)** / the UK Addendum to the EU SCCs, with appropriate safeguards; a copy of the safeguards can be requested at ${E.email}.`,
          ),
        ],
      },
      {
        h: 'Retention',
        blocks: [
          p('We keep personal data only for as long as we need it. Where a dispute, investigation or legal claim is open, we keep the related data until it is resolved.'),
          {
            t: 'table',
            head: ['Data', 'How long we keep it'],
            rows: [
              ['Account and profile data', 'While your account is open. After you close it, we delete or anonymise it within a reasonable period, except data we must keep under the rows below.'],
              ['Identity verification (KYC) and AML records', '5 years after our relationship with you ends, in line with UK anti-money-laundering record-keeping rules (see the AML / KYC Policy).'],
              ['Orders, payments, payouts and platform-reporting data', '6 years from the end of the financial year they relate to, as UK tax law requires.'],
              ['Order chat and dispute records', 'As long as we keep the related Order record, because they are the evidence for disputes, refunds and chargebacks.'],
              ['Support emails', 'As long as needed to deal with your request and any follow-up, unless they form part of an Order or complaint record.'],
              ['Error and security logs', 'For the short periods set by our providers’ retention settings, after which they are deleted automatically.'],
            ],
          },
        ],
      },
      {
        h: 'Your rights',
        blocks: [
          p('Under UK data-protection law you have the right to:'),
          ul([
            'access the personal data we hold about you and get a copy of it;',
            'have inaccurate data corrected;',
            'have data erased, where we have no lawful reason to keep it;',
            'restrict how we use your data;',
            'receive data you gave us in a portable format;',
            'object to processing based on legitimate interests, and to direct marketing at any time;',
            'not be subject to a decision based solely on automated processing that significantly affects you, and to ask for a human review;',
            'withdraw consent at any time, where we rely on consent.',
          ]),
          p(
            `To use these rights, email ${E.email} from the email address on your account. We reply within **one month**; for complex or numerous requests we may extend this by up to two further months and will tell you why. We may need to confirm your identity first. Using your rights is free unless a request is clearly unfounded or excessive.`,
          ),
        ],
      },
      {
        h: 'Complaints',
        blocks: [
          p(
            'In line with the Data (Use and Access) Act 2025 (DPA 2018 s.164A, effective 19 June 2026), we acknowledge data-protection complaints within **30 days** and respond without undue delay.',
          ),
          p(
            'You also have the right to complain to the **Information Commissioner’s Office (ICO)**, the UK data-protection regulator: ico.org.uk/make-a-complaint or 0303 123 1113. We would appreciate the chance to deal with your concern first.',
          ),
        ],
      },
      {
        h: 'Children',
        blocks: [
          p('The Platform is for adults: you must be 18 or over to use it. We do not knowingly collect children’s personal data; if we learn that we have, we delete it.'),
        ],
      },
      {
        h: 'Cookies',
        blocks: [
          p(
            'Cookies: see the Cookie Policy. This policy reflects UK data-protection law as amended by the DUAA 2025, with all data-protection provisions in force as confirmed by the ICO on 19 June 2026.',
          ),
        ],
      },
    ],
  },
  /**
   * Cookie Policy — v1.1 (4 Oct 2026): the tables list what the code sets
   * (Supabase auth cookies via @supabase/ssr defaults; browser-storage keys
   * from src/hooks/use-auth.tsx, the sell wizard, seller application,
   * signup-to-sell, seller checklist, payment-return handler, stale-build).
   * There is no consent banner and no non-essential cookie, so the policy
   * no longer refers to a "cookie settings link". Re-check these tables
   * whenever a cookie or storage key is added.
   */
  {
    slug: 'cookies',
    title: 'Cookie Policy',
    description:
      'The cookies and browser storage DropMarket uses, what each one is for and how long it lasts, and how to control them.',
    ...UPDATED_2026_10_10,
    sections: [
      {
        blocks: [
          p(
            'This policy explains the cookies and similar technologies (such as your browser’s local and session storage) that DropMarket uses. We use **strictly necessary** cookies, which keep you signed in and secure, and **functional** browser storage that remembers things you asked for, such as a draft listing. **Analytics cookies are optional**: we set them only if you click Accept on our cookie bar. We do **not** use advertising cookies.',
          ),
        ],
      },
      {
        h: 'Cookies we set',
        blocks: [
          {
            t: 'table',
            head: ['Name', 'Purpose', 'Duration', 'Type'],
            rows: [
              ['sb-[project]-auth-token (may be split into .0, .1 parts)', 'Keeps you signed in and secures your session (Supabase authentication)', 'Up to 400 days, or until you sign out', 'Strictly necessary'],
              ['sb-[project]-auth-token-code-verifier', 'Completes a sign-in, email-confirmation or password-reset link securely', 'Until that step completes', 'Strictly necessary'],
              ['ph_[project]_posthog', 'Recognises you across visits so we can see which steps of buying and selling people finish (PostHog). Set only if you click Accept', '1 year', 'Analytics (optional)'],
            ],
          },
        ],
      },
      {
        h: 'Browser storage we use',
        blocks: [
          {
            t: 'table',
            head: ['Key', 'Purpose', 'Duration', 'Type'],
            rows: [
              ['gamevault_user_profile, gamevault_seller_status, gamevault_seller_app_status', 'Remembers your profile and seller status so pages open signed in without a flash', 'Until you sign out', 'Functional'],
              ['dm_pending_signup_avatar', 'Holds the avatar you picked at sign-up until your account is ready', 'Removed once uploaded', 'Functional'],
              ['dm_seller_app_draft_v1', 'Saves your seller application draft on this device', 'Until you submit or clear it', 'Functional'],
              ['gv_sell_recent_games', 'Remembers the games you recently listed in', 'Until you clear site data', 'Functional'],
              ['dm-seller-onboarding-dismissed, dm-seller-onboarding-shared', 'Remembers that you closed or used the seller checklist', 'Until you clear site data', 'Functional'],
              ['gv_sell_wizard_snapshot', 'Keeps your listing draft if the page reloads', 'Until you close the tab', 'Functional'],
              ['dm.signup-to-sell', 'Keeps your place in the sign-up-to-sell steps', 'Until you close the tab', 'Functional'],
              ['paid-return:[order]', 'Shows the right message when you come back from a payment page', 'Until you close the tab', 'Strictly necessary'],
              ['dm.stale-build-reload', 'Reloads the page once when a new version of the site is released', 'Until you close the tab', 'Strictly necessary'],
              ['dm.analytics.consent', 'Remembers whether you accepted or rejected optional analytics cookies', 'Until you clear site data or change your choice', 'Strictly necessary'],
              ['ph_[project]_posthog (local storage copy)', 'PostHog keeps a copy of its analytics ID here. Set only if you click Accept', 'Until you clear site data or reject', 'Analytics (optional)'],
            ],
          },
        ],
      },
      {
        h: 'Analytics and error monitoring',
        blocks: [
          p(
            'We count page views with Vercel Web Analytics, which sets no cookies and stores nothing on your device; it reports aggregated visit data. Our error monitoring (Sentry) also sets no cookies.',
          ),
          p(
            'We use PostHog to see which steps of buying and selling people complete and which buttons they click, so we can fix the ones where they get stuck. By default it runs without cookies and stores nothing on your device. If you click Accept, it also sets the cookie listed above and records your visit as a replay of the page (what you clicked and scrolled), with everything you type masked so it is never recorded. It never receives your email or name. Its data is hosted in the EU.',
          ),
        ],
      },
      {
        h: 'Other sites',
        blocks: [
          p(
            'Payment pages run by our payment processors, and sites we link to (such as Trustpilot or Discord), set their own cookies under their own policies.',
          ),
        ],
      },
      {
        h: 'Your choices',
        blocks: [
          p(
            'The first time you visit, a small bar asks whether you accept optional analytics cookies, with equally prominent “Accept” and “Reject” buttons. Nothing optional is set until you click Accept; if you ignore the bar or click Reject, analytics stays cookieless. You can change your choice at any time with the “Cookie Settings” link at the bottom of every page, and we also honour Global Privacy Control signals from your browser as a Reject. You can block or delete cookies and site data in your browser settings; if you block the sign-in cookies, you will not be able to sign in.',
          ),
          p(
            'This reflects PECR as updated by the Data (Use and Access) Act 2025 (in force from 5 February 2026) and the ICO’s finalised storage-and-access-technologies guidance (April 2026).',
          ),
        ],
      },
    ],
  },
  /**
   * AML position paragraph restated for Model C (12 Jul 2026): commercial-
   * agent exclusion rationale replaces the PSP-holds-funds rationale.
   * PENDING: UK solicitor / compliance sign-off of the perimeter position
   * (see Solicitor Enquiry Pack §E) — caveat tracked here, not rendered.
   */
  {
    slug: 'aml',
    title: 'AML / KYC Policy',
    description:
      'Anti-money-laundering and know-your-customer arrangements: the payment providers’ role, DropMarket’s risk-based programme, record keeping and DropMarket’s regulatory position.',
    ...UPDATED_2026_10_04,
    sections: [
      {
        h: 'Payment providers',
        blocks: [
          p(
            `Buyers pay through ${PAYMENT_PROCESSORS_PHRASE}. Payssion processes local payment methods and applies its own AML and sanctions checks to the payments it handles. Crypto payments are received through BTCPay Server, payment software DropMarket hosts itself, so DropMarket’s own programme below applies to them. Seller payouts through Payoneer are also subject to Payoneer’s own checks.`,
          ),
        ],
      },
      {
        h: 'DropMarket’s supporting, risk-based programme',
        blocks: [
          p(
            'Seller identity verification (KYC via provider), sanctions/PEP screening, transaction monitoring, and an escalation posture (report suspicions internally to the nominated officer/MLRO and, where required, to the **National Crime Agency**). Sanctioned persons are prohibited from using the Platform.',
          ),
        ],
      },
      {
        h: 'Record keeping',
        blocks: [
          p(
            'We keep identity-verification records, and the records of transactions and monitoring, for **5 years** after the business relationship ends (or after the date of a one-off transaction), in line with regulation 40 of the Money Laundering Regulations 2017. After that we delete them, unless the law requires us to keep them longer or they are needed for legal proceedings.',
          ),
        ],
      },
      {
        h: 'Position on DropMarket’s own status',
        blocks: [
          p(
            'DropMarket collects Buyers’ payments solely as each Seller’s **disclosed commercial agent** under the agency exclusion in the Payment Services Regulations 2017 and is not itself an authorised payment institution. Local payment methods are processed by Payssion; crypto payments are received through BTCPay Server, which DropMarket hosts, and every Order is priced and recorded in US dollars. DropMarket handles **no cash**, so it does **not** meet the “high value dealer” trigger in MLR 2017 reg. 14(1)(a) (HMRC confirms card and bank-transfer payments are not relevant HVD payments).',
          ),
        ],
      },
    ],
  },
  {
    slug: 'risk',
    title: 'Risk Disclosure',
    description:
      'The risks of trading gaming assets: publisher bans and clawbacks, account recovery, crypto volatility and irreversibility, and counterparty risk.',
    sections: [
      {
        blocks: [
          p('Trading gaming assets carries risk:'),
          ul([
            '**Publisher-EULA / RMT risk** — accounts and items may be banned, suspended or clawed back by the publisher.',
            '**Account-recovery risk** — a prior owner may reclaim an account.',
            '**Crypto risk** — cryptocurrency is volatile and payments are **irreversible (no chargebacks)**.',
            '**Counterparty risk** — SafeDrop mitigates but does not eliminate the risk of bad-faith Users.',
          ]),
          p(
            'Only spend what you can afford to lose. This is not financial advice and DropMarket is not a game publisher.',
          ),
        ],
      },
    ],
  },

  {
    slug: 'fees',
    title: 'Fees & Charges',
    description:
      'DropMarket’s commission and service fees, all-inclusive buyer pricing, the payment processors we use, and payout timing.',
    ...UPDATED_2026_10_04,
    sections: [
      {
        blocks: [
          p(
            'DropMarket charges Sellers a **commission (take rate)** on each completed sale and charges Buyers itemised **marketplace and processing fees**, all **disclosed before listing and at checkout**. Buyers always see **all-inclusive prices** (no drip pricing). Payout timing follows the applicable Protection Window and PSP settlement. PSP processing, FX, and payout fees are shown before you transact.',
          ),
        ],
      },
      {
        h: 'Seller commissions',
        blocks: [
          p(
            'Sellers pay a **commission set per category** (in-game currency, in-game items, top-ups, gift cards, boosting / coaching, game accounts). Individual game economies may carry their own rate in place of the category standard, and game accounts are priced by risk band. The **current schedule** — every category and per-game rate, scheduled changes, the seller-rank discount ladder and the founding-seller programme — is published on the [Seller Fees page](/sell/fees), which reads the same rate table our checkout uses.',
          ),
          ul([
            'Commission applies to the **item price only** — never to the buyer fee.',
            'The rate for an order is **fixed when the order is placed** and recorded on the order; a later change never applies to a past order.',
            'Standard rates change only on a **dated schedule** with the notice period in Section 4 of the Terms; promotional rates may start immediately but always carry an end date.',
            'Rank discounts reduce the category rate by a stated number of points, never below the published floor; the founding programme replaces the rank discount while it runs.',
            'Payout holds follow the applicable Protection Window (see the Refund & Dispute Policy).',
          ]),
          p(
            'Your exact commission and estimated net proceeds, with any rank or founding adjustment, are shown on the listing form before you publish.',
          ),
        ],
      },
      {
        h: 'Buyer fee',
        blocks: [
          p(
            'Buyers pay one **service fee** at checkout, shown as a single line and always included in the displayed total, so the price you see at checkout is the price you pay. It has two parts. The **marketplace part** is **2%** of the item price with a $0.30 minimum; it keeps every order covered by SafeDrop Protection. The **processing part** depends on the payment method you choose: it covers the payment provider’s charge on the amount actually charged, currency conversion where the provider applies it, and a small buffer for rate movement, and every method has a minimum share of that amount. Orders whose total would fall under $1.00 are raised to $1.00. **Orders paid entirely with store credit carry no service fee.** The exact fee for your order is quoted before you pay.',
          ),
          p(
            'The current terms per payment method are listed below, read live from the same table checkout quotes from. A method that is hidden or over its provider’s limit for your order is not offered.',
          ),
        ],
      },
      {
        h: 'Payment processors',
        blocks: [
          p(`Buyers’ payments are processed by ${PAYMENT_PROCESSORS_PHRASE}:`),
          ul(PAYMENT_PROCESSORS.map((x) => `**${x.name}**: ${sentence(x.role)}.`)),
          p('Seller payouts are made in crypto, or through:'),
          ul(PAYOUT_PROVIDERS.map((x) => `**${x.name}**: ${sentence(x.role)}.`)),
        ],
      },
      {
        h: 'Withdrawals',
        blocks: [
          ul([
            '**Crypto payouts (USDT, USDC, BTC, ETH):** 3% + $5 per payout; minimum withdrawal $50.',
            '**Payoneer payouts:** 3% per payout with a $5 minimum fee; minimum withdrawal $100.',
            `**When a sale becomes withdrawable:** ${HOLD} after the Buyer confirms receipt, or immediately when the Order completes automatically at the end of its SafeDrop Protection window.`,
            `**New sellers:** withdrawals open ${WITHDRAWAL_MIN_ACCOUNT_AGE_DAYS} days after your seller account is approved.`,
            `**Payout details:** changing your payout address or Payoneer email pauses withdrawals for ${PAYOUT_DETAILS_FREEZE_HOURS} hours. One withdrawal may be in progress at a time.`,
            '**Disputes:** while a dispute is open on an Order, that Order’s amount is set aside from your balance; a refund decided against you is deducted, and your balance may go below zero until later sales cover it.',
          ]),
          p('The live schedule, read from the same table the withdrawal page quotes from, is on the [Seller Fees page](/sell/fees).'),
        ],
      },
      {
        h: 'Warranties',
        blocks: [
          p(
            `DropMarket does not currently sell warranty upgrades. Every Order, including game accounts, is covered by SafeDrop Protection at no extra cost. For game accounts, a recovery, ban or clawback caused by the Seller or a previous owner is covered if it happens within the account Protection Window (**${hoursAsDays(WIN.account)} from delivery**); see the SafeDrop Protection Terms.`,
          ),
        ],
      },
    ],
  },

  {
    slug: 'chargebacks',
    title: 'Chargeback & Payment Policy',
    description:
      'How crypto and local-method payments behave: irreversibility, chargeback and reversal rules, seller liability, and friendly-fraud.',
    ...UPDATED_2026_10_04,
    sections: [
      {
        blocks: [
          ul([
            '**Crypto (received through BTCPay Server):** payments are **irreversible; no chargebacks**. Refunds, if approved, are made under the Refund & Dispute Policy.',
            '**Local payment methods (processed by Payssion):** some methods let the payer dispute or reverse a payment through their bank or payment provider, under that method’s own rules. Where a reversal results from a Seller’s failure to deliver, misdescription, breach or fraud, the Seller bears it through reserves and clawbacks under the Seller Agency Agreement.',
            'Initiating a chargeback instead of using the SafeDrop dispute process (“friendly fraud”) breaches the Terms.',
          ]),
          p(`The current list of payment processors is on the Fees & Charges page.`),
        ],
      },
    ],
  },
  {
    slug: 'complaints',
    title: 'Complaints Handling / Dispute Resolution',
    description:
      'How to raise a complaint, our response times, how to escalate, and your options if you are still not satisfied.',
    ...UPDATED_2026_10_04,
    sections: [
      {
        h: '1. How to complain',
        blocks: [
          p(
            `Email **${E.email}** with “Complaint” in the subject, or call **${E.phone}**. Tell us your username, any Order number, what went wrong and what you would like us to do. For a problem with an active Order, use the Order chat or open a dispute first: that is the fastest route (see the Refund & Dispute Policy).`,
          ),
        ],
      },
      {
        h: '2. Our response times',
        blocks: [
          ul([
            '**First reply:** our support team usually replies within a few hours.',
            '**Acknowledgement:** we acknowledge every complaint within **2 business days**.',
            '**Final response:** we send our final written response within **8 weeks** of receiving the complaint. If we cannot meet that, we will tell you why and when to expect it.',
          ]),
        ],
      },
      {
        h: '3. Escalation',
        blocks: [
          ul([
            '**Stage 1, Support:** the support team investigates and replies with what we will do.',
            '**Stage 2, Review:** if you are unhappy with that answer, reply asking for a review. Someone senior who was not involved looks at the complaint again and sends our final response.',
          ]),
        ],
      },
      {
        h: '4. If you are still not satisfied',
        blocks: [
          p(
            'Our final response will explain your options. If you are a consumer you can get free advice from **Citizens Advice** (citizensadvice.org.uk, consumer helpline 0808 223 1133), and you can bring a claim through the **small claims track** of the county court (in England and Wales, online at gov.uk/make-court-claim-for-money). Data-protection complaints can also go to the ICO (see the Privacy Policy).',
          ),
          p(
            '**Alternative Dispute Resolution (ADR):** DropMarket is not currently a member of an ADR scheme. If we cannot settle a consumer complaint through our internal process, our final response will say so, name a certified ADR entity that could deal with it, and say whether we agree to use it, as the Alternative Dispute Resolution for Consumer Disputes Regulations 2015 require. The EU ODR platform is no longer available to UK traders (post-Brexit), so it is not referenced.',
          ),
          p(
            'Data-protection complaints follow the 30-day acknowledgement standard set out in the Privacy Policy.',
          ),
        ],
      },
    ],
  },
  {
    slug: 'ip',
    title: 'IP / Copyright / Notice-and-Takedown Policy',
    description:
      'How rights holders report infringing listings, how DropMarket handles removal, and how sellers can send a counter-notice, under English law.',
    ...UPDATED_2026_10_04,
    sections: [
      {
        blocks: [
          p(
            'DropMarket respects intellectual property. There is **no UK statutory DMCA**; under the Electronic Commerce (EC Directive) Regulations 2002 a host must act **expeditiously on actual knowledge** of unlawful content.',
          ),
        ],
      },
      {
        h: '1. Reporting infringement',
        blocks: [
          p(`Rights holders may report an infringing Listing to **${E.email}** including:`),
          ul([
            'Your identity and authority to act.',
            'Identification of the protected work.',
            'The specific Listing URL(s).',
            'A good-faith statement that the use is unauthorised.',
            'A statement that the information provided is accurate.',
          ]),
        ],
      },
      {
        h: '2. What we do with a notice',
        blocks: [
          p(
            'We acknowledge a complete notice within **2 business days** and aim to decide on it within **5 business days**. If the notice is valid, we remove or disable the Listing and tell the Seller why, with the details of the complaint (we may leave out the rights holder’s personal contact details). If a notice is incomplete, we ask for what is missing.',
          ),
        ],
      },
      {
        h: '3. Counter-notice',
        blocks: [
          p(`If your Listing was removed and you believe that was a mistake, or that you have the right to sell the item, you can send a counter-notice to **${E.email}** within **14 days** of our message, including:`),
          ul([
            'Your name, username and contact details.',
            'The Listing that was removed.',
            'Why you believe the removal was a mistake, or the rights you rely on, with any evidence.',
            'A statement that the information you provide is accurate.',
          ]),
          p(
            'We send a valid counter-notice to the rights holder. If the rights holder does not tell us within **10 business days** that they have started court proceedings, we may restore the Listing. We do not decide legal disputes between rights holders and Sellers.',
          ),
        ],
      },
      {
        h: '4. Repeat infringers and unjustified threats',
        blocks: [
          p(
            'We review, remove infringing content, and may terminate repeat infringers. **Note:** the UK “unjustified threats” regime (Trade Marks Act s.21; equivalents for patents and designs) means trade-mark and patent complaints must be made in good faith and can attract liability if groundless.',
          ),
        ],
      },
    ],
  },
  {
    slug: 'trust-safety',
    title: 'Community Guidelines / Trust & Safety',
    description:
      'The behaviour we expect from every user, how to report a problem, how DropMarket moderates content and enforces the rules, and how to appeal.',
    ...UPDATED_2026_10_04,
    sections: [
      {
        blocks: [
          ul([
            'Be honest; deliver exactly as described.',
            '**Communicate only on-platform.**',
            'No scams; no harassment; protect minors.',
            `Report bad actors to ${E.email}.`,
          ]),
          p(
            'Verified-seller status and public ratings support trust. DropMarket operates content-moderation, illegal-content reporting and takedown processes and may act on complaints (see the Prohibited Items & Conduct Policy). Violations lead to enforcement up to permanent removal.',
          ),
        ],
      },
      reportingSection('Reporting a problem'),
      appealsSection('Statement of reasons and appeals'),
      onlineSafetySection('Online Safety Act 2023'),
    ],
  },
  {
    slug: 'company',
    title: 'Company Information',
    description:
      'Statutory company disclosures for DropMarket Ltd: registration, registered office, VAT number and contact details.',
    ...UPDATED_2026_10_04,
    sections: [
      {
        blocks: [
          p(
            `**${E.name}**, a private company limited by shares, registered in **${E.jurisdiction}**.`,
          ),
          ul([
            `**Company number:** ${E.companyNumber}`,
            `**Registered office:** ${E.registeredOffice}`,
            `**VAT number:** ${E.vatNumber}`,
            `**Phone:** ${E.phone}`,
            `**Website:** ${E.website}`,
            `**Contact:** ${E.email}`,
          ]),
          p(
            '*Disclosures made under the Companies Act 2006, the Company, Limited Liability Partnership and Business (Names and Trading Disclosures) Regulations 2015, and the Electronic Commerce (EC Directive) Regulations 2002.*',
          ),
        ],
      },
    ],
  },
]

export function getLegalDoc(slug: string): LegalDoc | null {
  return LEGAL_DOCS.find((d) => d.slug === slug) ?? null
}

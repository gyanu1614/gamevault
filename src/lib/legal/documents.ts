/**
 * V46 — Legal & policy pack (footer documents).
 *
 * 17 cross-referenced documents for DropMarket Ltd (England & Wales),
 * drafted to the "intermediary + agent-of-payee + PSP-holds-the-funds"
 * model with SafeDrop as the escrow-style protection flow. Content is
 * data here; rendering lives in components/legal/LegalPage.tsx and one
 * thin route per document under src/app/(legal)/.
 *
 * ⚠️ NOT LEGAL ADVICE — eleven points in the source pack require UK
 * solicitor sign-off before go-live (see the Risk/AML notes inline).
 *
 * Remaining placeholder: the final commission % / fee schedule (Fees).
 */

export const LEGAL_ENTITY = {
  name: 'DropMarket Ltd',
  companyNumber: '17309867',
  registeredOffice:
    '82a James Carter Road, Mildenhall, Bury St. Edmunds, England, IP28 7DE',
  jurisdiction: 'England & Wales',
  website: 'dropmarket.gg',
  email: 'support@dropmarket.gg',
  effectiveDate: '1 July 2026',
  lastUpdated: '8 July 2026',
} as const

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
  sections: LegalSection[]
}

const p = (md: string): LegalBlock => ({ t: 'p', md })
const ul = (items: string[]): LegalBlock => ({ t: 'ul', items })
const note = (md: string): LegalBlock => ({ t: 'note', md })

/** Shared definitions block reused conceptually across documents. */
const DEFINED_TERMS = p(
  '**Defined terms (used identically in every document):** **DropMarket** = DropMarket Ltd and the dropmarket.gg Platform; **Platform** = the website and services at dropmarket.gg; **SafeDrop** = DropMarket’s escrow-style payment-protection flow operated through a licensed PSP; **PSP** = the licensed third-party payment service provider that holds and moves funds (CoinGate now; Tazapay planned); **Buyer**, **Seller**, **User**, **Listing**, **Order** have their ordinary marketplace meanings; **Protection Window** = the per-category period in which a Buyer must confirm delivery or open a dispute (see the Refund & Dispute Policy).',
)

export const LEGAL_DOCS: LegalDoc[] = [
  /**
   * Terms of Use — DRAFT v2 (expanded), Model A: licensed PSP holds all
   * funds; DropMarket never takes custody. PSP-agnostic wording.
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
      'The master terms governing use of the DropMarket platform: our venue role, SafeDrop payments through a licensed PSP, eligibility, accounts, consumer rights, liability, and governing law.',
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
            '1.4. **Summary of how money moves (binding description).** When a Buyer pays for an Order, payment is collected and held by a **licensed third-party payment service provider** (the “**PSP**”) — not by DropMarket. DropMarket acts as the Seller’s **disclosed limited payment-collection agent (agent of payee)** solely for the purpose of directing the PSP: the Buyer’s payment obligation to the Seller is **discharged when the PSP receives the Buyer’s funds**. Funds remain with the PSP until released under the SafeDrop Escrow Terms, and are paid out to the Seller by the PSP on DropMarket’s instruction. **DropMarket does not hold, control, or take custody of user funds at any time, is not the merchant of record for Seller items, and is not a bank, e-money issuer, or money transmitter.**',
          ),
          p(
            '1.5. The PSP(s) currently used, and their regulatory status, are identified at checkout and on the Fees & Charges page. Payment processing is subject to the PSP’s own terms, which you accept when transacting.',
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
            '“**SafeDrop**” — DropMarket’s payment-protection flow described in the SafeDrop Escrow Terms, operated through the PSP.',
            '“**PSP**” — the licensed third-party payment service provider(s) that collect, hold, convert, and pay out funds.',
            '“**Protection Window**” — the per-category period after delivery in which a Buyer must confirm delivery or open a dispute (see Refund & Dispute Policy).',
            '“**Seller Balance**” — the record shown in a Seller’s Account of the Seller’s entitlement to funds **held at the PSP**; the Seller Balance is a ledger entry, not money held by DropMarket.',
            '“**Platform Content**” — all content made available by DropMarket on the Platform (text, graphics, logos, software, data, and design).',
          ]),
          p(
            '2.2. The following Policies are incorporated into this Agreement: Buyer Terms & Buyer Protection; Seller Agreement; SafeDrop Escrow Terms; Refund & Dispute Policy; Prohibited Items & Conduct Policy; Acceptable Use Policy; Privacy Policy; Cookie Policy; AML/KYC Policy; Risk Disclosure; Fees & Charges; Chargeback & Payment Policy; Complaints Handling / Dispute Resolution; IP / Notice-and-Takedown Policy; Community Guidelines / Trust & Safety. If a Policy conflicts with these Terms, the more specific document prevails for its subject matter.',
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
            '5.5. **Suspension and termination by us.** We may suspend, restrict, or terminate an Account, remove Listings, or withhold instruction of payouts where, acting reasonably: (a) you breach this Agreement or any Policy; (b) we suspect fraud, money laundering, sanctions exposure, or other unlawful activity; (c) information you provided appears untrue or incomplete; (d) required verification is not completed; (e) your conduct creates risk or possible legal exposure for DropMarket, the PSP, or other Users; or (f) we are required to do so by law, a regulator, or a PSP. Where we suspend or terminate a Seller who is a business user, we will provide a statement of reasons unless prohibited by law or legitimate fraud-prevention grounds.',
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
            '6.2. We (and the PSP) may require additional documentation at any time — including government ID, proof of address, source of funds, and proof of ownership of the payout account — and may delay Listings, releases, or payout instructions pending verification.',
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
            '7.2. **Binding sales.** When a Buyer places an Order for a Listing, a binding contract of sale is formed between Buyer and Seller on the terms of the Listing and this Agreement. Sellers must deliver promptly per the Seller Agreement; Buyers must confirm delivery or raise a dispute within the Protection Window.',
          ),
          p(
            '7.3. **Transaction risks.** Buying and selling gaming virtual goods involves risks, including: misdescribed or defective items; delayed or failed delivery; account recovery by a prior owner; publisher enforcement (Section 8); fraud by counterparties acting under false pretences; and price volatility of crypto assets. **You use the Platform at your own risk and assume these transaction risks**, subject always to your statutory rights (Section 10) and the protections in the SafeDrop Escrow Terms and Refund & Dispute Policy.',
          ),
          p(
            '7.4. We use verification, escrow-style protection via the PSP, ratings, and monitoring to reduce these risks, but we cannot eliminate them and do not underwrite them, except as expressly stated in the Refund & Dispute Policy.',
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
            '9.1. **All Orders run through SafeDrop.** The Buyer pays the PSP; the PSP holds the funds; the funds are released from buyer protection only after delivery is confirmed (or the Protection Window lapses, or a dispute resolves) per the SafeDrop Escrow Terms.',
          ),
          p(
            '9.2. **Discharge.** The Buyer’s payment obligation to the Seller is discharged when the PSP receives the Buyer’s payment in full.',
          ),
          p(
            '9.3. **Seller Balance and payouts.** After release, the Seller’s entitlement is recorded in the Seller Balance. Funds remain held at the PSP until the Seller requests a payout from their Account, at which point we instruct the PSP to pay the Seller’s verified payout method. A minimum payout amount and payout fees apply (see Fees & Charges). We may delay payout instructions pending verification, dispute resolution, chargeback exposure, or as required by the PSP or law.',
          ),
          p(
            '9.4. **Refunds go to source.** Approved refunds are returned to the Buyer’s original payment method, per the Refund & Dispute Policy. We do not maintain buyer wallets or stored buyer balances.',
          ),
          p(
            '9.5. **Crypto payments.** Where crypto/stablecoin payment is offered, payments are processed and converted by the PSP. **Crypto transactions are irreversible once broadcast**; send exactly the displayed amount on the displayed network within the displayed time. Underpayments, overpayments, wrong-network transfers, and late payments are handled per the PSP’s rules and the Refund & Dispute Policy; recovery may be impossible and reasonable recovery costs may be deducted where recovery is attempted.',
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
            '12.1. **Platform-first dispute process.** Buyer–Seller disputes about an Order must be raised through the Platform’s dispute process within the Protection Window (see Refund & Dispute Policy). We investigate transaction disputes (delivery, description) — we do not adjudicate the general quality, safety, or legality of items beyond their Listing description. Users agree to cooperate with the process and not to escalate to external channels in respect of an open, pending dispute before the process completes; this does not limit any User’s legal rights, statutory complaints channels, or recourse to the courts or to their payment provider.',
          ),
          p(
            '12.2. **Outcomes.** Dispute outcomes may include: release to Seller; full or partial refund to Buyer (to source); redelivery; or cancellation. Outcomes are implemented via instruction to the PSP.',
          ),
          p(
            '12.3. **Recovery from Sellers.** Where a refund, chargeback, reversal, or fine imposed by a card scheme or PSP results from a Seller’s failure to deliver, misdescription, breach of this Agreement, or fraud, the Seller must reimburse the amounts involved (including PSP/chargeback fees reasonably incurred). The Seller authorises us to instruct the PSP to debit or withhold such amounts from the Seller Balance or future release entitlements; if the Balance is insufficient, the Seller must pay the shortfall within 14 days of notice, failing which we may use lawful collection mechanisms. Recoverable amounts are limited to **amounts we or the PSP actually incur or are liable for, plus reasonable administrative costs** — we do not levy punitive fines.',
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
            '13.1. Sellers must list accurately and completely: item, scope, delivery method and time, region restrictions, and all material terms. Listings must be placed in the correct category with accurate tags and must be removed promptly when no longer available. Specific listing warranties (including for game accounts: personal, non-commercial origin; no cheat/hack-derived goods; no stolen or fraudulently obtained items) are set out in the Seller Agreement and Prohibited Items & Conduct Policy.',
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
            'DropMarket Ltd · Company No. 17309867 · Registered in England & Wales · 82a James Carter Road, Mildenhall, Bury St. Edmunds, IP28 7DE, United Kingdom · support@dropmarket.gg',
          ),
        ],
      },
    ],
  },

  {
    slug: 'buyer-terms',
    title: 'Buyer Terms & Buyer Protection',
    description:
      'How SafeDrop protects buyers: what is covered, what is not, protection windows, and how your statutory rights sit alongside the platform protection.',
    sections: [
      {
        blocks: [
          p(
            'Buyers are protected by **SafeDrop**: funds are held via the PSP until you **Confirm Delivery** or the **Protection Window** for the category expires (see the Refund & Dispute Policy). You must inspect the item and either confirm or open a dispute **within the Protection Window**.',
          ),
          ul([
            '**Covered:** non-delivery; items materially not as described; (for accounts) ban / recovery / clawback within the account Protection Window caused by the Seller or prior owner.',
            '**Not covered:** change of mind after supply has begun with your consent; misuse; losses caused by your own acts or failure to secure an account (change email/password, enable 2FA immediately).',
            '**Friendly-fraud:** initiating a chargeback while a SafeDrop dispute could resolve the matter, or after receiving the item, is a breach of these Terms and may lead to account termination and recovery of resulting losses.',
            '**Your statutory rights** (where you are a consumer buying from a trader Seller) are unaffected and sit alongside SafeDrop.',
          ]),
        ],
      },
    ],
  },

  {
    slug: 'seller-agreement',
    title: 'Seller Agreement',
    description:
      'The commercial / sales agency agreement between DropMarket Ltd and Sellers: agent-of-payee appointment, delivery obligations, fees, reserves, KYC and tax reporting.',
    sections: [
      {
        blocks: [
          p('*Parties: DropMarket Ltd and the Seller. Governing law: England & Wales.*'),
        ],
      },
      {
        h: '1. Appointment as disclosed collection agent',
        blocks: [
          p(
            'The Seller appoints DropMarket as its **disclosed limited commercial agent** to (a) display Listings, (b) conclude sales with Buyers **on the Seller’s behalf**, and (c) collect payment from Buyers **via the PSP on the Seller’s behalf**, such that receipt of funds by the PSP **discharges the Buyer’s payment obligation to the Seller**. DropMarket acts for the **Seller (payee) only**, never for both parties. Funds collected belong to the Seller, less DropMarket’s commission and fees.',
          ),
        ],
      },
      {
        h: '2. Seller obligations',
        blocks: [
          p(
            'The Seller must: hold full legal right to sell the item; deliver exactly as described within the stated delivery time; keep Listings accurate; communicate only via Platform chat; and comply with the Prohibited Items & Conduct Policy, the Acceptable Use Policy and the AML / KYC Policy.',
          ),
        ],
      },
      {
        h: '3. Delivery',
        blocks: [
          p(
            'Delivery must match the Listing. For accounts, the Seller must fully transfer ownership and **unbind all personal identifiers** (phone, linked socials, recovery email) and provide original registration details before delivery.',
          ),
        ],
      },
      {
        h: '4. Fees, commission and payouts',
        blocks: [
          p(
            'DropMarket deducts commission (see Fees & Charges) from each completed sale. Payouts release, via the PSP, after the Buyer confirms or the Protection Window expires.',
          ),
        ],
      },
      {
        h: '5. Reserves, clawbacks and set-off',
        blocks: [
          p(
            'DropMarket (via the PSP) may withhold, reserve, or claw back funds to cover refunds, chargebacks, fines, or losses arising from the Seller’s transactions, and may hold a **rolling reserve** for higher-risk Sellers.',
          ),
        ],
      },
      {
        h: '6. KYC and tax reporting',
        blocks: [
          p(
            'Sellers must complete identity verification (KYC) via our provider and sanctions screening before payout. DropMarket may report Seller income to HMRC under the OECD/UK **digital platform reporting rules** (in force 1 January 2024; annual report due 31 January).',
          ),
        ],
      },
      {
        h: '7. Indemnity and termination',
        blocks: [
          p(
            'The Seller indemnifies DropMarket against claims arising from the Seller’s items, delivery, or conduct. Either party may terminate; clauses on fees, refunds, chargebacks, reserves and indemnities survive.',
          ),
        ],
      },
    ],
  },

  {
    slug: 'safedrop',
    title: 'SafeDrop Escrow Terms',
    description:
      'How the SafeDrop payment-protection flow works: funds held by a licensed PSP, delivery confirmation, auto-release, and dispute windows.',
    sections: [
      {
        blocks: [
          p(
            'SafeDrop is DropMarket’s name for the escrow-style payment-protection flow operated through our **licensed PSP**. **DropMarket does not itself hold funds.**',
          ),
        ],
      },
      {
        h: 'The flow',
        blocks: [
          ul([
            '**1.** Buyer pays into SafeDrop via the PSP; funds are held.',
            '**2.** Order status: *“Funds Held — Awaiting Delivery.”*',
            '**3.** Seller delivers the item or service.',
            '**4.** Buyer inspects and clicks **Confirm Delivery**, or the **Protection Window** expires, at which point funds **release to the Seller (less fees)**.',
            '**5.** If there is a problem, the Buyer opens a **dispute within the Protection Window** (see the Refund & Dispute Policy).',
          ]),
        ],
      },
      {
        h: 'Auto-release',
        blocks: [
          p(
            'If the Buyer neither confirms nor disputes within the applicable Protection Window, funds auto-release to the Seller.',
          ),
        ],
      },
      {
        h: 'PSP role and payment type',
        blocks: [
          p(
            'The PSP is the regulated entity holding and moving funds. **Crypto (CoinGate) payments are irreversible.** Card payments (Tazapay, planned) may carry chargeback exposure and a longer initial hold on a Seller’s first card-funded payouts.',
          ),
        ],
      },
    ],
  },

  {
    slug: 'refunds',
    title: 'Refund & Dispute Policy',
    description:
      'When sales are final, when you get your money back, the SafeDrop Protection Windows per category, and how disputes are decided.',
    sections: [
      {
        blocks: [
          p(
            'All sales are final once delivery is confirmed, **except** where the item is not delivered, is materially not as described, or where the Buyer has non-excludable statutory rights (Consumer Rights Act 2015).',
          ),
        ],
      },
      {
        h: 'SafeDrop Protection Windows by category',
        blocks: [
          {
            t: 'table',
            head: ['Category', 'Protection Window (confirm/dispute)', 'Notes'],
            rows: [
              [
                'Game accounts',
                '14 days from delivery',
                'Covers ban / recovery / clawback caused by Seller or prior owner.',
              ],
              [
                'In-game currency / gold',
                '72 hours from delivery',
                'Short window; value is consumed on use.',
              ],
              ['In-game items', '72 hours from delivery', 'Non-delivery / not-as-described.'],
              [
                'Boosting / coaching',
                'Service duration + 72 hours',
                'Performance/completion-based; protects deliverables, not competitive outcomes.',
              ],
              [
                'Digital game keys',
                'Before reveal/redemption only',
                'Non-refundable once revealed/redeemed unless invalid, duplicated, or not as described.',
              ],
            ],
          },
        ],
      },
      {
        h: 'Seller grace period and dispute timing',
        blocks: [
          p(
            'Sellers have **12 hours** to respond to a raised issue before escalation. Most disputes are resolved within **3 days**; if a party fails to engage within the stated window, the dispute may be decided against the non-responding party.',
          ),
        ],
      },
      {
        h: 'Crypto refund mechanics',
        blocks: [
          p(
            'Crypto payments are irreversible; approved refunds are made **via the PSP** in crypto/stablecoin (or store credit) at the value received and may be subject to exchange-rate variation. **Friendly-fraud** (false “item not received” claims, chargeback abuse) is investigated and may lead to termination and loss recovery.',
          ),
        ],
      },
      {
        h: 'Consumer cancellation',
        blocks: [
          p(
            'Where the Buyer is a consumer and the Seller a trader, the 14-day distance-cancellation right for digital content is **lost once supply begins** with the consumer’s **express consent and acknowledgement** of that loss (CCR Reg. 37). Faulty digital content carries CRA 2015 repair / replacement / price-reduction / refund remedies.',
          ),
        ],
      },
    ],
  },

  {
    slug: 'prohibited',
    title: 'Prohibited Items & Conduct Policy',
    description:
      'What may be traded on DropMarket, what is banned outright, and the publisher-EULA and account-security acknowledgements every user accepts.',
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
    ],
  },

  {
    slug: 'acceptable-use',
    title: 'Acceptable Use Policy',
    description:
      'The conduct rules for using DropMarket: no off-platform payments, no scraping or bots, no fake reviews, no security abuse.',
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
    ],
  },

  {
    slug: 'privacy',
    title: 'Privacy Policy',
    description:
      'How DropMarket Ltd collects, uses, shares and protects personal data under UK GDPR and the DPA 2018, including KYC data, transfers and your rights.',
    sections: [
      {
        blocks: [
          p(
            '**Controller:** DropMarket Ltd, 82a James Carter Road, Mildenhall, Bury St. Edmunds, England, IP28 7DE. **Contact:** support@dropmarket.gg.',
          ),
        ],
      },
      {
        h: 'Categories of personal data',
        blocks: [
          p(
            'Identity and contact data; account credentials; **KYC data** (ID documents; selfie/liveness/biometric verification via provider); transaction, order and payout data; device, cookie and usage data; on-platform communications and chat; dispute records.',
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
            '**Consent** — non-essential cookies and any direct marketing (withdrawable at any time).',
          ]),
        ],
      },
      {
        h: 'Recipients',
        blocks: [
          p(
            'Payment partners — **CoinGate (UAB “Decentralized”, Lithuania)** and **Tazapay** (planned); **KYC/verification provider** (which screens against sanctions/PEP/adverse-media lists); hosting and IT sub-processors; professional advisers; and regulators or authorities where legally required (HMRC, ICO, NCA, law enforcement).',
          ),
        ],
      },
      {
        h: 'International transfers',
        blocks: [
          p(
            'Because Users and providers operate outside the UK, personal data is transferred internationally (including to the EEA, e.g., Lithuania). Transfers rely on **UK adequacy regulations** where available, or the **UK International Data Transfer Agreement (IDTA)** / the UK Addendum to the EU SCCs, with appropriate safeguards; a copy of the safeguards can be requested at support@dropmarket.gg.',
          ),
        ],
      },
      {
        h: 'Retention',
        blocks: [
          p(
            'KYC/AML records: retained for the statutory period after the business relationship ends. Transaction and accounting records: retained for the period required by tax law. Account data: retained while your account is active and for a reasonable period afterwards. Specific periods are applied per data category.',
          ),
        ],
      },
      {
        h: 'Your rights',
        blocks: [
          p(
            'Access, rectification, erasure, restriction, portability, objection, and rights regarding automated decision-making. Exercise them via support@dropmarket.gg. You may complain to the **ICO** (ico.org.uk).',
          ),
        ],
      },
      {
        h: 'Complaints duty (2026)',
        blocks: [
          p(
            'In line with the Data (Use and Access) Act 2025 (DPA 2018 s.164A, effective 19 June 2026), we acknowledge data-protection complaints within **30 days** and respond without undue delay.',
          ),
          p(
            'Cookies: see the Cookie Policy. This policy reflects UK data-protection law as amended by the DUAA 2025, with all data-protection provisions in force as confirmed by the ICO on 19 June 2026.',
          ),
        ],
      },
    ],
  },

  {
    slug: 'cookies',
    title: 'Cookie Policy',
    description:
      'The cookies and similar technologies DropMarket uses, the consent model, and how to change your choices at any time.',
    sections: [
      {
        blocks: [
          p(
            'We use **strictly necessary** cookies (no consent required) and, **only with your consent**, functional, analytics and advertising cookies. Before any non-essential cookie is set, we present a consent banner with **equal-prominence “Accept all” and “Reject all”** options; you can change your choice at any time via the cookie settings link.',
          ),
          p('Categories: *strictly necessary; functional; analytics; advertising.*'),
          p(
            'This reflects PECR as updated by the Data (Use and Access) Act 2025 (in force from 5 February 2026) and the ICO’s finalised storage-and-access-technologies guidance (April 2026).',
          ),
        ],
      },
    ],
  },

  {
    slug: 'aml',
    title: 'AML / KYC Policy',
    description:
      'Anti-money-laundering and know-your-customer arrangements: the licensed PSP’s regulated role and DropMarket’s supporting risk-based programme.',
    sections: [
      {
        h: 'The licensed PSP is the regulated payment entity',
        blocks: [
          p(
            'CoinGate (UAB “Decentralized”) holds a MiCA CASP authorisation and a payment-institution licence and performs regulated AML/CTF and sanctions functions on the payment leg; Tazapay (planned) is a licensed payment institution.',
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
        h: 'Position on DropMarket’s own status',
        blocks: [
          p(
            'DropMarket handles **no cash**, so it does **not** meet the “high value dealer” trigger in MLR 2017 reg. 14(1)(a) (HMRC confirms card and bank-transfer payments are not relevant HVD payments); and because a MiCA/PI-licensed PSP holds and moves all funds, DropMarket does not itself carry on a regulated cryptoasset payment activity.',
          ),
          note(
            '⚠️ This position must be confirmed by a UK solicitor / compliance advisor before launch.',
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
      'DropMarket’s commission and service fees, all-inclusive buyer pricing, and payout timing.',
    sections: [
      {
        blocks: [
          p(
            'DropMarket charges Sellers a **commission (take rate)** on each completed sale, plus any service fees, **disclosed before listing and at checkout**. Buyers always see **all-inclusive prices** (no drip pricing). Payout timing follows the applicable Protection Window and PSP settlement. PSP processing, FX, and payout fees may apply and are shown before you transact.',
          ),
          note(
            'The final commission percentage and full fee schedule will be published here before public launch.',
          ),
        ],
      },
    ],
  },

  {
    slug: 'chargebacks',
    title: 'Chargeback & Payment Policy',
    description:
      'How crypto and card payments behave: irreversibility, chargeback rules, seller liability, and friendly-fraud.',
    sections: [
      {
        blocks: [
          ul([
            '**Crypto (CoinGate) — now:** payments are **irreversible; no chargebacks**. Refunds, if approved, are made via the PSP under the Refund & Dispute Policy.',
            '**Cards (Tazapay) — planned:** subject to **card-scheme chargeback rules**; a longer hold may apply to a Seller’s first card-funded payouts; Sellers bear chargeback liability via reserves and clawbacks.',
            'Initiating a chargeback instead of using the SafeDrop dispute process (“friendly fraud”) breaches the Terms.',
          ]),
        ],
      },
    ],
  },

  {
    slug: 'complaints',
    title: 'Complaints Handling / Dispute Resolution',
    description:
      'How to raise a complaint, our response standards, and Alternative Dispute Resolution for consumers.',
    sections: [
      {
        blocks: [
          p(
            'Raise complaints to **support@dropmarket.gg**. We acknowledge promptly and aim to resolve within a reasonable period.',
          ),
          p(
            '**Alternative Dispute Resolution (ADR):** if a consumer complaint remains unresolved after our internal process, we will tell the consumer the name and website of a relevant **certified ADR entity** and whether we agree to use it, as required by the Alternative Dispute Resolution for Consumer Disputes Regulations 2015. The EU ODR platform is no longer available to UK traders (post-Brexit), so it is not referenced.',
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
      'How rights holders report infringing listings and how DropMarket handles removal under English law.',
    sections: [
      {
        blocks: [
          p(
            'DropMarket respects intellectual property. There is **no UK statutory DMCA**; under the Electronic Commerce (EC Directive) Regulations 2002 a host must act **expeditiously on actual knowledge** of unlawful content.',
          ),
          p('Rights holders may report an infringing Listing to **support@dropmarket.gg** including:'),
          ul([
            'Your identity and authority to act.',
            'Identification of the protected work.',
            'The specific Listing URL(s).',
            'A good-faith statement that the use is unauthorised.',
            'A statement that the information provided is accurate.',
          ]),
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
      'The behaviour we expect from every user, and how DropMarket moderates content and enforces the rules.',
    sections: [
      {
        blocks: [
          ul([
            'Be honest; deliver exactly as described.',
            '**Communicate only on-platform.**',
            'No scams; no harassment; protect minors.',
            'Report bad actors to support@dropmarket.gg.',
          ]),
          p(
            'Verified-seller status and public ratings support trust. DropMarket operates content-moderation, illegal-content reporting and takedown processes and may act on complaints (see the Prohibited Items & Conduct Policy). Violations lead to enforcement up to permanent removal.',
          ),
        ],
      },
    ],
  },

  {
    slug: 'company',
    title: 'Company Information',
    description:
      'Statutory company disclosures for DropMarket Ltd — registration, registered office and contact details.',
    sections: [
      {
        blocks: [
          p(
            '**DropMarket Ltd**, a private company limited by shares, registered in **England & Wales**.',
          ),
          ul([
            '**Company number:** 17309867',
            '**Registered office:** 82a James Carter Road, Mildenhall, Bury St. Edmunds, England, IP28 7DE',
            '**Website:** dropmarket.gg',
            '**Contact:** support@dropmarket.gg',
          ]),
          p(
            '*Disclosures made under the Companies Act 2006, the Company, Limited Liability Partnership and Business (Names and Trading Disclosures) Regulations 2015, and the Electronic Commerce (EC Directive) Regulations 2002. VAT number to be added if/when VAT-registered.*',
          ),
        ],
      },
    ],
  },
]

export function getLegalDoc(slug: string): LegalDoc | null {
  return LEGAL_DOCS.find((d) => d.slug === slug) ?? null
}

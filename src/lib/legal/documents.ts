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
  lastUpdated: '1 July 2026',
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
  {
    slug: 'terms',
    title: 'Terms of Use',
    description:
      'The master terms governing use of the DropMarket platform: our venue role, SafeDrop payments, eligibility, consumer rights, liability, and governing law.',
    sections: [
      { blocks: [DEFINED_TERMS] },
      {
        h: '1. Who we are and what DropMarket is',
        blocks: [
          p(
            'DropMarket Ltd (“DropMarket”, “we”, “us”) operates the online marketplace at dropmarket.gg. DropMarket is a **venue** that connects independent Buyers and Sellers of gaming virtual goods and services. **DropMarket does not own, sell, or supply any item listed and is not a party to the sale.** Each contract of sale is formed **directly between the Buyer and the Seller**. DropMarket acts (a) as an intermediary providing the Platform and dispute-handling tools, and (b) as the Seller’s **disclosed limited payment-collection agent (agent of payee)**: when a Buyer pays, the Buyer’s payment obligation to the Seller is discharged on receipt of the funds by our licensed PSP.',
          ),
        ],
      },
      {
        h: '2. No holding of funds',
        blocks: [
          p(
            'DropMarket does not hold, control, or operate an account into which Buyer funds are paid before onward payment to the Seller. Funds are held and moved solely by the PSP. DropMarket is **not the merchant of record and not a money transmitter.**',
          ),
        ],
      },
      {
        h: '3. Eligibility',
        blocks: [
          p(
            'You must be at least 18 and able to form a binding contract, and not barred under applicable sanctions or export-control laws.',
          ),
        ],
      },
      {
        h: '4. Real-money-trading (RMT) / publisher-EULA risk',
        blocks: [
          p(
            'Items traded are gaming assets. Buying or selling these assets, or account access, **may breach the End-User Licence Agreement (EULA) or terms of the relevant game publisher** and can result in suspension, ban, or clawback by the publisher. **DropMarket is not affiliated with, endorsed by, or authorised by any game publisher.** You accept this risk (see the Risk Disclosure).',
          ),
        ],
      },
      {
        h: '5. Accounts and security',
        blocks: [
          p(
            'You are responsible for your DropMarket account and all activity under it. Report unauthorised use to support@dropmarket.gg.',
          ),
        ],
      },
      {
        h: '6. SafeDrop, payment and crypto irreversibility',
        blocks: [
          p(
            'All Orders use the SafeDrop flow (see the SafeDrop Escrow Terms). Funds are held and moved by a licensed PSP — **CoinGate** (crypto), operated by UAB “Decentralized” (Lithuania), authorised by the Bank of Lithuania as a MiCA Crypto-Asset Service Provider and payment institution; **Tazapay** (cards/escrow) is planned. **Crypto payments are irreversible and cannot be charged back.** Card payments (when available) are subject to card-scheme chargeback rules.',
          ),
        ],
      },
      {
        h: '7. Fees and pricing',
        blocks: [
          p(
            'DropMarket earns a commission on completed sales and may charge service fees (see Fees & Charges). Prices shown to Buyers are **inclusive of all mandatory charges** (no drip pricing), consistent with the Digital Markets, Competition and Consumers Act 2024.',
          ),
        ],
      },
      {
        h: '8. Prohibited conduct',
        blocks: [
          p(
            'You must comply with the Prohibited Items & Conduct Policy and the Acceptable Use Policy. Breach may lead to listing removal, withheld payouts, suspension, and reporting to authorities.',
          ),
        ],
      },
      {
        h: '9. Consumer rights',
        blocks: [
          p(
            'Where a Seller is a *trader* and a Buyer is a *consumer*, statutory rights under the Consumer Rights Act 2015 and the Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013 apply and are not excluded. Digital content must be of satisfactory quality, fit for purpose and as described. The 14-day distance-cancellation right for digital content is **lost once supply begins with the consumer’s express consent and acknowledgement** that the right will be lost (CCR Reg. 37) — captured at checkout. See the Buyer Terms and the Refund & Dispute Policy.',
          ),
        ],
      },
      {
        h: '10. Intellectual property',
        blocks: [
          p(
            'See the IP / Copyright / Notice-and-Takedown Policy. Report infringement to support@dropmarket.gg.',
          ),
        ],
      },
      {
        h: '11. Limitation of liability',
        blocks: [
          p(
            'Nothing excludes or limits liability for death or personal injury caused by negligence, for fraud, or for any liability that cannot lawfully be excluded (including under the CRA 2015 where the Buyer is a consumer). Subject to that: DropMarket is not liable for the acts or omissions of Buyers or Sellers, for publisher actions (bans/clawbacks), for account-recovery by prior owners, or for indirect, special or consequential loss; and DropMarket’s total aggregate liability for any Order is limited to the commission DropMarket actually earned on that Order.',
          ),
        ],
      },
      {
        h: '12. Governing law and jurisdiction',
        blocks: [
          p(
            'These Terms and any non-contractual obligations are governed by the law of **England & Wales**, and the **courts of England and Wales** have exclusive jurisdiction (a consumer resident elsewhere may also have the protection of mandatory local law and their local courts). Complaints are handled per the Complaints Handling / Dispute Resolution policy.',
          ),
        ],
      },
      {
        h: '13. Changes',
        blocks: [
          p(
            'We may update these Terms; material changes will be notified and continued use constitutes acceptance.',
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

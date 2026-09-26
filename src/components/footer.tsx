/**
 * Footer — "marketplace columns" layout (owner-picked Style A, 2026-08):
 *   1. Brand column left — logo, blurb, socials, Trustpilot.
 *   2. Link columns right — Marketplace / Legal / Policies / Support.
 *      (The game directory renders INSIDE this footer via the
 *      `gameDirectory` slot — see footer-game-links.tsx + layout-wrapper.)
 *   3. Bottom bar — the legally-required UK company details as small
 *      print (e-commerce regs + PSP onboarding: legal name, company
 *      number, registered office, VAT, phone + email), then copyright.
 * Motion: one-time fade-up stagger on scroll-into-view (framer-motion,
 * respects prefers-reduced-motion), CSS hover lifts on socials/links,
 * and a lime hairline glow along the top edge as the page→footer
 * transition. Policies/Support columns collapse visually on phones but
 * stay in the HTML for crawlers.
 * Hidden entirely on sidebar'd account/seller pages (see layout-wrapper).
 */

'use client'

import Link from 'next/link'
import { Mail, MessageCircle, Phone } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { TrustpilotLink } from '@/components/trust/TrustpilotLink'

/* ── Company details (UK e-commerce law + payment-provider requirement) ── */

const COMPANY = {
  name: 'DropMarket Ltd',
  number: '17309867',
  jurisdiction: 'England & Wales',
  office: '82A James Carter Road, Mildenhall, Suffolk, IP28 7DE, United Kingdom',
  vat: '287522083',
  phone: '+44 7476 562276',
  email: 'support@dropmarket.gg',
}


/* ── Link columns ── */

const LINK_GROUPS: Array<{
  title: string
  links: Array<{ name: string; href: string }>
}> = [
  {
    title: 'Marketplace',
    links: [
      { name: 'Browse Listings', href: '/browse' },
      // Beta: the become-seller wizard is post-launch; motivated sellers should
      // land on the founding-seller waitlist, not a dead end.
      { name: 'Become a Founding Seller', href: '/early-seller?src=footer' },
      { name: 'Fees', href: '/fees' },
      { name: 'Blog', href: '/blog' },
      { name: 'Company', href: '/company' },
    ],
  },
  {
    title: 'Buying & Selling',
    links: [
      // One SafeDrop entry, pointing at the POLICY: it is the binding
      // document and the one PSP review looks for. The marketing page is
      // reachable from it and from the buyer-steps section.
      { name: 'SafeDrop Protection', href: '/safedrop-policy' },
      { name: 'Refunds & Disputes', href: '/refunds' },
      { name: 'Prohibited Items', href: '/prohibited' },
      { name: 'Trust & Safety', href: '/trust-safety' },
      { name: 'Chargebacks', href: '/chargebacks' },
    ],
  },
  {
    title: 'Policies',
    links: [
      { name: 'Buyer Terms', href: '/buyer-terms' },
      { name: 'Seller Agreement', href: '/seller-agreement' },
      { name: 'Acceptable Use', href: '/acceptable-use' },
      { name: 'Risk Disclosure', href: '/risk' },
      { name: 'AML Policy', href: '/aml' },
    ],
  },
]

/* Bottom-bar legal row — the pages a UK marketplace must surface everywhere.
   Kept inline beside the copyright (the Eldorado pattern) rather than as a
   fourth column, so the columns above stay short while the statutory links
   are still one click from any page. */
const BOTTOM_LEGAL: Array<{ name: string; href: string }> = [
  { name: 'Terms of Use', href: '/terms' },
  { name: 'Privacy Policy', href: '/privacy' },
  { name: 'Cookie Policy', href: '/cookies' },
  { name: 'Complaints', href: '/complaints' },
  { name: 'IP & Takedowns', href: '/ip' },
]



const headingClass = 'text-[16px] font-semibold tracking-tight text-white'

/** Footer link — slides 2px right and brightens on hover. */
function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      // Colour change only on hover — no translate. The 2px slide read as a
      // pop and made a dense column feel jumpy.
      className="inline-flex min-h-[28px] items-center text-[14.5px] text-text-secondary transition-colors duration-200 hover:text-white sm:min-h-0"
    >
      {children}
    </Link>
  )
}

export function Footer({ gameDirectory }: { gameDirectory?: React.ReactNode } = {}) {
  const reduceMotion = useReducedMotion()

  // One-time slide-up as the footer scrolls into view. TRANSFORM ONLY, no
  // opacity: framer SSRs `initial` styles inline, and headless renderers
  // (Googlebot included) may never fire IntersectionObserver — an opacity:0
  // start would leave the SEO link mesh invisible in the rendered snapshot.
  // A translated element stays fully visible/indexable no matter what.
  // Zeroed out entirely under prefers-reduced-motion.
  const fadeUp = {
    hidden: reduceMotion ? { y: 0 } : { y: 18 },
    show: { y: 0, transition: { duration: 0.5, ease: [0.21, 0.6, 0.35, 1] } },
  }
  const stagger = {
    hidden: {},
    show: { transition: { staggerChildren: reduceMotion ? 0 : 0.07 } },
  }

  return (
    <footer className="relative overflow-hidden" style={{ backgroundColor: 'var(--footer-bg, var(--color-bg-base))' }}>
      {/* Where the footer begins. The only rule in the whole footer — inside
          it, sections are separated by spacing alone. */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-[rgba(233,237,242,0.09)]" />
      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '0px 0px -60px 0px' }}
        className="relative mx-auto max-w-7xl px-4 pb-10 pt-12 sm:px-6 lg:px-8"
      >
        {/* Brand column + link columns */}
        <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(250px,1fr)_2.2fr]">
          <motion.div variants={fadeUp} className="max-w-sm">
            <Link href="/" className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/logo-mark-lime.png"
                alt="DropMarket"
                width={44}
                height={44}
                className="h-11 w-11 object-contain"
              />
              <span className="text-[26px] font-bold tracking-[-0.02em] text-white">
                Drop<span className="text-lime-text">Market</span>
              </span>
            </Link>
            {/* Positioning line, then the supporting line — the brand column
                leads with what DropMarket is for, not with contact details. */}
            <p className="mt-5 text-[19px] font-semibold leading-snug tracking-tight text-white">
              Every Trade, Protected
            </p>
            {/* Registered-company details sit HERE, beside the brand, rather
                than as small print in the bottom bar: they are a trust signal,
                and the competitors that publish them (GameBoost, Kinguin) put
                them in the brand block. */}
            {/* Small print: registered office + registration number. VAT is
                carried on the invoices, not here. */}
            {/* grid, not flex: a shared label column keeps "Registered
                office" and "Registration No" left-aligned with each other,
                and the wrapped second line of the address indents under the
                value rather than under the label. */}
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[12px] leading-relaxed text-text-tertiary">
              <dt>Registered office</dt>
              <dd>{COMPANY.office}</dd>
              <dt>Registration No</dt>
              <dd>{COMPANY.number}</dd>
            </dl>

            {/* Trustpilot — our own link, NOT a TrustBox (display widgets need
                a Plus plan; see TrustpilotLink). Self-hides until reviews land. */}
            <TrustpilotLink className="mt-6" />
          </motion.div>

          {/* Link columns + a support block. Every column shows at every
              width — the compliance pack lives in Policies/Support. */}
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-3">
            {LINK_GROUPS.map((group) => (
              <motion.div
                key={group.title}
                variants={fadeUp}
                // Direction A keeps every column visible at every width: the
                // Policies and Support groups carry the compliance pack
                // (AML, refunds, complaints, chargebacks), and hiding them on
                // phones put those routes out of reach for most visitors.
                className={undefined}
              >
                <h3 className={headingClass}>{group.title}</h3>
                <ul className="mt-3.5 space-y-1.5">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <FooterLink href={link.href}>{link.name}</FooterLink>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}

          </nav>
        </div>

        {/* Support — a full-width row of its own, not a block wedged under
            the address. Heading and copy left, actions right, so the row
            reads as one band across the footer. */}
        <motion.div
          variants={fadeUp}
          // No border, no fill: a bordered card between two borderless
          // sections read as a foreign element. The row is defined by
          // spacing alone, matching the rest of the footer.
          className="mt-14 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8"
        >
          <div className="min-w-0">
            <h3 className={headingClass}>Support Available</h3>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-text-secondary">
              Real people, not bots — any time you need us.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <a
              href={`mailto:${COMPANY.email}`}
              className="flex items-center gap-2 text-[13.5px] text-text-secondary transition-colors hover:text-white"
            >
              <Mail aria-hidden className="h-4 w-4 text-lime" />
              {COMPANY.email}
            </a>
            <a
              href={`tel:${COMPANY.phone.replace(/\s/g, '')}`}
              className="flex items-center gap-2 text-[13.5px] text-text-secondary transition-colors hover:text-white"
            >
              <Phone aria-hidden className="h-4 w-4 text-lime" />
              {COMPANY.phone}
            </a>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/support"
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[rgba(233,237,242,0.05)] px-4 py-2.5 text-[13.5px] font-medium text-white transition-colors hover:bg-[rgba(233,237,242,0.09)]"
              >
                <MessageCircle aria-hidden className="h-4 w-4 text-lime" />
                Live Chat
              </Link>
              <a
                href="https://discord.gg/dropmarket"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-[rgba(88,101,242,0.35)] bg-[rgba(88,101,242,0.14)] px-4 py-2.5 text-[13.5px] font-medium text-white transition-colors hover:bg-[rgba(88,101,242,0.24)]"
              >
                <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                  <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.79.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.32.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.6.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.41.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
                Join Discord
              </a>
            </div>
          </div>
        </motion.div>


      </motion.div>

      {/* Games directory — inside the footer and BELOW the footer content
          (brand, link columns, trust strip), immediately above the bottom
          bar. No border, no background of its own: it is part of the same
          surface, not a separate band. */}
      {gameDirectory}

      {/* Bottom bar — the legally-required company details (two lines,
          left-aligned), copyright on the right. Phone/email live in the
          brand column above.

          Separated by a TONAL BAND, not a divider line: across the dark
          footers surveyed (HyperUI's `(Dark)` variants, Flowbite's sitemap
          footer, shadcnblocks' "Contrasting Bar" set) a darker step is the
          convention, and it also satisfies the homepage surface rule —
          depth through tone, never a border. */}
      {/* No band, no tint: the bar sits on the same surface as everything
          above it, centred like Eldorado's. */}
      <div className="relative">
        {/* One row: entity + copyright on the left, statutory links on the
            right. Stacks and centres below sm. */}
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 pb-10 pt-4 text-center sm:flex-row sm:justify-between sm:gap-6 sm:text-left lg:px-8">
          <p className="text-xs leading-relaxed text-text-tertiary">
            © {new Date().getFullYear()} {COMPANY.name} · Registered in{' '}
            {COMPANY.jurisdiction}
          </p>
          <nav
            aria-label="Legal"
            className="flex flex-wrap justify-center gap-x-5 gap-y-2 sm:justify-end"
          >
            {BOTTOM_LEGAL.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-xs text-text-secondary transition-colors hover:text-white"
              >
                {l.name}
              </Link>
            ))}
          </nav>
        </div>

      </div>
    </footer>
  )
}

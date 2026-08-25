/**
 * Footer — "marketplace columns" layout (owner-picked Style A, 2026-08):
 *   1. Brand column left — logo, blurb, socials, Trustpilot.
 *   2. Link columns right — Marketplace / Legal / Policies / Support.
 *      (The "Popular Games" directory is its own GameBoost-style section
 *      ABOVE this footer — see footer-game-links.tsx + layout-wrapper.)
 *   3. Trust strip — four proof points through SilverIcon (the site's
 *      silver-glass 3D icon material), then the payments row.
 *   4. Bottom bar — the legally-required UK company details as small
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
import { ArrowUp, Mail, Phone } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { SilverIcon } from '@/components/ui/silver-icon'
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

/* ── Trust strip — SilverIcon set (not default line icons) ── */

const TRUST_ITEMS: Array<{ icon: string; title: string; sub: string; href?: string }> = [
  { icon: '/icons/set/shield-check.svg', title: 'SafeDrop Protection', sub: 'Every order covered', href: '/safedrop' },
  { icon: '/icons/set/wallet.svg', title: 'Secure Payments', sub: 'Visa, Apple Pay, crypto' },
  { icon: '/icons/set/verified.svg', title: 'UK Registered Company', sub: COMPANY.name, href: '/company' },
  { icon: '/icons/set/support.svg', title: 'Real Human Support', sub: COMPANY.email, href: `mailto:${COMPANY.email}` },
]

/* ── Link columns ── */

const LINK_GROUPS: Array<{
  title: string
  /** Policies/Support hide visually on phones (essentials-only rule) but stay
      in the HTML so the compliance pack is linked site-wide for crawlers. */
  desktopOnly?: boolean
  links: Array<{ name: string; href: string }>
}> = [
  {
    title: 'Marketplace',
    links: [
      { name: 'Browse Listings', href: '/browse' },
      // Beta: the become-seller wizard is post-launch; motivated sellers should
      // land on the founding-seller waitlist, not a dead end.
      { name: 'Become a Founding Seller', href: '/early-seller?src=footer' },
      { name: 'SafeDrop', href: '/safedrop' },
      { name: 'Fees', href: '/fees' },
      { name: 'Blog', href: '/blog' },
      { name: 'Company', href: '/company' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { name: 'Terms Of Use', href: '/terms' },
      { name: 'Buyer Terms', href: '/buyer-terms' },
      { name: 'Seller Agreement', href: '/seller-agreement' },
      { name: 'Privacy Policy', href: '/privacy' },
      { name: 'Cookie Policy', href: '/cookies' },
      { name: 'Company Details', href: '/company' },
    ],
  },
  {
    title: 'Policies',
    desktopOnly: true,
    links: [
      { name: 'SafeDrop Protection', href: '/safedrop-policy' },
      { name: 'Refunds & Disputes', href: '/refunds' },
      { name: 'Prohibited Items', href: '/prohibited' },
      { name: 'Acceptable Use', href: '/acceptable-use' },
      { name: 'Risk Disclosure', href: '/risk' },
      { name: 'AML Policy', href: '/aml' },
    ],
  },
  {
    title: 'Support',
    desktopOnly: true,
    links: [
      { name: 'Trust & Safety', href: '/trust-safety' },
      { name: 'Chargebacks', href: '/chargebacks' },
      { name: 'Complaints', href: '/complaints' },
      { name: 'IP & Takedowns', href: '/ip' },
      { name: 'Email Support', href: 'mailto:support@dropmarket.gg' },
    ],
  },
]

const SOCIALS: Array<{ name: string; href: string; path: string }> = [
  {
    name: 'Twitter',
    href: 'https://twitter.com/dropmarket',
    path: 'M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84',
  },
  {
    name: 'Discord',
    href: 'https://discord.gg/dropmarket',
    path: 'M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z',
  },
  {
    name: 'GitHub',
    href: 'https://github.com/dropmarket',
    path: 'M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z',
  },
]

/* Monochrome payment wordmarks — no licensed art. */
const PAYMENT_ROW: Array<{ key: string; node: React.ReactNode }> = [
  { key: 'visa', node: <span className="text-[16px] font-black italic tracking-wider">VISA</span> },
  { key: 'mastercard', node: <span className="text-[15px] font-medium lowercase tracking-tight">mastercard</span> },
  { key: 'applepay', node: <span className="text-[15px] font-semibold tracking-tight">&#63743; Pay</span> },
  { key: 'gpay', node: <span className="text-[15px] font-semibold tracking-tight"><span className="font-bold">G</span> Pay</span> },
  { key: 'btc', node: <span className="inline-flex items-baseline gap-0.5 text-[15px] font-bold lowercase"><span aria-hidden>₿</span>bitcoin</span> },
  { key: 'klarna', node: <span className="text-[15px] font-black tracking-tight">Klarna.</span> },
]

const headingClass =
  'text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary'

/** Footer link — slides 2px right and brightens on hover. */
function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-[28px] items-center text-xs text-text-secondary transition-[color,transform] duration-200 hover:translate-x-0.5 hover:text-white sm:min-h-0"
    >
      {children}
    </Link>
  )
}

export function Footer() {
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
    <footer className="relative overflow-hidden bg-bg-base">
      {/* Page→footer transition: lime hairline + soft ambient glow along
          the top edge (replaces the old flat border-t). */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(198,255,61,0.35)_28%,rgba(198,255,61,0.35)_72%,transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40"
        style={{
          background:
            'radial-gradient(48% 100% at 50% 0%, rgba(198,255,61,0.05), transparent 70%)',
        }}
      />

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
            <Link href="/" className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/logo-mark-lime.png"
                alt="DropMarket"
                width={32}
                height={32}
                className="h-8 w-8 object-contain"
              />
              <span className="text-lg font-bold tracking-tight text-white">
                Drop<span className="text-lime-text">Market</span>
              </span>
            </Link>
            <p className="mt-4 text-[13px] leading-relaxed text-text-tertiary">
              The trusted UK marketplace for game accounts, items and currency —
              every order covered by SafeDrop Buyer Protection.
            </p>
            {/* Direct contact — official company contact details, with the
                small print in the bottom bar carrying the registration data. */}
            <div className="mt-5 space-y-2">
              <a
                href={`tel:${COMPANY.phone.replace(/\s/g, '')}`}
                className="flex items-center gap-2.5 text-[13px] text-text-secondary transition-colors hover:text-white"
              >
                <Phone aria-hidden className="h-4 w-4 text-lime" />
                {COMPANY.phone}
              </a>
              <a
                href={`mailto:${COMPANY.email}`}
                className="flex items-center gap-2.5 text-[13px] text-text-secondary transition-colors hover:text-white"
              >
                <Mail aria-hidden className="h-4 w-4 text-lime" />
                {COMPANY.email}
              </a>
            </div>
            <div className="mt-5 flex items-center gap-2">
              {SOCIALS.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.name}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-text-secondary transition-all duration-200 hover:-translate-y-0.5 hover:border-lime-tint-border hover:bg-lime-tint-bg hover:text-lime-text"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
                    <path d={social.path} />
                  </svg>
                </a>
              ))}
            </div>
            {/* Trustpilot — our own link, NOT a TrustBox (display widgets need
                a Plus plan; see TrustpilotLink). Self-hides until reviews land. */}
            <TrustpilotLink className="mt-5" />
          </motion.div>

          {/* Link columns — Marketplace / Legal always; Policies / Support are
              desktop-only visually but stay in the HTML (SEO + compliance). */}
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
            {LINK_GROUPS.map((group) => (
              <motion.div
                key={group.title}
                variants={fadeUp}
                className={group.desktopOnly ? 'hidden sm:block' : undefined}
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

        {/* Trust strip — silver-glass icons, the site's premium material */}
        <motion.div
          variants={fadeUp}
          className="mt-10 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-border-subtle pt-7 lg:grid-cols-4 lg:gap-x-8"
        >
          {TRUST_ITEMS.map((item) => {
            const body = (
              <span className="flex items-center gap-3">
                <SilverIcon src={item.icon} className="h-8 w-8 shrink-0" />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-white">
                    {item.title}
                  </span>
                  <span className="block truncate text-xs text-text-tertiary">{item.sub}</span>
                </span>
              </span>
            )
            return item.href ? (
              <Link
                key={item.title}
                href={item.href}
                className="transition-opacity duration-200 hover:opacity-80"
              >
                {body}
              </Link>
            ) : (
              <span key={item.title}>{body}</span>
            )
          })}
        </motion.div>

        {/* Payments row + back to top */}
        <motion.div
          variants={fadeUp}
          className="mt-8 flex flex-col items-center gap-4 border-t border-border-subtle pt-6 sm:flex-row sm:justify-between"
        >
          <div
            aria-label="Accepted payment methods"
            className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-text-tertiary"
          >
            {PAYMENT_ROW.map((m) => (
              <span
                key={m.key}
                className="select-none whitespace-nowrap opacity-60 transition-opacity duration-200 hover:opacity-100"
              >
                {m.node}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary transition-all duration-200 hover:-translate-y-0.5 hover:border-lime-tint-border hover:text-lime-text"
          >
            <ArrowUp aria-hidden className="h-3.5 w-3.5" />
            Back To Top
          </button>
        </motion.div>
      </motion.div>

      {/* Bottom bar — the legally-required company details (two lines,
          left-aligned), copyright on the right. Phone/email live in the
          brand column above. */}
      <div className="relative border-t border-border-subtle bg-[#07070B]">
        <div className="mx-auto flex max-w-7xl flex-col gap-2.5 px-4 py-5 text-center sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6 sm:text-left lg:px-8">
          <p className="text-xs leading-relaxed text-text-tertiary">
            {COMPANY.name} · Company No. {COMPANY.number} · Registered in {COMPANY.jurisdiction} · VAT
            No. {COMPANY.vat}
            <span className="block">Registered office: {COMPANY.office}</span>
          </p>
          <p className="shrink-0 text-xs text-text-disabled">
            © {new Date().getFullYear()} {COMPANY.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}

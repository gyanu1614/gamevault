/**
 * Footer — compact "centered with logo" layout (aceternity-style):
 * everything stacks center-aligned — brand row, one primary nav row,
 * social icons, the compliance legal strip, and a one-line copyright.
 * Replaces the old 4-column + newsletter footer (too tall, dated, and it
 * still carried a violet glow + "G" logo tile from the GameVault era).
 * Hidden entirely on sidebar'd account/seller pages (see layout-wrapper).
 */

'use client'

import Link from 'next/link'

const NAV_LINKS: Array<{ name: string; href: string }> = [
  { name: 'Browse Listings', href: '/browse' },
  { name: 'Become A Seller', href: '/account/become-seller' },
  { name: 'SafeDrop', href: '/safedrop' },
  { name: 'Fees', href: '/fees' },
  { name: 'Blog', href: '/blog' },
  { name: 'Company', href: '/company' },
  { name: 'Contact', href: 'mailto:support@dropmarket.gg' },
]

/**
 * Full legal pack (compliance — every published document stays linked),
 * grouped into three centered mini-columns instead of one flat strip.
 */
const DOC_GROUPS: Array<{ title: string; links: Array<{ name: string; href: string }> }> = [
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

/**
 * Mobile footer (below lg) — 2-column link grid, then centered brand,
 * then a monochrome payment wordmark row. Desktop layout untouched at
 * lg+ (the original centered stack gets `hidden lg:flex`).
 */
const MOBILE_LINK_GROUPS: Array<{ title: string; links: Array<{ name: string; href: string }> }> = [
  { title: 'Marketplace', links: NAV_LINKS },
  ...DOC_GROUPS,
]

const PAYMENT_ROW: Array<{ key: string; node: React.ReactNode }> = [
  { key: 'visa', node: <span className="text-[13px] font-black italic tracking-wider">VISA</span> },
  { key: 'mastercard', node: <span className="text-[12px] font-medium lowercase tracking-tight">mastercard</span> },
  { key: 'applepay', node: <span className="text-[12.5px] font-semibold tracking-tight">&#63743; Pay</span> },
  { key: 'gpay', node: <span className="text-[12.5px] font-semibold tracking-tight"><span className="font-bold">G</span> Pay</span> },
  { key: 'btc', node: <span className="inline-flex items-baseline gap-0.5 text-[12.5px] font-bold lowercase"><span aria-hidden>₿</span>bitcoin</span> },
  { key: 'klarna', node: <span className="text-[12.5px] font-black tracking-tight">Klarna.</span> },
]

function MobileFooter() {
  return (
    <div className="lg:hidden px-5 py-10">
      {/* 2-column link grid — full compliance pack stays linked. */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-8">
        {MOBILE_LINK_GROUPS.map((group) => (
          <div key={group.title}>
            <h3 className="t-eyebrow text-text-tertiary">{group.title}</h3>
            <ul className="mt-2.5">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex min-h-[36px] items-center text-[13px] text-text-secondary transition-colors active:brightness-95 hover:text-white"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Centered brand */}
      <div className="mt-10 flex flex-col items-center gap-4 border-t border-white/[0.06] pt-8 text-center">
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

        <div className="flex items-center gap-2">
          {SOCIALS.map((social) => (
            <a
              key={social.name}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={social.name}
              className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-text-secondary transition-colors hover:border-white/25 hover:text-white"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
                <path d={social.path} />
              </svg>
            </a>
          ))}
        </div>

        {/* Payment row — monochrome wordmarks, no licensed art. */}
        <div
          aria-label="Accepted payment methods"
          className="mt-1 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-text-tertiary"
        >
          {PAYMENT_ROW.map((m) => (
            <span key={m.key} className="select-none whitespace-nowrap opacity-80">
              {m.node}
            </span>
          ))}
        </div>

        <p className="text-xs text-text-tertiary">
          © {new Date().getFullYear()} DropMarket Ltd. All rights reserved.
        </p>
      </div>
    </div>
  )
}

export function Footer() {
  return (
    <footer className="border-t border-white/[0.08] bg-[#0a0a0f]">
      <MobileFooter />
      <div className="mx-auto hidden max-w-4xl flex-col items-center gap-7 px-6 py-12 text-center lg:flex">
        {/* Brand */}
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

        {/* Primary nav */}
        <nav aria-label="Footer">
          <ul className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2.5">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-text-secondary transition-colors hover:text-white"
                >
                  {link.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Socials */}
        <div className="flex items-center gap-2">
          {SOCIALS.map((social) => (
            <a
              key={social.name}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={social.name}
              className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-text-secondary transition-colors hover:border-white/25 hover:text-white"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
                <path d={social.path} />
              </svg>
            </a>
          ))}
        </div>

        {/* Docs — the full compliance pack in three centered mini-columns */}
        <div className="grid w-full max-w-2xl grid-cols-1 gap-8 border-t border-white/[0.06] pt-7 sm:grid-cols-3">
          {DOC_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                {group.title}
              </h3>
              <ul className="mt-3 space-y-1.5">
                {group.links.map((doc) => (
                  <li key={doc.href}>
                    <Link
                      href={doc.href}
                      className="text-xs text-text-secondary transition-colors hover:text-white"
                    >
                      {doc.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Copyright */}
        <p className="text-xs text-text-tertiary">
          © {new Date().getFullYear()} DropMarket Ltd. All rights reserved.
        </p>
      </div>
    </footer>
  )
}

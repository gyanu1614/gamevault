'use client'

/**
 * V29 — Site footer, Flock-Ramp layout in DropMarket clothes.
 *
 * Two-part top area:
 *   LEFT  — brand block: logo + tagline, newsletter subscribe (input +
 *           lime button) and a privacy-consent checkbox line.
 *   RIGHT — four link columns (Product / Company / Legal / Support)
 *           with the social icons row underneath.
 * Bottom — hairline-separated, centered one-line copyright.
 *
 * A soft violet radial glow sits at the very bottom edge (matches the
 * site's violet-dusk backdrop, where Flock uses purple).
 *
 * The subscribe form is a local stub — it flips to a "you're on the
 * list" state client-side. TODO: wire to a newsletter endpoint when
 * marketing has one.
 */

import { useState } from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

const footerLinks = {
  Product: [
    { name: 'Browse Listings', href: '/browse' },
    { name: 'Sell Items', href: '/sell/create' },
    { name: 'How It Works', href: '/how-it-works' },
    { name: 'Pricing', href: '/pricing' },
  ],
  Company: [
    { name: 'About Us', href: '/about' },
    { name: 'Blog', href: '/blog' },
    { name: 'Careers', href: '/careers' },
    { name: 'Contact', href: '/contact' },
  ],
  Legal: [
    { name: 'Terms of Use', href: '/terms' },
    { name: 'Privacy Policy', href: '/privacy' },
    { name: 'Refunds & Disputes', href: '/refunds' },
    { name: 'Cookie Policy', href: '/cookies' },
  ],
  Support: [
    { name: 'SafeDrop Escrow', href: '/safedrop-policy' },
    { name: 'Trust & Safety', href: '/trust-safety' },
    { name: 'Complaints', href: '/complaints' },
    { name: 'Risk Disclosure', href: '/risk' },
  ],
} as const

/** V46 — Full legal pack strip (all 17 documents) above the copyright
 *  bar. The four-column grid keeps the headline links only. */
const LEGAL_STRIP: Array<{ name: string; href: string }> = [
  { name: 'Terms', href: '/terms' },
  { name: 'Buyer Terms', href: '/buyer-terms' },
  { name: 'Seller Agreement', href: '/seller-agreement' },
  { name: 'SafeDrop', href: '/safedrop' },
  { name: 'Refunds & Disputes', href: '/refunds' },
  { name: 'Prohibited Items', href: '/prohibited' },
  { name: 'Acceptable Use', href: '/acceptable-use' },
  { name: 'Privacy', href: '/privacy' },
  { name: 'Cookies', href: '/cookies' },
  { name: 'AML/KYC', href: '/aml' },
  { name: 'Risk', href: '/risk' },
  { name: 'Fees', href: '/fees' },
  { name: 'Chargebacks', href: '/chargebacks' },
  { name: 'Complaints', href: '/complaints' },
  { name: 'IP/Takedown', href: '/ip' },
  { name: 'Trust & Safety', href: '/trust-safety' },
  { name: 'Company', href: '/company' },
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

interface FooterProps {
  hasSellerSidebar?: boolean
}

export function Footer({ hasSellerSidebar = false }: FooterProps) {
  const [email, setEmail] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [subscribed, setSubscribed] = useState(false)

  const onSubscribe = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !agreed) return
    // TODO: POST to the newsletter endpoint once marketing has one.
    setSubscribed(true)
  }

  return (
    <footer
      className={`relative overflow-hidden border-t border-white/10 bg-black ${hasSellerSidebar ? 'lg:pl-64' : ''}`}
    >
      {/* Violet dusk glow along the bottom edge (Flock's purple, ours). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-[radial-gradient(60%_120%_at_50%_100%,rgba(124,58,237,0.16),transparent_70%)]"
      />

      <div className="relative mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
          {/* ── Brand + newsletter ─────────────────────────────────── */}
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-lime text-[23px] font-black text-text-inverse">
                G
              </span>
              <span className="text-[24px] font-bold tracking-tight text-text-primary">
                DropMarket
              </span>
            </Link>

            <p className="mt-5 max-w-md text-[15.5px] leading-relaxed text-text-secondary">
              The player-to-player marketplace for game items, currency, and
              accounts — every order protected by SafeDrop escrow.
            </p>

            {/* Newsletter */}
            {subscribed ? (
              <div className="mt-7 inline-flex items-center gap-2.5 rounded-lg border border-lime/30 bg-lime/10 px-4 py-3 text-[14.5px] font-semibold text-lime-text">
                <Check className="h-4 w-4" />
                You&apos;re on the list — see you in your inbox.
              </div>
            ) : (
              <>
                <form onSubmit={onSubscribe} className="mt-7 flex max-w-md gap-2.5">
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    aria-label="Email address"
                    className="h-12 flex-1 rounded-lg border-border-default bg-bg-overlay/60 text-[14.5px]"
                  />
                  <Button
                    type="submit"
                    disabled={!email.trim() || !agreed}
                    className="h-12 shrink-0 rounded-lg bg-lime px-6 text-[14.5px] font-bold text-text-inverse hover:bg-lime-hover"
                  >
                    Subscribe
                  </Button>
                </form>
                <label className="mt-3.5 flex w-fit cursor-pointer items-center gap-2.5 text-[14px] text-text-secondary">
                  <Checkbox
                    checked={agreed}
                    onCheckedChange={(v) => setAgreed(v === true)}
                    aria-label="Agree to the Privacy Policy"
                  />
                  <span>
                    I agree to the{' '}
                    <Link
                      href="/privacy"
                      className="font-semibold text-text-primary underline-offset-2 transition-colors hover:text-lime-text hover:underline"
                    >
                      Privacy Policy
                    </Link>
                  </span>
                </label>
              </>
            )}
          </div>

          {/* ── Link columns + socials ─────────────────────────────── */}
          <div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4">
              {Object.entries(footerLinks).map(([heading, links]) => (
                <div key={heading}>
                  <h3 className="text-[15.5px] font-semibold text-text-primary">
                    {heading}
                  </h3>
                  <ul className="mt-4 space-y-3">
                    {links.map((link) => (
                      <li key={link.name}>
                        <Link
                          href={link.href}
                          className="text-[15px] text-text-tertiary transition-colors hover:text-text-primary"
                        >
                          {link.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Socials */}
            <div className="mt-12 flex items-center gap-5">
              {SOCIALS.map((s) => (
                <a
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text-tertiary transition-colors hover:text-text-primary"
                >
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d={s.path} />
                  </svg>
                  <span className="sr-only">{s.name}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Legal strip — all 17 policy documents ────────────────── */}
      <div className="relative border-t border-white/5">
        <nav
          aria-label="Legal"
          className="mx-auto flex max-w-7xl flex-wrap justify-center gap-x-5 gap-y-2 px-4 py-5 sm:px-6 lg:px-8"
        >
          {LEGAL_STRIP.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-[12.5px] text-text-tertiary transition-colors hover:text-text-primary"
            >
              {l.name}
            </Link>
          ))}
        </nav>
      </div>

      {/* ── Bottom bar — statutory disclosures ───────────────────── */}
      <div className="relative border-t border-white/5">
        <p className="mx-auto max-w-7xl px-4 py-7 text-center text-[13.5px] leading-relaxed text-text-tertiary sm:px-6 lg:px-8">
          © {new Date().getFullYear()} DropMarket Ltd. All rights
          reserved. · Company No. 17309867 · Registered in England &amp; Wales ·
          82a James Carter Road, Mildenhall, Bury St. Edmunds, IP28 7DE
        </p>
      </div>
    </footer>
  )
}

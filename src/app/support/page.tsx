/**
 * /support — the destination every "Support" link in the app points at
 * (user menu, settings, checkout, the new mobile menu). Until now it
 * 404'd. A simple themed hub: contact card + the self-serve paths that
 * solve most tickets before they're written.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { Mail, ShieldCheck, Package, FileText, ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Support | DropMarket',
  description: 'Get help with orders, payments, and your DropMarket account.',
}

const QUICK_LINKS = [
  {
    href: '/account/orders',
    Icon: Package,
    title: 'An Order Issue?',
    body: 'Open the order and use its chat — sellers answer fastest there, and every message counts in a dispute.',
  },
  {
    href: '/safedrop',
    Icon: ShieldCheck,
    title: 'How You’re Protected',
    body: 'SafeDrop Buyer Protection: pay, receive, confirm — sellers are paid after you are happy.',
  },
  {
    href: '/legal/terms',
    Icon: FileText,
    title: 'Policies & Terms',
    body: 'Refunds, disputes, and the rules both sides agree to.',
  },
] as const

export default function SupportPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 pb-24 pt-10 lg:pt-16">
      <p className="t-eyebrow text-lime-text">Support</p>
      <h1 className="t-hero mt-2 text-text-primary md:text-4xl">How Can We Help?</h1>
      <p className="t-body mt-3 text-text-secondary">
        Real humans, usually within a few hours — every day of the week.
      </p>

      {/* Contact card — deep-forest primary, house 3D recipe */}
      <a
        href="mailto:support@dropmarket.gg"
        className="mt-7 flex items-center gap-4 rounded-2xl p-5 transition-transform active:scale-[0.99]"
        style={{
          backgroundColor: '#14432A',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -2px 0 rgba(0,0,0,0.28), 0 16px 36px -16px rgba(15,51,32,0.6)',
        }}
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10">
          <Mail className="h-5 w-5 text-white" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold text-white">Email The Team</span>
          <span className="block truncate text-[13px] text-white/70">
            support@dropmarket.gg — include your order number if you have one
          </span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-white/60" />
      </a>

      <div className="mt-8 space-y-3">
        {QUICK_LINKS.map(({ href, Icon, title, body }) => (
          <Link
            key={href}
            href={href}
            className="flex items-start gap-3.5 rounded-2xl border border-[#A3E635]/[0.10] bg-[linear-gradient(180deg,#14241A_0%,#0E1611_100%)] p-4 transition-colors hover:border-[#A3E635]/[0.2] active:scale-[0.99]"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#A3E635]/[0.14] bg-[#1B5E3A]/[0.16]">
              <Icon className="h-4 w-4 text-lime-text" />
            </span>
            <span className="min-w-0">
              <span className="t-card block text-text-primary">{title}</span>
              <span className="t-body mt-0.5 block text-text-secondary">{body}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

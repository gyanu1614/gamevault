/**
 * /support — the help centre every "Support" link in the app points at (user
 * menu, settings, checkout, mobile menu, footer).
 *
 * Built on the pattern the large game marketplaces use (Eldorado, G2G,
 * GameBoost, PlayerAuctions, Z2U): a search-first hero, the contact channels
 * with the typical response time, topic cards that route into the policies,
 * an FAQ, the trust basics, and a final "Still Need Help?".
 *
 * Content (topics, FAQ, search) lives in src/lib/support/help-content.ts —
 * every answer restates the published policies or existing site copy.
 * Static: no cookie client, no searchParams; the search runs in the browser.
 * FAQPage JSON-LD mirrors the visible FAQ.
 */

import type { Metadata } from 'next'
import Link from '@/components/navigation/AppLink'
import { LifebuoyIcon } from '@phosphor-icons/react/dist/ssr/Lifebuoy'
import { EnvelopeSimpleIcon } from '@phosphor-icons/react/dist/ssr/EnvelopeSimple'
import { ChatsCircleIcon } from '@phosphor-icons/react/dist/ssr/ChatsCircle'
import { DiscordLogoIcon } from '@phosphor-icons/react/dist/ssr/DiscordLogo'
import { PhoneIcon } from '@phosphor-icons/react/dist/ssr/Phone'
import { ClockIcon } from '@phosphor-icons/react/dist/ssr/Clock'
import { PackageIcon } from '@phosphor-icons/react/dist/ssr/Package'
import { CreditCardIcon } from '@phosphor-icons/react/dist/ssr/CreditCard'
import { ShieldCheckIcon } from '@phosphor-icons/react/dist/ssr/ShieldCheck'
import { ScalesIcon } from '@phosphor-icons/react/dist/ssr/Scales'
import { StorefrontIcon } from '@phosphor-icons/react/dist/ssr/Storefront'
import { LockKeyIcon } from '@phosphor-icons/react/dist/ssr/LockKey'
import { SealCheckIcon } from '@phosphor-icons/react/dist/ssr/SealCheck'
import { BuildingsIcon } from '@phosphor-icons/react/dist/ssr/Buildings'
import { ArrowRightIcon } from '@phosphor-icons/react/dist/ssr/ArrowRight'
import { ArrowUpRightIcon } from '@phosphor-icons/react/dist/ssr/ArrowUpRight'
import { JsonLd, faqPage } from '@/lib/seo/jsonld'
import { DISCORD_INVITE_URL } from '@/lib/config/founding-seller'
import { MARKET_CARD, MARKET_CARD_HOVER } from '@/lib/ui/surfaces'
import { accountBtn } from '@/components/account/AccountSurface'
import { cn } from '@/lib/utils'
import { HELP_FAQ, HELP_TOPICS, type HelpTopicId } from '@/lib/support/help-content'
import { SupportSearch } from './_SupportSearch'
import { SupportFaq } from './_SupportFaq'

export const metadata: Metadata = {
  // Bare: the root layout template appends "| DropMarket".
  title: 'Support',
  description: 'Get help with orders, payments, and your DropMarket account.',
  alternates: { canonical: '/support' },
}

const SUPPORT_EMAIL = 'support@dropmarket.gg'
/** UK business line — same number as the footer's company details. */
const SUPPORT_PHONE = '+44 7476 562276'

const TOPIC_ICONS: Record<HelpTopicId, React.ReactNode> = {
  orders: <PackageIcon size={18} weight="bold" />,
  payments: <CreditCardIcon size={18} weight="bold" />,
  safedrop: <ShieldCheckIcon size={18} weight="bold" />,
  disputes: <ScalesIcon size={18} weight="bold" />,
  selling: <StorefrontIcon size={18} weight="bold" />,
  account: <LockKeyIcon size={18} weight="bold" />,
}

const CHANNELS: Array<{
  title: string
  value: string
  body: string
  href: string
  external?: boolean
  icon: React.ReactNode
}> = [
  {
    title: 'Email Support',
    value: SUPPORT_EMAIL,
    body: 'Include your order number if you have one.',
    href: `mailto:${SUPPORT_EMAIL}`,
    icon: <EnvelopeSimpleIcon size={18} weight="bold" />,
  },
  {
    title: 'Order Chat',
    value: 'From Your Order',
    body: 'Open the order and use its chat — sellers answer fastest there, and every message counts in a dispute.',
    href: '/account/orders',
    icon: <ChatsCircleIcon size={18} weight="bold" />,
  },
  {
    title: 'Discord',
    value: 'DropMarket Community',
    body: 'Join the DropMarket community on Discord.',
    href: DISCORD_INVITE_URL,
    external: true,
    icon: <DiscordLogoIcon size={18} weight="bold" />,
  },
  {
    title: 'Phone',
    value: SUPPORT_PHONE,
    body: 'DropMarket Ltd, UK business line.',
    href: `tel:${SUPPORT_PHONE.replace(/\s/g, '')}`,
    icon: <PhoneIcon size={18} weight="bold" />,
  },
]

const TRUST: Array<{ title: string; body: string; href?: string; icon: React.ReactNode }> = [
  {
    title: 'SafeDrop Protection',
    body: 'Item Guaranteed or Full Refund on every order.',
    href: '/safedrop',
    icon: <ShieldCheckIcon size={18} weight="bold" />,
  },
  {
    title: 'Verified Sellers',
    body: 'Every seller completes identity verification before they can list anything.',
    icon: <SealCheckIcon size={18} weight="bold" />,
  },
  {
    title: 'Licensed Payment Providers',
    body: 'Card and crypto payments are processed by licensed payment providers.',
    icon: <CreditCardIcon size={18} weight="bold" />,
  },
  {
    title: 'UK Registered Company',
    body: 'DropMarket Ltd, registered in England & Wales, Company No. 17309867.',
    href: '/company',
    icon: <BuildingsIcon size={18} weight="bold" />,
  },
]

function IconTile({ children }: { children: React.ReactNode }) {
  return (
    <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-white/[0.06] text-text-secondary">
      {children}
    </span>
  )
}

function SectionHeader({ id, title, lead }: { id: string; title: string; lead?: React.ReactNode }) {
  return (
    <div className="max-w-3xl">
      <h2 id={id} className="text-[22px] font-bold tracking-[-0.01em] text-text-primary">
        {title}
      </h2>
      {lead && <div className="mt-1.5 text-[14px] text-text-secondary">{lead}</div>}
    </div>
  )
}

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-bg-base">
      <JsonLd data={faqPage(HELP_FAQ.map(({ q, a }) => ({ q, a })))} />

      <div className="mx-auto w-full max-w-7xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14 lg:px-8">
        {/* ── Hero + search ─────────────────────────────────────────── */}
        <header className="mx-auto max-w-3xl text-center">
          <p className="inline-flex items-center gap-2 text-[13px] font-semibold uppercase leading-none tracking-[0.08em] text-text-secondary sm:text-[14px]">
            <LifebuoyIcon size={15} weight="bold" aria-hidden /> Help Centre
          </p>
          <h1 className="mt-3 text-[32px] font-bold leading-[1.05] tracking-[-0.02em] text-text-primary sm:text-[44px]">
            How Can We Help?
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-text-secondary">
            Search for an answer, browse a topic, or reach the team directly.
          </p>
          <SupportSearch />
        </header>

        {/* ── Contact channels ──────────────────────────────────────── */}
        <section aria-labelledby="support-contact" className="mt-16">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <SectionHeader id="support-contact" title="Contact Us" />
            <p className="inline-flex items-center gap-2 rounded-md bg-white/[0.05] px-3 py-2 text-[13px] text-text-secondary">
              <ClockIcon size={15} weight="bold" aria-hidden className="text-text-tertiary" />
              Real humans, usually within a few hours — every day of the week.
            </p>
          </div>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {CHANNELS.map((c) => {
              const content = (
                <>
                  <span className="flex items-center justify-between gap-3">
                    <IconTile>{c.icon}</IconTile>
                    {c.external ? (
                      <ArrowUpRightIcon size={14} weight="bold" aria-hidden className="text-text-tertiary" />
                    ) : (
                      <ArrowRightIcon
                        size={14}
                        weight="bold"
                        aria-hidden
                        className="text-text-tertiary transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                      />
                    )}
                  </span>
                  <span className="mt-4 block text-[15px] font-semibold text-text-primary">{c.title}</span>
                  <span className="mt-0.5 block truncate text-[13.5px] font-medium text-text-secondary">{c.value}</span>
                  <span className="mt-2 block text-[13px] leading-relaxed text-text-tertiary">{c.body}</span>
                </>
              )
              const cls = cn('group flex h-full flex-col rounded-lg p-5', MARKET_CARD, MARKET_CARD_HOVER)
              return (
                <li key={c.title}>
                  {c.href.startsWith('/') ? (
                    <Link href={c.href} className={cls}>
                      {content}
                    </Link>
                  ) : (
                    <a
                      href={c.href}
                      className={cls}
                      {...(c.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    >
                      {content}
                    </a>
                  )}
                </li>
              )
            })}
          </ul>
        </section>

        {/* ── Topics ────────────────────────────────────────────────── */}
        <section aria-labelledby="support-topics" className="mt-16">
          <SectionHeader
            id="support-topics"
            title="Browse Help Topics"
            lead="Each topic links straight to the policy section that answers it."
          />
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {HELP_TOPICS.map((t) => (
              <li
                key={t.id}
                id={`topic-${t.id}`}
                tabIndex={-1}
                className={cn(
                  'flex flex-col rounded-lg p-5 outline-none scroll-mt-[calc(var(--navbar-bottom)+24px)] focus-visible:ring-2 focus-visible:ring-focus-ring',
                  MARKET_CARD,
                )}
              >
                <div className="flex items-center gap-3">
                  <IconTile>{TOPIC_ICONS[t.id]}</IconTile>
                  <h3 className="text-[16px] font-semibold text-text-primary">{t.title}</h3>
                </div>
                <p className="mt-3 text-[13.5px] leading-relaxed text-text-secondary">{t.summary}</p>
                <ul className="mt-4 divide-y divide-white/[0.07] border-t border-white/[0.07]">
                  {t.links.map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        className="group flex min-h-[44px] items-center justify-between gap-3 py-2.5 text-[14px] font-medium text-text-primary transition-colors hover:text-white"
                      >
                        {l.label}
                        <ArrowRightIcon
                          size={13}
                          weight="bold"
                          aria-hidden
                          className="shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>

        {/* ── FAQ ───────────────────────────────────────────────────── */}
        <section
          id="faq"
          aria-labelledby="support-faq"
          className="mt-16 scroll-mt-[calc(var(--navbar-bottom)+24px)]"
        >
          <SectionHeader
            id="support-faq"
            title="Frequently Asked Questions"
            lead={
              <>
                Short answers from our policies. The full rules are in the{' '}
                <Link
                  href="/refunds"
                  className="font-medium text-text-primary underline decoration-white/30 underline-offset-4 hover:decoration-white/70"
                >
                  Refund &amp; Dispute Policy
                </Link>{' '}
                and the{' '}
                <Link
                  href="/terms"
                  className="font-medium text-text-primary underline decoration-white/30 underline-offset-4 hover:decoration-white/70"
                >
                  Terms of Use
                </Link>
                .
              </>
            }
          />
          <SupportFaq items={HELP_FAQ.map(({ id, q, a }) => ({ id, q, a }))} />
        </section>

        {/* ── Trust ─────────────────────────────────────────────────── */}
        <section aria-labelledby="support-trust" className="mt-16">
          <h2 id="support-trust" className="sr-only">
            Why Trade on DropMarket
          </h2>
          <ul
            className={cn(
              'grid divide-y divide-white/[0.07] rounded-lg sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x',
              MARKET_CARD,
            )}
          >
            {TRUST.map((t, i) => {
              const inner = (
                <>
                  <IconTile>{t.icon}</IconTile>
                  <span className="min-w-0">
                    <span className="block text-[14.5px] font-semibold text-text-primary">{t.title}</span>
                    <span className="mt-1 block text-[13px] leading-relaxed text-text-tertiary">{t.body}</span>
                  </span>
                </>
              )
              return (
                <li
                  key={t.title}
                  className={cn(
                    // 2-up grid on tablets: hairline under the first row only.
                    i < 2 && 'sm:border-b sm:border-white/[0.07] lg:border-b-0',
                  )}
                >
                  {t.href ? (
                    <Link
                      href={t.href}
                      className="flex h-full items-start gap-3.5 p-5 transition-colors hover:bg-white/[0.03]"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div className="flex h-full items-start gap-3.5 p-5">{inner}</div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>

        {/* ── Still need help ───────────────────────────────────────── */}
        <section
          aria-labelledby="support-cta"
          className={cn(
            'mt-16 flex flex-col items-start gap-5 rounded-lg p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8',
            MARKET_CARD,
          )}
        >
          <div>
            <h2 id="support-cta" className="text-[22px] font-bold tracking-[-0.01em] text-text-primary">
              Still Need Help?
            </h2>
            <p className="mt-1.5 text-[14px] text-text-secondary">
              Email the team and include your order number if you have one.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <a href={`mailto:${SUPPORT_EMAIL}`} className={cn(accountBtn.primary, 'h-11 px-5 text-[14px]')}>
              <EnvelopeSimpleIcon size={16} weight="bold" aria-hidden /> Email Support
            </a>
            <a
              href={DISCORD_INVITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(accountBtn.secondary, 'h-11 px-5 text-[14px]')}
            >
              <DiscordLogoIcon size={16} weight="bold" aria-hidden /> Join Our Discord
            </a>
          </div>
        </section>
      </div>
    </main>
  )
}

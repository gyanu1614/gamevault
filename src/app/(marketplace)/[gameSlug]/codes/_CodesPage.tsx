import { Suspense, type ComponentType } from 'react'
import type { IconProps } from '@phosphor-icons/react'
import Link from '@/components/navigation/AppLink'
import { ArrowSquareOutIcon } from '@phosphor-icons/react/dist/ssr/ArrowSquareOut'
import { CalendarCheckIcon } from '@phosphor-icons/react/dist/ssr/CalendarCheck'
import { CaretRightIcon } from '@phosphor-icons/react/dist/ssr/CaretRight'
import { ClockCounterClockwiseIcon } from '@phosphor-icons/react/dist/ssr/ClockCounterClockwise'
import { DiscordLogoIcon } from '@phosphor-icons/react/dist/ssr/DiscordLogo'
import { HourglassLowIcon } from '@phosphor-icons/react/dist/ssr/HourglassLow'
import { LightbulbIcon } from '@phosphor-icons/react/dist/ssr/Lightbulb'
import { ProhibitIcon } from '@phosphor-icons/react/dist/ssr/Prohibit'
import { TicketIcon } from '@phosphor-icons/react/dist/ssr/Ticket'
import { UsersThreeIcon } from '@phosphor-icons/react/dist/ssr/UsersThree'
import { WarningIcon } from '@phosphor-icons/react/dist/ssr/Warning'
import { XLogoIcon } from '@phosphor-icons/react/dist/ssr/XLogo'
import { XCircleIcon } from '@phosphor-icons/react/dist/ssr/XCircle'
import { JsonLd, breadcrumbList, faqPage } from '@/lib/seo/jsonld'
import { GameHeroBackdrop } from '@/components/marketplace/GameHeroBackdrop'
import { HubNav } from '@/components/content/HubNav'
import { HubFooter } from '@/components/content/HubFooter'
import { HubHero } from '@/components/content/HubHero'
import { HubFaqSection } from '@/components/content/HubFaqSection'
import { HubCtaBand } from '@/components/content/HubCtaBand'
import { ValueCallout } from '@/components/values/ValueCallout'
import { HUB_GROUND, VALUE_LABEL, VALUE_SURFACE, VALUE_SURFACE_LINK } from '@/components/values/styles'
import { HUB_COPY, getGameContentTheme, hasHubPage } from '@/lib/content/theme'
import { getHubNavData } from '@/lib/content/hubNav'
import { getGameCtaImage } from '@/lib/content/game-cta-art.server'
import { getValueItems } from '@/lib/values/data'
import { formatCodeWhen, getFreeGuide, sortCodesNewestFirst, type FreeGuide, type PromoCode } from '@/lib/values/free-guide'
import { valueItemHasPage, valueListHub } from '@/lib/values/hub-config'
import { rarityMeta } from '@/lib/values/rarity'
import { hexRgb } from '@/lib/values/events-model'
import { cn } from '@/lib/utils'
import { WaySectionHead } from '../values/_generic/WaySectionHead'
import { usd } from '../free-items/_freeItemsCopy'
import { Block } from '../[categorySlug]/_ItemsSkeleton'
import {
  announcedHeading,
  channels,
  codesFacts,
  expiredHeading,
  faq as codesFaq,
  lead,
  pageTitle,
  promoHeading,
  redeemCallout,
  scamTitle,
  scamsCallout,
  scamsHeading,
  verdict,
  verdictLine,
  type Channel,
  type CopyCtx,
} from './_codesCopy'

/**
 * /[game]/codes — "MM2 Codes (<month>): Every Code and If Any Work". The
 * verdict first, big (no code works), with the facts in a line and where a
 * real code would be posted; then every expired code in a table, the merch
 * and toy codes that were never free (art + live price for the items with a
 * value page), the code scams, the FAQ (= FAQPage schema), cross-links and
 * the CTA band. Facts are the researched seed at build time; only the merch
 * items' art and prices are read live (tagged values reads), behind an
 * in-page Suspense that mirrors them.
 */

const ROSE = '244,114,128'
const AMBER = '250,204,21'

const CHANNEL_ICON: Record<Channel['key'], ComponentType<IconProps>> = {
  x: XLogoIcon,
  discord: DiscordLogoIcon,
  group: UsersThreeIcon,
}

export function codesCopyCtx(gameSlug: string): CopyCtx {
  const theme = getGameContentTheme(gameSlug)
  return { gameName: theme.name, shortName: valueListHub(gameSlug)?.shortName ?? theme.initials }
}

export default async function CodesPage({ gameSlug }: { gameSlug: string }) {
  const theme = getGameContentTheme(gameSlug)
  const guide = getFreeGuide(gameSlug)!
  const ctx = codesCopyCtx(gameSlug)
  const f = codesFacts(guide)
  const [hubNav, ctaBg] = await Promise.all([getHubNavData(gameSlug), getGameCtaImage(gameSlug)])
  const buyHref = hubNav.itemsHref ?? `/${gameSlug}`
  const l = lead(ctx, f)
  const qa = codesFaq(ctx, f)
  const expired = sortCodesNewestFirst(guide.codes.expired)
  const ch = channels(ctx, guide)
  const redeem = redeemCallout(ctx)
  const scams = scamsCallout(ctx)

  return (
    <main className={`relative min-h-screen ${HUB_GROUND}`}>
      <GameHeroBackdrop gameSlug={gameSlug} size="hub">
        <HubNav data={hubNav} />
        <JsonLd
          data={breadcrumbList([
            { name: 'Home', path: '/' },
            { name: theme.name, path: `/${gameSlug}` },
            { name: 'Codes', path: `/${gameSlug}/codes` },
          ])}
        />
        <JsonLd data={faqPage(qa)} />

        <section>
          <HubHero
            title={pageTitle(ctx, f)}
            lead={
              <>
                <strong className="font-semibold text-text-primary">{l.strong}</strong> {l.rest}
              </>
            }
          />
        </section>

        <div className="mx-auto w-full max-w-7xl space-y-12 px-4 pb-10 pt-4 sm:px-6 lg:px-8">
          {/* The answer: big, then the facts in a line, then where a real code would appear. */}
          <section aria-labelledby="codes-verdict" className={cn(VALUE_SURFACE, 'relative isolate overflow-hidden')}>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10"
              style={{
                background: `radial-gradient(55% 70% at 0% 0%, rgba(${ROSE},0.14) 0%, rgba(${ROSE},0.04) 45%, transparent 75%)`,
              }}
            />
            <div className="p-5 sm:p-8">
              <div className="flex items-start gap-4">
                <span
                  aria-hidden
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-lg sm:h-14 sm:w-14"
                  style={{ background: `rgba(${ROSE},0.14)`, color: `rgb(${ROSE})` }}
                >
                  <XCircleIcon size={30} weight="duotone" />
                </span>
                <div className="min-w-0">
                  <h2 id="codes-verdict" className="text-balance text-[24px] font-bold leading-8 tracking-tight text-text-primary sm:text-[30px] sm:leading-9">
                    {verdict(ctx, f)}
                  </h2>
                  <p className="mt-1.5 text-body leading-7 text-text-secondary">{verdictLine(ctx, f)}</p>
                </div>
              </div>

              <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-white/[0.07] pt-6 lg:grid-cols-4">
                <Fact icon={TicketIcon} tint={ROSE} label="Working Codes" value={String(f.working)} />
                <Fact icon={HourglassLowIcon} label="Expired Codes" value={String(f.expired)} />
                {f.last && (
                  <Fact icon={ClockCounterClockwiseIcon} label="Last Free Code" value={`${f.last.code}${f.lastWhen ? ` · ${f.lastWhen}` : ''}`} />
                )}
                <Fact icon={CalendarCheckIcon} label="Last Checked" value={<time dateTime={guide.checkedAt}>{f.checked}</time>} />
              </dl>

              {ch.length > 0 && (
                <div className="mt-7 border-t border-white/[0.07] pt-6">
                  <WaySectionHead n={1} title={announcedHeading(ctx)} tone="neutral" as="h2" />
                  <ul className="mt-6">
                    {ch.map((c, i) => (
                      <ChannelRow key={c.key} channel={c} first={i === 0} />
                    ))}
                  </ul>
                  <ValueCallout tone="yellow" icon={LightbulbIcon} title={redeem.title} className="mt-5">
                    {redeem.body}
                  </ValueCallout>
                </div>
              )}
            </div>
          </section>

          {/* Every expired code: a real table (code · reward · when), newest first. */}
          <section aria-label={expiredHeading(ctx, expired.length)} className={VALUE_SURFACE}>
            <div className="p-5 sm:p-8">
              <WaySectionHead n={2} title={expiredHeading(ctx, expired.length)} tone="neutral" as="h2" />
              <table className="mt-6 w-full table-fixed border-collapse text-left">
                <caption className="sr-only">Every expired {ctx.gameName} code, its reward and when it ran</caption>
                <thead>
                  <tr className={VALUE_LABEL}>
                    <th scope="col" className="w-[38%] pb-2.5 font-medium sm:w-[22%]">Code</th>
                    <th scope="col" className="pb-2.5 font-medium">Reward</th>
                    <th scope="col" className="hidden w-[36%] pb-2.5 font-medium sm:table-cell">When</th>
                  </tr>
                </thead>
                <tbody>
                  {expired.map((c) => (
                    <tr key={c.code} className="border-t border-white/[0.07] align-top">
                      <td className="py-3 pr-3">
                        <code className="break-all font-mono text-[14px] font-semibold tracking-wide text-text-primary">{c.code}</code>
                      </td>
                      <td className="py-3 pr-3 text-[14px] leading-6 text-text-secondary">
                        <span className="text-text-primary">{c.reward}</span>
                        <span className="block text-[13px] text-text-tertiary sm:hidden">{formatCodeWhen(c.when)}</span>
                        {c.notes && <span className="mt-0.5 block text-[12px] leading-5 text-text-tertiary">{c.notes}</span>}
                      </td>
                      <td className="hidden py-3 text-[14px] leading-6 text-text-secondary sm:table-cell">{formatCodeWhen(c.when)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <Suspense fallback={<PromoSkeleton count={guide.codes.promo.length} />}>
            <PromoSection gameSlug={gameSlug} ctx={ctx} guide={guide} />
          </Suspense>

          <section aria-label={scamsHeading(ctx)} className={VALUE_SURFACE}>
            <div className="p-5 sm:p-8">
              <WaySectionHead n={4} title={scamsHeading(ctx)} tone="neutral" as="h2" />
              <ul className="mt-6 grid grid-cols-1 gap-x-8 lg:grid-cols-2">
                {guide.scams.map((s, i) => (
                  <li
                    key={s.title}
                    className={cn('flex items-start gap-3 py-4', i > 0 && 'border-t border-white/[0.07]', i === 1 && 'lg:border-t-0')}
                  >
                    <span
                      aria-hidden
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-md"
                      style={{ background: `rgba(${AMBER},0.12)`, color: `rgb(${AMBER})` }}
                    >
                      <WarningIcon size={18} weight="duotone" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-semibold leading-6 text-text-primary">{scamTitle(ctx, s.title)}</h3>
                      <p className="mt-0.5 text-[14px] leading-6 text-text-secondary">{s.howItWorks}</p>
                      <p className="mt-1 text-[14px] leading-6 text-text-primary">{s.howToSpot}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <ValueCallout tone="yellow" icon={ProhibitIcon} title={scams.title} className="mt-5">
                {scams.body}
              </ValueCallout>
            </div>
          </section>

          <HubFaqSection
            title="Frequently Asked Questions"
            subtitle={`${ctx.shortName} codes, where they are posted and how to avoid code scams.`}
            items={qa}
          />

          <nav aria-label={`More ${ctx.gameName} guides`} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {hasHubPage(gameSlug, 'freeItems') && (
              <CrossLink href={`/${gameSlug}/free-items`} label="What Actually Works" title={`Free ${ctx.shortName} Items Guide`} />
            )}
            <CrossLink href={`/${gameSlug}/values`} label="What Your Items Are Worth" title={`${ctx.shortName} Value List`} />
            {hasHubPage(gameSlug, 'events') && (
              <CrossLink href={`/${gameSlug}/events`} label="Free Event Items" title={`${ctx.shortName} Events`} />
            )}
          </nav>

          <HubCtaBand
            gameSlug={gameSlug}
            bgSrc={ctaBg}
            title={`No Codes? Get ${ctx.shortName} Godlies Today`}
            body={HUB_COPY.safedrop}
            ctaLabel={`Buy ${ctx.shortName} Godlies`}
            ctaHref={buyHref}
          />
        </div>
      </GameHeroBackdrop>

      <HubFooter
        gameName={hubNav.current.name}
        gameSlug={hubNav.current.slug}
        tools={hubNav.tools}
        itemsHref={hubNav.itemsHref}
        accountsHref={hubNav.accountsHref}
      />
    </main>
  )
}

function Fact({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: ComponentType<IconProps>
  label: string
  value: React.ReactNode
  tint?: string
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span
        aria-hidden
        className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-md', tint ? '' : 'bg-white/[0.07] text-text-primary')}
        style={tint ? { background: `rgba(${tint},0.14)`, color: `rgb(${tint})` } : undefined}
      >
        <Icon size={18} weight="duotone" />
      </span>
      <div className="min-w-0">
        <dt className={VALUE_LABEL}>{label}</dt>
        <dd className="text-[15px] font-semibold leading-6 text-text-primary">{value}</dd>
      </div>
    </div>
  )
}

function ChannelRow({ channel: c, first }: { channel: Channel; first: boolean }) {
  const Icon = CHANNEL_ICON[c.key]
  return (
    <li className={cn('flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-5', !first && 'border-t border-white/[0.07]')}>
      <div className="flex min-w-0 flex-1 items-start gap-3.5">
        <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-white/[0.07] text-text-primary">
          <Icon size={18} weight="duotone" />
        </span>
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold leading-6 text-text-primary">{c.name}</h3>
          <p className="mt-0.5 text-[14px] leading-6 text-text-secondary">{c.line}</p>
        </div>
      </div>
      <a
        href={c.href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="inline-flex h-10 shrink-0 items-center justify-center gap-2 self-start rounded-md bg-bg-overlay px-4 text-[13px] font-semibold text-text-primary transition-colors hover:bg-bg-overlay-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring sm:ml-auto sm:self-center"
      >
        {c.cta}
        <ArrowSquareOutIcon aria-hidden size={15} weight="bold" className="text-text-tertiary" />
      </a>
    </li>
  )
}

function CrossLink({ href, label, title }: { href: string; label: string; title: string }) {
  return (
    <Link
      href={href}
      className={`${VALUE_SURFACE_LINK} group flex items-center justify-between gap-3 px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring`}
    >
      <span>
        <span className={`block ${VALUE_LABEL}`}>{label}</span>
        <span className="block text-body-sm font-semibold text-text-primary">{title}</span>
      </span>
      <CaretRightIcon aria-hidden size={20} weight="bold" className="shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-text-primary" />
    </Link>
  )
}

/** "Eternal II (Godly knife)" → "eternal-ii": the catalogue slug to try for a promo item. */
const promoSlug = (item: string) =>
  item
    .replace(/\s*\(.*$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** Merch and toy codes (never free): art + live price + value page for the items that have one. */
async function PromoSection({ gameSlug, ctx, guide }: { gameSlug: string; ctx: CopyCtx; guide: FreeGuide }) {
  const items = await getValueItems(gameSlug, { kinds: ['item'] })
  const bySlug = new Map(items.map((i) => [i.slug, i]))
  return (
    <section aria-label={promoHeading(ctx)} className={VALUE_SURFACE}>
      <div className="p-5 sm:p-8">
        <WaySectionHead n={3} title={promoHeading(ctx)} tone="neutral" as="h2" />
        <ul className="mt-6">
          {guide.codes.promo.map((p, i) => (
            <PromoRow key={p.item} gameSlug={gameSlug} promo={p} item={bySlug.get(promoSlug(p.item)) ?? null} first={i === 0} />
          ))}
        </ul>
      </div>
    </section>
  )
}

function PromoRow({
  gameSlug,
  promo: p,
  item,
  first,
}: {
  gameSlug: string
  promo: PromoCode
  item: Awaited<ReturnType<typeof getValueItems>>[number] | null
  first: boolean
}) {
  const cheapest = item?.price?.cheapestUsd ?? null
  const href =
    item && valueItemHasPage(gameSlug, { rarity: item.rarity, priced: cheapest != null }) ? `/${gameSlug}/values/${item.slug}` : null
  const rgb = hexRgb(rarityMeta(gameSlug, item?.rarity ?? null).color)
  const art = item?.imageUrl ? (
    <span
      className="grid h-11 w-11 shrink-0 place-items-center rounded-md"
      style={{ background: `radial-gradient(closest-side, rgba(${rgb},0.28), rgba(${rgb},0.06) 70%, rgba(255,255,255,0.03))` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- catalogue art, served as-is */}
      <img src={item.imageUrl} alt={item.name} loading="lazy" decoding="async" className="h-9 w-9 object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.55)]" />
    </span>
  ) : (
    <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-white/[0.05] text-text-tertiary">
      <TicketIcon size={18} weight="duotone" />
    </span>
  )
  return (
    <li className={cn('flex items-start gap-3.5 py-3.5 sm:items-center sm:gap-5', !first && 'border-t border-white/[0.07]')}>
      {art}
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-semibold leading-6 text-text-primary">
          {href ? (
            <Link href={href} className="rounded-sm underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">
              {p.item}
            </Link>
          ) : (
            p.item
          )}
        </h3>
        <p className="mt-0.5 text-[14px] leading-6 text-text-secondary">
          {p.how} · {formatCodeWhen(p.when)}
        </p>
        <p className="text-[13px] leading-5 text-text-tertiary sm:hidden">
          {cheapest != null && <span className="font-semibold text-[#54DDBE]">From {usd(cheapest)} · </span>}
          {p.status}
        </p>
      </div>
      <div className="hidden w-[260px] shrink-0 text-right sm:block">
        {cheapest != null && <p className="text-[15px] font-semibold tabular-nums text-[#54DDBE]">From {usd(cheapest)}</p>}
        <p className="text-[13px] leading-5 text-text-tertiary">{p.status}</p>
      </div>
    </li>
  )
}

function PromoSkeleton({ count }: { count: number }) {
  return (
    <div aria-busy aria-label="Loading merch codes" className={`p-5 sm:p-8 ${VALUE_SURFACE}`}>
      <div className="flex items-center gap-3">
        <Block className="h-8 w-8 rounded-md" />
        <Block className="h-6 w-72 max-w-full" />
      </div>
      <div className="mt-6">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className={cn('flex items-center gap-5 py-3.5', i > 0 && 'border-t border-white/[0.07]')}>
            <Block className="h-11 w-11 rounded-md" />
            <div className="flex flex-1 flex-col gap-2">
              <Block className="h-4 w-48" />
              <Block className="h-3.5 w-2/3" />
            </div>
            <Block className="hidden h-9 w-40 sm:block" />
          </div>
        ))}
      </div>
    </div>
  )
}


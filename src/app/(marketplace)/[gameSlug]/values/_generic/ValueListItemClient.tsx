'use client'

/**
 * Client parts of a value-list item page (Murder Mystery 2 first): the hero,
 * the About callout + stats strip, and the price trend. Same shared pieces as
 * the Adopt Me pet page — ValueItemHero, ValueBuyActions (useBuyCta: the
 * button is DropMarket's own stock, never the market price), the stat cells,
 * PriceTrendChart — with one price per item (a Chroma is its own item, so
 * the picker is a two-way Standard ↔ Chroma switch between pages).
 */

import { VariantSelector } from '@/components/values/VariantSelector'
import { formGroup } from '@/lib/values/variant-selector'
import dynamic from 'next/dynamic'
import { useItemCta, type ItemBuy } from '@/components/values/how-to-get/HowToGetFastWay'
import { ValueItemHero, HeroBadge, TrendChartPlaceholder, confidenceMeta } from '@/components/values/ValueItemHero'
import { ValueBuyActions } from '@/components/values/ValueBuyActions'
import { ValueBuyPanel } from '@/components/values/ValueBuyPanel'
import { noPriceFallback } from '@/lib/value-listings/buy-panel'
import { FreshnessBadge } from '@/components/content/ValuesFreshnessBadge'
import { VALUE_LABEL, VALUE_SURFACE } from '@/components/values/styles'
import type { TrendSeries } from '@/components/values/PriceTrendChart'
import { TagIcon } from '@phosphor-icons/react/dist/csr/Tag'
import { SealCheckIcon } from '@phosphor-icons/react/dist/csr/SealCheck'
import { UsersThreeIcon } from '@phosphor-icons/react/dist/csr/UsersThree'
import { GaugeIcon } from '@phosphor-icons/react/dist/csr/Gauge'

// recharts is ~100KB and sits below the fold: load it after the page.
const PriceTrendChart = dynamic(
  () => import('@/components/values/PriceTrendChart').then((m) => m.PriceTrendChart),
  { ssr: false, loading: () => <TrendChartPlaceholder height={220} /> },
)

const CHEAPEST_TEAL = '#54DDBE'
const usd = (v: number) =>
  v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

/** One side of the Standard ↔ Chroma switch. */
export interface ItemForm {
  key: string
  label: string
  name: string
  href: string
  priceUsd: number | null
  color: string
  current: boolean
}


export function ValueListItemHero({
  name,
  accent,
  imageUrl,
  imageAlt,
  imageCredit,
  stats,
  cheapestUsd,
  marketUsd,
  priceChangedAt,
  buy,
  sell,
  forms,
  isNew,
  titleAs = 'h2',
}: {
  name: string
  /** Rarity colour: price label. */
  accent: string
  imageUrl: string | null
  imageAlt: string
  imageCredit: { text: string; href: string | null } | null
  stats: ReadonlyArray<{ label: string; value: string; color?: string }>
  cheapestUsd: number | null
  marketUsd: number | null
  priceChangedAt: string | null
  buy: ItemBuy
  sell: { href: string; label: string }
  forms: ItemForm[] | null
  /** Added in the last 14 days: the New tag. */
  isNew?: boolean
  /**
   * h2 under a page that prints ItemPageTitle (the MM2 list pages); h1 where
   * the hero is the page's only title (the generic item page — Steal an Egg).
   */
  titleAs?: 'h1' | 'h2'
}) {
  const cta = useItemCta(buy, name)

  return (
    <ValueItemHero
      titleAs={titleAs}
      accent={accent}
      art={{
        src: imageUrl,
        alt: imageAlt,
        caption: imageCredit ? (
          imageCredit.href ? (
            <a
              href={imageCredit.href}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="underline decoration-white/20 underline-offset-2 transition-colors hover:text-text-secondary"
            >
              {imageCredit.text}
            </a>
          ) : (
            imageCredit.text
          )
        ) : undefined,
      }}
      title={name}
      isNew={isNew}
      stats={stats.map((s) => ({
        label: s.label,
        value: s.color ? <span style={{ color: s.color }}>{s.value}</span> : s.value,
      }))}
      panel={
        <ValueBuyPanel
          cta={cta}
          itemName={name}
          marketUsd={marketUsd}
          cheapestUsd={cheapestUsd}
          fallback={noPriceFallback({ isNew: !!isNew })}
          notes={
            cheapestUsd != null && (
              <div className="mt-2.5 flex min-h-[28px] flex-wrap items-center gap-2 lg:justify-end">
                <HeroBadge color="var(--color-success)">From Reputable Sellers</HeroBadge>
              </div>
            )
          }
          sell={sell}
        />
      }
      footer={
        priceChangedAt ? (
          <FreshnessBadge updatedAt={priceChangedAt} />
        ) : cheapestUsd != null ? (
          <span className="text-[12px] text-text-tertiary">Priced from reputable sellers only</span>
        ) : (
          <span className="text-[12px] text-text-tertiary">Priced once reputable sellers list it</span>
        )
      }
      picker={forms ? <FormSwitch forms={forms} /> : undefined}
    />
  )
}

/**
 * Standard ↔ Chroma on the universal selector: each form is a link to its own
 * page (a Chroma is a separate item with its own price), the current one is
 * the active pill in its rarity colour, each with its price.
 */
function FormSwitch({ forms }: { forms: ItemForm[] }) {
  return (
    <VariantSelector
      groups={[formGroup(forms.map((f) => ({ key: f.key, label: f.label, href: f.href, priceUsd: null, color: f.color, current: f.current })), usd)]}
      onSelect={() => {}}
      labels={false}
      fill
    />
  )
}

const ABOUT_TEAL_RGB = '84,221,190'

/** One stat in the About card: tinted icon tile + label + value. */
function AboutStat({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof TagIcon
  label: string
  value: string
  color?: string
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 sm:px-5 sm:first:pl-0">
      <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-white/[0.06] text-text-secondary">
        <Icon size={18} weight="duotone" />
      </span>
      <div className="min-w-0">
        <dt className={VALUE_LABEL}>{label}</dt>
        <dd className="truncate text-[16px] font-semibold tabular-nums text-text-primary" style={color ? { color } : undefined}>
          {value}
        </dd>
      </div>
    </div>
  )
}

/**
 * "How much is X worth?" — ONE compact card (owner, 2026-10-05: the old
 * callout + four big stat cards were too big and scattered): the starting
 * price and the buy button on top, then four quiet stats on one line. No
 * listing counts — the value is the verified market price from professional
 * sellers.
 */
export function ValueListAboutStats({
  name,
  cheapestUsd,
  marketUsd,
  confidence,
  buy,
}: {
  name: string
  cheapestUsd: number | null
  marketUsd: number | null
  confidence: string | null
  buy: ItemBuy
}) {
  const cta = useItemCta(buy, name)
  return (
    <div className={`${VALUE_SURFACE} relative isolate overflow-hidden p-5 sm:p-6`}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: `radial-gradient(50% 90% at 0% 0%, rgba(${ABOUT_TEAL_RGB},0.10), transparent 70%)` }}
      />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[12px] font-medium text-text-tertiary">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: CHEAPEST_TEAL }} />
            {name} · Starting From
          </p>
          <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="text-[32px] font-bold leading-none tracking-[-0.02em] tabular-nums text-text-primary">
              {cheapestUsd != null ? usd(cheapestUsd) : '—'}
            </span>
            <span className="text-body-sm text-text-secondary">the lowest price from professional sellers right now</span>
          </p>
        </div>
        <ValueBuyActions cta={cta} itemName={name} className="shrink-0" />
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-white/[0.07] pt-5 sm:grid-cols-4 sm:gap-0 sm:divide-x sm:divide-white/[0.07]">
        <AboutStat icon={TagIcon} label="Cheapest" value={cheapestUsd != null ? usd(cheapestUsd) : '—'} color={CHEAPEST_TEAL} />
        <AboutStat icon={SealCheckIcon} label="Verified Market Price" value={marketUsd != null ? usd(marketUsd) : '—'} />
        <AboutStat icon={UsersThreeIcon} label="Sold By" value="Professional Sellers" />
        <AboutStat icon={GaugeIcon} label="Confidence" value={confidenceMeta(confidence).label} />
      </dl>
    </div>
  )
}

/** The page's one Buy (+ optional Sell) pair, for server sections (How To Get). */
export function ValueListBuyActions({
  name,
  buy,
  sell,
  className,
}: {
  name: string
  buy: ItemBuy
  sell?: { href: string; label: string } | null
  className?: string
}) {
  const cta = useItemCta(buy, name)
  return <ValueBuyActions cta={cta} itemName={name} sell={sell} className={className} />
}

/** Daily price history: this item's line; Compare adds the other form. */
export function ValueListPriceTrend({
  series,
  selectedKey,
}: {
  series: TrendSeries[]
  selectedKey: string
}) {
  return (
    <PriceTrendChart
      series={series}
      selectedKey={selectedKey}
      formatValue={usd}
      seriesNoun="forms"
      height={220}
      idPrefix="vl-trend"
      emptyBody={(n) =>
        `We snapshot ${n}'s price every day. The trend line appears once we have a few days of data in this range.`
      }
    />
  )
}

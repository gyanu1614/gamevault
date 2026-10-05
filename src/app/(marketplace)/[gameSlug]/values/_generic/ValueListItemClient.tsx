'use client'

/**
 * Client parts of a value-list item page (Murder Mystery 2 first): the hero,
 * the About callout + stats strip, and the price trend. Same shared pieces as
 * the Adopt Me pet page — ValueItemHero, ValueBuyActions (useBuyCta: the
 * button is DropMarket's own stock, never the market price), the stat cells,
 * PriceTrendChart — with one price per item (a Chroma is its own item, so
 * the picker is a two-way Standard ↔ Chroma switch between pages).
 */

import dynamic from 'next/dynamic'
import Link from '@/components/navigation/AppLink'
import { useBuyCta } from '@/components/value-listings/useBuyCta'
import type { ItemStock } from '@/lib/value-listings/buy-state'
import { ValueItemHero, HeroBadge, TrendChartPlaceholder, confidenceMeta } from '@/components/values/ValueItemHero'
import { ValueBuyActions } from '@/components/values/ValueBuyActions'
import { BuyButtonFace } from '@/components/marketplace/BuyButton'
import { FreshnessBadge } from '@/components/content/ValuesFreshnessBadge'
import { VALUE_LABEL, VALUE_SURFACE } from '@/components/values/styles'
import { marketSecondaryUsd } from '@/lib/values/pricing'
import type { TrendSeries } from '@/components/values/PriceTrendChart'
import { LightningIcon } from '@phosphor-icons/react/dist/csr/Lightning'
import { ShoppingCartIcon } from '@phosphor-icons/react/dist/csr/ShoppingCart'
import { StorefrontIcon } from '@phosphor-icons/react/dist/csr/Storefront'
import type { WayStep } from './valueHowToGetCopy'
import { WaySectionHead } from './WaySectionHead'
import { ValueCallout } from '@/components/values/ValueCallout'
import { ShieldCheckIcon } from '@phosphor-icons/react/dist/csr/ShieldCheck'

// recharts is ~100KB and sits below the fold: load it after the page.
const PriceTrendChart = dynamic(
  () => import('@/components/values/PriceTrendChart').then((m) => m.PriceTrendChart),
  { ssr: false, loading: () => <TrendChartPlaceholder height={220} /> },
)

const CHEAPEST_TEAL = '#54DDBE'
const usd = (v: number) =>
  v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

export interface ItemBuy {
  gameSlug: string
  itemSlug: string
  categorySlug: string
  stock: ItemStock | null
}

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

function useItemCta(buy: ItemBuy, name: string) {
  return useBuyCta({
    gameSlug: buy.gameSlug,
    categorySlug: buy.categorySlug,
    itemSlug: buy.itemSlug,
    variant: null,
    variantName: name,
    stock: buy.stock,
    surface: 'value_item',
  })
}

export function ValueListItemHero({
  name,
  eyebrow,
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
}: {
  name: string
  eyebrow: string
  /** Rarity colour: glow, eyebrow, price label. */
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
}) {
  const cta = useItemCta(buy, name)
  const secondary = marketSecondaryUsd(cheapestUsd, marketUsd)

  return (
    <ValueItemHero
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
      eyebrow={
        <>
          <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: accent }} />
          {eyebrow}
        </>
      }
      title={name}
      stats={stats.map((s) => ({
        label: s.label,
        value: s.color ? <span style={{ color: s.color }}>{s.value}</span> : s.value,
      }))}
      price={{
        label: cheapestUsd != null ? 'Cheapest Price' : 'Value',
        labelColor: accent,
        value: cheapestUsd != null ? usd(cheapestUsd) : 'No price yet',
        children: (
          <>
            {secondary != null && (
              <p className="mt-1.5 text-[13px] tabular-nums text-text-tertiary">typically ~{usd(secondary)}</p>
            )}
            {cheapestUsd != null && (
              <div className="mt-2.5 flex min-h-[28px] flex-wrap items-center gap-2 lg:justify-end">
                <HeroBadge color="var(--color-success)">From reputable sellers</HeroBadge>
              </div>
            )}
          </>
        ),
      }}
      actions={<ValueBuyActions cta={cta} itemName={name} sell={sell} align="end" />}
      footer={
        priceChangedAt ? (
          <FreshnessBadge updatedAt={priceChangedAt} />
        ) : (
          <span className="text-[12px] text-text-tertiary">Priced from reputable sellers only</span>
        )
      }
      picker={forms ? <FormSwitch forms={forms} /> : undefined}
    />
  )
}

/**
 * Standard ↔ Chroma: two tiles, each a link to that form's own page (a
 * Chroma is a separate item with its own price). Active = filled with the
 * form's rarity colour, like the Adopt Me tier tiles.
 */
function FormSwitch({ forms }: { forms: ItemForm[] }) {
  const current = forms.find((f) => f.current)
  return (
    <div>
      <p className={`mb-2 ${VALUE_LABEL}`}>Form</p>
      <div className="grid grid-cols-2 gap-2">
        {forms.map((f) => {
          const body = (
            <>
              <span className="truncate">{f.label}</span>
              <span className={`tabular-nums ${f.current ? 'opacity-70' : 'text-text-tertiary'}`}>
                {f.priceUsd != null ? usd(f.priceUsd) : '—'}
              </span>
            </>
          )
          const cls =
            'flex h-11 items-center justify-center gap-2 rounded-md px-3 text-body-sm font-semibold transition-[filter,background-color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring'
          return f.current ? (
            <span
              key={f.key}
              aria-current="page"
              className={cls}
              style={{ backgroundColor: f.color, color: '#0B0810' }}
            >
              {body}
            </span>
          ) : (
            <Link
              key={f.key}
              href={f.href}
              className={`${cls} bg-bg-overlay text-text-secondary hover:bg-bg-overlay-2 hover:text-text-primary active:scale-[0.98]`}
            >
              {body}
            </Link>
          )
        })}
      </div>
      {current && (
        <p className="mt-2 text-center text-caption text-text-tertiary">
          Showing <span className="font-semibold" style={{ color: current.color }}>{current.name}</span>
        </p>
      )}
    </div>
  )
}

function ActivityCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className={`${VALUE_SURFACE} px-4 py-3.5`}>
      <dt className={VALUE_LABEL}>{label}</dt>
      <dd
        className="mt-1 text-subheading font-bold tabular-nums text-text-primary"
        style={color ? { color } : undefined}
      >
        {value}
      </dd>
    </div>
  )
}

/** The quick-answer callout + the market stats strip (Adopt Me's About block). */
export function ValueListAboutStats({
  name,
  cheapestUsd,
  marketUsd,
  listedNow,
  confidence,
  buy,
}: {
  name: string
  cheapestUsd: number | null
  marketUsd: number | null
  listedNow: number
  confidence: string | null
  buy: ItemBuy
}) {
  const cta = useItemCta(buy, name)
  return (
    <>
      {cheapestUsd != null && (
        <div
          className={`${VALUE_SURFACE} mb-6 flex flex-col gap-5 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6`}
        >
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-2 text-[12px] font-medium">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: CHEAPEST_TEAL }} />
              <span className="text-text-primary">{name}</span>
              <span className="text-text-tertiary">· Starting From</span>
            </p>
            <p className="mt-1.5 text-[30px] font-bold leading-none tracking-[-0.02em] text-text-primary tabular-nums">
              {usd(cheapestUsd)}
            </p>
            <p className="mt-1.5 text-body-sm text-text-secondary">
              The lowest price a reputable seller is asking right now.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
            {marketUsd != null && (
              <div className="sm:text-right">
                <p className={VALUE_LABEL}>Market Price</p>
                <p className="mt-0.5 text-body font-semibold tabular-nums text-text-primary">{usd(marketUsd)}</p>
              </div>
            )}
            <ValueBuyActions cta={cta} itemName={name} />
          </div>
        </div>
      )}

      <dl className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <ActivityCell label="Cheapest" value={cheapestUsd != null ? usd(cheapestUsd) : '—'} color={CHEAPEST_TEAL} />
        <ActivityCell label="Market Price" value={marketUsd != null ? usd(marketUsd) : '—'} />
        <ActivityCell label="Listed Now" value={listedNow > 0 ? listedNow.toLocaleString('en-US') : 'None'} />
        <ActivityCell label="Confidence" value={confidenceMeta(confidence).label} />
      </dl>
    </>
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

const FAST_ICONS = { store: StorefrontIcon, cart: ShoppingCartIcon, bolt: LightningIcon } as const
const FAST_GREEN = '63,217,134'
/** Steps across one line on desktop (2-up on tablets, stacked on phones). */
const FAST_COLS: Record<number, string> = { 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4' }

/**
 * How To Get, row 2 — "Buy It for Cheap": DropMarket → buy → delivered in
 * minutes, then one button. Owner, 2026-10-05: the button reads "Buy <item>";
 * it opens this item's listings when we stock it, otherwise the game's items
 * page. Client-side only for the live stock (useBuyCta); the text is in the
 * server HTML. Step 1 links to the same place as the button.
 */
export function HowToGetFastWay({
  way,
  name,
  buy,
}: {
  way: { heading: string; steps: WayStep[]; total: { label: string; value: string | null; detail: string } }
  name: string
  buy: ItemBuy
}) {
  const cta = useItemCta(buy, name)
  const href = cta.state === 'none' ? `/${buy.gameSlug}/${buy.categorySlug}` : cta.href
  const label = `Buy ${name}`
  return (
    <div className="mt-7 border-t border-white/[0.07] pt-6">
      <WaySectionHead n={2} title={way.heading} tone="green" />
      <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-center lg:gap-8">
        <ol className={`grid min-w-0 flex-1 grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 ${FAST_COLS[way.steps.length] ?? ''}`}>
          {way.steps.map((step, i) => {
            const Icon = FAST_ICONS[step.icon as keyof typeof FAST_ICONS] ?? StorefrontIcon
            const body = (
              <>
                <p className="text-[14px] font-semibold leading-5 text-text-primary">
                  <span className="sr-only">Step {i + 1}: </span>
                  {step.title}
                </p>
                <p className="mt-0.5 text-[13px] leading-5 text-text-secondary">{step.value}</p>
              </>
            )
            return (
              <li key={step.title} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-md"
                  style={{ background: `rgba(${FAST_GREEN},0.14)`, color: `rgb(${FAST_GREEN})` }}
                >
                  <Icon size={18} weight="duotone" />
                </span>
                {i === 0 ? (
                  <Link
                    href={href}
                    prefetch={false}
                    onClick={cta.onClick}
                    className="min-w-0 rounded-sm underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="min-w-0">{body}</div>
                )}
              </li>
            )
          })}
        </ol>
        <Link
          href={href}
          prefetch={false}
          onClick={cta.onClick}
          className="group inline-flex shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <BuyButtonFace size="md" className="w-full lg:w-auto">
            <span className="truncate">{label}</span>
          </BuyButtonFace>
        </Link>
      </div>
      <ValueCallout
        tone="blue"
        icon={ShieldCheckIcon}
        title={way.total.value ? `${way.total.label}: ${way.total.value}` : undefined}
        className="mt-5"
      >
        {way.total.detail}
      </ValueCallout>
    </div>
  )
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

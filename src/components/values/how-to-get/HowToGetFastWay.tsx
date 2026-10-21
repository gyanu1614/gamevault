'use client'

import Link from '@/components/navigation/AppLink'
import { useBuyCta } from '@/components/value-listings/useBuyCta'
import type { ItemStock } from '@/lib/value-listings/buy-state'
import { BuyButtonFace } from '@/components/marketplace/BuyButton'
import { ValueCallout } from '@/components/values/ValueCallout'
import type { WayStep } from '@/lib/values/how-to-get-copy'
import { LightningIcon } from '@phosphor-icons/react/dist/csr/Lightning'
import { ShoppingCartIcon } from '@phosphor-icons/react/dist/csr/ShoppingCart'
import { StorefrontIcon } from '@phosphor-icons/react/dist/csr/Storefront'
import { ShieldCheckIcon } from '@phosphor-icons/react/dist/csr/ShieldCheck'
import { WaySectionHead } from './WaySectionHead'

/** Where an item page's buy buttons go: this item's listings when we stock it. */
export interface ItemBuy {
  gameSlug: string
  itemSlug: string
  categorySlug: string
  stock: ItemStock | null
}

/** The item page's buy CTA (live stock → label + link), shared by the hero and How To Get. */
export function useItemCta(buy: ItemBuy, name: string) {
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


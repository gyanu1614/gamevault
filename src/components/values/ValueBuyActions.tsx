'use client'

import Link from 'next/link'
import { ArrowRightIcon } from '@phosphor-icons/react/dist/csr/ArrowRight'
import { BuyButtonFace } from '@/components/marketplace/BuyButton'
import type { useBuyCta } from '@/components/value-listings/useBuyCta'
import { VALUE_BTN_SECONDARY } from './styles'

type BuyCta = ReturnType<typeof useBuyCta>

/**
 * The value pages' one Buy + Sell pair (item heroes, calculators, about
 * panels). Buy = the marketplace BuyButton face (flat brand green, sweep on
 * hover) driven by `useBuyCta` (truthful state, funnel click event); Sell =
 * the neutral secondary fill. Stacked full width on phones, inline from lg.
 */
export function ValueBuyActions({
  cta,
  itemName,
  sell,
  align = 'start',
  className = '',
}: {
  cta: BuyCta
  itemName: string
  sell?: { href: string; label: string } | null
  /** Desktop alignment of the button row (phones always stack full width). */
  align?: 'start' | 'end'
  className?: string
}) {
  return (
    <div className={className}>
      <div className={`flex flex-col gap-2 lg:flex-row lg:flex-wrap ${align === 'end' ? 'lg:justify-end' : ''}`}>
        <Link
          href={cta.href}
          onClick={cta.onClick}
          aria-label={cta.state === 'none' ? `Browse items similar to ${itemName}` : `${cta.label}: ${itemName}`}
          className="group inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <BuyButtonFace size="md" className="w-full lg:w-auto">
            <span className="truncate">{cta.label}</span>
          </BuyButtonFace>
        </Link>
        {sell && (
          <Link href={sell.href} aria-label={`${sell.label}`} className={`${VALUE_BTN_SECONDARY} h-11`}>
            {sell.label}
            <ArrowRightIcon size={15} weight="bold" aria-hidden />
          </Link>
        )}
      </div>
      {cta.subline ? <p className={`mt-1.5 text-[12px] text-text-secondary ${align === 'end' ? 'lg:text-right' : ''}`}>{cta.subline}</p> : null}
    </div>
  )
}

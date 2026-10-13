'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded'
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded'
import Link from '@/components/navigation/AppLink'
import { amVariantKey } from '@/lib/value-listings/catalogs'
import { itemBuyHref, type ItemStock } from '@/lib/value-listings/buy-state'
import { formatUsd } from '@/lib/value-listings/format'
import { cn } from '@/lib/utils'
import type { AdoptMePetVariant } from './_adoptMePetTypes'
import { variantColor } from './_adoptMeVariantColor'
import { useSelectedVariant } from './_SelectedVariantContext'
import { aboutAnswer, aboutBasis, aboutFacts, formRows } from './_adoptMeAboutModel'
import { TradeValue } from '@/components/values/TradeValue'

/**
 * "About The <Pet>" (owner, 2026-10-11 revamp: structured, curated, easy to
 * read): one plain answer for the form picked in the hero (price, trade
 * value) with its source as a quiet line, then one surface with the
 * description (left, clamped behind Read More) · Quick Facts (right). The
 * Variants table is its own section after the price trend (AdoptMeFormTable).
 *
 * Replaces the old callout + four stat boxes, which repeated the hero's
 * numbers and put a second Buy button beside a different price.
 */
const CHEAPEST_TEAL = '#54DDBE'
const TRADE = new Intl.NumberFormat('en-US')

export function AdoptMeAbout({
  name,
  rarity,
  rarityColor,
  originType,
  originDetail,
  obtainabilityLabel,
  variants,
  children,
}: {
  name: string
  rarity: string
  rarityColor: string
  originType: string | null
  originDetail: string | null
  obtainabilityLabel: string
  variants: AdoptMePetVariant[]
  /** The description prose (server-rendered, with its highlights). */
  children: ReactNode
}) {
  const { selectedCode } = useSelectedVariant()
  const picked = variants.find((v) => v.variant === selectedCode) ?? variants.find((v) => v.variant === 'FR') ?? variants[0]
  const answer = aboutAnswer(name, picked)
  const basis = aboutBasis(picked)
  const facts = aboutFacts({ rarity, originType, originDetail, obtainabilityLabel }, variants)

  return (
    <section aria-labelledby="about-pet">
      <h2 id="about-pet" className="text-heading font-bold tracking-tight text-text-primary">
        About The {name}
      </h2>
      {answer && <p className="mt-3 text-body-lg font-medium leading-7 text-text-primary">{answer}</p>}
      {basis && <p className="mt-1 text-body-sm text-text-tertiary">{basis}</p>}

      <div className="mt-6 overflow-hidden rounded-[8px] bg-[#1D1E23]">
        <div className="grid md:grid-cols-[minmax(0,1fr)_280px]">
          <div className="p-5 sm:p-6">
            <ClampedText>{children}</ClampedText>
          </div>
          <aside aria-label="Quick facts" className="border-t border-white/[0.07] p-5 sm:p-6 md:border-l md:border-t-0">
            <p className="text-caption font-medium text-text-tertiary">Quick Facts</p>
            <dl className="mt-2">
              {facts.map((f) => (
                <div key={f.label} className="flex items-baseline justify-between gap-4 py-2 [&+&]:border-t [&+&]:border-white/[0.07]">
                  <dt className="text-body-sm text-text-secondary">{f.label}</dt>
                  <dd
                    className="text-right text-body-sm font-semibold tabular-nums text-text-primary"
                    style={f.label === 'Rarity' ? { color: rarityColor } : undefined}
                  >
                    {f.value}
                  </dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </div>
    </section>
  )
}

/**
 * The description, four lines then "Read More" (owner, 2026-10-12: too much
 * text up front). The full text stays in the HTML, so crawlers read all of
 * it; only the visible height is clamped. The toggle only shows when the
 * text actually overflows.
 */
function ClampedText({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [overflows, setOverflows] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => setOverflows(el.scrollHeight - el.clientHeight > 2)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div>
      <div
        ref={ref}
        id="about-pet-text"
        className={cn('text-body leading-7 text-text-secondary', !open && 'line-clamp-4')}
      >
        {children}
      </div>
      {(overflows || open) && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls="about-pet-text"
          onClick={() => setOpen((o) => !o)}
          className="mt-2 inline-flex min-h-[44px] items-center gap-1 text-body-sm font-semibold text-text-primary touch-manipulation"
        >
          {open ? 'Show Less' : 'Read More'}
          <ExpandMoreRounded
            aria-hidden
            sx={{ fontSize: 20 }}
            className={cn('transition-transform duration-200 motion-reduce:transition-none', open && 'rotate-180')}
          />
        </button>
      )}
    </div>
  )
}

/**
 * "<Pet> Variants" (owner, 2026-10-12: "Variants", not "Form"): every
 * variant with its cheapest price, trade value, listings and our own
 * "From $X", the one place to compare them. Its own section after the price
 * trend. Tap a row to pick that variant everywhere (hero, About, chart).
 */
export function AdoptMeFormTable({
  name,
  variants,
  buy,
}: {
  name: string
  variants: AdoptMePetVariant[]
  buy: { itemSlug: string; categorySlug: string; stock: ItemStock | null }
}) {
  const { selectedCode, setSelectedCode } = useSelectedVariant()
  const rows = formRows(variants, buy.stock, amVariantKey, selectedCode)
  return (
    <section aria-labelledby="pet-variants">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="pet-variants" className="text-heading font-bold tracking-tight text-text-primary">{name} Variants</h2>
        <p className="text-caption text-text-tertiary">Tap one to see it above</p>
      </div>
      <div className="mt-5 overflow-hidden rounded-[8px] bg-[#1D1E23]">
          {/* relative: the cells' sr-only spans are absolute; without a
              positioned scroller they escape it and widen the whole page
              on phones (Safari then zooms out). */}
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[520px] text-body-sm">
              <thead>
                <tr className="text-left text-caption text-text-tertiary">
                  <th scope="col" className="px-5 py-2 font-medium sm:px-6">Variant</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Cheapest</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Trade Value</th>
                  <th scope="col" className="hidden px-3 py-2 text-right font-medium sm:table-cell">Listings</th>
                  <th scope="col" className="px-5 py-2 text-right font-medium sm:px-6">On DropMarket</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const color = variantColor(r.code)
                  return (
                    <tr
                      key={r.code}
                      className={cn('border-t border-white/[0.07] transition-colors', r.selected ? '' : 'hover:bg-white/[0.03]')}
                      style={r.selected ? { backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)` } : undefined}
                    >
                      <td className="px-5 py-0 sm:px-6">
                        <button
                          type="button"
                          onClick={() => setSelectedCode(r.code)}
                          aria-pressed={r.selected}
                          className="flex w-full items-center gap-2 py-3 text-left font-semibold text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                        >
                          <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                          {r.label}
                        </button>
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums" style={{ color: r.cheapestUsd != null ? CHEAPEST_TEAL : undefined }}>
                        {r.cheapestUsd != null ? formatUsd(r.cheapestUsd) : <span className="text-text-tertiary"><span aria-hidden>—</span><span className="sr-only">None yet</span></span>}
                        {r.isEstimated && r.cheapestUsd != null && <span className="ml-1 text-caption font-medium text-text-tertiary">est.</span>}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums">
                        {r.tradeValue != null ? <TradeValue>{TRADE.format(r.tradeValue)}</TradeValue> : <span className="text-text-tertiary"><span aria-hidden>—</span><span className="sr-only">None yet</span></span>}
                      </td>
                      <td className="hidden px-3 py-3 text-right tabular-nums text-text-secondary sm:table-cell">{r.listings > 0 ? r.listings : '—'}</td>
                      <td className="px-5 py-3 text-right sm:px-6">
                        {r.ourFromUsd != null ? (
                          <Link
                            href={itemBuyHref({ gameSlug: 'adopt-me', categorySlug: buy.categorySlug, itemSlug: buy.itemSlug, variant: amVariantKey(r.code) ?? null })}
                            className="group inline-flex items-center gap-1 rounded-sm font-semibold tabular-nums text-text-primary hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                          >
                            From {formatUsd(r.ourFromUsd)}
                            <ArrowForwardRounded aria-hidden style={{ fontSize: 14 }} className="transition-transform group-hover:translate-x-0.5" />
                          </Link>
                        ) : (
                          <span className="text-text-tertiary"><span aria-hidden>—</span><span className="sr-only">None yet</span></span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
      </div>
    </section>
  )
}

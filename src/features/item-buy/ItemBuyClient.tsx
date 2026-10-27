'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { StockAlertsProvider } from '@/features/items-grid/stock-alerts-context'
import type { ItemOffer } from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_itemsTypes'
import { formatDeliveryLabel } from '@/lib/utils/delivery-time'
import { BuyPanel } from './BuyPanel'
import { FACT_ICONS, ItemFacts, type Fact } from './ItemFacts'
import { OffersList } from './OffersList'
import { PhoneBuyBar } from './PhoneBuyBar'
import { PictureBox } from './PictureBox'
import { TraitSelect } from './TraitSelect'
import { offersOfTrait, pickOffer, traitOptions, type TraitDef } from './model/offers'
import { useBuyOffer } from './use-buy-offer'

export interface ItemBuyClientProps {
  gameSlug: string
  gameName: string
  itemSlug: string
  itemName: string
  imageUrl: string | null
  rarity: { label: string; color: string } | null
  noun: 'Trait' | 'Mutation'
  traits: TraitDef[]
  /** Every live offer of the pet, any trait. */
  offers: ItemOffer[]
  offerVariants: Record<string, string | null>
  /** The trait the page opens on (the URL's), or null for Any. */
  initialTrait: string | null
  /** The pet page without a trait: the URL base when the trait changes. */
  basePath: string
  /** The trust strip (server-rendered: its Trustpilot row reads the review count). */
  trust: ReactNode
}

/**
 * The pet page's top half and offers (owner, 2026-10-27, Eldorado's offer
 * page as the reference, our own look): a compact picture with the name and
 * the offer's facts beside it, the trait picker and trust strip under it, and
 * the buy panel (seller, description, price, quantity, Buy) on the right.
 *
 * One trait at a time: the panel shows its cheapest offer (or one picked from
 * the list), the list shows the rest of that trait. Changing the trait swaps
 * both in place and replaces the URL with the trait's page (it canonicals
 * here), so a shared link opens on the same trait. Personal state (own
 * listing, alerts) is client-side; the page stays static.
 */
export function ItemBuyClient(p: ItemBuyClientProps) {
  const { offers, offerVariants, traits } = p
  const [trait, setTrait] = useState<string | null>(p.initialTrait)
  const [chosenId, setChosenId] = useState<string | null>(null)
  const [qty, setQty] = useState(1)
  const { buy, navigating, viewerId } = useBuyOffer(p.gameSlug, p.itemSlug)

  const options = useMemo(() => traitOptions(traits, offers, offerVariants, `Any ${p.noun}`), [traits, offers, offerVariants, p.noun])
  const offer = useMemo(() => pickOffer(offers, offerVariants, trait, chosenId), [offers, offerVariants, trait, chosenId])
  const others = useMemo(() => offersOfTrait(offers, offerVariants, trait).filter((o) => o.id !== offer?.id), [offers, offerVariants, trait, offer])

  useEffect(() => setQty(1), [offer?.id])

  const traitDef = (key: string | null) => (key ? traits.find((t) => t.key === key) ?? null : null)
  const named = (key: string | null) => {
    const t = traitDef(key)
    return t && t.key !== 'default' ? `${t.label} ${p.itemName}` : p.itemName
  }
  const offerVariant = offer ? offerVariants[offer.id] ?? null : null
  const shownTrait = traitDef(offer ? offerVariant : trait)
  const isOwn = !!offer && !!viewerId && offer.sellerId === viewerId

  const facts: Fact[] = [
    ...(p.rarity ? [{ key: 'rarity', label: 'Rarity', value: p.rarity.label, icon: FACT_ICONS.rarity, tone: p.rarity.color }] : []),
    ...(traits.length > 0 ? [{ key: 'trait', label: p.noun, value: shownTrait?.label ?? `Any ${p.noun}`, icon: FACT_ICONS.trait }] : []),
    ...(offer
      ? [
          { key: 'delivery', label: 'Delivery', value: formatDeliveryLabel(offer.deliveryTime), icon: FACT_ICONS.delivery },
          { key: 'stock', label: 'In Stock', value: offer.isUnlimited ? 'Unlimited' : String(offer.stock ?? 1), icon: FACT_ICONS.stock },
        ]
      : []),
  ]

  const onTrait = (next: string | null) => {
    setTrait(next)
    setChosenId(null)
    try {
      window.history.replaceState(window.history.state, '', next ? `${p.basePath}/${encodeURIComponent(next)}` : p.basePath)
    } catch {
      // A blocked history API only costs the shareable URL.
    }
  }

  const onSelect = (o: ItemOffer) => {
    setChosenId(o.id)
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    document.getElementById('buy-box')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }

  const onBuy = () => {
    if (offer) buy(offer, qty, offerVariant)
  }

  // Phones: the docked bar shows while the panel's Buy button is off screen and the footer is not on screen.
  const buyRef = useRef<HTMLDivElement>(null)
  const [buyInView, setBuyInView] = useState(true)
  const [footerInView, setFooterInView] = useState(false)
  const observe = useCallback((el: Element | null, set: (v: boolean) => void) => {
    if (!el || typeof IntersectionObserver === 'undefined') return () => {}
    const io = new IntersectionObserver(([e]) => set(e.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [])
  // The Buy block is a different element with and without an offer: observe the current one.
  const hasOffer = offer !== null
  useEffect(() => observe(buyRef.current, setBuyInView), [observe, hasOffer])
  useEffect(() => observe(document.querySelector('[data-site-footer]'), setFooterInView), [observe])

  return (
    <StockAlertsProvider gameSlug={p.gameSlug}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,380px)] lg:gap-x-10 xl:gap-x-14">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <div className="flex items-start gap-4 sm:gap-6">
            <PictureBox imageUrl={p.imageUrl} name={`${p.gameName} ${p.itemName}`} badge={shownTrait?.short ?? null} className="w-[112px] sm:w-[200px] lg:w-[232px]" />
            <div className="min-w-0 flex-1 sm:pt-1">
              <p className="flex items-center gap-2 font-medium" style={{ fontSize: 'var(--fs-meta)' }}>
                {p.rarity ? (
                  <>
                    <span style={{ color: p.rarity.color }}>{p.rarity.label}</span>
                    <span aria-hidden className="text-text-tertiary">·</span>
                  </>
                ) : null}
                <span className="text-text-secondary">{p.gameName}</span>
              </p>
              <h1
                id="item-title"
                className="mt-1.5 text-balance text-text-primary"
                style={{ fontSize: 'var(--fs-page-title)', lineHeight: 1.1, fontWeight: 'var(--fw-heading)', letterSpacing: '-0.02em' }}
              >
                {p.gameName} {p.itemName}
              </h1>
              <ItemFacts facts={facts} className="mt-5 hidden sm:grid" />
            </div>
          </div>
          <ItemFacts facts={facts} className="mt-5 sm:hidden" />
          {options.length > 0 ? (
            <div className="mt-6">
              <TraitSelect noun={p.noun} options={options} value={trait} onChange={onTrait} />
            </div>
          ) : null}
        </div>

        <aside className="min-w-0 lg:sticky lg:top-[calc(var(--game-chrome-bottom)+20px)] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          <BuyPanel
            gameSlug={p.gameSlug}
            itemSlug={p.itemSlug}
            noun={p.noun}
            trait={trait}
            offer={offer}
            wantedName={named(trait)}
            otherTraitsHaveOffers={offers.length > 0}
            qty={qty}
            onQty={setQty}
            onBuy={onBuy}
            navigating={navigating}
            isOwn={isOwn}
            buyRef={buyRef}
          />
        </aside>

        <div className="min-w-0 lg:col-start-1 lg:row-start-2">{p.trust}</div>
      </div>

      {others.length > 0 ? (
        <OffersList
          title={trait ? `${traitDef(trait)?.label ?? ''} Offers` : 'Other Offers'}
          offers={others}
          traitOf={(o) => {
            const t = traitDef(offerVariants[o.id] ?? null)
            return t ? t.short ?? t.label : null
          }}
          onSelect={onSelect}
        />
      ) : null}

      <PhoneBuyBar
        visible={!!offer && !buyInView && !footerInView}
        label={named(offerVariant)}
        total={offer ? offer.pricePerUnit * qty : 0}
        onBuy={onBuy}
        navigating={navigating}
        isOwn={isOwn}
      />
    </StockAlertsProvider>
  )
}

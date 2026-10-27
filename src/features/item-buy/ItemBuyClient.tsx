'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { StockAlertsProvider } from '@/features/items-grid/stock-alerts-context'
import type { ItemOffer } from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_itemsTypes'
import { BuyBox } from './BuyBox'
import { OffersList } from './OffersList'
import { PhoneBuyBar } from './PhoneBuyBar'
import { offersOfTrait, pickOffer, traitOptions, type TraitDef } from './model/offers'
import { useBuyOffer } from './use-buy-offer'

export interface ItemBuyClientProps {
  gameSlug: string
  gameName: string
  itemSlug: string
  itemName: string
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
  /** The picture box (server-rendered: its Trustpilot row reads the review count). */
  picture: ReactNode
}

/**
 * The pet page's top half and offers (owner, 2026-10-26). One trait at a
 * time: the buy box shows its cheapest offer (or one picked from the list),
 * the list shows the rest of that trait. Changing the trait swaps both in
 * place and updates the URL to the trait's page (it canonicals here), so a
 * shared link opens on the same trait. Personal state (own listing, alerts)
 * is client-side; the page stays static.
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
  const isOwn = !!offer && !!viewerId && offer.sellerId === viewerId

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

  // Phones: the docked bar shows while the buy box's button is off screen and the footer is not on screen.
  const buyRef = useRef<HTMLDivElement>(null)
  const [buyInView, setBuyInView] = useState(true)
  const [footerInView, setFooterInView] = useState(false)
  const observe = useCallback((el: Element | null, set: (v: boolean) => void) => {
    if (!el || typeof IntersectionObserver === 'undefined') return () => {}
    const io = new IntersectionObserver(([e]) => set(e.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [])
  // The buy block is a different element with and without an offer: observe the current one.
  const hasOffer = offer !== null
  useEffect(() => observe(buyRef.current, setBuyInView), [observe, hasOffer])
  useEffect(() => observe(document.querySelector('[data-site-footer]'), setFooterInView), [observe])

  const traitTitle = trait ? `${traitDef(trait)?.label ?? ''} Offers` : 'Other Offers'

  return (
    <StockAlertsProvider gameSlug={p.gameSlug}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-12 xl:gap-16">
        <div className="min-w-0">{p.picture}</div>
        <BuyBox
          gameSlug={p.gameSlug}
          gameName={p.gameName}
          itemSlug={p.itemSlug}
          itemName={p.itemName}
          rarity={p.rarity}
          noun={p.noun}
          traits={options}
          trait={trait}
          onTrait={onTrait}
          offer={offer}
          offerTrait={traitDef(offerVariant)?.label ?? null}
          wantedName={named(trait)}
          otherTraitsHaveOffers={offers.length > 0}
          qty={qty}
          onQty={setQty}
          onBuy={onBuy}
          navigating={navigating}
          isOwn={isOwn}
          buyRef={buyRef}
        />
      </div>

      {others.length > 0 ? (
        <OffersList
          title={traitTitle}
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

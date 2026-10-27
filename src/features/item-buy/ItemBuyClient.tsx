'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { StockAlertsProvider } from '@/features/items-grid/stock-alerts-context'
import type { ItemOffer } from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_itemsTypes'
import { BuyBox } from './BuyBox'
import { OfferTabs } from './OfferTabs'
import { PhoneBuyBar } from './PhoneBuyBar'
import { PictureStage } from './PictureStage'
import { defaultTrait, offersOfTrait, pickOffer, traitOptions, type TraitDef } from './model/offers'
import { useBuyOffer } from './use-buy-offer'

export interface ItemBuyClientProps {
  gameSlug: string
  gameName: string
  itemSlug: string
  itemName: string
  imageUrl: string | null
  noun: 'Trait' | 'Mutation'
  traits: TraitDef[]
  /** Every live offer of the pet, any trait. */
  offers: ItemOffer[]
  offerVariants: Record<string, string | null>
  /** The trait in the URL (a values page's Buy), if any. */
  urlVariant: string | null
  /** The pet page without a trait: the URL base when the trait changes. */
  basePath: string
  /** Trustpilot row (server-rendered, gated on the review count). */
  trustpilot: ReactNode
}

/**
 * The pet page (owner, 2026-10-27; built from the research board: Skinport's
 * stage + tabs, StockX's trait field and buy box, GameBoost's trust strip).
 *
 * Desktop: the picture stage with the trust strip on the left and the offer
 * tabs under it; the buy column sticky on the right. Phones: picture, buy
 * column, tabs — the name, trait, price and Buy fit the first screen, and a
 * Buy bar docks at the bottom once the box scrolls away.
 *
 * The page opens on the URL's trait, else the cheapest offer's. Picking a
 * trait shows its cheapest offer; picking a row shows that offer and its
 * trait. The URL follows the trait (its page canonicals here). Personal state
 * (own listing, alerts) is client-side; the page stays static.
 */
export function ItemBuyClient(p: ItemBuyClientProps) {
  const { offers, offerVariants, traits } = p
  const [trait, setTrait] = useState<string | null>(() => defaultTrait(traits, p.urlVariant, offers, offerVariants))
  const [chosenId, setChosenId] = useState<string | null>(null)
  const [qty, setQty] = useState(1)
  const { buy, navigating, viewerId } = useBuyOffer(p.gameSlug, p.itemSlug)

  const options = useMemo(() => traitOptions(traits, offers, offerVariants), [traits, offers, offerVariants])
  const offer = useMemo(() => pickOffer(offers, offerVariants, trait, chosenId), [offers, offerVariants, trait, chosenId])
  const allOffers = useMemo(() => offersOfTrait(offers, offerVariants, null), [offers, offerVariants])

  useEffect(() => setQty(1), [offer?.id])

  const traitDef = (key: string | null) => (key ? traits.find((t) => t.key === key) ?? null : null)
  const named = (key: string | null) => {
    const t = traitDef(key)
    return t && t.key !== 'default' ? `${t.label} ${p.itemName}` : p.itemName
  }
  const offerVariant = offer ? offerVariants[offer.id] ?? null : null
  const shown = traitDef(offer ? offerVariant : trait)
  const isOwn = !!offer && !!viewerId && offer.sellerId === viewerId

  const setUrlTrait = (next: string | null) => {
    try {
      window.history.replaceState(window.history.state, '', next ? `${p.basePath}/${encodeURIComponent(next)}` : p.basePath)
    } catch {
      // A blocked history API only costs the shareable URL.
    }
  }
  const toBuyBox = () => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    document.getElementById('buy-box')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }

  const onTrait = (next: string) => {
    setTrait(next)
    setChosenId(null)
    setUrlTrait(next)
  }
  const onSelectOffer = (o: ItemOffer) => {
    const v = offerVariants[o.id] ?? null
    setTrait(v)
    setChosenId(o.id)
    setUrlTrait(v)
    toBuyBox()
  }
  const onSelectTrait = (v: string) => {
    onTrait(v)
    toBuyBox()
  }
  const onBuy = () => {
    if (offer) buy(offer, qty, offerVariant)
  }

  // Phones: the docked bar shows while the box's Buy button is off screen and the footer is not on screen.
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
      <div className="grid grid-cols-1 gap-y-8 [grid-template-areas:'media'_'buy'_'tabs'] lg:grid-cols-[minmax(0,1fr)_400px] lg:grid-rows-[auto_1fr] lg:gap-x-12 lg:gap-y-10 lg:[grid-template-areas:'media_buy'_'tabs_buy'] xl:grid-cols-[minmax(0,1fr)_420px] xl:gap-x-16">
        <div className="min-w-0 [grid-area:media]">
          <PictureStage
            imageUrl={p.imageUrl}
            name={`${p.gameName} ${p.itemName}`}
            traitCode={shown?.short ?? null}
            trustpilot={p.trustpilot}
          />
        </div>

        <div className="min-w-0 [grid-area:buy] lg:sticky lg:top-[calc(var(--game-chrome-bottom)+24px)] lg:self-start">
          <BuyBox
            gameSlug={p.gameSlug}
            itemSlug={p.itemSlug}
            itemName={p.itemName}
            noun={p.noun}
            traits={options}
            trait={trait}
            onTrait={onTrait}
            offer={offer}
            wantedName={named(trait)}
            qty={qty}
            onQty={setQty}
            onBuy={onBuy}
            navigating={navigating}
            isOwn={isOwn}
            buyRef={buyRef}
          />
        </div>

        <div className="min-w-0 [grid-area:tabs]">
          <OfferTabs
            noun={p.noun}
            offers={allOffers}
            offerVariants={offerVariants}
            traitDefs={traits}
            traits={options}
            selectedId={offer?.id ?? null}
            onSelectOffer={onSelectOffer}
            onSelectTrait={onSelectTrait}
          />
        </div>
      </div>

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

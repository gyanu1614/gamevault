'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { StockAlertsProvider } from '@/features/items-grid/stock-alerts-context'
import type { ItemOffer } from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_itemsTypes'
import { BuyBox } from './BuyBox'
import { DeliveryNotes } from './DeliveryNotes'
import { ItemSpecs } from './ItemSpecs'
import { OffersSection } from './OffersSection'
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
  /** Spec card facts that don't depend on the offer. */
  itemType: string
  rarity: { label: string; color: string } | null
  deliveryMethod: string
  /** Delivery card text when the seller wrote no instructions. */
  deliveryFallback: string
  /** The three promises + Trustpilot (server-rendered), under the delivery instructions. */
  trust: ReactNode
}

/**
 * The pet page (owner, 2026-10-27; layout 2026-10-28, Eldorado's item page
 * as the reference; StockX's trait field and buy box).
 *
 * Desktop (owner, 2026-11-02): the left column holds ONE picture card with
 * the facts in a strip under the picture, then the delivery instructions and
 * the three promises; the buy column on the right stays in view while the
 * left column scrolls. Under that block, every offer as a full-width row with
 * the trait filter. Phones and tablets: picture card, buy column,
 * instructions, promises, and a Buy bar docks at the bottom once the box
 * scrolls away.
 *
 * The page opens on the URL's trait, else the cheapest offer's. Picking a
 * trait shows its cheapest offer; picking a row shows that offer and its
 * trait and glides back up to the buy box. The URL follows the trait (its
 * page canonicals here). Personal state (own listing, alerts) is client-side;
 * the page stays static.
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
  // Back to the top block after a pick: desktop shows it from the page top; a phone lands on the buy box.
  const toBuyBox = () => {
    const behavior: ScrollBehavior = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    if (window.matchMedia?.('(min-width: 1024px)').matches) window.scrollTo({ top: 0, behavior })
    else document.getElementById('buy-box')?.scrollIntoView({ behavior, block: 'start' })
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
      <div className="grid grid-cols-1 gap-4 [grid-template-areas:'pic'_'buy'_'notes'] lg:grid-cols-[minmax(0,1fr)_400px] lg:grid-rows-[auto_1fr] lg:gap-x-10 lg:[grid-template-areas:'pic_buy'_'notes_buy'] xl:grid-cols-[minmax(0,1fr)_420px] xl:gap-x-12">
        <div className="min-w-0 [grid-area:pic]">
          <PictureStage imageUrl={p.imageUrl} name={`${p.gameName} ${p.itemName}`} traitCode={shown?.short ?? null}>
            <ItemSpecs rarity={p.rarity} offer={offer} deliveryMethod={p.deliveryMethod} />
          </PictureStage>
        </div>

        <div className="min-w-0 pt-2 [grid-area:buy] sm:pt-4 lg:sticky lg:top-[calc(var(--game-chrome-bottom)+20px)] lg:self-start lg:pt-0">
          <BuyBox
            gameSlug={p.gameSlug}
            itemSlug={p.itemSlug}
            itemName={p.itemName}
            kicker={{ game: p.gameName, type: p.itemType, rarity: p.rarity }}
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

        <div className="min-w-0 [grid-area:notes] lg:self-start">
          {offer ? <DeliveryNotes text={offer.description ?? null} fallback={p.deliveryFallback} resetKey={offer.id} /> : null}
          {p.trust}
        </div>
      </div>

      <div className="mt-12 sm:mt-14">
        <OffersSection
          noun={p.noun}
          offers={allOffers}
          offerVariants={offerVariants}
          traitDefs={traits}
          selectedId={offer?.id ?? null}
          viewerId={viewerId}
          onSelectOffer={onSelectOffer}
        />
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

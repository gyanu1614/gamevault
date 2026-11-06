'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { StockAlertsProvider } from '@/features/items-grid/stock-alerts-context'
import type { ItemOffer } from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_itemsTypes'
import { BuyBox, ItemTitle, type ItemPickerProps } from './BuyBox'
import { DeliveryNotes } from './DeliveryNotes'
import { ItemSpecs } from './ItemSpecs'
import { OffersSection } from './OffersSection'
import { PhoneBuyBar } from './PhoneBuyBar'
import { PictureStage } from './PictureStage'
import { TraitField } from './TraitField'
import { TraitName } from './TraitName'
import { defaultTrait, formPicker, linkedOffer, offerPhotoFor, offersOfTrait, pickOffer, traitOptions, type TraitDef } from './model/offers'
import { offerLine } from './model/seller-title'
import { useBuyOffer } from './use-buy-offer'
import { ITEM_SECTION_GAP } from './layout'

export interface ItemBuyClientProps {
  gameSlug: string
  gameName: string
  itemSlug: string
  itemName: string
  imageUrl: string | null
  noun: 'Trait' | 'Mutation'
  traits: TraitDef[]
  /** Murder Mystery 2: this item and its Chroma version; picking one opens its page. */
  forms?: ReadonlyArray<{ slug: string; label: string; href: string; count: number; minPriceUsd: number | null }>
  /** Every live offer of the pet, any trait. */
  offers: ItemOffer[]
  offerVariants: Record<string, string | null>
  /** The trait in the URL (a values page's Buy), if any. */
  urlVariant: string | null
  /** The pet page without a trait: the URL base when the trait changes. */
  basePath: string
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
 * Desktop (owner, 2026-11-03, a mix of GameBoost's panel and Eldorado's facts):
 * one glass panel over the game art, the picture with the trait picker under
 * it on the left, the title, four facts with icons and the delivery
 * instructions on the right, its title level with the price; the buy card beside
 * it with the seller under it, the columns ending level (owner, 2026-11-03). Under
 * that block, every offer as a full-width row with the trait filter. Phones and tablets
 * (Eldorado's phone page as the reference, no box in a box): title, picture, the
 * facts floating 2 × 2, the buy box with the trait picker on the page,
 * instructions, and a Buy bar docks at the bottom once the box scrolls away. One
 * DOM order serves both: the panel and its grid are `display: contents` on phones
 * so their pieces take their own `order`.
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

  const router = useRouter()
  const options = useMemo(() => traitOptions(traits, offers, offerVariants), [traits, offers, offerVariants])
  const offer = useMemo(() => pickOffer(offers, offerVariants, trait, chosenId), [offers, offerVariants, trait, chosenId])
  const allOffers = useMemo(() => offersOfTrait(offers, offerVariants, null), [offers, offerVariants])

  useEffect(() => setQty(1), [offer?.id])

  // A link to one seller's offer opens on it. Read here so the page stays static.
  useEffect(() => {
    const linked = linkedOffer(window.location.search, offers)
    if (!linked) return
    setTrait(offerVariants[linked.id] ?? null)
    setChosenId(linked.id)
    // Only on arrival: after this the buyer's own picks decide.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const traitDef = (key: string | null) => (key ? traits.find((t) => t.key === key) ?? null : null)
  const named = (key: string | null) => {
    const t = traitDef(key)
    return t && t.key !== 'default' ? `${t.label} ${p.itemName}` : p.itemName
  }
  const offerVariant = offer ? offerVariants[offer.id] ?? null : null
  const shown = traitDef(offer ? offerVariant : trait)
  const isOwn = !!offer && !!viewerId && offer.sellerId === viewerId
  const photo = offerPhotoFor(p.noun, offerVariant, offer?.imageUrl)
  const line = offer ? offerLine(p.gameSlug, offer.name, { itemName: p.itemName, gameName: p.gameName, traitLabel: shown?.label }) : null
  // The mutation in the line wears its colour, the same as in the picker.
  const lineTrait = line && shown && shown.key !== 'default' && line.toLowerCase().startsWith(shown.label.toLowerCase()) ? shown : null

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
  const forms = p.forms ?? []
  const picker: ItemPickerProps | null =
    forms.length > 0
      ? formPicker(forms, p.itemSlug, (href) => router.push(href))
      : options.length > 0
        ? { noun: p.noun, options, value: trait, onChange: onTrait }
        : null
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
      {/* Desktop (owner, 2026-11-04: "2 big modals… too tight"): a small picture tile, the details floating on the page,
          one buy card, with room between them. The buy card sets the row's height; the picture column ends level with it. */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[220px_minmax(0,1fr)_340px] lg:grid-rows-[auto_auto_1fr] lg:gap-x-8 lg:gap-y-0 lg:[grid-template-areas:'pic_title_buy'_'pic_facts_buy'_'pic_notes_buy'] xl:grid-cols-[300px_minmax(0,1fr)_380px] xl:gap-x-10">
        <div className="order-1 min-w-0 lg:[grid-area:title]">
          <ItemTitle itemName={p.itemName} gameName={p.gameName} />
          {line ? (
            <p title={offer?.name} className="mt-2 flex min-w-0 items-center gap-2 truncate text-[18px] font-semibold leading-snug text-text-primary">
              {lineTrait ? (
                <>
                  <TraitName traitKey={lineTrait.key} label={lineTrait.label} />
                  <span className="truncate">{line.slice(lineTrait.label.length).trim()}</span>
                </>
              ) : (
                <span className="truncate">{line}</span>
              )}
            </p>
          ) : null}
        </div>
        <div className="order-2 min-w-0 lg:flex lg:flex-col lg:[grid-area:pic]">
          <PictureStage imageUrl={photo ?? p.imageUrl} photo={!!photo} name={`${p.gameName} ${named(offerVariant)}`} traitCode={shown?.short ?? null} />
          {picker ? (
            <div className="mt-3 hidden shrink-0 lg:block">
              <TraitField {...picker} />
            </div>
          ) : null}
        </div>
        <div className="order-3 min-w-0 lg:mt-6 lg:[grid-area:facts]">
          <ItemSpecs rarity={p.rarity} offer={offer} deliveryMethod={p.deliveryMethod} />
        </div>
        <div className="order-4 min-w-0 lg:[grid-area:buy]">
          <BuyBox
            gameSlug={p.gameSlug}
            itemSlug={p.itemSlug}
            picker={picker}
            trait={trait}
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
        {/* Desktop: as tall as the room left beside the buy card, adding none of its own, so the page never grows. */}
        <div className="order-5 min-w-0 lg:mt-6 lg:flex lg:h-0 lg:min-h-[calc(100%-1.5rem)] lg:flex-col lg:[grid-area:notes]">
          {offer ? <DeliveryNotes text={offer.description ?? null} fallback={p.deliveryFallback} resetKey={offer.id} /> : null}
          {p.trust}
        </div>
      </div>

      <div className={ITEM_SECTION_GAP}>
        <OffersSection
          noun={p.noun}
          gameSlug={p.gameSlug}
          gameName={p.gameName}
          itemName={p.itemName}
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

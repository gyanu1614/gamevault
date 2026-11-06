'use client'

/**
 * SellWizard — the seller's listing creator (/sell/new) and editor (/sell/edit/[id]).
 *
 * Three steps: 1 Category → 2 Game → 3 Details (dynamic attribute fields,
 * then title, photos, price, stock and delivery, then the terms). Edit and
 * duplicate open on Details with the listing already loaded on the server
 * (lib/sell/wizard-prefill), so there is no step-walk or client fetch chain.
 *
 * This file only composes. The parts live in ./sell-wizard:
 *   offer-form / offer-rules  the answers and the rules over them (pure, tested)
 *   hooks/*                   form state, steps + history, catalog data,
 *                             refresh persistence, publish
 *   steps/*, ui/*             the screens and their controls
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AnimatePresence, motion } from 'framer-motion'

import { fetchExistingCurrencyListingId, type SellGameOption } from '@/lib/actions/sell-wizard'
import type { GlobalCategory } from '@/lib/actions/new-schema'
import type { WizardPrefill } from '@/lib/sell/wizard-prefill'
import type { WizardStart } from '@/lib/sell/wizard-start'
import { resolveCurrencyPriceRules } from '@/lib/currency/price-rules'
import { activeDeliveryMethods } from '@/lib/currency/delivery-methods'
import { applyOptionSets } from '@/lib/sell/option-sets'
import { cn } from '@/lib/utils'
import { scrollToStep } from '@/lib/ui/scroll-into-step'

import { buildChildIndex, collectDescendantIds } from './sell-wizard/attribute-tree'
import { EMPTY_OFFER_FORM, hasDetailsInput, offerFormFromListing } from './sell-wizard/offer-form'
import {
  buildItemRows,
  initialAutoTitle,
  initialItemEntry,
  itemChainIds,
  itemListIds,
  itemSearchGame,
  itemTitle,
  nextTitle,
  pickHasNoTrait,
  pickUsesItemPicture,
  pickedRow,
  valuesForPick,
  withoutIds,
  type ItemRow,
} from './sell-wizard/item-search'
import { canContinue, canPublishOffer, priceHintInputFor, requiredAttributesFilled } from './sell-wizard/offer-rules'
import { useOfferForm } from './sell-wizard/hooks/use-offer-form'
import { useWizardSteps, type WizardStep } from './sell-wizard/hooks/use-wizard-steps'
import { useRecentGames, useSellCatalog } from './sell-wizard/hooks/use-sell-catalog'
import { useWizardSnapshot } from './sell-wizard/hooks/use-wizard-snapshot'
import { usePublishOffer } from './sell-wizard/hooks/use-publish-offer'
import { StepBar } from './sell-wizard/StepBar'
import { StepHeading } from './sell-wizard/StepHeading'
import { ChangesRequestedBanner } from './sell-wizard/ChangesRequestedBanner'
import { PolicyBanner } from './sell-wizard/PolicyBanner'
import { TermsCard } from './sell-wizard/TermsCard'
import { WizardFooter } from './sell-wizard/WizardFooter'
import { GoBackDialog } from './sell-wizard/GoBackDialog'
import { Step1Category } from './sell-wizard/steps/Step1Category'
import { Step2Game } from './sell-wizard/steps/Step2Game'
import { Step3Details } from './sell-wizard/steps/Step3Details'
import { ItemPicker } from './sell-wizard/steps/ItemPicker'
import { useTraitHint } from './sell-wizard/hooks/use-trait-hint'
import { Step4Publish } from './sell-wizard/steps/Step4Publish'

export interface SellWizardProps {
  initialCategories: GlobalCategory[]
  /** Edit mode: Save Changes updates this listing. Category and game are fixed. */
  editListingId?: string | null
  /** The listing to open (edit) or copy (duplicate), loaded on the server. */
  prefill?: WizardPrefill | null
  /** Why a duplicate could not be loaded (the wizard then starts empty). */
  prefillError?: string | null
  /** `?game=&category=`: open on this game's offer details (lib/sell/wizard-start). */
  start?: WizardStart | null
}

export default function SellWizard({ initialCategories, editListingId = null, prefill = null, prefillError = null, start = null }: SellWizardProps) {
  const router = useRouter()
  const cardRef = useRef<HTMLElement | null>(null)
  const isEditMode = !!editListingId
  const categories = initialCategories

  const prefillCategory = prefill ? categories.find((c) => c.slug === prefill.listing.category_slug) ?? null : null
  const startCategory = !prefill && !isEditMode && start ? categories.find((c) => c.slug === start.categorySlug) ?? null : null
  const [category, setCategory] = useState<GlobalCategory | null>(prefillCategory ?? startCategory)
  const [game, setGame] = useState<SellGameOption | null>(prefillCategory ? prefill?.game ?? null : startCategory ? start?.game ?? null : null)
  const { form, setForm, update, setters } = useOfferForm(() => {
    if (!prefill || !prefillCategory) return EMPTY_OFFER_FORM
    const opened = offerFormFromListing(prefill.listing, prefill.template)
    // An existing listing opens on its item, or on its manual fields if it sells something we don't list.
    const opening = itemSearchGame(prefill.game?.game_slug, prefillCategory.slug)
    if (!opening || !prefill.template) return opened
    const attrs = prefill.template.attributes
    const row = pickedRow(buildItemRows(opening, attrs), attrs, opened.fieldValues)
    return {
      ...opened,
      itemEntry: initialItemEntry(row, itemChainIds(opening, attrs), opened.fieldValues),
      autoTitle: initialAutoTitle(opened.title, row, prefill.game?.game_name ?? ''),
    }
  })
  const { step, setStep, direction } = useWizardSteps({
    initialStep: prefillCategory || startCategory ? 3 : 1,
    historyEnabled: !isEditMode,
    cardRef,
  })

  const [gameFilter, setGameFilter] = useState('')
  const [gameSortMode, setGameSortMode] = useState<'popular' | 'recent'>('popular')
  const [pendingJump, setPendingJump] = useState<WizardStep | null>(null)
  const { recentGameIds, remember } = useRecentGames()

  const catalog = useSellCatalog({
    category,
    game,
    bundleId: form.bundleId,
    region: form.region,
    platform: form.platform,
    isEditMode,
    prefill: prefillCategory ? prefill : null,
    start: startCategory ? start : null,
  })
  const { template, currencyConfig, policy } = catalog

  useWizardSnapshot({
    persist: !isEditMode,
    restore: !isEditMode && !prefill && !startCategory,
    categories,
    games: catalog.games,
    step,
    setStep,
    category,
    setCategory,
    game,
    setGame,
    form,
    setForm,
  })

  // One notice per mount: a copied listing, or why the copy failed.
  useEffect(() => {
    if (prefillError) toast.error(prefillError)
    else if (prefill && !isEditMode) toast.success('Pre-filled from your existing listing')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A game that only delivers manually (or only one way) forces the choice.
  useEffect(() => {
    if (!game) return
    const modes = game.delivery_modes
    if (modes.length === 1) update('deliveryMethod', modes[0] as 'manual' | 'instant')
    else if (!modes.includes('instant')) update('deliveryMethod', 'manual')
  }, [game, update])

  const { topLevel, childrenOf } = useMemo(() => buildChildIndex(template?.attributes ?? []), [template])

  // The search-first picker: on for a game with a catalogue whose form has loaded with item lists.
  const searchGame = useMemo(() => itemSearchGame(game?.game_slug, category?.slug), [game, category])
  const attributes = useMemo(() => template?.attributes ?? [], [template])
  const itemRows = useMemo(() => (searchGame ? buildItemRows(searchGame, attributes) : []), [searchGame, attributes])
  const usesSearch = !!searchGame && itemRows.length > 0
  const manualItem = usesSearch && form.itemEntry === 'manual'
  const picked = useMemo(() => (usesSearch ? pickedRow(itemRows, attributes, form.fieldValues) : null), [usesSearch, itemRows, attributes, form.fieldValues])
  const listIds = useMemo(() => (searchGame ? itemListIds(searchGame, attributes) : new Set<string>()), [searchGame, attributes])
  const retiredIds = useMemo(() => new Set(attributes.filter((a) => searchGame?.hidden.includes(a.slug)).map((a) => a.id)), [attributes, searchGame])
  const notAskedUnderPick = useMemo(() => new Set([...listIds, ...retiredIds]), [listIds, retiredIds])
  const itemPicture = usesSearch && pickUsesItemPicture(searchGame, picked)

  const { submitting, publish, uploading, uploadImages } = usePublishOffer({
    form,
    game,
    categorySlug: category?.slug,
    template,
    currencyConfig,
    editListingId,
    editStatus: isEditMode ? prefill?.listing.status ?? null : null,
    addImages: setters.addImages,
    useItemPicture: itemPicture,
  })

  // Never require what isn't on screen: a retired field. Entering manually asks no fields at all.
  const attributesFilled = useMemo(
    () => manualItem || requiredAttributesFilled(template, form.fieldValues, topLevel, childrenOf, usesSearch ? retiredIds : undefined),
    [template, form.fieldValues, topLevel, childrenOf, usesSearch, manualItem, retiredIds],
  )
  const deliveryMethods = useMemo(
    () => (category?.slug === 'currency' ? activeDeliveryMethods(currencyConfig) : []),
    [category, currencyConfig],
  )
  const canPublish = canPublishOffer({ form, attributesFilled, categorySlug: category?.slug, currencyConfig, deliveryMethods, policy, templateLoading: catalog.templateLoading, photosNotAsked: itemPicture })
  const priceHintInput = useMemo(
    () => priceHintInputFor({ game, category, template, values: form.fieldValues, bundleId: form.bundleId }),
    [game, category, template, form.fieldValues, form.bundleId],
  )
  const priceRules = useMemo(
    () => (category?.slug === 'currency' && currencyConfig ? resolveCurrencyPriceRules(currencyConfig) : null),
    [category, currencyConfig],
  )

  const onFieldChange = useCallback(
    (id: string, value: unknown) => {
      update('fieldValues', (prev) => {
        // Changing a parent clears its descendants, so a stale sub-pick can't
        // sit under a now-hidden parent and come back; an option can also
        // fill other fields (an MM2 item sets its rarity).
        const next: Record<string, unknown> = { ...prev, [id]: value }
        const attrs = template?.attributes ?? []
        collectDescendantIds(id, attrs).forEach((childId) => delete next[childId])
        return applyOptionSets(attrs, id, value, next)
      })
    },
    [template, update],
  )

  const gameName = game?.game_name ?? ''
  const pickItem = useCallback(
    (row: ItemRow) => {
      if (!searchGame) return
      const auto = itemTitle(row.label, gameName)
      setForm((prev) => ({
        ...prev,
        fieldValues: valuesForPick(searchGame, attributes, row, prev.fieldValues),
        title: nextTitle(prev.title, prev.autoTitle, auto),
        autoTitle: auto,
      }))
    },
    [searchGame, attributes, gameName, setForm],
  )
  const changeItem = useCallback(() => {
    if (!searchGame) return
    update('fieldValues', (prev) => withoutIds(prev, itemChainIds(searchGame, attributes)))
  }, [searchGame, attributes, update])
  const enterManually = useCallback(
    (typed: string) => {
      if (!searchGame) return
      const auto = itemTitle(typed, gameName)
      setForm((prev) => ({
        ...prev,
        itemEntry: 'manual',
        fieldValues: withoutIds(prev.fieldValues, itemChainIds(searchGame, attributes)),
        title: nextTitle(prev.title, prev.autoTitle, auto),
        autoTitle: auto,
      }))
    },
    [searchGame, attributes, gameName, setForm],
  )
  const backToSearch = useCallback(() => {
    if (!searchGame) return
    setForm((prev) => ({
      ...prev,
      itemEntry: 'search',
      fieldValues: withoutIds(prev.fieldValues, itemChainIds(searchGame, attributes)),
      title: nextTitle(prev.title, prev.autoTitle, ''),
      autoTitle: '',
    }))
  }, [searchGame, attributes, setForm])

  // Adopt Me: the title's variant pre-selects or flags the Trait pick.
  const traitHint = useTraitHint({
    gameSlug: game?.game_slug,
    template,
    title: form.title,
    values: form.fieldValues,
    onFieldChange,
    // "Fly Potion" reads as Fly; a picked egg or potion has no trait to set.
    enabled: !(searchGame && picked && pickHasNoTrait(searchGame, attributes, picked)),
  })

  /** A new game or category starts the item over; a title the seller wrote stays. */
  const resetItem = () => {
    setForm((prev) => ({ ...prev, fieldValues: {}, itemEntry: 'search', title: nextTitle(prev.title, prev.autoTitle, ''), autoTitle: '' }))
  }

  const selectCategory = (c: GlobalCategory) => {
    setCategory(c)
    setGame(null)
    catalog.clearTemplate()
    resetItem()
  }

  const selectGame = async (g: SellGameOption) => {
    // One currency listing per (seller, game): open the existing one instead
    // of letting the seller fill the form and collide at publish.
    if (category?.slug === 'currency' && !isEditMode) {
      const existing = await fetchExistingCurrencyListingId(g.game_id)
      if (existing?.id) {
        toast.success(`You already have a currency listing for ${g.game_name}. Opening it for editing…`)
        router.push(`/sell/edit/${existing.id}`)
        return
      }
    }
    if (g.game_id !== game?.game_id) resetItem()
    setGame(g)
    remember(g.game_id)
    setStep(3)
  }

  // Continue / Back swap the step in place while the window stays where the
  // button was (owner, 2026-10-14): bring the new step's heading into view
  // under the fixed wizard bar (main's pt-32 clears it).
  const firstStep = useRef(true)
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false
      return
    }
    scrollToStep(cardRef.current, 128)
  }, [step])

  const jumpToStep = (target: number) => {
    if (isEditMode || target >= step) return
    const t = target as WizardStep
    // Leaving Details re-picks the category or game, which resets the answers.
    if (step === 3 && hasDetailsInput(form)) setPendingJump(t)
    else setStep(t)
  }

  const goBack = () => {
    if (isEditMode || step === 1) router.push('/account/listings')
    else setStep((step - 1) as WizardStep)
  }

  return (
    <main
      className={cn(
        // pt clears the fixed wizard bar; `sell-form` scopes the focus-ring override in globals.css.
        'sell-form mx-auto flex w-full max-w-3xl flex-col px-4 pb-[calc(3rem+env(safe-area-inset-bottom))] pt-32 sm:px-6 sm:pt-[8.5rem]',
        step < 3 && 'min-h-[calc(100dvh-5.5rem-env(safe-area-inset-bottom))]',
      )}
    >
      <section ref={cardRef} className="relative isolate overflow-visible">
        <StepBar
          step={step}
          backLabel={isEditMode || step === 1 ? 'Back to Listings' : 'Back'}
          onBack={goBack}
          onJumpToStep={jumpToStep}
        />

        <StepHeading
          step={step}
          category={category}
          game={game}
          unitLabel={currencyConfig?.unit_label ?? null}
          unitLabelLoading={catalog.currencyConfigLoading}
        />

        {/* initial={false}: no entry animation on first paint; step changes still slide.
            popLayout, not wait: the next step slides in WHILE the last one leaves (lifted out
            of the flow by the relative section), instead of after its exit — `wait` held the
            Details form back ~0.26 s on every step change (speed audit 2026-10-29). */}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 64 * direction }}
            animate={{ opacity: 1, x: 0, transition: { duration: 0.26, ease: [0.22, 1, 0.36, 1] } }}
            exit={{ opacity: 0, x: -64 * direction, transition: { duration: 0.16, ease: [0.4, 0, 1, 1] } }}
          >
            {step === 1 && <Step1Category categories={categories} selected={category} onSelect={selectCategory} />}

            {step === 2 && category && (
              <Step2Game
                category={category}
                games={catalog.games}
                loading={catalog.gamesLoading}
                selected={game}
                onSelect={selectGame}
                filter={gameFilter}
                onFilter={setGameFilter}
                recentGameIds={recentGameIds}
                sortMode={gameSortMode}
                onSortMode={setGameSortMode}
                region={form.region}
                onRegion={setters.onRegion}
                platform={form.platform}
                onPlatform={setters.onPlatform}
              />
            )}

            {step === 3 && category && game && (
              <div className="space-y-5">
                {isEditMode && prefill?.listing.status === 'changes_requested' && (
                  <ChangesRequestedBanner notes={prefill.listing.moderation_notes} />
                )}
                <PolicyBanner policy={policy} />
                {/* Entering manually asks nothing here: what they're selling goes in the title. */}
                {manualItem ? null : usesSearch && searchGame ? (
                  <ItemPicker
                    game={searchGame}
                    gameSlug={game.game_slug}
                    rows={itemRows}
                    picked={picked}
                    attributes={attributes}
                    values={form.fieldValues}
                    childrenOf={childrenOf}
                    hiddenIds={notAskedUnderPick}
                    hint={traitHint}
                    onPick={pickItem}
                    onChange={changeItem}
                    onFieldChange={onFieldChange}
                    onManual={enterManually}
                  />
                ) : (
                  <Step3Details
                    templateLoading={catalog.templateLoading}
                    template={template}
                    topLevel={topLevel}
                    childrenOf={childrenOf}
                    values={form.fieldValues}
                    onChange={onFieldChange}
                    hint={traitHint}
                  />
                )}
                <Step4Publish
                  title={form.title}
                  setTitle={setters.setTitle}
                  description={form.description}
                  setDescription={setters.setDescription}
                  price={form.price}
                  setPrice={setters.setPrice}
                  originalPrice={form.originalPrice}
                  setOriginalPrice={setters.setOriginalPrice}
                  quantity={form.quantity}
                  setQuantity={setters.setQuantity}
                  minQuantity={form.minQuantity}
                  setMinQuantity={setters.setMinQuantity}
                  deliveryMethod={form.deliveryMethod}
                  setDeliveryMethod={setters.setDeliveryMethod}
                  deliveryTime={form.deliveryTime}
                  setDeliveryTime={setters.setDeliveryTime}
                  allowedDeliveryModes={game.delivery_modes}
                  hidePhotos={itemPicture}
                  onBackToSearch={manualItem ? backToSearch : undefined}
                  images={form.images}
                  onUpload={uploadImages}
                  onRemoveImage={setters.removeImage}
                  imageUploading={uploading}
                  priceHintInput={priceHintInput}
                  categorySlug={category.slug}
                  gameName={game.game_name}
                  gameSlug={game.game_slug}
                  gameCategoryId={game.game_category_id}
                  unitLabel={currencyConfig?.unit_label ?? null}
                  unitLabelLoading={catalog.currencyConfigLoading}
                  granularity={currencyConfig?.quantity_granularity ?? 'unit'}
                  adminMinQuantity={currencyConfig?.min_quantity ?? 1}
                  platformFields={currencyConfig?.platform_fields ?? null}
                  region={form.region}
                  onRegion={setters.onRegion}
                  platform={form.platform}
                  onPlatform={setters.onPlatform}
                  device={form.device}
                  onDevice={setters.onDevice}
                  deliveryMethods={deliveryMethods}
                  deliveryMethodType={form.deliveryMethodType}
                  onDeliveryMethodType={setters.onDeliveryMethodType}
                  bundles={currencyConfig?.bundles ?? null}
                  bundleId={form.bundleId}
                  onBundleId={setters.onBundleId}
                  existingBundleListingId={catalog.existingBundleListingId}
                  priceRules={priceRules}
                />
                <TermsCard
                  agreeSellerRules={form.agreeSellerRules}
                  setAgreeSellerRules={setters.setAgreeSellerRules}
                  agreeTos={form.agreeTos}
                  setAgreeTos={setters.setAgreeTos}
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <WizardFooter
          step={step}
          canContinue={canContinue(step, category, game, form.region)}
          canPublish={canPublish}
          submitting={submitting}
          isEditMode={isEditMode}
          onBack={() => setStep(Math.max(1, step - 1) as WizardStep)}
          onContinue={() => setStep(Math.min(3, step + 1) as WizardStep)}
          onPublish={() => publish(false)}
        />
      </section>

      <GoBackDialog
        target={pendingJump}
        onCancel={() => setPendingJump(null)}
        onConfirm={(t) => {
          setPendingJump(null)
          setStep(t)
        }}
      />
    </main>
  )
}

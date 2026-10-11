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
import { resolveCurrencyPriceRules } from '@/lib/currency/price-rules'
import { activeDeliveryMethods } from '@/lib/currency/delivery-methods'
import { applyOptionSets } from '@/lib/sell/option-sets'
import { cn } from '@/lib/utils'

import { buildChildIndex, collectDescendantIds } from './sell-wizard/attribute-tree'
import { EMPTY_OFFER_FORM, hasDetailsInput, offerFormFromListing } from './sell-wizard/offer-form'
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
import { NUMBERED_SECTIONS } from './sell-wizard/ui/SubCard'
import { WizardFooter } from './sell-wizard/WizardFooter'
import { GoBackDialog } from './sell-wizard/GoBackDialog'
import { Step1Category } from './sell-wizard/steps/Step1Category'
import { Step2Game } from './sell-wizard/steps/Step2Game'
import { Step3Details } from './sell-wizard/steps/Step3Details'
import { Step4Publish } from './sell-wizard/steps/Step4Publish'

export interface SellWizardProps {
  initialCategories: GlobalCategory[]
  /** Edit mode: Save Changes updates this listing. Category and game are fixed. */
  editListingId?: string | null
  /** The listing to open (edit) or copy (duplicate), loaded on the server. */
  prefill?: WizardPrefill | null
  /** Why a duplicate could not be loaded (the wizard then starts empty). */
  prefillError?: string | null
}

export default function SellWizard({ initialCategories, editListingId = null, prefill = null, prefillError = null }: SellWizardProps) {
  const router = useRouter()
  const cardRef = useRef<HTMLElement | null>(null)
  const isEditMode = !!editListingId
  const categories = initialCategories

  const prefillCategory = prefill ? categories.find((c) => c.slug === prefill.listing.category_slug) ?? null : null
  const [category, setCategory] = useState<GlobalCategory | null>(prefillCategory)
  const [game, setGame] = useState<SellGameOption | null>(prefillCategory ? prefill?.game ?? null : null)
  const { form, setForm, update, setters } = useOfferForm(prefill && prefillCategory ? offerFormFromListing(prefill.listing) : EMPTY_OFFER_FORM)
  const { step, setStep, direction } = useWizardSteps({
    initialStep: prefillCategory ? 3 : 1,
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
  })
  const { template, currencyConfig, policy } = catalog

  useWizardSnapshot({
    persist: !isEditMode,
    restore: !isEditMode && !prefill,
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

  const { submitting, publish, uploading, uploadImages } = usePublishOffer({
    form,
    game,
    categorySlug: category?.slug,
    template,
    currencyConfig,
    editListingId,
    editStatus: isEditMode ? prefill?.listing.status ?? null : null,
    addImages: setters.addImages,
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
  const attributesFilled = useMemo(
    () => requiredAttributesFilled(template, form.fieldValues, topLevel, childrenOf),
    [template, form.fieldValues, topLevel, childrenOf],
  )
  const deliveryMethods = useMemo(
    () => (category?.slug === 'currency' ? activeDeliveryMethods(currencyConfig) : []),
    [category, currencyConfig],
  )
  const canPublish = canPublishOffer({ form, attributesFilled, categorySlug: category?.slug, currencyConfig, deliveryMethods, policy })
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

  const selectCategory = (c: GlobalCategory) => {
    setCategory(c)
    setGame(null)
    catalog.clearTemplate()
    update('fieldValues', {})
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
    setGame(g)
    remember(g.game_id)
    setStep(3)
  }

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
        'sell-form mx-auto flex w-full max-w-3xl flex-col px-4 pb-[calc(3rem+env(safe-area-inset-bottom))] pt-[10.5rem] sm:px-6 sm:pt-[11rem]',
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

        {/* initial={false}: no entry animation on first paint; step changes still slide. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 64 * direction }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -64 * direction }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
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
              <div className={cn('space-y-5', NUMBERED_SECTIONS)}>
                {isEditMode && prefill?.listing.status === 'changes_requested' && (
                  <ChangesRequestedBanner notes={prefill.listing.moderation_notes} />
                )}
                <PolicyBanner policy={policy} />
                <Step3Details
                  templateLoading={catalog.templateLoading}
                  template={template}
                  topLevel={topLevel}
                  childrenOf={childrenOf}
                  values={form.fieldValues}
                  onChange={onFieldChange}
                />
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

import type { Attribute, AttributeTemplateFull, GlobalCategory } from '@/lib/actions/new-schema'
import type { SellGameOption, SellerPublishPolicy } from '@/lib/actions/sell-wizard'
import type { CurrencyConfig, CurrencyDeliveryMethod } from '@/lib/types/category-configs'
import type { HintInput } from '@/lib/price-helper/resolve'
import { resolveMinQuantity } from '@/lib/currency/min-quantity'
import { visiblePlatformKinds } from '@/app/(sell)/_components/PlatformFieldsBlock'

import { isVisible } from './attribute-tree'
import type { OfferForm } from './offer-form'

/**
 * The wizard's rules as pure functions: what the Continue and Create Offer
 * buttons allow, and what a publish sends. No React, so each is unit-tested
 * (offer-rules.test.ts) and the component only wires them up.
 */
type ChildIndex = Map<string, Map<string, Attribute[]>>

const isBlank = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)

function indexById(template: AttributeTemplateFull): Map<string, Attribute> {
  const byId = new Map<string, Attribute>()
  for (const a of template.attributes) byId.set(a.id, a)
  return byId
}

/** Every visible required attribute — including the sub-fields of the picked choice — has a value. */
export function requiredAttributesFilled(
  template: AttributeTemplateFull | null,
  values: Record<string, unknown>,
  topLevel: Attribute[],
  childrenOf: ChildIndex,
): boolean {
  if (!template) return true
  const byId = indexById(template)
  const check = (list: Attribute[]): boolean => {
    for (const a of list) {
      if (!isVisible(a, values, byId)) continue
      if (a.is_required && isBlank(values[a.id])) return false
      const inner = childrenOf.get(a.id)
      const v = values[a.id]
      if (inner && typeof v === 'string' && v && !check(inner.get(v) ?? [])) return false
    }
    return true
  }
  return check(topLevel)
}

/** Continue on steps 1 and 2. Step 3's action is Create Offer (canPublishOffer). */
export function canContinue(
  step: number,
  category: GlobalCategory | null,
  game: SellGameOption | null,
  region: string,
): boolean {
  if (step === 1) return !!category
  if (step === 2) return !!game && !(game.requires_region && !region)
  return false
}

export function canPublishOffer(input: {
  form: OfferForm
  attributesFilled: boolean
  categorySlug: string | undefined
  currencyConfig: CurrencyConfig | null
  deliveryMethods: CurrencyDeliveryMethod[]
  policy: SellerPublishPolicy | null
}): boolean {
  const { form, categorySlug, currencyConfig, deliveryMethods } = input
  if (!input.attributesFilled) return false
  // Currency listings skip Title + Photos: the server fills them from the currency record.
  const isCurrency = categorySlug === 'currency'
  if (!isCurrency && !form.title.trim()) return false
  if (!isCurrency && form.images.length === 0) return false
  const price = parseFloat(form.price)
  if (!Number.isFinite(price) || price <= 0) return false
  const quantity = parseInt(form.quantity, 10)
  if (!Number.isFinite(quantity) || quantity < 1) return false
  if (!form.agreeSellerRules || !form.agreeTos) return false
  if (isCurrency) {
    const vals = { region: form.region, platform: form.platform, device: form.device }
    if (visiblePlatformKinds(currencyConfig?.platform_fields).some((k) => !vals[k])) return false
    if ((currencyConfig?.bundles?.length ?? 0) > 0 && !form.bundleId) return false
    if (deliveryMethods.length > 0 && !deliveryMethods.some((m) => m.id === form.deliveryMethodType)) return false
  }
  // The server enforces the cap too; blocking here saves the round trip and the error toast.
  if (input.policy?.at_listing_limit) return false
  return true
}

/** The visible, non-empty attribute answers keyed by slug: what a listing stores as template_data. */
export function templateDataFor(template: AttributeTemplateFull | null, values: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (!template) return out
  const byId = indexById(template)
  for (const a of template.attributes) {
    if (!isVisible(a, values, byId)) continue
    const v = values[a.id]
    if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) continue
    out[a.slug] = v
  }
  return out
}

/**
 * What the market price helper asks about: the pair, plus (items only) the
 * visible dropdown picks keyed by slug. Never free text or the title, so
 * typing never re-asks the server.
 */
export function priceHintInputFor(input: {
  game: SellGameOption | null
  category: GlobalCategory | null
  template: AttributeTemplateFull | null
  values: Record<string, unknown>
  bundleId: string
}): HintInput | null {
  const { game, category, template, values } = input
  if (!game?.game_category_id || !category) return null
  const templateData: Record<string, string> = {}
  const optionLabels: Record<string, Record<string, string>> = {}
  if (category.slug === 'items' && template) {
    const byId = indexById(template)
    for (const a of template.attributes) {
      if (a.type !== 'select' && a.type !== 'image_select') continue
      const v = values[a.id]
      if (typeof v !== 'string' || !v || !isVisible(a, values, byId)) continue
      templateData[a.slug] = v
      const label = a.options?.find((o) => o.value === v)?.label
      if (label) optionLabels[a.slug] = { [v]: label }
    }
  }
  return {
    gameSlug: game.game_slug,
    categorySlug: category.slug,
    gameCategoryId: game.game_category_id,
    templateData,
    optionLabels,
    bundleId: input.bundleId || null,
  }
}

export function publishPayloadFor(input: {
  form: OfferForm
  game: SellGameOption
  categorySlug: string
  template: AttributeTemplateFull | null
  currencyConfig: CurrencyConfig | null
  asDraft: boolean
}) {
  const { form } = input
  return {
    game_id: input.game.game_id,
    category_slug: input.categorySlug,
    title: form.title.trim(),
    description: form.description,
    price: parseFloat(form.price),
    original_price: form.originalPrice ? parseFloat(form.originalPrice) : null,
    quantity: parseInt(form.quantity, 10),
    // The seller's minimum order, in the category's granularity unit. Bundles
    // sell one at a time (always 1); a flexible currency is clamped up to the
    // per-game admin floor so a stale form value can never publish below it.
    min_quantity: resolveMinQuantity({
      requested: parseInt(form.minQuantity, 10),
      adminFloor: input.currencyConfig?.min_quantity,
      stock: parseInt(form.quantity, 10),
      isBundle: !!form.bundleId,
    }),
    delivery_method: form.deliveryMethod,
    delivery_time: form.deliveryTime,
    images: form.images,
    template_data: templateDataFor(input.template, form.fieldValues),
    region: form.region || null,
    platform: form.platform || null,
    // Sent for forward-compatibility; dropped server-side until listings has a device column.
    device: form.device || null,
    bundle_id: form.bundleId || null,
    delivery_method_type: form.deliveryMethodType || null,
    status: (input.asDraft ? 'draft' : 'active') as 'draft' | 'active',
  }
}

import type { DuplicatePrefill } from '@/lib/actions/sell-wizard'

import type { WizardSnapshot } from './constants'

/**
 * The seller's answers on the Details step, as ONE value. The wizard keeps it
 * in a single state cell (hooks/use-offer-form) instead of seventeen
 * useState calls, so a snapshot, a prefill or a reset is one assignment and
 * the persistence effect depends on one object.
 */
export interface OfferForm {
  region: string
  platform: string
  /** iOS / Android / PC client for currencies that ask; '' when not asked. Not persisted. */
  device: string
  /** Currency delivery method id (Gamepass, UID / Login …); '' until picked. */
  deliveryMethodType: string
  /** Fixed-bundle currency: the bundle sold; '' for flexible currencies. */
  bundleId: string
  title: string
  description: string
  price: string
  originalPrice: string
  quantity: string
  minQuantity: string
  deliveryMethod: 'manual' | 'instant'
  deliveryTime: string
  images: string[]
  /** Attribute answers keyed by attribute id. */
  fieldValues: Record<string, unknown>
  agreeSellerRules: boolean
  agreeTos: boolean
}

export const EMPTY_OFFER_FORM: OfferForm = {
  region: '',
  platform: '',
  device: '',
  deliveryMethodType: '',
  bundleId: '',
  title: '',
  description: '',
  price: '',
  originalPrice: '',
  quantity: '1',
  minQuantity: '1',
  deliveryMethod: 'manual',
  deliveryTime: '1hr',
  images: [],
  fieldValues: {},
  agreeSellerRules: false,
  agreeTos: false,
}

/** An existing listing's answers (edit / duplicate). The terms boxes start unticked. */
export function offerFormFromListing(d: DuplicatePrefill): OfferForm {
  return {
    ...EMPTY_OFFER_FORM,
    region: d.region ?? '',
    platform: d.platform ?? '',
    deliveryMethodType: d.delivery_method_type ?? '',
    bundleId: d.bundle_id ?? '',
    title: d.title,
    description: d.description,
    price: String(d.price),
    originalPrice: d.original_price != null ? String(d.original_price) : '',
    quantity: String(d.quantity),
    minQuantity: String(d.min_quantity),
    deliveryMethod: d.delivery_method,
    deliveryTime: d.delivery_time ?? '1hr',
    images: d.images,
    fieldValues: d.template_data ?? {},
  }
}

/** A refresh snapshot back into answers; tolerant of old snapshots missing newer keys. */
export function offerFormFromSnapshot(s: Partial<WizardSnapshot>): OfferForm {
  return {
    ...EMPTY_OFFER_FORM,
    region: s.region ?? '',
    platform: s.platform ?? '',
    bundleId: s.bundleId ?? '',
    deliveryMethodType: s.deliveryMethodType ?? '',
    title: s.title ?? '',
    description: s.description ?? '',
    price: s.price ?? '',
    originalPrice: s.originalPrice ?? '',
    quantity: s.quantity ?? '1',
    minQuantity: s.minQuantity ?? '1',
    deliveryMethod: s.deliveryMethod ?? 'manual',
    deliveryTime: s.deliveryTime ?? '1hr',
    images: Array.isArray(s.images) ? s.images : [],
    fieldValues: s.fieldValues ?? {},
    agreeSellerRules: !!s.agreeSellerRules,
    agreeTos: !!s.agreeTos,
  }
}

export function toSnapshot(
  form: OfferForm,
  at: { step: number; categoryId: string | null; gameId: string | null },
): WizardSnapshot {
  const { device: _device, ...persisted } = form
  return { ...at, ...persisted }
}

/**
 * Work the seller would lose by going back from Details. Ignores the fields
 * that carry defaults (quantity 1, delivery 1hr): warning about untouched
 * defaults trains people to dismiss the dialog.
 */
export function hasDetailsInput(form: OfferForm): boolean {
  return (
    form.description.trim().length > 0 ||
    form.price.trim().length > 0 ||
    form.title.trim().length > 0 ||
    form.images.length > 0 ||
    Object.values(form.fieldValues).some((v) => v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0))
  )
}

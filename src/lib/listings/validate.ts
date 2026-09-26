/**
 * ONE listing validator for every seller write path (audit ACC-03/05/06/11,
 * BUG-02/13 server halves).
 *
 * publishListing, updateListingFromWizard, updateListing / updateListingPrice /
 * bulkUpdateListings and bulkPublishListings all normalise their input here
 * before the service-role write. The database trigger `validate_listing_write`
 * (migration 20260925204757) re-checks the invariants a JWT caller could
 * otherwise bypass; this module is the version with readable error messages
 * and the category-config rules (price floor/ceiling, minimum order size,
 * bundle ids) the trigger does not know.
 *
 * Plain TS, no I/O: the caller loads the category config and hands it in, so
 * the rules are unit-testable and every path resolves them identically.
 */
import { z } from 'zod'
import { SELLER_DELIVERY_WINDOWS } from '@/lib/utils/delivery-time'
import type { CurrencyConfig } from '@/lib/types/category-configs'

export const DELIVERY_METHODS = ['manual', 'instant'] as const
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number]

/** A listing is born as one of these and nothing else (ACC-11). */
export const INSERT_STATUSES = ['draft', 'active'] as const
export type InsertStatus = (typeof INSERT_STATUSES)[number]

/** Statuses a seller may set on an existing listing through the quick-edit
 *  path (offers table). Moderation states are only entered through review. */
export const SELLER_PATCH_STATUSES = ['draft', 'active', 'paused', 'archived'] as const
export type SellerPatchStatus = (typeof SELLER_PATCH_STATUSES)[number]

export const MAX_IMAGES = 10
export const TITLE_MIN = 5
export const TITLE_MAX = 100
export const DESCRIPTION_MAX = 5000
/** listings.price is numeric(12,4). */
export const PRICE_MIN = 0.01
export const PRICE_MAX = 99_999_999.9999
export const PRICE_SCALE = 4
export const MAX_QUANTITY = 1_000_000_000

const DELIVERY_WINDOW_VALUES: ReadonlySet<string> = new Set(SELLER_DELIVERY_WINDOWS.map((w) => w.value))

/** numeric(12,4): round half away from zero at 4 decimals, as Postgres does. */
export function roundPrice(n: number): number {
  const scaled = Math.abs(n) * 10 ** PRICE_SCALE
  const rounded = Math.round(scaled + Number.EPSILON) / 10 ** PRICE_SCALE
  return n < 0 ? -rounded : rounded
}

const httpUrl = z
  .string()
  .trim()
  .max(2048, 'image URL is too long')
  .refine((s) => /^https?:\/\//i.test(s), 'image must be an http(s) URL')

const optionalLabel = z.string().trim().max(100).nullable().optional()

/** Field-level shapes shared by the full write and the partial patch. */
export const listingFields = {
  title: z.string().trim().max(TITLE_MAX, `title must be at most ${TITLE_MAX} characters`),
  description: z.string().trim().max(DESCRIPTION_MAX, `description must be at most ${DESCRIPTION_MAX} characters`),
  price: z.number().finite('price must be a number'),
  original_price: z.number().finite().nullable().optional(),
  quantity: z.number().int('quantity must be a whole number').min(0).max(MAX_QUANTITY),
  min_quantity: z.number().int('minimum order must be a whole number').min(1, 'minimum order must be at least 1'),
  delivery_method: z.enum(DELIVERY_METHODS, { errorMap: () => ({ message: 'delivery method must be manual or instant' }) }),
  delivery_time: z.string().trim().max(32).nullable().optional(),
  images: z.array(httpUrl).max(MAX_IMAGES, `at most ${MAX_IMAGES} images`),
  template_data: z.record(z.unknown()),
  region: optionalLabel,
  platform: optionalLabel,
  bundle_id: z.string().trim().max(200).nullable().optional(),
  status: z.enum(INSERT_STATUSES, { errorMap: () => ({ message: 'a new listing can only be a draft or active' }) }),
}

export const listingWriteSchema = z.object(listingFields)
export type ListingWriteInput = z.input<typeof listingWriteSchema>

/** Everything a rule needs to know about where the listing lives. */
export interface ListingRuleContext {
  /** game_categories.type of the target pair ('currency', 'items', …). */
  categoryType: string
  /** category_configs.config for (game, 'currency'); null when none / not currency. */
  currencyConfig?: Partial<CurrencyConfig> | null
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string }

export interface ListingWrite {
  title: string
  description: string
  price: number
  original_price: number | null
  quantity: number
  min_quantity: number
  delivery_method: DeliveryMethod
  delivery_time: string
  images: string[]
  template_data: Record<string, unknown>
  region: string | null
  platform: string | null
  bundle_id: string | null
  status: InsertStatus
}

function firstIssue(err: z.ZodError): string {
  const issue = err.issues[0]
  const path = issue?.path?.length ? `${issue.path.join('.')}: ` : ''
  return `${path}${issue?.message ?? 'invalid input'}`
}

/**
 * ACC-06 — price: numeric(12,4) rounding, an absolute floor of $0.01 (a
 * $0 listing took checkout's wallet-covered auto-confirm path), the column's
 * ceiling, and the admin's per-game floor / ceiling for currency listings.
 */
export function resolvePrice(raw: number, ctx: ListingRuleContext, label = 'price'): ValidationResult<number> {
  if (!Number.isFinite(raw)) return { ok: false, error: `${label} must be a number` }
  const price = roundPrice(raw)
  if (price < PRICE_MIN) return { ok: false, error: `${label} must be at least $${PRICE_MIN.toFixed(2)}` }
  if (price > PRICE_MAX) return { ok: false, error: `${label} is above the maximum allowed` }
  if (ctx.categoryType === 'currency' && ctx.currencyConfig) {
    const floor = Number(ctx.currencyConfig.price_floor)
    const ceiling = Number(ctx.currencyConfig.price_ceiling)
    if (Number.isFinite(floor) && floor > 0 && price < floor) {
      return { ok: false, error: `${label} must be at least $${floor} per unit for this game` }
    }
    if (Number.isFinite(ceiling) && ceiling > 0 && price > ceiling) {
      return { ok: false, error: `${label} must be at most $${ceiling} per unit for this game` }
    }
  }
  return { ok: true, value: price }
}

/** 'instant' delivery has no window; a manual listing must promise one of
 *  SELLER_DELIVERY_WINDOWS (free text breaks the SLA / cancellation parsers). */
export function resolveDeliveryTime(
  method: DeliveryMethod,
  time: string | null | undefined,
): ValidationResult<string> {
  if (method === 'instant') return { ok: true, value: 'instant' }
  const t = (time ?? '').trim()
  if (!DELIVERY_WINDOW_VALUES.has(t)) {
    return { ok: false, error: 'delivery time must be one of the offered delivery windows' }
  }
  return { ok: true, value: t }
}

/**
 * Full write (publish, wizard edit, bulk row). Returns the normalised row
 * fragment the caller writes verbatim, or the first user-facing error.
 */
export function validateListingWrite(raw: unknown, ctx: ListingRuleContext): ValidationResult<ListingWrite> {
  const parsed = listingWriteSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) }
  const v = parsed.data

  // Currency titles are auto-filled from the category config after
  // validation; every other category needs a real title now.
  if (ctx.categoryType !== 'currency' && v.title.length < TITLE_MIN) {
    return { ok: false, error: `title must be at least ${TITLE_MIN} characters` }
  }
  if (v.title.length > 0 && v.title.length < TITLE_MIN) {
    return { ok: false, error: `title must be at least ${TITLE_MIN} characters` }
  }

  const delivery = resolveDeliveryTime(v.delivery_method, v.delivery_time)
  if (!delivery.ok) return delivery

  const price = resolvePrice(v.price, ctx)
  if (!price.ok) return price
  let originalPrice: number | null = null
  if (v.original_price != null) {
    const op = resolvePrice(v.original_price, ctx, 'original price')
    if (!op.ok) return op
    originalPrice = op.value
  }

  return {
    ok: true,
    value: {
      title: v.title,
      description: v.description,
      price: price.value,
      original_price: originalPrice,
      quantity: v.quantity,
      min_quantity: v.min_quantity,
      delivery_method: v.delivery_method,
      delivery_time: delivery.value,
      images: v.images,
      template_data: v.template_data,
      region: v.region ?? null,
      platform: v.platform ?? null,
      bundle_id: v.bundle_id ?? null,
      status: v.status,
    },
  }
}

/** The fields the quick-edit path (offers table, updateListing) may touch. */
export const listingPatchSchema = z
  .object({
    title: listingFields.title,
    description: listingFields.description,
    price: listingFields.price,
    original_price: listingFields.original_price,
    quantity: listingFields.quantity,
    min_quantity: listingFields.min_quantity,
    delivery_method: listingFields.delivery_method,
    delivery_time: listingFields.delivery_time,
    delivery_method_type: z.string().trim().max(100).nullable(),
    images: listingFields.images,
    template_data: listingFields.template_data,
    region: listingFields.region,
    platform: listingFields.platform,
    status: z.enum(SELLER_PATCH_STATUSES, { errorMap: () => ({ message: 'status can only be draft, active, paused or archived' }) }),
  })
  .partial()
  .strict()

export type ListingPatchInput = z.input<typeof listingPatchSchema>
export type ListingPatch = z.output<typeof listingPatchSchema>

/** What the patch is applied to — the rules that span two fields need it. */
export interface ExistingListingForPatch {
  quantity: number
  min_quantity: number
  is_unlimited: boolean
  delivery_method: DeliveryMethod | string
}

/**
 * Partial write (offers table price / status / delivery edits, updateListing).
 * Only the keys present are validated; cross-field rules use the merged row.
 * Unknown keys are rejected: a client cannot smuggle a moderation column in.
 */
export function validateListingPatch(
  raw: unknown,
  ctx: ListingRuleContext,
  existing: ExistingListingForPatch,
): ValidationResult<ListingPatch> {
  const parsed = listingPatchSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) }
  const p = parsed.data
  if (Object.keys(p).length === 0) return { ok: false, error: 'nothing to update' }

  if (p.title !== undefined && p.title.length < TITLE_MIN) {
    return { ok: false, error: `title must be at least ${TITLE_MIN} characters` }
  }
  if (p.images !== undefined && p.images.length === 0) {
    return { ok: false, error: 'at least one image is required' }
  }

  if (p.price !== undefined) {
    const price = resolvePrice(p.price, ctx)
    if (!price.ok) return price
    p.price = price.value
  }
  if (p.original_price != null) {
    const op = resolvePrice(p.original_price, ctx, 'original price')
    if (!op.ok) return op
    p.original_price = op.value
  }

  const method = (p.delivery_method ?? existing.delivery_method) as DeliveryMethod
  if (p.delivery_method !== undefined || p.delivery_time !== undefined) {
    const delivery = resolveDeliveryTime(method, p.delivery_time)
    if (!delivery.ok) return delivery
    p.delivery_time = delivery.value
  }

  return { ok: true, value: p }
}

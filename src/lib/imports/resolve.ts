/**
 * Step 4 bulk importer — turning parsed rows into "here is exactly what will be
 * created".
 *
 * This is PURE on purpose. The preview an admin approves and the payload the
 * apply step writes come from the same function, so the preview cannot lie: the
 * title, the description and the price shown are the ones that get written.
 * Only the image is deferred (a preview does no network — see images.ts).
 *
 * Every input row produces exactly one resolved row. A row that cannot become a
 * listing carries the reason, and the candidates a reviewer needs; nothing is
 * dropped, which is the whole point of the rows table.
 */
import { matchItem, matchVariant, type MatchCandidate, type MatchIndex } from './match'
import { resolveImportPrice } from './price'
import { previewImage } from './images'
import { resolveTemplateData, type TemplateAttributeLike } from './attributes'
import type { RawImportRow } from './csv'
import type { CatalogueItem, CatalogueVariant, GameImportConfig, MarketPriceMap } from './types'
import { priceKey } from './types'

export type RowStatus = 'matched' | 'ambiguous' | 'unmatched' | 'rejected'

export interface ResolvedRow {
  rowNo: number
  raw: Record<string, string>
  status: RowStatus
  /** Set once the item is resolved; the idempotency key with variantRef. */
  itemRef: string | null
  itemName: string | null
  variantRef: string | null
  variantLabel: string | null
  quantity: number | null
  priceMode: 'auto' | 'explicit' | null
  priceInput: number | null
  /** What the listing will cost. Null unless the row is `matched`. */
  resolvedPrice: number | null
  /** The market price the auto rule started from, for the preview table. */
  marketPrice: number | null
  /** Catalogue art if we have it now; null means "fetched at import time". */
  imageUrl: string | null
  imagePending: boolean
  candidates: MatchCandidate[]
  /** Why this row is not `matched`, in words an admin can act on. */
  error: string | null
  /** Advisory — the row still applies. */
  warning: string | null
  /** Exactly what will be written, so the preview is the truth. */
  title: string | null
  description: string | null
  /** The game's filter attributes, keyed by attribute slug → option value. */
  templateData: Record<string, string>
  /** Filter attributes this row could not fill (it will be hidden under them). */
  unfilledAttributes: string[]
}

export interface ResolveContext {
  config: GameImportConfig
  index: MatchIndex
  prices: MarketPriceMap
  /** The batch default; a row carrying its own price overrides it. */
  pricingMode: 'auto' | 'explicit'
  undercutPct: number
  allowEstimated: boolean
  /** Used when a row leaves the quantity cell empty. */
  defaultQuantity?: number
  /**
   * The live attribute template for the (game, category) pair. Empty when the
   * game has none, in which case nothing is filterable and nothing is warned.
   */
  templateAttributes?: TemplateAttributeLike[]
}

/** Shared skeleton so every branch returns the same shape. */
function baseRow(raw: RawImportRow): ResolvedRow {
  return {
    rowNo: raw.rowNo,
    raw: raw.raw,
    status: 'unmatched',
    itemRef: null,
    itemName: null,
    variantRef: null,
    variantLabel: null,
    quantity: raw.quantity,
    priceMode: null,
    priceInput: raw.price,
    resolvedPrice: null,
    marketPrice: null,
    imageUrl: null,
    imagePending: false,
    candidates: [],
    error: null,
    warning: null,
    title: null,
    description: null,
    templateData: {},
    unfilledAttributes: [],
  }
}

function copyFor(item: CatalogueItem, variant: CatalogueVariant | null, config: GameImportConfig) {
  const ctx = { item, variant, gameName: config.gameSlug }
  return { title: config.title(ctx), description: config.description(ctx) }
}

export function resolveRow(raw: RawImportRow, ctx: ResolveContext): ResolvedRow {
  const row = baseRow(raw)

  // ── the item ──────────────────────────────────────────────────────────────
  if (!raw.item.trim()) {
    row.status = 'unmatched'
    row.error = 'no item name in this row'
    return row
  }

  const match = matchItem(ctx.index, raw.item)
  if (match.status !== 'matched') {
    row.status = match.status
    row.candidates = match.candidates
    row.error =
      match.status === 'ambiguous'
        ? `"${raw.item}" could be more than one ${ctx.config.itemNoun} — pick one`
        : `no ${ctx.config.itemNoun} in the catalogue matches "${raw.item}"`
    return row
  }

  const item = match.item
  row.itemRef = item.ref
  row.itemName = item.name

  // ── the variant ───────────────────────────────────────────────────────────
  const variantMatch = matchVariant(ctx.index, raw.variant)
  if (variantMatch === 'unknown') {
    row.status = 'rejected'
    row.error = `"${raw.variant}" is not a ${ctx.config.variantNoun ?? 'variant'} this game has`
    return row
  }
  const variant = variantMatch
  row.variantRef = variant?.ref ?? null
  row.variantLabel = variant?.label ?? null

  // ── the quantity ──────────────────────────────────────────────────────────
  const quantity = raw.quantity ?? ctx.defaultQuantity ?? 1
  row.quantity = quantity
  if (!Number.isFinite(quantity) || quantity < 1) {
    row.status = 'rejected'
    row.error = 'quantity must be a whole number of 1 or more'
    return row
  }

  // ── the price ─────────────────────────────────────────────────────────────
  // A row carrying its own price is explicit whatever the batch default says:
  // a supplier sheet with some prices filled in should honour them.
  const mode: 'auto' | 'explicit' = raw.price != null ? 'explicit' : ctx.pricingMode
  row.priceMode = mode
  if (mode === 'explicit' && raw.price == null) {
    row.status = 'rejected'
    row.error = 'this batch prices from the sheet, but this row has no price'
    return row
  }

  const price = resolveImportPrice({
    mode,
    input: raw.price,
    market: ctx.prices.get(priceKey(item.ref, variant?.ref ?? null)),
    undercutPct: ctx.undercutPct,
    allowEstimated: ctx.allowEstimated,
  })
  if (!price.ok) {
    row.status = 'rejected'
    row.error = price.reason
    return row
  }
  row.resolvedPrice = price.price
  row.marketPrice = price.market
  row.warning = price.warning ?? null

  // ── what gets written ─────────────────────────────────────────────────────
  const preview = previewImage(item)
  row.imageUrl = preview.url
  row.imagePending = preview.kind === 'pending'

  const copy = copyFor(item, variant, ctx.config)
  row.title = copy.title
  row.description = copy.description

  // The game's own filters. An unfilled one is a warning, not a rejection: the
  // listing is still correct, it just will not appear under that filter.
  const attrs = resolveTemplateData(ctx.templateAttributes ?? [], {
    variant,
    item: { ref: item.ref, name: item.name },
    hints: ctx.config.attributeHints,
  })
  row.templateData = attrs.data
  row.unfilledAttributes = attrs.unfilled
  if (attrs.unfilled.length > 0) {
    const note = `won't show under the ${attrs.unfilled.join(' / ')} filter${attrs.unfilled.length > 1 ? 's' : ''}`
    row.warning = row.warning ? `${row.warning}; ${note}` : note
  }

  row.status = 'matched'
  return row
}

export interface ResolveSummary {
  total: number
  matched: number
  ambiguous: number
  unmatched: number
  rejected: number
  warnings: number
  /** Rows whose image will be fetched from the wiki (or a placeholder) on apply. */
  imagesPending: number
  /** (item, variant) pairs appearing more than once in this input. */
  duplicates: number
}

export interface ResolveResult {
  rows: ResolvedRow[]
  summary: ResolveSummary
}

export function resolveRows(rows: RawImportRow[], ctx: ResolveContext): ResolveResult {
  const resolved = rows.map((r) => resolveRow(r, ctx))

  // A stock list that names the same (item, variant) twice cannot create two
  // listings — the idempotency index forbids it — so the LATER row is rejected
  // rather than silently overwriting the earlier one at apply time.
  const seen = new Map<string, number>()
  let duplicates = 0
  for (const row of resolved) {
    if (row.status !== 'matched' || !row.itemRef) continue
    const key = priceKey(row.itemRef, row.variantRef)
    const first = seen.get(key)
    if (first != null) {
      duplicates += 1
      row.status = 'rejected'
      row.error = `same ${ctx.config.itemNoun}${row.variantLabel ? ` and ${ctx.config.variantNoun}` : ''} as row ${first} — remove one`
      row.resolvedPrice = null
    } else {
      seen.set(key, row.rowNo)
    }
  }

  const count = (s: RowStatus) => resolved.filter((r) => r.status === s).length
  return {
    rows: resolved,
    summary: {
      total: resolved.length,
      matched: count('matched'),
      ambiguous: count('ambiguous'),
      unmatched: count('unmatched'),
      rejected: count('rejected'),
      warnings: resolved.filter((r) => r.status === 'matched' && r.warning).length,
      imagesPending: resolved.filter((r) => r.status === 'matched' && r.imagePending).length,
      duplicates,
    },
  }
}

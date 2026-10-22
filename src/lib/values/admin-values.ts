/**
 * The admin Values tab's read model: every item of one hub game as one row
 * (name, art, rarity, our live price, market price, trade value, How To Get,
 * added / released, visible on the site), plus counts, the catalogue job's
 * recent runs and the last price update. Admin-only (service role); a game
 * has at most ~1,100 items, so it reads them all and filters in memory.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { readGameHealth, VALUES_HEALTH_GAMES } from './health'
import { isNewItem } from './new-item'

type Db = SupabaseClient

export type AdminValuesView = 'all' | 'new' | 'no-price' | 'no-image' | 'no-facts' | 'hidden'
export const ADMIN_VALUES_VIEWS: readonly AdminValuesView[] = ['all', 'new', 'no-price', 'no-image', 'no-facts', 'hidden']
export const ADMIN_VALUES_PAGE_SIZE = 50

export interface AdminValueRow {
  slug: string
  name: string
  rarity: string | null
  imageUrl: string | null
  /** Cheapest live DropMarket listing linked to the item. */
  ourUsd: number | null
  marketUsd: number | null
  tradeValue: number | null
  hasHowToGet: boolean
  addedAt: string | null
  releasedAt: string | null
  isNew: boolean
  /** Shown on the public site (SAB: approved art and reviewed; others: active / enabled). */
  isVisible: boolean
  href: string
}

export interface AdminValuesSummary {
  total: number
  visible: number
  newItems: number
  noPrice: number
  noImage: number
  noHowToGet: number
}

export interface AdminCatalogueRun {
  startedAt: string
  status: string
  added: string[]
  message: string | null
}

export interface AdminValuesPage {
  rows: AdminValueRow[]
  total: number
  page: number
  totalPages: number
  summary: AdminValuesSummary
  runs: AdminCatalogueRun[]
  lastPriceAt: string | null
}

// ── pure ──────────────────────────────────────────────────────────────────

const hasPrice = (r: AdminValueRow) => r.ourUsd != null || r.marketUsd != null || r.tradeValue != null

export function summarize(rows: AdminValueRow[]): AdminValuesSummary {
  return {
    total: rows.length,
    visible: rows.filter((r) => r.isVisible).length,
    newItems: rows.filter((r) => r.isNew).length,
    noPrice: rows.filter((r) => !hasPrice(r)).length,
    noImage: rows.filter((r) => !r.imageUrl).length,
    noHowToGet: rows.filter((r) => !r.hasHowToGet).length,
  }
}

/** One view + a name search; newest first, then by name. */
export function filterRows(rows: AdminValueRow[], view: AdminValuesView, q: string): AdminValueRow[] {
  const needle = q.trim().toLowerCase()
  const match: Record<AdminValuesView, (r: AdminValueRow) => boolean> = {
    all: () => true,
    new: (r) => r.isNew,
    'no-price': (r) => !hasPrice(r),
    'no-image': (r) => !r.imageUrl,
    'no-facts': (r) => !r.hasHowToGet,
    hidden: (r) => !r.isVisible,
  }
  return rows
    .filter((r) => match[view](r) && (!needle || r.name.toLowerCase().includes(needle) || r.slug.includes(needle)))
    .sort((a, b) => (b.addedAt ?? '').localeCompare(a.addedAt ?? '') || a.name.localeCompare(b.name))
}

export function pageOf<T>(rows: T[], page: number, size = ADMIN_VALUES_PAGE_SIZE): { rows: T[]; page: number; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(rows.length / size))
  const safe = Math.min(Math.max(1, Math.floor(page) || 1), totalPages)
  return { rows: rows.slice((safe - 1) * size, safe * size), page: safe, totalPages }
}

// ── reads ─────────────────────────────────────────────────────────────────

async function all<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>, label: string): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999)
    if (error) throw new Error(`${label}: ${error.message}`)
    out.push(...(data ?? []))
    if (!data || data.length < 1000) return out
  }
}

async function gameId(db: Db, slug: string): Promise<string> {
  const { data, error } = await db.from('games').select('id').eq('slug', slug).maybeSingle()
  if (error || !data) throw new Error(`game ${slug}: ${error?.message ?? 'not found'}`)
  return data.id as string
}

/** Cheapest live linked listing per item slug (our own stock). */
async function ourPrices(db: Db, id: string): Promise<Map<string, number>> {
  const rows = await all<{ value_item_slug: string; price: number }>(
    (from, to) => db.from('listings').select('value_item_slug,price').eq('game_id', id).eq('status', 'active').not('value_item_slug', 'is', null).range(from, to),
    'listings',
  )
  const out = new Map<string, number>()
  for (const r of rows) {
    const p = Number(r.price)
    if (Number.isFinite(p) && (!out.has(r.value_item_slug) || p < out.get(r.value_item_slug)!)) out.set(r.value_item_slug, p)
  }
  return out
}

const num = (v: unknown) => (v == null || Number.isNaN(Number(v)) ? null : Number(v))
const minOf = (xs: (number | null)[]) => {
  const ok = xs.filter((x): x is number => x != null)
  return ok.length ? Math.min(...ok) : null
}

async function sabRows(db: Db, now: number): Promise<AdminValueRow[]> {
  const id = await gameId(db, 'steal-a-brainrot')
  const [items, prices, ours] = await Promise.all([
    all<any>((f, t) => db.from('sab_brainrots').select('slug,name,rarity,image_path,image_status,how_to_get,created_at,released_at,is_active,needs_review').order('slug').range(f, t), 'sab_brainrots'),
    // The plain brainrot's price row (no mutation).
    all<any>((f, t) => db.from('sab_price_display').select('brainrot_slug,mutation_slug,average_usd,market_value_usd').or('mutation_slug.is.null,mutation_slug.eq.default').range(f, t), 'sab_price_display'),
    ourPrices(db, id),
  ])
  const market = new Map(prices.map((p) => [p.brainrot_slug as string, num(p.average_usd) ?? num(p.market_value_usd)]))
  return items.map((r) => ({
    slug: r.slug,
    name: r.name,
    rarity: r.rarity,
    imageUrl: r.image_path && r.image_status === 'approved' ? db.storage.from('sab-brainrots').getPublicUrl(r.image_path).data.publicUrl : null,
    ourUsd: ours.get(r.slug) ?? null,
    marketUsd: market.get(r.slug) ?? null,
    tradeValue: null,
    hasHowToGet: r.how_to_get != null,
    addedAt: r.created_at,
    releasedAt: r.released_at,
    isNew: isNewItem({ releasedAt: r.released_at, addedAt: r.created_at }, now),
    isVisible: r.is_active && !r.needs_review && r.image_status === 'approved',
    href: `/steal-a-brainrot/values/${r.slug}`,
  }))
}

async function adoptMeRows(db: Db, now: number): Promise<AdminValueRow[]> {
  const id = await gameId(db, 'adopt-me')
  const [pets, values, ours] = await Promise.all([
    all<any>((f, t) => db.from('adopt_me_pets').select('id,slug,name,rarity,image_url,how_to_get,created_at,released_at,is_active').order('slug').range(f, t), 'adopt_me_pets'),
    all<any>((f, t) => db.from('adopt_me_pet_values').select('pet_id,variant,average_usd,cash_value_usd,trade_value').order('pet_id').range(f, t), 'adopt_me_pet_values'),
    ourPrices(db, id),
  ])
  const byPet = new Map<string, any[]>()
  for (const v of values) byPet.set(v.pet_id, [...(byPet.get(v.pet_id) ?? []), v])
  return pets.map((p) => {
    const forms = byPet.get(p.id) ?? []
    const fr = forms.find((f) => f.variant === 'FR') ?? forms.find((f) => f.variant === 'N')
    return {
      slug: p.slug,
      name: p.name,
      rarity: p.rarity,
      imageUrl: p.image_url,
      ourUsd: ours.get(p.slug) ?? null,
      // The cheapest form's market price.
      marketUsd: minOf(forms.map((f) => num(f.average_usd) ?? num(f.cash_value_usd))),
      tradeValue: num(fr?.trade_value),
      hasHowToGet: p.how_to_get != null,
      addedAt: p.created_at,
      releasedAt: p.released_at,
      isNew: isNewItem({ releasedAt: p.released_at, addedAt: p.created_at }, now),
      isVisible: p.is_active,
      href: `/adopt-me/values/${p.slug}`,
    }
  })
}

async function valuesItemsRows(db: Db, gameSlug: string, now: number): Promise<AdminValueRow[]> {
  const id = await gameId(db, gameSlug)
  const [items, prices, ours] = await Promise.all([
    all<any>((f, t) => db.from('values_items').select('id,slug,name,rarity,image_url,how_to_get,created_at,is_enabled').eq('game_id', id).order('slug').range(f, t), 'values_items'),
    all<any>((f, t) => db.from('values_prices').select('item_id,average_usd,cheapest_usd').eq('game_id', id).range(f, t), 'values_prices'),
    ourPrices(db, id),
  ])
  const market = new Map(prices.map((p) => [p.item_id as string, num(p.average_usd) ?? num(p.cheapest_usd)]))
  return items.map((r) => ({
    slug: r.slug,
    name: r.name,
    rarity: r.rarity,
    imageUrl: r.image_url,
    ourUsd: ours.get(r.slug) ?? null,
    marketUsd: market.get(r.id) ?? null,
    tradeValue: null,
    hasHowToGet: r.how_to_get != null,
    addedAt: r.created_at,
    releasedAt: null,
    isNew: isNewItem({ addedAt: r.created_at }, now),
    isVisible: r.is_enabled,
    href: `/${gameSlug}/values/${r.slug}`,
  }))
}

export function isAdminValuesGame(slug: string): boolean {
  return VALUES_HEALTH_GAMES.some((g) => g.gameSlug === slug)
}

export async function loadAdminValues(
  db: Db,
  gameSlug: string,
  opts: { view: AdminValuesView; q: string; page: number },
  now: number = Date.now(),
): Promise<AdminValuesPage> {
  const game = VALUES_HEALTH_GAMES.find((g) => g.gameSlug === gameSlug)
  if (!game) throw new Error(`${gameSlug} has no values hub`)
  const [rows, runs, health] = await Promise.all([
    gameSlug === 'steal-a-brainrot' ? sabRows(db, now) : gameSlug === 'adopt-me' ? adoptMeRows(db, now) : valuesItemsRows(db, gameSlug, now),
    db.from('catalogue_runs').select('started_at,status,added_slugs,message').eq('game_slug', gameSlug).order('started_at', { ascending: false }).limit(8),
    readGameHealth(db, game),
  ])
  if (runs.error) throw new Error(`catalogue_runs: ${runs.error.message}`)
  const filtered = filterRows(rows, opts.view, opts.q)
  const paged = pageOf(filtered, opts.page)
  return {
    rows: paged.rows,
    total: filtered.length,
    page: paged.page,
    totalPages: paged.totalPages,
    summary: summarize(rows),
    runs: (runs.data ?? []).map((r) => ({ startedAt: r.started_at, status: r.status, added: r.added_slugs ?? [], message: r.message })),
    lastPriceAt: health.lastPriceAt,
  }
}

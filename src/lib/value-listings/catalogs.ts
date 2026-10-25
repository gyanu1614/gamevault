/**
 * Value catalogues the listing matcher keys into, one per game that has value
 * pages. Pure builder + a loader that takes any Supabase client (service role
 * from the link/reconcile jobs, anon from public pages), so it runs in server
 * actions, ISR pages, the cron route and the tsx backfill script alike — no
 * `server-only`, no `@/` imports.
 */
import { VARIANTS, VARIANT_ALIASES, VARIANT_KEY, VARIANT_LABEL, isVariant, variantFromKey, type Variant } from '../adopt-me/variants'
import { variantFromTitle } from '../adopt-me/variant-from-title'
import type { ValueCatalog } from './match'
import type { SimilarCandidate } from './stock'

/**
 * Games whose value pages use the generic `values_items` pipeline. MM2's
 * catalogue rows only exist once the wiki import has run on that database, so
 * until then its catalogue is empty and nothing links.
 */
export const VALUES_PIPELINE_GAMES: ReadonlySet<string> = new Set(['steal-an-egg', 'murder-mystery-2'])

export const VALUE_CATALOG_GAMES: readonly string[] = ['steal-a-brainrot', 'adopt-me', ...VALUES_PIPELINE_GAMES]

/**
 * Sell-form fields whose option value is the catalogue slug, per game, most
 * specific first (the first picked one wins). MM2: one name list per item
 * type (a chroma is its own row). Steal an Egg: a named egg or pet beats the
 * area it comes from.
 */
const PIPELINE_IDENTITY_KEYS: Record<string, readonly string[]> = {
  'murder-mystery-2': ['select-knife', 'select-gun', 'select-pet'],
  'steal-an-egg': ['select-egg', 'select-pet', 'egg-area'],
}

/** Adopt Me value-page variant code → URL key (also the stored `value_variant`). One map: lib/adopt-me/variants. */
export const AM_VARIANT_KEY = VARIANT_KEY

export type AmVariantCode = Variant

export function amVariantKey(code: string): string | null {
  return isVariant(code) ? VARIANT_KEY[code] : null
}

export const amVariantCode = variantFromKey

/** Display label for a stored variant key, per game. */
export function variantLabel(gameSlug: string, key: string | null, mutations?: ReadonlyArray<{ slug: string; name: string }>): string | null {
  if (!key) return null
  if (gameSlug === 'adopt-me') {
    const code = variantFromKey(key)
    return code ? VARIANT_LABEL[code] : null
  }
  if (key === 'default') return 'Default'
  return mutations?.find((m) => m.slug === key)?.name ?? key.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export interface CatalogItemRow extends SimilarCandidate {
  imageUrl?: string | null
  /** False when the item has no public value page (an inactive Adopt Me pet). */
  hasPage?: boolean
}

export interface LoadedCatalog {
  catalog: ValueCatalog
  items: CatalogItemRow[]
  mutations: Array<{ slug: string; name: string }>
}

export function buildValueCatalog(
  gameSlug: string,
  rows: { items: CatalogItemRow[]; mutations?: Array<{ slug: string; name: string }> },
): LoadedCatalog | null {
  const items = rows.items.filter((i) => i.slug && i.name)
  if (gameSlug === 'steal-a-brainrot') {
    const mutations = (rows.mutations ?? []).filter((m) => m.slug !== 'default')
    return {
      items,
      mutations: rows.mutations ?? [],
      catalog: {
        gameSlug,
        items,
        variants: mutations.map((m) => ({ key: m.slug, names: [m.name] })),
        // The SAB items form splits the brainrot picker by rarity:
        // select-brainrot, select-brainrot-2 … -8 (only one is shown at a time).
        identityKeys: ['select-brainrot', ...Array.from({ length: 7 }, (_, i) => `select-brainrot-${i + 2}`)],
        variantKeys: ['mutation', 'select-mutation'],
        defaultVariant: 'default',
      },
    }
  }
  if (gameSlug === 'adopt-me') {
    return {
      items,
      mutations: [],
      catalog: {
        gameSlug,
        items,
        variants: VARIANTS.map((code) => ({ key: VARIANT_KEY[code], names: VARIANT_ALIASES[code] })),
        identityKeys: ['pet-name'],
        variantKeys: ['trait'],
        // Real variants with no value page, and "no potion": not part of a pet's name.
        skipWords: ['nf', 'nr', 'mf', 'mr', 'np', 'potion', 'potions'],
        titleVariant: (title, itemName) => {
          const code = variantFromTitle(title, { itemName })
          return code ? VARIANT_KEY[code] : null
        },
      },
    }
  }
  if (VALUES_PIPELINE_GAMES.has(gameSlug)) {
    return {
      items,
      mutations: [],
      catalog: { gameSlug, items, variants: [], identityKeys: [...(PIPELINE_IDENTITY_KEYS[gameSlug] ?? []), 'select-item', 'item-name'] },
    }
  }
  return null
}

type AnyClient = { from: (table: string) => any }

export async function loadValueCatalog(client: AnyClient, game: { id: string; slug: string }): Promise<LoadedCatalog | null> {
  if (game.slug === 'steal-a-brainrot') {
    const [items, mutations] = await Promise.all([
      client.from('sab_brainrot_market_catalog').select('slug, name, rarity, market_value_usd, image_url').limit(5000),
      client.from('sab_mutations').select('slug, name, is_active').limit(500),
    ])
    if (items.error) throw items.error
    if (mutations.error) throw mutations.error
    return buildValueCatalog(game.slug, {
      items: (items.data ?? []).map((r: any) => ({
        slug: r.slug, name: r.name, rarity: r.rarity, valueUsd: r.market_value_usd == null ? null : Number(r.market_value_usd), imageUrl: r.image_url,
      })),
      mutations: (mutations.data ?? []).filter((m: any) => m.is_active !== false).map((m: any) => ({ slug: m.slug, name: m.name })),
    })
  }
  if (game.slug === 'adopt-me') {
    const { data, error } = await client.from('adopt_me_pets').select('slug, name, rarity, image_url, is_active').limit(5000)
    if (error) throw error
    return buildValueCatalog(game.slug, {
      items: (data ?? []).map((r: any) => ({ slug: r.slug, name: r.name, rarity: r.rarity, imageUrl: r.image_url, hasPage: r.is_active === true })),
    })
  }
  if (VALUES_PIPELINE_GAMES.has(game.slug)) {
    const { data, error } = await client
      .from('values_items')
      .select('slug, name, rarity, image_url, is_enabled')
      .eq('game_id', game.id)
      .limit(5000)
    if (error) throw error
    return buildValueCatalog(game.slug, {
      items: (data ?? []).filter((r: any) => r.is_enabled !== false).map((r: any) => ({ slug: r.slug, name: r.name, rarity: r.rarity, imageUrl: r.image_url })),
    })
  }
  return null
}

/** attribute slug → option slug → label, for one game category's template. */
export async function loadOptionLabels(client: AnyClient, gameCategoryId: string): Promise<Record<string, Record<string, string>>> {
  const { data: tpl } = await client
    .from('attribute_templates')
    .select('id')
    .eq('game_category_id', gameCategoryId)
    .eq('is_active', true)
    .maybeSingle()
  if (!tpl?.id) return {}
  const { data: attrs } = await client.from('attributes').select('id, slug').eq('template_id', tpl.id)
  const list = (attrs ?? []) as Array<{ id: string; slug: string }>
  if (list.length === 0) return {}
  const { data: opts } = await client
    .from('attribute_options')
    .select('attribute_id, slug, value, label')
    .in('attribute_id', list.map((a) => a.id))
  const slugById = new Map(list.map((a) => [a.id, a.slug]))
  const out: Record<string, Record<string, string>> = {}
  for (const o of (opts ?? []) as Array<{ attribute_id: string; slug: string; value: string | null; label: string }>) {
    const attr = slugById.get(o.attribute_id)
    if (!attr) continue
    // Listings store the choice's VALUE (what the sell form writes); it equals
    // the slug unless an admin set one, so key both.
    const byCode = (out[attr] ??= {})
    byCode[o.slug] = o.label
    if (o.value) byCode[o.value] = o.label
  }
  return out
}

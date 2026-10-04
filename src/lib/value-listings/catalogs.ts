/**
 * Value catalogues the listing matcher keys into, one per game that has value
 * pages. Pure builder + a loader that takes any Supabase client (service role
 * from the link/reconcile jobs, anon from public pages), so it runs in server
 * actions, ISR pages, the cron route and the tsx backfill script alike — no
 * `server-only`, no `@/` imports.
 */
import type { ValueCatalog } from './match'
import type { SimilarCandidate } from './stock'

/** Games whose value pages use the generic `values_items` pipeline. */
export const VALUES_PIPELINE_GAMES: ReadonlySet<string> = new Set(['steal-an-egg'])

export const VALUE_CATALOG_GAMES: readonly string[] = ['steal-a-brainrot', 'adopt-me', ...VALUES_PIPELINE_GAMES]

/** Adopt Me value-page variant code → URL key (also the stored `value_variant`). */
export const AM_VARIANT_KEY = {
  N: 'normal',
  F: 'fly',
  R: 'ride',
  FR: 'fly-ride',
  NEON: 'neon',
  NFR: 'neon-fly-ride',
  MEGA: 'mega-neon',
  MFR: 'mega-fly-ride',
} as const

export type AmVariantCode = keyof typeof AM_VARIANT_KEY

export function amVariantKey(code: string): string | null {
  return (AM_VARIANT_KEY as Record<string, string>)[code] ?? null
}

export function amVariantCode(key: string): AmVariantCode | null {
  const hit = Object.entries(AM_VARIANT_KEY).find(([, k]) => k === key)
  return (hit?.[0] as AmVariantCode | undefined) ?? null
}

const AM_VARIANT_NAMES: Record<AmVariantCode, readonly string[]> = {
  N: ['Normal', 'No Potion'],
  F: ['Fly', 'F'],
  R: ['Ride', 'R'],
  FR: ['Fly Ride', 'FR'],
  NEON: ['Neon', 'N'],
  NFR: ['Neon Fly Ride', 'NFR'],
  MEGA: ['Mega Neon', 'Mega', 'M'],
  MFR: ['Mega Fly Ride', 'Mega Neon Fly Ride', 'MFR'],
}

/** Display label for a stored variant key, per game. */
export function variantLabel(gameSlug: string, key: string | null, mutations?: ReadonlyArray<{ slug: string; name: string }>): string | null {
  if (!key) return null
  if (gameSlug === 'adopt-me') {
    const code = amVariantCode(key)
    return code ? AM_VARIANT_NAMES[code][0] : null
  }
  if (key === 'default') return 'Default'
  return mutations?.find((m) => m.slug === key)?.name ?? key.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export interface CatalogItemRow extends SimilarCandidate {
  imageUrl?: string | null
  /** False when the item has no public value page (Adopt Me `has_page`). */
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
        identityKeys: ['select-brainrot'],
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
        variants: (Object.keys(AM_VARIANT_KEY) as AmVariantCode[]).map((code) => ({
          key: AM_VARIANT_KEY[code],
          names: AM_VARIANT_NAMES[code],
        })),
        identityKeys: ['pet-name'],
        variantKeys: ['trait'],
      },
    }
  }
  if (VALUES_PIPELINE_GAMES.has(gameSlug)) {
    return {
      items,
      mutations: [],
      catalog: { gameSlug, items, variants: [], identityKeys: ['select-item', 'item-name'] },
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
    const { data, error } = await client.from('adopt_me_pets').select('slug, name, rarity, image_url, has_page').limit(5000)
    if (error) throw error
    return buildValueCatalog(game.slug, {
      items: (data ?? []).map((r: any) => ({ slug: r.slug, name: r.name, rarity: r.rarity, imageUrl: r.image_url, hasPage: r.has_page === true })),
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
    .select('attribute_id, slug, label')
    .in('attribute_id', list.map((a) => a.id))
  const slugById = new Map(list.map((a) => [a.id, a.slug]))
  const out: Record<string, Record<string, string>> = {}
  for (const o of (opts ?? []) as Array<{ attribute_id: string; slug: string; label: string }>) {
    const attr = slugById.get(o.attribute_id)
    if (!attr) continue
    ;(out[attr] ??= {})[o.slug] = o.label
  }
  return out
}

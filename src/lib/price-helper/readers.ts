/**
 * Database reads behind the market price helper. Plain functions over any
 * Supabase client (anon in production, a fake in readers.test.ts); caching
 * and tags live in ./server.ts. Every table read here is public (anon RLS).
 *
 * Each game's number is the one its public value page headlines, so the
 * seller and the buyer see the same price:
 *   - SAB          sab_price_display.market_value_usd   (item × mutation)
 *   - Adopt Me     adopt_me_pet_values.average_usd      (pet × FR/NFR/…)
 *   - MM2, Egg     values_prices.average_usd            (one price per item)
 */
import { amVariantCode, VALUES_PIPELINE_GAMES } from '@/lib/value-listings/catalogs'
import type { LiveCurrencyOffer } from './hint'
import type { ItemPriceRow } from './resolve'

type AnyClient = { from: (table: string) => any }

const num = (v: unknown): number | null => {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

async function one(query: PromiseLike<{ data: any; error: any }>): Promise<any> {
  const { data, error } = await query
  if (error) throw new Error(error.message ?? 'read failed')
  return data ?? null
}

export async function readItemPrice(
  client: AnyClient,
  q: { gameSlug: string; gameId: string; itemSlug: string; variant: string | null },
): Promise<ItemPriceRow | null> {
  if (q.gameSlug === 'steal-a-brainrot') {
    const r = await one(
      client
        .from('sab_price_display')
        .select('market_value_usd, external_sample_size, price_updated_at')
        .eq('brainrot_slug', q.itemSlug)
        .eq('mutation_slug', q.variant ?? 'default')
        .maybeSingle(),
    )
    if (!r) return null
    // `is_public_estimate` only says the number came from the live market
    // pipeline (preferred over the verified fallback); both are real listings.
    // The page's own derived mutation estimates are never stored here.
    return { usd: num(r.market_value_usd), offers: num(r.external_sample_size), updatedAt: r.price_updated_at ?? null }
  }

  if (q.gameSlug === 'adopt-me') {
    const code = q.variant ? amVariantCode(q.variant) : null
    if (!code) return null
    const pet = await one(client.from('adopt_me_pets').select('id').eq('slug', q.itemSlug).maybeSingle())
    if (!pet) return null
    const r = await one(
      client
        .from('adopt_me_pet_values')
        .select('average_usd, reputable_count, last_priced_at')
        .eq('pet_id', pet.id)
        .eq('variant', code)
        .maybeSingle(),
    )
    if (!r) return null
    return { usd: num(r.average_usd), offers: num(r.reputable_count), updatedAt: r.last_priced_at ?? null }
  }

  if (VALUES_PIPELINE_GAMES.has(q.gameSlug)) {
    const item = await one(
      client
        .from('values_items')
        .select('id')
        .eq('game_id', q.gameId)
        .eq('slug', q.itemSlug)
        .eq('is_enabled', true)
        .maybeSingle(),
    )
    if (!item) return null
    const r = await one(
      client.from('values_prices').select('average_usd, sample_size, updated_at').eq('item_id', item.id).maybeSingle(),
    )
    if (!r) return null
    return { usd: num(r.average_usd), offers: num(r.sample_size), updatedAt: r.updated_at ?? null }
  }

  return null
}

export async function readCurrencyOffers(
  client: AnyClient,
  q: { gameCategoryId: string; bundleId: string | null; hiddenSellerIds: readonly string[] },
): Promise<LiveCurrencyOffer[]> {
  let query = client
    .from('listings')
    .select('price, quantity, min_quantity, is_unlimited')
    .eq('game_category_id', q.gameCategoryId)
    .eq('status', 'active')
  query = q.bundleId ? query.eq('bundle_id', q.bundleId) : query.is('bundle_id', null)
  if (q.hiddenSellerIds.length) query = query.not('seller_id', 'in', `(${q.hiddenSellerIds.join(',')})`)
  const rows = (await one(query.order('price', { ascending: true }).limit(500))) as any[] | null
  return (rows ?? []).map((r) => ({
    price: num(r.price) ?? 0,
    stock: num(r.quantity) ?? 0,
    minQty: num(r.min_quantity) ?? 1,
    unlimited: r.is_unlimited === true,
  }))
}

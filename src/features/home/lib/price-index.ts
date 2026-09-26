import 'server-only'

import { createClient } from '@/lib/supabase/server'

/**
 * Price-index summary for the hero rail card.
 *
 * HONESTY RULE (see the design brief): the hero rail was specced as a LIVE
 * SALES feed. We have zero completed sales, so that card would either be
 * empty or invented. This is the specced fallback: real numbers from the
 * price index we genuinely run — items tracked and when the crawl last
 * refreshed them. Never add a sales count, a user count or a rating here.
 */
export interface PriceIndexSummary {
  /** Items carrying a public base-mutation value right now. */
  trackedItems: number
  /** Most recent crawl refresh across those rows. */
  updatedAt: string | null
  /** A few real movers to show as rows, highest value first. */
  samples: Array<{ name: string; value: number }>
}

export async function getPriceIndexSummary(): Promise<PriceIndexSummary | null> {
  const supabase = await createClient()

  // COUNT: one row per item via the base ('default') mutation, as an exact
  // head count — two round-trips total for this card.
  //
  // Why not count every matching row: an item appears once per mutation
  // (3,238 rows over 427 items today), so a raw row count overstates
  // coverage ~7.6x. Why not paginate and de-duplicate names: that is four
  // round-trips on every homepage render for a single number.
  //
  // 'default' yields 379 of those 427 — the 48 missing have a priced
  // mutation but no base row. Understating by 48 is the honest direction
  // to err, and it is one query.
  const { count, error: countError } = await supabase
    .from('sab_price_display')
    .select('brainrot_id', { count: 'exact', head: true })
    .not('market_value_usd', 'is', null)
    .eq('is_public_estimate', true)
    .eq('mutation_slug', 'default')

  if (countError || !count) return null

  // SAMPLES: the few highest-value rows, for the list beneath the number.
  const { data, error } = await supabase
    .from('sab_price_display')
    .select('brainrot_name, market_value_usd, price_updated_at')
    .not('market_value_usd', 'is', null)
    .eq('is_public_estimate', true)
    .order('market_value_usd', { ascending: false })
    .limit(40)

  if (error || !data?.length) return null

  type Row = {
    brainrot_name: string | null
    market_value_usd: number | null
    price_updated_at: string | null
  }

  const best = new Map<string, number>()
  let latest: string | null = null

  for (const r of data as Row[]) {
    if (r.price_updated_at && (!latest || r.price_updated_at > latest)) {
      latest = r.price_updated_at
    }
    const name = r.brainrot_name?.trim()
    const value = r.market_value_usd
    if (!name || value == null) continue
    // Same item across mutations — keep its highest value, once.
    const seen = best.get(name)
    if (seen == null || value > seen) best.set(name, value)
  }

  const samples = [...best.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, value]) => ({ name, value }))

  if (samples.length === 0) return null

  return { trackedItems: count, updatedAt: latest, samples }
}

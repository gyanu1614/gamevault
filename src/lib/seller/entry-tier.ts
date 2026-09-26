/**
 * Live entry-rank lookup.
 *
 * The seller ladder has been re-keyed once already (gemstone → metal, migration
 * 20260908100000) and `profiles.seller_tier` is guarded by the CHECK constraint
 * `profiles_seller_tier_check`. Any code that hard-codes the entry rank name
 * breaks the moment the ladder is re-keyed again — that is exactly how seller
 * approval started failing in production with
 * `new row for relation "profiles" violates check constraint`.
 *
 * So: never write a literal rank key. Read the lowest `sort_order` row from
 * `seller_tier_config`, which is the same thing `get_seller_publish_policy` and
 * `upgrade_all_seller_tiers` do in SQL:
 *
 *     SELECT tier FROM public.seller_tier_config ORDER BY sort_order ASC LIMIT 1;
 */

import { DEFAULT_TIER } from '@/lib/seller/tiers'

/** Minimal shape we need — any Supabase client (service or session) satisfies it. */
type TierConfigReader = {
  from: (table: string) => {
    select: (cols: string) => {
      order: (
        col: string,
        opts: { ascending: boolean },
      ) => {
        limit: (n: number) => PromiseLike<{ data: unknown; error: unknown }>
      }
    }
  }
}

/**
 * The live entry rank (lowest sort_order in `seller_tier_config`).
 *
 * Falls back to {@link DEFAULT_TIER} only when the table is unreadable or
 * empty, so a transient config problem degrades to the current entry rank
 * rather than throwing mid-approval. The caller is still writing a value that
 * the CHECK constraint accepts as long as the TS ladder mirrors the DB.
 */
export async function getEntryTier(client: unknown): Promise<string> {
  try {
    const { data, error } = await (client as TierConfigReader)
      .from('seller_tier_config')
      .select('tier')
      .order('sort_order', { ascending: true })
      .limit(1)

    if (error) return DEFAULT_TIER

    const rows = data as Array<{ tier?: unknown }> | null
    const tier = rows?.[0]?.tier
    return typeof tier === 'string' && tier.length > 0 ? tier : DEFAULT_TIER
  } catch {
    return DEFAULT_TIER
  }
}

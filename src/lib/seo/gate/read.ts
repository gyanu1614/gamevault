import { createTaggedAnonClient } from '@/lib/supabase/anon'
import { createValueItemReadClient } from '@/lib/values/read-client'
import { valuePageVerdict, type ValuePageVerdictReason } from '@/lib/games/indexability'

import { readGateConfig, SEO_GATE_TAG } from './settings'

/**
 * What ONE value page needs from the gate, read cookie-free (static-first):
 * its evidence row under the item's price tag (refreshed with its price) and
 * the gate config under SEO_GATE_TAG. The verdict comes from the same
 * valuePageVerdict the sitemap calls.
 */
export interface ValuePageEvidence {
  observations: number
  historyDays: number
  valueUsd: number | null
  /** The last material price move: visible "Updated", dateModified, sitemap lastmod. */
  priceMovedAt: string | null
  isProtected: boolean
  /** When we first saw a price (a page under 7 days old passes on offers alone). */
  firstSeenAt: string | null
}

export interface ValuePageGate {
  index: boolean
  reason: ValuePageVerdictReason
  evidence: ValuePageEvidence | null
}

export async function readValuePageEvidence(gameSlug: string, itemSlug: string): Promise<ValuePageEvidence | null | undefined> {
  try {
    const { data, error } = await (createValueItemReadClient(gameSlug, itemSlug) as any)
      .from('seo_value_evidence')
      .select('observations, history_days, value_usd, price_moved_at, is_protected, first_seen_at')
      .eq('game_slug', gameSlug)
      .eq('item_slug', itemSlug)
      .maybeSingle()
    if (error) return undefined
    if (!data) return null
    return {
      observations: data.observations,
      historyDays: data.history_days,
      valueUsd: data.value_usd == null ? null : Number(data.value_usd),
      priceMovedAt: data.price_moved_at,
      isProtected: data.is_protected,
      firstSeenAt: data.first_seen_at ?? null,
    }
  } catch {
    return undefined
  }
}

export async function getValuePageGate(
  gameSlug: string,
  itemSlug: string,
  legacyIndexable: boolean,
): Promise<ValuePageGate> {
  const [evidence, config] = await Promise.all([
    readValuePageEvidence(gameSlug, itemSlug),
    readGateConfig(createTaggedAnonClient({ tags: [SEO_GATE_TAG] })),
  ])
  const verdict = valuePageVerdict({
    legacyIndexable,
    evidence: evidence ?? null,
    // A failed evidence read (undefined) must not noindex: treat it as report mode.
    mode: evidence === undefined ? 'report' : config.mode,
    override: config.overrides.get(`/${gameSlug}/values/${itemSlug}`) ?? null,
  })
  return { ...verdict, evidence: evidence ?? null }
}

/** The robots field for a page's metadata: nothing when indexable. */
export function robotsFor(gate: { index: boolean }) {
  return gate.index ? {} : { robots: { index: false, follow: true } }
}

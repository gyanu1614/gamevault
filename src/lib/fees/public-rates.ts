import { unstable_cache } from 'next/cache'

import { createAnonClient } from '@/lib/supabase/anon'
import { FEE_RULES_TAG } from '@/lib/revalidation/tags'

/**
 * Public, cookie-free, cached reads of the seller commission table
 * (docs/design/fee-engine.md §4.2, D2/D3). Everything here resolves with
 * p_seller_id = NULL — the headline rate before any seller adjustment — and
 * sits in unstable_cache under FEE_RULES_TAG, which the admin fee action
 * revalidates after every write. The pages' 24 h `revalidate` is the backstop.
 *
 * No TypeScript here computes a commission (§8.4): per-pair numbers come
 * from resolve_seller_fee; the category-scope row is read only as a
 * structure (which types have a default) and its number is cross-checked
 * against a representative pair's resolver answer whenever one exists.
 */

const TWENTY_FOUR_HOURS = 86_400

type RuleRow = {
  id: string
  kind: 'base' | 'promo'
  scope: 'category' | 'game_category'
  category_type: string
  game_category_id: string | null
  pct: string | number
  starts_at: string
  ends_at: string | null
}

type PairRow = {
  id: string
  slug: string
  name: string | null
  type: string | null
  is_enabled: boolean
  game: { slug: string; name: string; is_active: boolean } | null
}

export const CATEGORY_TYPE_LABEL: Record<string, string> = {
  currency: 'In-game currency',
  items: 'In-game items',
  account: 'Game accounts',
  top_up: 'Top-ups',
  service: 'Boosting & services',
  gift_card: 'Gift cards',
}
export const CATEGORY_TYPE_ORDER = ['currency', 'items', 'top_up', 'gift_card', 'service', 'account'] as const

export interface CategoryRate {
  type: string
  label: string
  /** Headline rate now (resolver, NULL seller) — null when the type has no rule at all. */
  pct: number | null
  /** The rate from `nextChange`, when a dated rule changes it; null = unchanged / no change scheduled. */
  nextPct: number | null
}

export interface GameOverride {
  gameSlug: string
  gameName: string
  categorySlug: string
  categoryName: string
  type: string
  pct: number
  kind: 'base' | 'promo'
  /** Promo only: when the promotional rate ends. */
  endsAt: string | null
}

export interface RankStep {
  tier: string
  displayName: string
  discountPts: number
}

export interface PublicFeeSchedule {
  categories: CategoryRate[]
  overrides: GameOverride[]
  ranks: RankStep[]
  rankFloorPct: number
  founding: { discountPct: number; months: number }
  noticeDays: number
  /** ISO — the start of the category defaults in force now. */
  effectiveFrom: string | null
  /** ISO — the earliest future base-rule start, or null when nothing is scheduled. */
  nextChange: string | null
  generatedAt: string
}

async function resolveNull(client: ReturnType<typeof createAnonClient>, pairId: string, at?: string): Promise<number | null> {
  const args: Record<string, unknown> = { p_seller_id: null, p_game_category_id: pairId }
  if (at) args.p_at = at
  const { data, error } = await client.rpc('resolve_seller_fee', args as any)
  if (error) throw new Error(`resolve_seller_fee(${pairId}): ${error.message}`)
  const row = ((data as any[]) ?? [])[0]
  const pct = Number(row?.pct)
  return Number.isFinite(pct) ? pct : null
}

async function loadSchedule(): Promise<PublicFeeSchedule> {
  const client = createAnonClient()
  const nowIso = new Date().toISOString()

  const [rulesRes, pairsRes, tiersRes, settingsRes] = await Promise.all([
    client.from('fee_rules').select('id, kind, scope, category_type, game_category_id, pct, starts_at, ends_at').order('starts_at', { ascending: true }),
    client
      .from('game_categories')
      .select('id, slug, name, type, is_enabled, game:games!game_categories_game_id_fkey ( slug, name, is_active )')
      .eq('is_enabled', true),
    client.from('seller_tier_config').select('tier, display_name, discount_pts, sort_order').order('sort_order', { ascending: true }),
    client.from('platform_fee_settings').select('rank_floor_pct, founding_discount_pct, founding_months, base_change_notice_days').eq('id', true).maybeSingle(),
  ])
  if (rulesRes.error) throw new Error(`fee_rules: ${rulesRes.error.message}`)
  if (pairsRes.error) throw new Error(`game_categories: ${pairsRes.error.message}`)

  const rules = (rulesRes.data ?? []) as unknown as RuleRow[]
  const pairs = ((pairsRes.data ?? []) as unknown as PairRow[]).filter((p) => p.game?.is_active && p.type)
  const activeNow = (r: RuleRow) => r.starts_at <= nowIso && (r.ends_at == null || r.ends_at > nowIso)
  const future = rules.filter((r) => r.kind === 'base' && r.starts_at > nowIso)
  const nextChange = future.length ? future[0].starts_at : null

  // Pairs that carry their own rule right now (base or promo) — the overrides.
  const ruledPairIds = new Set(rules.filter((r) => r.scope === 'game_category' && r.game_category_id && activeNow(r)).map((r) => r.game_category_id as string))
  // …and pairs with ANY pair rule (including future), excluded from "representative".
  const everRuled = new Set(rules.filter((r) => r.scope === 'game_category' && r.game_category_id).map((r) => r.game_category_id as string))

  const categories: CategoryRate[] = []
  for (const type of CATEGORY_TYPE_ORDER) {
    const catRuleNow = rules.find((r) => r.kind === 'base' && r.scope === 'category' && r.category_type === type && activeNow(r)) ?? null
    const rep = pairs.find((p) => p.type === type && !everRuled.has(p.id)) ?? null
    let pct: number | null = null
    let nextPct: number | null = null
    if (rep) {
      pct = await resolveNull(client, rep.id)
      if (nextChange) nextPct = await resolveNull(client, rep.id, nextChange)
    } else {
      // No rule-free pair of this type (service / gift_card have no pairs yet):
      // the category row IS what a new pair would resolve to.
      pct = catRuleNow ? Number(catRuleNow.pct) : null
      if (nextChange) {
        const catAt = rules.find((r) => r.kind === 'base' && r.scope === 'category' && r.category_type === type && r.starts_at <= nextChange && (r.ends_at == null || r.ends_at > nextChange))
        nextPct = catAt ? Number(catAt.pct) : null
      }
    }
    if (nextPct != null && pct != null && nextPct === pct) nextPct = null
    categories.push({ type, label: CATEGORY_TYPE_LABEL[type] ?? type, pct, nextPct })
  }

  const overrides: GameOverride[] = []
  for (const p of pairs) {
    if (!ruledPairIds.has(p.id)) continue
    const rule = rules
      .filter((r) => r.game_category_id === p.id && activeNow(r))
      .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'promo' ? -1 : 1))[0]
    const pct = await resolveNull(client, p.id)
    if (pct == null) continue
    overrides.push({
      gameSlug: p.game!.slug,
      gameName: p.game!.name,
      categorySlug: p.slug,
      categoryName: p.name ?? CATEGORY_TYPE_LABEL[p.type ?? ''] ?? p.slug,
      type: p.type!,
      pct,
      kind: rule?.kind ?? 'base',
      endsAt: rule?.kind === 'promo' ? rule.ends_at : null,
    })
  }
  overrides.sort((a, b) => a.gameName.localeCompare(b.gameName) || a.type.localeCompare(b.type))

  const settings = (settingsRes.data ?? {}) as any
  const effective = rules
    .filter((r) => r.kind === 'base' && r.scope === 'category' && activeNow(r))
    .map((r) => r.starts_at)
    .sort()
  return {
    categories,
    overrides,
    ranks: ((tiersRes.data ?? []) as any[]).map((t) => ({ tier: t.tier, displayName: t.display_name ?? t.tier, discountPts: Number(t.discount_pts ?? 0) })),
    rankFloorPct: Number(settings.rank_floor_pct ?? 8),
    founding: { discountPct: Number(settings.founding_discount_pct ?? 50), months: Number(settings.founding_months ?? 12) },
    noticeDays: Number(settings.base_change_notice_days ?? 14),
    effectiveFrom: effective.length ? effective[effective.length - 1] : null,
    nextChange,
    generatedAt: nowIso,
  }
}

/** The whole public schedule — one read serves /sell/fees. */
export const getPublicFeeSchedule = unstable_cache(loadSchedule, ['public-fee-schedule'], {
  tags: [FEE_RULES_TAG],
  revalidate: TWENTY_FOUR_HOURS,
})

/**
 * The headline rate for ONE pair (the /[game]/sell title). Cached per pair
 * under the same tag so an admin write refreshes every game's title.
 */
export const getPairHeadlineRate = unstable_cache(
  async (gameCategoryId: string): Promise<number | null> => resolveNull(createAnonClient(), gameCategoryId),
  ['pair-headline-rate'],
  { tags: [FEE_RULES_TAG], revalidate: TWENTY_FOUR_HOURS },
)

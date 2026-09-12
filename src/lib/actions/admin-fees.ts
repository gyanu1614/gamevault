'use server'

/**
 * Admin — fee configuration (/admin/fees).
 *
 * CRUD for the DB-driven fee engine (lib/fees + lib/fees/config):
 *   • category_fee_config      — base % per category + rank-discount flag
 *   • game_fee_overrides       — per-game per-category % (replaces the base)
 *   • seller_tier_config       — rank fee multipliers
 * plus per-seller overrides (profiles.fee_override_pct) edited from the seller
 * detail page (see updateSellerFeeOverride / updateSellerRankPin below).
 *
 * Every write: requireAdmin → guardrail bounds → write → fee_config_audit row
 * → logAdminActivity → invalidateFeeConfigCache. Fees are snapshotted on
 * orders at purchase, so edits are never retroactive.
 */

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/actions/admin-permissions'
import { logAdminActivity } from '@/lib/admin/activity-log'
import { invalidateFeeConfigCache } from '@/lib/fees/config'
import { TIER_KEYS } from '@/lib/seller/tiers'

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const FEE_CATEGORIES = ['currency', 'items', 'accounts', 'top-up'] as const
type FeeCategoryKey = (typeof FEE_CATEGORIES)[number]

// Guardrails — a fat-fingered 0.5% or 50%+ needs a migration, not a click.
const PCT_MIN = 0
const PCT_MAX = 50
const MULTIPLIER_MIN = 0.5
const MULTIPLIER_MAX = 1

function validPct(pct: number): boolean {
  return Number.isFinite(pct) && pct >= PCT_MIN && pct <= PCT_MAX
}

async function auditFeeChange(
  actor: string,
  scope: string,
  key: string,
  oldValue: unknown,
  newValue: unknown,
) {
  const service = getServiceClient()
  const { error } = await (service.from('fee_config_audit').insert as any)({
    actor,
    scope,
    key,
    old_value: oldValue ?? null,
    new_value: newValue ?? null,
  })
  if (error) console.error('[admin-fees] audit insert failed:', error)
}

// ─── Read: everything the /admin/fees page renders ───────────────────────────

export async function getFeeAdminData() {
  await requireAdmin()
  const service = getServiceClient()

  const [categories, overrides, tiers, audit] = await Promise.all([
    service.from('category_fee_config').select('*').order('category'),
    service
      .from('game_fee_overrides')
      .select('*')
      .order('game_slug')
      .order('category'),
    service
      .from('seller_tier_config')
      .select('tier, display_name, fee_multiplier, sort_order')
      .order('sort_order'),
    service
      .from('fee_config_audit')
      .select('*, actor_profile:actor ( username )')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  return {
    categories: categories.data ?? [],
    gameOverrides: overrides.data ?? [],
    rankMultipliers: tiers.data ?? [],
    audit: audit.data ?? [],
  }
}

// ─── Category base fees ──────────────────────────────────────────────────────

export async function updateCategoryFee(input: {
  category: FeeCategoryKey
  basePct: number
  rankDiscount: boolean
}) {
  const admin = await requireAdmin()
  if (!FEE_CATEGORIES.includes(input.category)) {
    return { success: false as const, error: 'Unknown category' }
  }
  if (!validPct(input.basePct)) {
    return { success: false as const, error: `Base fee must be ${PCT_MIN}–${PCT_MAX}%` }
  }

  const service = getServiceClient()
  const { data: before } = await service
    .from('category_fee_config')
    .select('base_pct, rank_discount')
    .eq('category', input.category)
    .maybeSingle()

  const { error } = await (service.from('category_fee_config').update as any)({
    base_pct: input.basePct,
    rank_discount: input.rankDiscount,
    updated_at: new Date().toISOString(),
    updated_by: admin.userId,
  }).eq('category', input.category)

  if (error) {
    console.error('[admin-fees] updateCategoryFee:', error)
    return { success: false as const, error: 'Failed to update category fee' }
  }

  await auditFeeChange(admin.userId, 'category', input.category, before, {
    base_pct: input.basePct,
    rank_discount: input.rankDiscount,
  })
  await logAdminActivity({
    action: 'fee_category_updated',
    actionCategory: 'system',
    resourceType: 'category_fee_config',
    resourceId: input.category,
    previousState: before ?? undefined,
    newState: { base_pct: input.basePct, rank_discount: input.rankDiscount },
  })
  invalidateFeeConfigCache()
  return { success: true as const }
}

// ─── Per-game overrides ──────────────────────────────────────────────────────

export async function upsertGameOverride(input: {
  id?: string | null
  gameSlug: string
  category: FeeCategoryKey
  pct: number
  note?: string | null
  active?: boolean
}) {
  const admin = await requireAdmin()
  const slug = input.gameSlug.trim().toLowerCase()
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return { success: false as const, error: 'Game slug must be lowercase letters/numbers/dashes' }
  }
  if (!FEE_CATEGORIES.includes(input.category)) {
    return { success: false as const, error: 'Unknown category' }
  }
  if (!validPct(input.pct)) {
    return { success: false as const, error: `Fee must be ${PCT_MIN}–${PCT_MAX}%` }
  }

  const service = getServiceClient()
  const row = {
    game_slug: slug,
    category: input.category,
    pct: input.pct,
    note: input.note?.trim() || null,
    active: input.active ?? true,
    updated_at: new Date().toISOString(),
    updated_by: admin.userId,
  }

  const { data: before } = input.id
    ? await service.from('game_fee_overrides').select('*').eq('id', input.id).maybeSingle()
    : { data: null }

  const { error } = input.id
    ? await (service.from('game_fee_overrides').update as any)(row).eq('id', input.id)
    : await (service.from('game_fee_overrides').upsert as any)(row, {
        onConflict: 'game_slug,category',
      })

  if (error) {
    console.error('[admin-fees] upsertGameOverride:', error)
    return { success: false as const, error: 'Failed to save game override' }
  }

  await auditFeeChange(admin.userId, 'game_override', `${slug}/${input.category}`, before, row)
  await logAdminActivity({
    action: 'fee_game_override_saved',
    actionCategory: 'system',
    resourceType: 'game_fee_overrides',
    resourceId: `${slug}/${input.category}`,
    previousState: before ?? undefined,
    newState: row,
  })
  invalidateFeeConfigCache()
  return { success: true as const }
}

export async function deleteGameOverride(id: string) {
  const admin = await requireAdmin()
  const service = getServiceClient()

  const { data: before } = await service
    .from('game_fee_overrides')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (!before) return { success: false as const, error: 'Override not found' }

  const { error } = await service.from('game_fee_overrides').delete().eq('id', id)
  if (error) {
    console.error('[admin-fees] deleteGameOverride:', error)
    return { success: false as const, error: 'Failed to delete override' }
  }

  await auditFeeChange(
    admin.userId,
    'game_override',
    `${(before as any).game_slug}/${(before as any).category}`,
    before,
    null,
  )
  await logAdminActivity({
    action: 'fee_game_override_deleted',
    actionCategory: 'system',
    resourceType: 'game_fee_overrides',
    resourceId: id,
    previousState: before ?? undefined,
  })
  invalidateFeeConfigCache()
  return { success: true as const }
}

// ─── Rank multipliers ────────────────────────────────────────────────────────

export async function updateRankMultiplier(input: { tier: string; multiplier: number }) {
  const admin = await requireAdmin()
  if (!TIER_KEYS.includes(input.tier as any)) {
    return { success: false as const, error: 'Unknown rank' }
  }
  if (
    !Number.isFinite(input.multiplier) ||
    input.multiplier < MULTIPLIER_MIN ||
    input.multiplier > MULTIPLIER_MAX
  ) {
    return {
      success: false as const,
      error: `Multiplier must be ${MULTIPLIER_MIN}–${MULTIPLIER_MAX}`,
    }
  }

  const service = getServiceClient()
  const { data: before } = await service
    .from('seller_tier_config')
    .select('fee_multiplier')
    .eq('tier', input.tier)
    .maybeSingle()

  const { error } = await (service.from('seller_tier_config').update as any)({
    fee_multiplier: input.multiplier,
    // Keep the display-continuity effective items rate in step.
    commission_rate: Math.round(0.1 * input.multiplier * 10000) / 10000,
  }).eq('tier', input.tier)

  if (error) {
    console.error('[admin-fees] updateRankMultiplier:', error)
    return { success: false as const, error: 'Failed to update multiplier' }
  }

  await auditFeeChange(admin.userId, 'rank_multiplier', input.tier, before, {
    fee_multiplier: input.multiplier,
  })
  await logAdminActivity({
    action: 'fee_rank_multiplier_updated',
    actionCategory: 'system',
    resourceType: 'seller_tier_config',
    resourceId: input.tier,
    previousState: before ?? undefined,
    newState: { fee_multiplier: input.multiplier },
  })
  invalidateFeeConfigCache()
  return { success: true as const }
}

// ─── Per-seller override + rank pin (used by the seller detail page) ─────────

export async function updateSellerFeeOverride(input: {
  sellerId: string
  /** null clears the override. */
  pct: number | null
  /** ISO date or null (no expiry). Ignored when pct is null. */
  expiresAt?: string | null
}) {
  const admin = await requireAdmin()
  if (input.pct !== null && !validPct(input.pct)) {
    return { success: false as const, error: `Override must be ${PCT_MIN}–${PCT_MAX}%` }
  }

  const service = getServiceClient()
  const { data: before } = await service
    .from('profiles')
    .select('fee_override_pct, fee_override_expires_at, username, shop_name')
    .eq('id', input.sellerId)
    .maybeSingle()
  if (!before) return { success: false as const, error: 'Seller not found' }

  const newState = {
    fee_override_pct: input.pct,
    fee_override_expires_at: input.pct === null ? null : input.expiresAt ?? null,
  }
  const { error } = await (service.from('profiles').update as any)(newState).eq(
    'id',
    input.sellerId,
  )
  if (error) {
    console.error('[admin-fees] updateSellerFeeOverride:', error)
    return { success: false as const, error: 'Failed to save seller override' }
  }

  await auditFeeChange(admin.userId, 'seller_override', input.sellerId, before, newState)
  await logAdminActivity({
    action: input.pct === null ? 'seller_fee_override_cleared' : 'seller_fee_override_set',
    actionCategory: 'seller',
    resourceType: 'profile',
    resourceId: input.sellerId,
    resourceName: (before as any).shop_name || (before as any).username || undefined,
    previousState: before ?? undefined,
    newState,
  })
  return { success: true as const }
}

export async function updateSellerRankPin(input: { sellerId: string; pinned: boolean }) {
  const admin = await requireAdmin()
  const service = getServiceClient()

  const { data: before } = await service
    .from('profiles')
    .select('tier_pinned, seller_tier, username, shop_name')
    .eq('id', input.sellerId)
    .maybeSingle()
  if (!before) return { success: false as const, error: 'Seller not found' }

  const { error } = await (service.from('profiles').update as any)({
    tier_pinned: input.pinned,
  }).eq('id', input.sellerId)
  if (error) {
    console.error('[admin-fees] updateSellerRankPin:', error)
    return { success: false as const, error: 'Failed to update rank pin' }
  }

  await logAdminActivity({
    action: input.pinned ? 'seller_rank_pinned' : 'seller_rank_unpinned',
    actionCategory: 'seller',
    resourceType: 'profile',
    resourceId: input.sellerId,
    resourceName: (before as any).shop_name || (before as any).username || undefined,
    previousState: { tier_pinned: (before as any).tier_pinned },
    newState: { tier_pinned: input.pinned },
  })
  void admin
  return { success: true as const }
}

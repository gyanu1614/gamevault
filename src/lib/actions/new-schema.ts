/**
 * New-schema read layer (Phase A — additive only)
 *
 * These server actions read from the new Phase A tables:
 *   global_categories, game_categories, attribute_templates,
 *   attributes, attribute_options, attribute_conditional_rules
 *
 * Nothing in the existing app calls these yet. They exist so Phase B
 * (admin redesign) and Phase C (seller wizard) can be built against
 * the new shape without touching the live read paths in
 * `lib/actions/listings.ts`, `lib/api/listings.ts`, `navbar-floating.tsx`,
 * or any marketplace page.
 *
 * Hard rule: this file MUST NOT import from or modify any existing
 * server action. Side-effect free, read-only.
 */

'use server'

import { createClient } from '@/lib/supabase/server'

// ============================================
// TYPES
// ============================================

export interface GlobalCategory {
  id: string
  slug: string
  name: string
  description: string | null
  icon_url: string | null
  icon_emoji: string | null
  sort_order: number
  is_active: boolean
  seo_title: string | null
  seo_description: string | null
}

export interface GameCategory {
  id: string
  game_id: string
  global_category_id: string
  is_enabled: boolean
  requires_region: boolean
  available_regions: Array<{ code: string; name: string; currency?: string }>
  requires_platform: boolean
  available_platforms: string[]
  delivery_modes: string[] // e.g. ['manual'] or ['manual','instant']
  sort_order: number
  seo_title: string | null
  seo_description: string | null
  /** populated when the read joins global_categories */
  global_category?: GlobalCategory
}

export interface AttributeOption {
  id: string
  attribute_id: string
  slug: string
  value: string
  label: string
  description: string | null
  icon_url: string | null
  metadata: Record<string, any>
  sort_order: number
  seo_title: string | null
  seo_description: string | null
}

export interface AttributeConditionalRule {
  id: string
  attribute_id: string
  trigger_attribute_id: string
  operator: 'equals' | 'not_equals' | 'in' | 'not_in'
  trigger_values: string[]
}

export interface Attribute {
  id: string
  template_id: string
  parent_attribute_id: string | null
  slug: string
  name: string
  description: string | null
  type: 'text' | 'number' | 'textarea' | 'select' | 'multiselect' | 'boolean' | 'image_select'
  is_required: boolean
  placeholder: string | null
  help_text: string | null
  min_value: number | null
  max_value: number | null
  max_length: number | null
  default_value: any
  sort_order: number
  seo_title: string | null
  seo_description: string | null
  facet_indexed: boolean
  /** populated when the read joins attribute_options */
  options?: AttributeOption[]
  /** populated when the read joins attribute_conditional_rules where this attr is the CHILD */
  conditional_rules?: AttributeConditionalRule[]
}

export interface AttributeTemplate {
  id: string
  game_category_id: string
  name: string
  version: number
  is_active: boolean
}

export interface AttributeTemplateFull extends AttributeTemplate {
  attributes: Attribute[]
}

type Result<T> = { success: true; data: T } | { success: false; error: string }

function ok<T>(data: T): Result<T>            { return { success: true,  data } }
function fail<T = never>(e: any): Result<T>   {
  const msg = e?.message ?? (typeof e === 'string' ? e : 'Unknown error')
  return { success: false, error: msg }
}

// ============================================
// GLOBAL CATEGORIES
// ============================================

export async function getGlobalCategories(opts?: { includeDisabled?: boolean }): Promise<Result<GlobalCategory[]>> {
  try {
    const supabase = await createClient()
    let q = supabase
      .from('global_categories')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
    if (!opts?.includeDisabled) q = q.eq('is_active', true)
    const { data, error } = await q
    if (error) throw error
    return ok((data ?? []) as GlobalCategory[])
  } catch (e) { return fail(e) }
}

export async function getGlobalCategoryBySlug(slug: string): Promise<Result<GlobalCategory | null>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('global_categories')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()
    if (error) throw error
    return ok((data ?? null) as GlobalCategory | null)
  } catch (e) { return fail(e) }
}

// ============================================
// GAME ↔ CATEGORY JOIN
// ============================================

/** All categories enabled for a single game, joined with the global row for display. */
export async function getGameCategoriesFor(gameId: string): Promise<Result<GameCategory[]>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('game_categories')
      .select(`
        *,
        global_category:global_categories!game_categories_global_category_id_fkey(*)
      `)
      .eq('game_id', gameId)
      .eq('is_enabled', true)
      .order('sort_order', { ascending: true })
    if (error) throw error
    return ok((data ?? []) as unknown as GameCategory[])
  } catch (e) { return fail(e) }
}

/** All games that have a given global category enabled — feeds Step 2 of the seller wizard. */
export async function getGamesForGlobalCategory(globalCategorySlug: string): Promise<Result<GameCategory[]>> {
  try {
    const supabase = await createClient()
    // First resolve the global category id.
    const { data: gc, error: gcErr } = await supabase
      .from('global_categories')
      .select('id')
      .eq('slug', globalCategorySlug)
      .eq('is_active', true)
      .maybeSingle()
    if (gcErr) throw gcErr
    if (!gc) return ok([])
    const { data, error } = await supabase
      .from('game_categories')
      .select(`
        *,
        global_category:global_categories!game_categories_global_category_id_fkey(*)
      `)
      .eq('global_category_id', gc.id)
      .eq('is_enabled', true)
      .order('sort_order', { ascending: true })
    if (error) throw error
    return ok((data ?? []) as unknown as GameCategory[])
  } catch (e) { return fail(e) }
}

/** Resolve a (game_id, global_category_slug) pair to its game_categories row. */
export async function getGameCategoryByPair(
  gameId: string,
  globalCategorySlug: string,
): Promise<Result<GameCategory | null>> {
  try {
    const supabase = await createClient()
    const { data: gc, error: gcErr } = await supabase
      .from('global_categories')
      .select('id')
      .eq('slug', globalCategorySlug)
      .maybeSingle()
    if (gcErr) throw gcErr
    if (!gc) return ok(null)
    const { data, error } = await supabase
      .from('game_categories')
      .select(`
        *,
        global_category:global_categories!game_categories_global_category_id_fkey(*)
      `)
      .eq('game_id', gameId)
      .eq('global_category_id', gc.id)
      .maybeSingle()
    if (error) throw error
    return ok((data ?? null) as unknown as GameCategory | null)
  } catch (e) { return fail(e) }
}

// ============================================
// ATTRIBUTE TEMPLATES
// ============================================

/** Bare template row by game_category_id. */
export async function getAttributeTemplate(gameCategoryId: string): Promise<Result<AttributeTemplate | null>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('attribute_templates')
      .select('*')
      .eq('game_category_id', gameCategoryId)
      .eq('is_active', true)
      .maybeSingle()
    if (error) throw error
    return ok((data ?? null) as AttributeTemplate | null)
  } catch (e) { return fail(e) }
}

/**
 * Full template with all attributes, options, and conditional rules attached.
 * One query per relation — keep it predictable; no N+1.
 */
export async function getAttributeTemplateFull(gameCategoryId: string): Promise<Result<AttributeTemplateFull | null>> {
  try {
    const supabase = await createClient()

    const { data: tpl, error: tplErr } = await supabase
      .from('attribute_templates')
      .select('*')
      .eq('game_category_id', gameCategoryId)
      .eq('is_active', true)
      .maybeSingle()
    if (tplErr) throw tplErr
    if (!tpl) return ok(null)

    const tplId = (tpl as AttributeTemplate).id

    const { data: attrsData, error: attrsErr } = await supabase
      .from('attributes')
      .select('*')
      .eq('template_id', tplId)
      .order('sort_order', { ascending: true })
    if (attrsErr) throw attrsErr

    const attrs = (attrsData ?? []) as Attribute[]
    const attrIds = attrs.map(a => a.id)

    let opts: AttributeOption[] = []
    let rules: AttributeConditionalRule[] = []

    if (attrIds.length > 0) {
      const [optsRes, rulesRes] = await Promise.all([
        supabase
          .from('attribute_options')
          .select('*')
          .in('attribute_id', attrIds)
          .order('sort_order', { ascending: true }),
        supabase
          .from('attribute_conditional_rules')
          .select('*')
          .in('attribute_id', attrIds),
      ])
      if (optsRes.error)  throw optsRes.error
      if (rulesRes.error) throw rulesRes.error
      opts  = (optsRes.data  ?? []) as AttributeOption[]
      rules = (rulesRes.data ?? []) as AttributeConditionalRule[]
    }

    const optsByAttr = new Map<string, AttributeOption[]>()
    for (const o of opts) {
      const arr = optsByAttr.get(o.attribute_id) ?? []
      arr.push(o)
      optsByAttr.set(o.attribute_id, arr)
    }
    const rulesByAttr = new Map<string, AttributeConditionalRule[]>()
    for (const r of rules) {
      const arr = rulesByAttr.get(r.attribute_id) ?? []
      arr.push(r)
      rulesByAttr.set(r.attribute_id, arr)
    }

    const attributes = attrs.map(a => ({
      ...a,
      options:           optsByAttr.get(a.id) ?? [],
      conditional_rules: rulesByAttr.get(a.id) ?? [],
    }))

    return ok({ ...(tpl as AttributeTemplate), attributes })
  } catch (e) { return fail(e) }
}

/**
 * Convenience: resolve (game_id, global_category_slug) → full template.
 * Used by Phase C seller wizard.
 */
export async function getAttributeTemplateByGameAndCategory(
  gameId: string,
  globalCategorySlug: string,
): Promise<Result<AttributeTemplateFull | null>> {
  const pair = await getGameCategoryByPair(gameId, globalCategorySlug)
  if (!pair.success) return pair
  if (!pair.data)    return ok(null)
  return getAttributeTemplateFull(pair.data.id)
}

// ============================================
// CONDITIONAL RULE EVALUATION (pure)
// ============================================

/**
 * Evaluate whether a child attribute should be visible given the current
 * form values. Pure function — exported so the seller wizard, the admin
 * builder live preview, and any future SSR renderer can share semantics.
 *
 * Rules are AND-ed: every rule must pass for the attribute to be shown.
 * If the attribute has no rules, it is always visible.
 *
 * `values` is keyed by attribute id (not slug) for stability.
 */
export async function isAttributeVisible(
  attribute: Attribute,
  values: Record<string, unknown>,
): Promise<boolean> {
  // 'use server' files must export async functions, hence the async wrapper.
  // The logic itself is sync — no IO.
  const rules = attribute.conditional_rules ?? []
  if (rules.length === 0) return true

  for (const rule of rules) {
    const current = values[rule.trigger_attribute_id]
    const triggers = Array.isArray(rule.trigger_values) ? rule.trigger_values : []
    let pass = false
    switch (rule.operator) {
      case 'equals':     pass = triggers.length > 0 && current === triggers[0]; break
      case 'not_equals': pass = triggers.length > 0 && current !== triggers[0]; break
      case 'in':         pass = triggers.includes(current as string); break
      case 'not_in':     pass = !triggers.includes(current as string); break
    }
    if (!pass) return false
  }
  return true
}

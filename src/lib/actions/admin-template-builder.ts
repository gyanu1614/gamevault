/**
 * Admin reads/writes for the attribute template builder (Phase B).
 *
 * Tables touched (all created in Phase A — additive):
 *   - attribute_templates
 *   - attributes
 *   - attribute_options
 *   - attribute_conditional_rules
 *
 * Used only by /admin/games-v2/[id]/templates/[categorySlug] and the
 * builder client component. Never touches the live legacy tables.
 */

'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/actions/admin-permissions'
import { revalidatePath } from 'next/cache'

function getAdminSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type AttrType =
  | 'text' | 'number' | 'textarea' | 'select' | 'multiselect' | 'boolean' | 'image_select'

export interface BuilderOption {
  id: string
  attribute_id: string
  slug: string
  value: string
  label: string
  description: string | null
  icon_url: string | null
  metadata: Record<string, unknown>
  sort_order: number
}

export interface BuilderRule {
  id: string
  attribute_id: string             // child
  trigger_attribute_id: string     // parent
  operator: 'equals' | 'not_equals' | 'in' | 'not_in'
  trigger_values: string[]
}

export interface BuilderAttribute {
  id: string
  template_id: string
  slug: string
  name: string
  description: string | null
  type: AttrType
  is_required: boolean
  placeholder: string | null
  help_text: string | null
  min_value: number | null
  max_value: number | null
  max_length: number | null
  default_value: unknown
  sort_order: number
  facet_indexed: boolean
  options: BuilderOption[]
  rules: BuilderRule[]
}

export interface BuilderHeader {
  game_id: string
  game_name: string
  game_slug: string
  global_category_id: string
  global_category_slug: string
  global_category_name: string
  game_category_id: string
}

export interface BuilderState {
  header: BuilderHeader
  template: { id: string; name: string; version: number; is_active: boolean } | null
  attributes: BuilderAttribute[]
}

type Result<T> = { success: true; data: T } | { success: false; error: string }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// ─── READS ────────────────────────────────────────────────────────────────────

/**
 * Resolve (gameId, globalCategorySlug) → full builder state. Creates the
 * game_categories row + attribute_templates row lazily if missing, so the
 * builder always has something to render.
 */
export async function loadBuilderState(
  gameId: string,
  globalCategorySlug: string,
): Promise<Result<BuilderState>> {
  try {
    await requireAdmin()
    const supabase = getAdminSupabase()

    // 1. Game + global category
    const [{ data: game, error: gErr }, { data: gc, error: gcErr }] = await Promise.all([
      supabase.from('games').select('id, name, slug').eq('id', gameId).maybeSingle(),
      supabase.from('global_categories').select('id, slug, name').eq('slug', globalCategorySlug).maybeSingle(),
    ])
    if (gErr)  return { success: false, error: gErr.message }
    if (gcErr) return { success: false, error: gcErr.message }
    if (!game) return { success: false, error: 'Game not found' }
    if (!gc)   return { success: false, error: 'Category not found' }

    // 2. game_categories row — create lazily if missing
    const { data: existingGCRow } = await supabase
      .from('game_categories')
      .select('id')
      .eq('game_id', gameId)
      .eq('global_category_id', (gc as any).id)
      .maybeSingle()

    let gameCategoryId = (existingGCRow as any)?.id as string | undefined
    if (!gameCategoryId) {
      const { data: newGC, error: insErr } = await supabase
        .from('game_categories')
        .insert({
          game_id: gameId,
          global_category_id: (gc as any).id,
          is_enabled: false, // builder doesn't auto-enable
        })
        .select('id')
        .single()
      if (insErr) return { success: false, error: insErr.message }
      gameCategoryId = (newGC as any).id
    }

    // 3. attribute_templates row — create lazily if missing
    const { data: existingTpl } = await supabase
      .from('attribute_templates')
      .select('id, name, version, is_active')
      .eq('game_category_id', gameCategoryId!)
      .maybeSingle()

    let template = existingTpl as any
    if (!template) {
      const tplName = `${(game as any).name} — ${(gc as any).name}`
      const { data: newTpl, error: tErr } = await supabase
        .from('attribute_templates')
        .insert({ game_category_id: gameCategoryId!, name: tplName, version: 1, is_active: true })
        .select('id, name, version, is_active')
        .single()
      if (tErr) return { success: false, error: tErr.message }
      template = newTpl
    }

    // 4. attributes + options + rules
    const tplId = template.id as string
    const [{ data: attrs }, { data: opts }, { data: rules }] = await Promise.all([
      supabase
        .from('attributes')
        .select('*')
        .eq('template_id', tplId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('attribute_options')
        .select('*')
        .order('sort_order', { ascending: true }),
      supabase
        .from('attribute_conditional_rules')
        .select('*'),
    ])

    const attrRows = (attrs ?? []) as any[]
    const attrIdSet = new Set(attrRows.map((a) => a.id))
    const optsByAttr = new Map<string, BuilderOption[]>()
    for (const o of (opts ?? []) as any[]) {
      if (!attrIdSet.has(o.attribute_id)) continue
      const arr = optsByAttr.get(o.attribute_id) ?? []
      arr.push(o)
      optsByAttr.set(o.attribute_id, arr)
    }
    const rulesByAttr = new Map<string, BuilderRule[]>()
    for (const r of (rules ?? []) as any[]) {
      if (!attrIdSet.has(r.attribute_id)) continue
      const arr = rulesByAttr.get(r.attribute_id) ?? []
      arr.push({
        id: r.id,
        attribute_id: r.attribute_id,
        trigger_attribute_id: r.trigger_attribute_id,
        operator: r.operator,
        trigger_values: Array.isArray(r.trigger_values) ? r.trigger_values : [],
      })
      rulesByAttr.set(r.attribute_id, arr)
    }

    const attributes: BuilderAttribute[] = attrRows.map((a) => ({
      id: a.id,
      template_id: a.template_id,
      slug: a.slug,
      name: a.name,
      description: a.description,
      type: a.type,
      is_required: !!a.is_required,
      placeholder: a.placeholder,
      help_text: a.help_text,
      min_value: a.min_value,
      max_value: a.max_value,
      max_length: a.max_length,
      default_value: a.default_value,
      sort_order: a.sort_order ?? 0,
      facet_indexed: !!a.facet_indexed,
      options: optsByAttr.get(a.id) ?? [],
      rules: rulesByAttr.get(a.id) ?? [],
    }))

    return {
      success: true,
      data: {
        header: {
          game_id: (game as any).id,
          game_name: (game as any).name,
          game_slug: (game as any).slug,
          global_category_id: (gc as any).id,
          global_category_slug: (gc as any).slug,
          global_category_name: (gc as any).name,
          game_category_id: gameCategoryId!,
        },
        template: {
          id: template.id,
          name: template.name,
          version: template.version,
          is_active: !!template.is_active,
        },
        attributes,
      },
    }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Unknown error' }
  }
}

// ─── WRITES — attributes ─────────────────────────────────────────────────────

export interface CreateAttributeInput {
  template_id: string
  name: string
  type: AttrType
  is_required?: boolean
  sort_order?: number
}

export async function createAttribute(input: CreateAttributeInput): Promise<Result<{ id: string; slug: string }>> {
  try {
    await requireAdmin()
    const supabase = getAdminSupabase()

    const baseSlug = slugify(input.name) || `attr-${Date.now()}`
    // ensure uniqueness within the template
    let slug = baseSlug
    let n = 1
    while (true) {
      const { data: clash } = await supabase
        .from('attributes')
        .select('id')
        .eq('template_id', input.template_id)
        .eq('slug', slug)
        .maybeSingle()
      if (!clash) break
      n += 1
      slug = `${baseSlug}-${n}`
    }

    const { data, error } = await supabase
      .from('attributes')
      .insert({
        template_id: input.template_id,
        name: input.name.trim(),
        slug,
        type: input.type,
        is_required: input.is_required ?? false,
        sort_order: input.sort_order ?? 0,
      })
      .select('id, slug')
      .single()
    if (error) return { success: false, error: error.message }
    revalidatePath('/admin/games-v2', 'layout')
    return { success: true, data: { id: (data as any).id, slug: (data as any).slug } }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Unknown error' }
  }
}

export interface UpdateAttributeInput {
  id: string
  name?: string
  description?: string | null
  slug?: string
  type?: AttrType
  is_required?: boolean
  placeholder?: string | null
  help_text?: string | null
  min_value?: number | null
  max_value?: number | null
  max_length?: number | null
  facet_indexed?: boolean
  sort_order?: number
}

export async function updateAttribute(input: UpdateAttributeInput): Promise<Result<{ id: string }>> {
  try {
    await requireAdmin()
    const supabase = getAdminSupabase()
    const patch: Record<string, unknown> = {}
    if (input.name          !== undefined) patch.name = input.name.trim()
    if (input.description   !== undefined) patch.description = input.description?.trim() || null
    if (input.slug          !== undefined) patch.slug = slugify(input.slug)
    if (input.type          !== undefined) patch.type = input.type
    if (input.is_required   !== undefined) patch.is_required = input.is_required
    if (input.placeholder   !== undefined) patch.placeholder = input.placeholder?.trim() || null
    if (input.help_text     !== undefined) patch.help_text = input.help_text?.trim() || null
    if (input.min_value     !== undefined) patch.min_value = input.min_value
    if (input.max_value     !== undefined) patch.max_value = input.max_value
    if (input.max_length    !== undefined) patch.max_length = input.max_length
    if (input.facet_indexed !== undefined) patch.facet_indexed = input.facet_indexed
    if (input.sort_order    !== undefined) patch.sort_order = input.sort_order

    if (Object.keys(patch).length === 0) return { success: true, data: { id: input.id } }
    const { error } = await supabase.from('attributes').update(patch).eq('id', input.id)
    if (error) {
      if ((error as any).code === '23505') {
        return { success: false, error: 'Slug already used by another attribute on this template' }
      }
      return { success: false, error: error.message }
    }
    revalidatePath('/admin/games-v2', 'layout')
    return { success: true, data: { id: input.id } }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Unknown error' }
  }
}

export async function deleteAttribute(id: string): Promise<Result<{ id: string }>> {
  try {
    await requireAdmin()
    const supabase = getAdminSupabase()
    const { error } = await supabase.from('attributes').delete().eq('id', id)
    if (error) return { success: false, error: error.message }
    revalidatePath('/admin/games-v2', 'layout')
    return { success: true, data: { id } }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Unknown error' }
  }
}

export async function reorderAttributes(orderedIds: string[]): Promise<Result<{ count: number }>> {
  try {
    await requireAdmin()
    const supabase = getAdminSupabase()
    // Single UPDATE per id — fewer than 50 in practice
    await Promise.all(
      orderedIds.map((id, idx) =>
        supabase.from('attributes').update({ sort_order: idx }).eq('id', id)
      )
    )
    revalidatePath('/admin/games-v2', 'layout')
    return { success: true, data: { count: orderedIds.length } }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Unknown error' }
  }
}

// ─── WRITES — options ────────────────────────────────────────────────────────

export interface CreateOptionInput {
  attribute_id: string
  label: string
  value?: string  // defaults to slugified label
  sort_order?: number
}

export async function createOption(input: CreateOptionInput): Promise<Result<{ id: string }>> {
  try {
    await requireAdmin()
    const supabase = getAdminSupabase()

    const baseSlug = slugify(input.label) || `opt-${Date.now()}`
    let slug = baseSlug
    let n = 1
    while (true) {
      const { data: clash } = await supabase
        .from('attribute_options')
        .select('id')
        .eq('attribute_id', input.attribute_id)
        .eq('slug', slug)
        .maybeSingle()
      if (!clash) break
      n += 1
      slug = `${baseSlug}-${n}`
    }

    const { data, error } = await supabase
      .from('attribute_options')
      .insert({
        attribute_id: input.attribute_id,
        slug,
        value: input.value?.trim() || slug,
        label: input.label.trim(),
        sort_order: input.sort_order ?? 0,
      })
      .select('id')
      .single()
    if (error) return { success: false, error: error.message }
    revalidatePath('/admin/games-v2', 'layout')
    return { success: true, data: { id: (data as any).id } }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Unknown error' }
  }
}

export interface UpdateOptionInput {
  id: string
  label?: string
  value?: string
  description?: string | null
  icon_url?: string | null
  sort_order?: number
}

export async function updateOption(input: UpdateOptionInput): Promise<Result<{ id: string }>> {
  try {
    await requireAdmin()
    const supabase = getAdminSupabase()
    const patch: Record<string, unknown> = {}
    if (input.label       !== undefined) patch.label = input.label.trim()
    if (input.value       !== undefined) patch.value = input.value.trim()
    if (input.description !== undefined) patch.description = input.description?.trim() || null
    if (input.icon_url    !== undefined) patch.icon_url = input.icon_url
    if (input.sort_order  !== undefined) patch.sort_order = input.sort_order
    if (Object.keys(patch).length === 0) return { success: true, data: { id: input.id } }
    const { error } = await supabase.from('attribute_options').update(patch).eq('id', input.id)
    if (error) return { success: false, error: error.message }
    revalidatePath('/admin/games-v2', 'layout')
    return { success: true, data: { id: input.id } }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Unknown error' }
  }
}

export async function deleteOption(id: string): Promise<Result<{ id: string }>> {
  try {
    await requireAdmin()
    const supabase = getAdminSupabase()
    const { error } = await supabase.from('attribute_options').delete().eq('id', id)
    if (error) return { success: false, error: error.message }
    revalidatePath('/admin/games-v2', 'layout')
    return { success: true, data: { id } }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Unknown error' }
  }
}

// ─── WRITES — conditional rules ──────────────────────────────────────────────

export interface SaveRuleInput {
  id?: string                  // omit to create
  attribute_id: string         // child
  trigger_attribute_id: string // parent
  operator: 'equals' | 'not_equals' | 'in' | 'not_in'
  trigger_values: string[]
}

export async function saveRule(input: SaveRuleInput): Promise<Result<{ id: string }>> {
  try {
    await requireAdmin()
    const supabase = getAdminSupabase()
    if (input.attribute_id === input.trigger_attribute_id) {
      return { success: false, error: 'An attribute cannot trigger itself' }
    }
    const payload = {
      attribute_id: input.attribute_id,
      trigger_attribute_id: input.trigger_attribute_id,
      operator: input.operator,
      trigger_values: input.trigger_values,
    }
    if (input.id) {
      const { error } = await supabase.from('attribute_conditional_rules').update(payload).eq('id', input.id)
      if (error) return { success: false, error: error.message }
      revalidatePath('/admin/games-v2', 'layout')
      return { success: true, data: { id: input.id } }
    }
    const { data, error } = await supabase
      .from('attribute_conditional_rules')
      .insert(payload)
      .select('id')
      .single()
    if (error) return { success: false, error: error.message }
    revalidatePath('/admin/games-v2', 'layout')
    return { success: true, data: { id: (data as any).id } }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Unknown error' }
  }
}

export async function deleteRule(id: string): Promise<Result<{ id: string }>> {
  try {
    await requireAdmin()
    const supabase = getAdminSupabase()
    const { error } = await supabase.from('attribute_conditional_rules').delete().eq('id', id)
    if (error) return { success: false, error: error.message }
    revalidatePath('/admin/games-v2', 'layout')
    return { success: true, data: { id } }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Unknown error' }
  }
}

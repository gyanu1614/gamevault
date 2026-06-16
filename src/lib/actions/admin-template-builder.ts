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

/**
 * Convenience: create a new attribute and immediately wire a conditional
 * rule that says "show this only when trigger_attribute_id equals
 * trigger_value". Used by the tree builder when you click "Add sub-field
 * shown when X is chosen" — saves the admin two trips.
 */
export interface CreateSubAttributeInput {
  template_id: string
  name: string
  type: AttrType
  trigger_attribute_id: string
  trigger_value: string
  sort_order?: number
}

export async function createSubAttribute(
  input: CreateSubAttributeInput
): Promise<Result<{ id: string; slug: string; rule_id: string }>> {
  try {
    await requireAdmin()
    const supabase = getAdminSupabase()

    if (input.template_id === '' || !input.trigger_attribute_id) {
      return { success: false, error: 'Trigger attribute is required' }
    }

    // 1. Create the attribute (same logic as createAttribute, inlined to avoid double admin checks)
    const baseSlug = slugify(input.name) || `attr-${Date.now()}`
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

    const { data: attr, error: attrErr } = await supabase
      .from('attributes')
      .insert({
        template_id: input.template_id,
        name: input.name.trim(),
        slug,
        type: input.type,
        is_required: false,
        sort_order: input.sort_order ?? 0,
      })
      .select('id, slug')
      .single()
    if (attrErr) return { success: false, error: attrErr.message }
    const attrId = (attr as any).id as string

    // 2. Wire the rule
    const { data: rule, error: ruleErr } = await supabase
      .from('attribute_conditional_rules')
      .insert({
        attribute_id: attrId,
        trigger_attribute_id: input.trigger_attribute_id,
        operator: 'equals',
        trigger_values: [input.trigger_value],
      })
      .select('id')
      .single()
    if (ruleErr) {
      // Roll back the attribute create so we don't leave an orphan
      await supabase.from('attributes').delete().eq('id', attrId)
      return { success: false, error: ruleErr.message }
    }

    revalidatePath('/admin/games-v2', 'layout')
    return { success: true, data: { id: attrId, slug: (attr as any).slug, rule_id: (rule as any).id } }
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

export async function reorderOptions(orderedIds: string[]): Promise<Result<{ count: number }>> {
  try {
    await requireAdmin()
    const supabase = getAdminSupabase()
    await Promise.all(
      orderedIds.map((id, idx) =>
        supabase.from('attribute_options').update({ sort_order: idx }).eq('id', id)
      )
    )
    revalidatePath('/admin/games-v2', 'layout')
    return { success: true, data: { count: orderedIds.length } }
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

/**
 * V15 — Bulk-create options.
 *
 * Accepts a newline- (or comma-) separated list of labels and inserts
 * them in one round-trip. Each label is slugified and de-duplicated
 * against the parent attribute's existing slugs so re-paste-and-merge is
 * idempotent. Returns the number of rows actually created.
 *
 * Used by the Choices card's "Bulk add" UI in TemplateBuilder when
 * onboarding large taxonomies (e.g. Steal-a-Brainrot secrets — 270+).
 */
export interface BulkCreateOptionsInput {
  attribute_id: string
  /** Either a single multi-line/CSV string or a pre-parsed list of labels. */
  labels: string | string[]
  /** When true, lines that already exist (by slug) are silently skipped.
   *  Defaults to true so paste-and-merge is safe to repeat. */
  skipDuplicates?: boolean
}

export async function bulkCreateOptions(
  input: BulkCreateOptionsInput,
): Promise<Result<{ created: number; skipped: number }>> {
  try {
    await requireAdmin()
    const supabase = getAdminSupabase()

    const raw = Array.isArray(input.labels)
      ? input.labels
      : input.labels.split(/[\n,]+/g)
    const labels = raw
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      // Drop common wiki noise: leading "File:", "User:", trailing "(Disambiguation)" etc.
      .filter((s) => !/^(File|User|Category):/i.test(s))
      .filter((s) => !/\(Disambiguation\)/i.test(s))
    if (labels.length === 0) {
      return { success: true, data: { created: 0, skipped: 0 } }
    }

    // Read existing slugs once so we can dedupe in-memory.
    const { data: existing, error: existingErr } = await supabase
      .from('attribute_options')
      .select('slug, sort_order')
      .eq('attribute_id', input.attribute_id)
    if (existingErr) return { success: false, error: existingErr.message }

    const taken = new Set<string>((existing ?? []).map((r: any) => r.slug as string))
    const nextSort = (existing ?? []).reduce(
      (max: number, r: any) => Math.max(max, Number(r.sort_order ?? 0)),
      -1,
    ) + 1

    const rows: Array<{
      attribute_id: string
      slug: string
      value: string
      label: string
      sort_order: number
    }> = []
    let skipped = 0

    // Track slugs we're about to insert so the batch dedupes against
    // itself in addition to the existing rows.
    const pending = new Set<string>()

    labels.forEach((label, i) => {
      const baseSlug = slugify(label) || `opt-${Date.now()}-${i}`
      let slug = baseSlug
      let n = 1
      while (taken.has(slug) || pending.has(slug)) {
        if (input.skipDuplicates !== false) {
          skipped += 1
          return
        }
        n += 1
        slug = `${baseSlug}-${n}`
      }
      pending.add(slug)
      rows.push({
        attribute_id: input.attribute_id,
        slug,
        value: slug,
        label,
        sort_order: nextSort + rows.length,
      })
    })

    if (rows.length === 0) {
      revalidatePath('/admin/games-v2', 'layout')
      return { success: true, data: { created: 0, skipped } }
    }

    const { error: insertErr } = await supabase
      .from('attribute_options')
      .insert(rows)
    if (insertErr) return { success: false, error: insertErr.message }

    revalidatePath('/admin/games-v2', 'layout')
    return { success: true, data: { created: rows.length, skipped } }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Unknown error' }
  }
}

/**
 * V15b — Bulk-delete options.
 *
 * Strips every option under one attribute. Used to recover from a bad
 * paste (e.g. dumping a 272-row list into the wrong attribute). Caller
 * passes the attribute id; pass `ids` to delete only a subset instead
 * of the whole list.
 *
 * Returns the count of rows actually removed.
 */
export async function bulkDeleteOptions(input: {
  attribute_id: string
  ids?: string[]
}): Promise<Result<{ deleted: number }>> {
  try {
    await requireAdmin()
    const supabase = getAdminSupabase()

    let q: any = supabase
      .from('attribute_options')
      .delete()
      .eq('attribute_id', input.attribute_id)
    if (input.ids && input.ids.length > 0) {
      q = q.in('id', input.ids)
    }
    // `.select()` causes the delete to return the deleted rows so we can
    // give the admin an accurate count without a separate query.
    const { data, error } = await q.select('id')
    if (error) return { success: false, error: error.message }

    revalidatePath('/admin/games-v2', 'layout')
    return { success: true, data: { deleted: Array.isArray(data) ? data.length : 0 } }
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

/**
 * Upload an icon for an attribute_option. Service-role client; admin gate
 * at top. Public bucket 'attribute-icons' (created via migration).
 */
export async function uploadOptionIcon(
  optionId: string,
  fileData: { name: string; type: string; size: number; base64: string }
): Promise<Result<{ url: string }>> {
  try {
    await requireAdmin()
    const supabase = getAdminSupabase()
    const validTypes = ['image/png','image/jpeg','image/jpg','image/svg+xml','image/webp']
    if (!validTypes.includes(fileData.type)) {
      return { success: false, error: 'Invalid file type' }
    }
    if (fileData.size > 1_048_576) {
      return { success: false, error: 'Icon must be 1 MB or smaller' }
    }
    const commaIdx = fileData.base64.indexOf(',')
    const base64Data = commaIdx >= 0 ? fileData.base64.slice(commaIdx + 1) : fileData.base64
    const buffer = Buffer.from(base64Data, 'base64')
    const ext = (fileData.name.split('.').pop() || 'png').toLowerCase()
    const path = `options/${optionId}-${Date.now()}.${ext}`

    // Best-effort cleanup of the previous icon for this option
    const { data: existing } = await supabase
      .from('attribute_options')
      .select('icon_url')
      .eq('id', optionId)
      .maybeSingle()
    const oldUrl = (existing as { icon_url: string | null } | null)?.icon_url
    if (oldUrl) {
      const marker = '/attribute-icons/'
      const idx = oldUrl.indexOf(marker)
      if (idx >= 0) {
        const oldPath = oldUrl.slice(idx + marker.length)
        if (oldPath.startsWith('options/')) {
          await supabase.storage.from('attribute-icons').remove([oldPath])
        }
      }
    }

    const { error: upErr } = await supabase.storage
      .from('attribute-icons')
      .upload(path, buffer, { contentType: fileData.type, cacheControl: '3600', upsert: true })
    if (upErr) return { success: false, error: upErr.message }

    const { data: urlData } = supabase.storage.from('attribute-icons').getPublicUrl(path)
    const publicUrl = urlData.publicUrl

    const { error: updErr } = await supabase
      .from('attribute_options')
      .update({ icon_url: publicUrl })
      .eq('id', optionId)
    if (updErr) return { success: false, error: updErr.message }

    revalidatePath('/admin/games-v2', 'layout')
    return { success: true, data: { url: publicUrl } }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Upload failed' }
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

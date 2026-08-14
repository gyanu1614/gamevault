'use server'

/**
 * Founding-seller notices — the admin-controlled announcement feed for the
 * Founding Seller HQ page (/founding). Writes are admin-only via the service
 * role; the public feed reader returns only published notices (RLS also
 * enforces this, so the anon-key HQ page can read them on the magic-link path).
 *
 * v1 scope: title + body + pin + publish. No per-recipient targeting/read state.
 * See migration 20260813000000_founding_notices.sql.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { requireAdmin } from './admin-permissions'

export interface FoundingNotice {
  id: string
  title: string
  body: string | null
  pinned: boolean
  priority: number
  published: boolean
  created_at: string
  updated_at: string
}

/** One item as the public HQ stream needs it (no admin-only fields). */
export interface FoundingNoticePublic {
  id: string
  title: string
  body: string | null
  pinned: boolean
  created_at: string
}

const TITLE_MAX = 120
const BODY_MAX = 600

export interface NoticeInput {
  title: string
  body?: string
  pinned?: boolean
  priority?: number
  published?: boolean
}

export interface NoticeResult {
  ok: boolean
  error?: string
}

/**
 * Public reader for the HQ "What's happening" stream. Published only, ordered
 * pinned → priority → newest. Uses the anon server client so it works on the
 * unauthenticated magic-link path (RLS restricts to published rows).
 */
export async function getPublishedFoundingNotices(
  limit = 8,
): Promise<FoundingNoticePublic[]> {
  try {
    const supabase = (await createClient()) as any
    const { data, error } = await supabase
      .from('founding_notices')
      .select('id, title, body, pinned, created_at')
      .eq('published', true)
      .order('pinned', { ascending: false })
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[founding-notices] read failed:', error.message)
      return []
    }
    return data ?? []
  } catch (e) {
    console.error('[founding-notices] read threw:', e)
    return []
  }
}

/** Admin: every notice (incl. drafts) for the composer table. */
export async function listFoundingNotices(): Promise<FoundingNotice[]> {
  await requireAdmin()
  // founding_notices isn't in the generated DB types yet — query via `as any`
  // at the boundary (same pattern as early-seller.ts for its new table).
  const supabase = createServiceRoleClient() as any
  const { data, error } = await supabase
    .from('founding_notices')
    .select('id, title, body, pinned, priority, published, created_at, updated_at')
    .order('pinned', { ascending: false })
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[founding-notices] admin list failed:', error.message)
    return []
  }
  return data ?? []
}

function sanitize(input: NoticeInput): { title: string; body: string | null } | string {
  const title = (input.title ?? '').trim()
  if (!title) return 'A title is required.'
  if (title.length > TITLE_MAX) return `Keep the title under ${TITLE_MAX} characters.`
  const rawBody = (input.body ?? '').trim()
  if (rawBody.length > BODY_MAX) return `Keep the body under ${BODY_MAX} characters.`
  return { title, body: rawBody || null }
}

export async function createFoundingNotice(input: NoticeInput): Promise<NoticeResult> {
  const admin = await requireAdmin()
  const clean = sanitize(input)
  if (typeof clean === 'string') return { ok: false, error: clean }

  const supabase = createServiceRoleClient() as any
  const { error } = await supabase.from('founding_notices').insert({
    title: clean.title,
    body: clean.body,
    pinned: Boolean(input.pinned),
    priority: Number.isFinite(input.priority) ? Number(input.priority) : 0,
    published: input.published ?? true,
    created_by: admin.userId,
  })

  if (error) {
    console.error('[founding-notices] create failed:', error.message)
    return { ok: false, error: 'Could not save the notice. Try again.' }
  }
  revalidatePath('/founding')
  revalidatePath('/admin/founding-notices')
  return { ok: true }
}

export async function updateFoundingNotice(
  id: string,
  input: NoticeInput,
): Promise<NoticeResult> {
  await requireAdmin()
  const clean = sanitize(input)
  if (typeof clean === 'string') return { ok: false, error: clean }

  const supabase = createServiceRoleClient() as any
  const { error } = await supabase
    .from('founding_notices')
    .update({
      title: clean.title,
      body: clean.body,
      pinned: Boolean(input.pinned),
      priority: Number.isFinite(input.priority) ? Number(input.priority) : 0,
      published: input.published ?? true,
    })
    .eq('id', id)

  if (error) {
    console.error('[founding-notices] update failed:', error.message)
    return { ok: false, error: 'Could not update the notice. Try again.' }
  }
  revalidatePath('/founding')
  revalidatePath('/admin/founding-notices')
  return { ok: true }
}

export async function deleteFoundingNotice(id: string): Promise<NoticeResult> {
  await requireAdmin()
  const supabase = createServiceRoleClient() as any
  const { error } = await supabase.from('founding_notices').delete().eq('id', id)

  if (error) {
    console.error('[founding-notices] delete failed:', error.message)
    return { ok: false, error: 'Could not delete the notice. Try again.' }
  }
  revalidatePath('/founding')
  revalidatePath('/admin/founding-notices')
  return { ok: true }
}

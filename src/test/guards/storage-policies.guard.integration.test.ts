/**
 * DLT-003 — every storage bucket's ACL lives in version control.
 *
 * Root cause (2026-09-20 delta audit): a repo-wide search for
 * `storage.objects` / `storage.buckets` across supabase/migrations/ returned
 * ZERO matches, and `SELECT … FROM pg_policy WHERE polrelid =
 * 'storage.objects'::regclass` returned 0 rows on the local stack. Eight
 * buckets are used by the app and every read/write policy existed only in the
 * Supabase dashboard: unversioned, unreviewable, not reproducible on a fresh
 * project, and covered by no test.
 *
 * That compounds the backup finding (DLT-004): a restore into a fresh project
 * came back with NO storage ACLs at all — including kyc-documents (passports,
 * IDs) and delivery-evidence (which can carry account credentials).
 *
 * This guard pins the declared posture: every bucket the app uses exists, its
 * public flag matches intent, and it has at least one policy in version
 * control. Buckets are asserted by NAME so that adding a bucket to the app
 * without declaring it here fails.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { hasEnv, URL, SVC, ANON } from './throwaway'

/**
 * Intent per bucket, matching how the app reads it:
 *   private → the code issues createSignedUrl (kyc-documents,
 *             delivery-evidence). These must never be public: they hold
 *             passports/IDs and delivery proof.
 *   public  → the code issues getPublicUrl and the asset is rendered on a
 *             public page (icons, covers, listing images, avatars, blog art).
 */
const BUCKETS = {
  'kyc-documents': { public: false },
  'delivery-evidence': { public: false },
  'category-icons': { public: true },
  'game-covers': { public: true },
  'listing-images': { public: true },
  'attribute-icons': { public: true },
  'profile-pictures': { public: true },
  'blog-images': { public: true },
} as const

let svc: SupabaseClient
let applied = false

async function migrationApplied(): Promise<boolean> {
  const { error } = await svc.rpc('storage_policies_version')
  return !error
}

describe.skipIf(!hasEnv)('DLT-003 — storage bucket ACLs are in version control (integration)', () => {
  beforeAll(async () => {
    svc = createClient(URL!, SVC!, { auth: { persistSession: false } })
    applied = await migrationApplied()
    if (!applied) console.warn('[storage-policies guard] skipping — storage policy migration not applied')
  }, 30_000)

  it('the migration is applied to the target DB', async () => {
    if (!applied) return
    const { error } = await svc.rpc('storage_policies_version')
    expect(error).toBeNull()
  })

  it.each(Object.keys(BUCKETS))('bucket %s exists', async (name) => {
    if (!applied) return
    const { data, error } = await svc.rpc('storage_bucket_posture', { p_bucket: name })
    expect(error, `storage_bucket_posture(${name}) failed: ${error?.message}`).toBeNull()
    expect((data as any)?.exists, `bucket ${name} does not exist`).toBe(true)
  })

  it.each(Object.entries(BUCKETS))('bucket %s has the intended public flag', async (name, intent) => {
    if (!applied) return
    const { data } = await svc.rpc('storage_bucket_posture', { p_bucket: name })
    expect(
      (data as any)?.is_public,
      `bucket ${name} public flag drifted from intent — a private bucket turning public exposes every object by URL`,
    ).toBe((intent as { public: boolean }).public)
  })

  it.each(Object.keys(BUCKETS))('bucket %s has at least one policy in version control', async (name) => {
    if (!applied) return
    const { data } = await svc.rpc('storage_bucket_posture', { p_bucket: name })
    expect(
      Number((data as any)?.policy_count ?? 0),
      `bucket ${name} has no storage.objects policy — its ACL is not reproducible from the repo`,
    ).toBeGreaterThan(0)
  })

  it('the two private buckets are not readable with the anon key', async () => {
    if (!applied) return
    const anon = createClient(URL!, ANON!, { auth: { persistSession: false } })
    for (const name of ['kyc-documents', 'delivery-evidence']) {
      const { data, error } = await anon.storage.from(name).list()
      // Either an explicit error, or an empty listing — never object names.
      expect(
        error !== null || (data ?? []).length === 0,
        `anon listed objects in the private bucket ${name}`,
      ).toBe(true)
    }
  })

  it('no bucket used by the app is missing from this guard', async () => {
    if (!applied) return
    const { data, error } = await svc.rpc('storage_declared_buckets')
    expect(error).toBeNull()
    const declared = ((data as string[]) ?? []).sort()
    const known = Object.keys(BUCKETS).sort()
    expect(
      declared.filter((b) => !known.includes(b)),
      'a bucket exists in the DB that this guard does not declare — add it to BUCKETS with its intended public flag',
    ).toEqual([])
  })
})

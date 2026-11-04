/**
 * A signed-in user reads their own profile row and nobody else's (integration).
 * DLT-001b, the migration in supabase/migrations_pending or migrations named
 * *_profiles_own_row_only.sql.
 *
 *   · strangers' rows are not readable through `profiles`, directly or embedded, so
 *     every private column (email, paypal_email, balances, KYC, Stripe ids,
 *     restriction state, referral code) is closed at once;
 *   · your own row and staff reads keep working;
 *   · everyone's display details stay readable through `public_profiles`, which has
 *     no private columns;
 *   · what used to read other rows still works: order pages, buyer names, username
 *     checks, shop slugs, referrals.
 *
 * Applies the held-back migration to the local stack if it has not run yet.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { assertGuardTargetAllowed, hasEnv, makeFixture, type Fixture } from './throwaway'

const state = vi.hoisted(() => ({ client: null as any }))

vi.mock('next/cache', () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
  unstable_cache: (fn: any) => fn,
}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/email', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>()
  return Object.fromEntries(Object.keys(real).map((k) => [k, async () => undefined]))
})
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => state.client }))

import { checkUsernameAvailability } from '@/lib/actions/auth'
import { getReferralStats, validateReferralCode } from '@/lib/actions/referral'

const DB_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const ROOT = process.cwd()
const MIGRATION = '_profiles_own_row_only.sql'

const PRIVATE_COLUMNS = [
  'email',
  'full_name',
  'paypal_email',
  'kyc_status',
  'stripe_account_id',
  'stripe_connect_account_id',
  'seller_balance',
  'pending_balance',
  'lifetime_earnings',
  'loyalty_balance',
  'referral_code',
  'referred_by',
  'seller_status',
  'seller_restriction_reason',
  'fee_override_pct',
]

function sql(query: string): string {
  return execFileSync('psql', [DB_URL, '-Atq', '-c', query], { stdio: 'pipe' }).toString().trim()
}

function migrationFile(): string {
  for (const dir of ['supabase/migrations_pending', 'supabase/migrations']) {
    const name = readdirSync(join(ROOT, dir)).find((f) => f.endsWith(MIGRATION))
    if (name) return join(ROOT, dir, name)
  }
  throw new Error(`no *${MIGRATION}`)
}

let fx: Fixture | null = null

describe.skipIf(!hasEnv)('profile privacy (integration)', () => {
  beforeAll(async () => {
    assertGuardTargetAllowed(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env)
    if (sql(`select count(*) from pg_policy where polname = 'profiles_public_projection_read'`) !== '0') {
      execFileSync('psql', [DB_URL, '-v', 'ON_ERROR_STOP=1', '-q', '-f', migrationFile()], { stdio: 'pipe' })
      sql(`notify pgrst, 'reload schema'`)
    }
    fx = await makeFixture()
    const { error } = await fx.svc.from('profiles').update({ role: 'seller', shop_slug: `guardslug-${Date.now().toString(36)}` }).eq('id', fx.seller.id)
    if (error) throw new Error(error.message)
  }, 60_000)

  afterAll(async () => {
    if (fx) await fx.cleanup()
  }, 60_000)

  describe("another person's row", () => {
    it('a stranger cannot read it, whichever column they ask for', async () => {
      for (const column of PRIVATE_COLUMNS) {
        const { data, error } = await fx!.buyer.client.from('profiles').select(column).eq('id', fx!.seller.id)
        expect(error, column).toBeNull()
        expect(data, column).toEqual([])
      }
    })

    it('a stranger cannot list everyone: select * returns their own row only', async () => {
      const { data, error } = await fx!.buyer.client.from('profiles').select('*')
      expect(error).toBeNull()
      expect((data ?? []).map((row: any) => row.id)).toEqual([fx!.buyer.id])
    })

    it('an embed cannot reach it either', async () => {
      const { data, error } = await fx!.buyer.client
        .from('orders')
        .select('id, seller:seller_id(email, paypal_email)')
        .eq('id', fx!.pendingOrderId)
        .single()
      expect(error).toBeNull()
      expect((data as any).seller).toBeNull()
    })

    it('searching on a private column finds nothing', async () => {
      const { data: seller } = await fx!.svc.from('profiles').select('email').eq('id', fx!.seller.id).single()
      const { data } = await fx!.buyer.client.from('profiles').select('id').eq('email', (seller as any).email)
      expect(data).toEqual([])
    })
  })

  describe('your own row and staff', () => {
    it('you read your own row in full', async () => {
      const { data, error } = await fx!.buyer.client.from('profiles').select('*').eq('id', fx!.buyer.id).single()
      expect(error).toBeNull()
      expect((data as any).email).toBeTruthy()
    })

    it('staff with two-factor read any row', async () => {
      const { data, error } = await fx!.admin.client.from('profiles').select('email').eq('id', fx!.seller.id).single()
      expect(error).toBeNull()
      expect((data as any).email).toBeTruthy()
    })

    it('staff without two-factor do not', async () => {
      const client = await fx!.adminPasswordOnly()
      const { data } = await client.from('profiles').select('email').eq('id', fx!.seller.id)
      expect(data).toEqual([])
    })
  })

  describe('public_profiles', () => {
    it('shows anyone their display details, signed in or not', async () => {
      const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false },
      })
      for (const client of [fx!.buyer.client, anon]) {
        const { data, error } = await client.from('public_profiles').select('id, username').eq('id', fx!.seller.id).single()
        expect(error).toBeNull()
        expect((data as any).id).toBe(fx!.seller.id)
      }
    })

    it('has none of the private columns', async () => {
      for (const column of PRIVATE_COLUMNS) {
        const { error } = await fx!.buyer.client.from('public_profiles').select(column).limit(1)
        expect(error, column).not.toBeNull()
      }
    })

    it('embeds through the same foreign keys for both sides of an order', async () => {
      const buyerSide = await fx!.buyer.client
        .from('orders')
        .select('seller:public_profiles!orders_seller_id_fkey(username)')
        .eq('id', fx!.pendingOrderId)
        .single()
      expect(buyerSide.error).toBeNull()
      expect((buyerSide.data as any).seller.username).toBeTruthy()

      const sellerSide = await fx!.seller.client
        .from('orders')
        .select('buyer:public_profiles!orders_buyer_id_fkey(username)')
        .eq('id', fx!.pendingOrderId)
        .single()
      expect(sellerSide.error).toBeNull()
      expect((sellerSide.data as any).buyer.username).toBeTruthy()
    })
  })

  describe('what used to read other rows', () => {
    it('a signed-in user still sees that a username is taken', async () => {
      state.client = fx!.buyer.client
      const { data: seller } = await fx!.svc.from('profiles').select('username').eq('id', fx!.seller.id).single()
      const result = await checkUsernameAvailability((seller as any).username)
      expect(result.available).toBe(false)
    })

    it('a new shop slug still avoids one another seller holds', async () => {
      const { data: seller } = await fx!.svc.from('profiles').select('shop_slug').eq('id', fx!.seller.id).single()
      const slug = (seller as any).shop_slug as string
      const { data, error } = await fx!.buyer.client.rpc('generate_shop_slug', { name: slug })
      expect(error).toBeNull()
      expect(data).toBe(`${slug}-1`)
    })

    it('a referral code still resolves, and only to the name', async () => {
      state.client = fx!.buyer.client
      const code = `GUARD${Date.now().toString(36).toUpperCase()}`
      await fx!.svc.from('profiles').update({ referral_code: code }).eq('id', fx!.seller.id)
      const result = await validateReferralCode(code)
      expect(result.valid).toBe(true)
      expect(result.referrerId).toBe(fx!.seller.id)
    })

    it('a referrer still sees how many people they referred', async () => {
      state.client = fx!.seller.client
      await fx!.svc.from('profiles').update({ referred_by: fx!.seller.id }).eq('id', fx!.buyer.id)
      const result = await getReferralStats()
      await fx!.svc.from('profiles').update({ referred_by: null }).eq('id', fx!.buyer.id)
      expect(result.success, result.error).toBe(true)
      expect(result.data?.totalReferrals).toBe(1)
    })
  })
})

/**
 * Session-client code must read another person's display details through
 * public_profiles. Against `profiles` they silently come back null. Files here run
 * as staff or with the service role, so their embeds still resolve.
 */
describe('embeds of other people use public_profiles', () => {
  const STAFF_OR_SERVICE = [
    'src/app/api/admin/',
    'src/lib/actions/admin-',
    'src/lib/actions/moderation.ts',
    'src/lib/actions/order-cancellation.ts',
    'src/lib/actions/refund-to-source.ts',
    'src/lib/actions/withdrawals.ts',
    // Reviews on a shop page: rendered with the anon client, which keeps its own
    // column-limited read of profiles.
    'src/lib/shop/public-profile.ts',
  ]
  const EMBED = /(?:\b(?:buyer|seller|reviewer|sender|user|admin|restricted_by):(?:buyer_id|seller_id|reviewer_id|sender_id|user_id|restricted_by|seller_restricted_by)\s*\()|(?<![_\w])profiles!/

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) return name === 'test' ? [] : sourceFiles(path)
      return /\.tsx?$/.test(name) && !name.includes('.test.') ? [path] : []
    })
  }

  it('the migration exists where a release can find it', () => {
    expect(existsSync(migrationFile())).toBe(true)
    expect(readFileSync(migrationFile(), 'utf8')).toContain('profiles_public_projection_read')
  })

  it('no other file embeds profiles directly', () => {
    const offenders = sourceFiles(join(ROOT, 'src'))
      .map((path) => relative(ROOT, path))
      .filter((path) => !STAFF_OR_SERVICE.some((allowed) => path.startsWith(allowed)))
      .filter((path) => path !== 'src/types/database.ts' && path !== 'src/types/database.types.ts')
      .filter((path) => EMBED.test(readFileSync(join(ROOT, path), 'utf8')))
    expect(offenders).toEqual([])
  })
})

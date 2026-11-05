/**
 * Staff-like names are refused on every path, in the database (integration).
 * Migration 20261104231717_profile_name_rules.
 *
 * The browser checks can be skipped, so these write straight through PostgREST
 * with the seller's own session, as a hand-made request would.
 */
import { execFileSync } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { isReservedName } from '@/lib/seller/name-rules'
import { assertGuardTargetAllowed, hasEnv, makeFixture, type Fixture } from './throwaway'

const DB_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

function dbReserved(name: string): boolean {
  const out = execFileSync('psql', [DB_URL, '-Atq', '-c', `select public.name_is_reserved('${name.replace(/'/g, "''")}')`], { stdio: 'pipe' })
  return out.toString().trim() === 't'
}

/** A store name that passes every rule and is unique to this run. */
function freeName(tag: string): string {
  return `gt${tag}${Date.now().toString(36)}`.slice(0, 20)
}

let fx: Fixture | null = null
const update = (patch: Record<string, unknown>) => fx!.seller.client.from('profiles').update(patch).eq('id', fx!.seller.id).select('id')
const row = async () => {
  const { data } = await fx!.svc.from('profiles').select('username, shop_name, shop_slug, business_name, shop_name_updated_at').eq('id', fx!.seller.id).single()
  return data as Record<string, string | null>
}

describe.skipIf(!hasEnv)('profile name rules (integration)', () => {
  beforeAll(async () => {
    assertGuardTargetAllowed(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env)
    fx = await makeFixture()
    // The fixture's seller starts with a completed sale. Lend it to the buyer so
    // the seller starts with none; the rename-limit case hands it back.
    const { error } = await fx.svc.from('orders').update({ seller_id: fx.buyer.id }).eq('id', fx.completedOrderId)
    if (error) throw new Error(error.message)
  }, 60_000)

  afterAll(async () => {
    if (fx) await fx.cleanup()
  }, 60_000)

  describe('the TypeScript and SQL copies of the rule agree', () => {
    it.each([
      'dropmarket', 'Dr0p_Market', 'DropMarketSupport', 'SafeDrop_Help', 'gamevault', 'admin', 'Adm1n', 'admin1', '1admin', 'store_admin',
      'M0derator', 'moderation', 'mod', 'Mod_1', 'staff', 'support24', '5upport', 'Official_Store', '0fficial', 'VerifiedSeller',
      'help', 'Help1', 'security', 'system', 'root', 'owner', 'founder',
      'GGTrading', 'Trader1', 'badminton', 'Modern', 'ModShop', 'helpful', 'dropshop', 'rootbeer', 'Ownership', 'blox_market-2',
    ])('%s', (name) => {
      expect(dbReserved(name)).toBe(isReservedName(name))
    })
  })

  describe('a seller writing straight to their own row', () => {
    it.each(['DropMarketSupport', 'admin1', 'Official_Store'])('cannot take the store name %s', async (name) => {
      const before = await row()
      const { error } = await update({ shop_name: name })
      expect(error?.code).toBe('23514')
      expect(error?.hint).toBe('name_rule')
      expect((await row()).shop_name).toBe(before.shop_name)
    })

    it('cannot take a reserved username', async () => {
      const { error } = await update({ username: 'Adm1n' })
      expect(error?.hint).toBe('name_rule')
    })

    it('cannot put a reserved word in the shop address', async () => {
      const { error } = await update({ shop_slug: 'dropmarket' })
      expect(error?.hint).toBe('name_rule')
    })

    it('cannot call the business DropMarket', async () => {
      const { error } = await update({ business_name: 'DropMarket Ltd' })
      expect(error?.hint).toBe('name_rule')
    })

    it('cannot use a store name with spaces or lookalike letters', async () => {
      for (const name of ['Two Words', 'Аdmіnshop']) {
        const { error } = await update({ shop_name: name })
        expect(error?.hint, name).toBe('name_rule')
      }
    })

    it('can take an ordinary name, and the database stamps the change', async () => {
      const name = freeName('a')
      const { error } = await update({ shop_name: name, shop_name_updated_at: '2020-01-01T00:00:00Z' })
      expect(error).toBeNull()
      const after = await row()
      expect(after.shop_name).toBe(name)
      expect(new Date(after.shop_name_updated_at!).getFullYear()).toBeGreaterThan(2020)
    })

    it('cannot reset the rename clock by writing the date', async () => {
      const before = await row()
      const { error } = await update({ shop_name_updated_at: '2020-01-01T00:00:00Z' })
      expect(error).toBeNull()
      expect((await row()).shop_name_updated_at).toBe(before.shop_name_updated_at)
    })

    it('cannot take a store name another seller has, in any casing', async () => {
      const taken = freeName('b')
      await fx!.svc.from('profiles').update({ shop_name: taken }).eq('id', fx!.buyer.id)
      const { error } = await update({ shop_name: taken.toUpperCase() })
      expect(error?.code).toBe('23505')
      await fx!.svc.from('profiles').update({ shop_name: null }).eq('id', fx!.buyer.id)
    })
  })

  describe('the rename limit', () => {
    it('is free before the first completed sale, however recent the last change', async () => {
      await update({ shop_name: freeName('c') })
      const { error } = await update({ shop_name: freeName('d') })
      expect(error).toBeNull()
    })

    it('is once per 90 days after a completed sale', async () => {
      const handBack = await fx!.svc.from('orders').update({ seller_id: fx!.seller.id }).eq('id', fx!.completedOrderId)
      expect(handBack.error).toBeNull()
      await fx!.svc.from('profiles').update({ shop_name_updated_at: new Date().toISOString() }).eq('id', fx!.seller.id)
      const locked = await update({ shop_name: freeName('f') })
      expect(locked.error?.message).toMatch(/90 days/)

      await fx!.svc.from('profiles').update({ shop_name_updated_at: new Date(Date.now() - 91 * 86_400_000).toISOString() }).eq('id', fx!.seller.id)
      const open = await update({ shop_name: freeName('g') })
      expect(open.error).toBeNull()
    })
  })

  describe('the rename limit cannot be dodged', () => {
    it('blanking the name first is refused', async () => {
      const before = await row()
      expect(before.shop_name).not.toBeNull()
      const { error } = await update({ shop_name: null })
      expect(error?.hint).toBe('name_rule')
      expect((await row()).shop_name).toBe(before.shop_name)
    })
  })

  describe('existing names and staff tools', () => {
    it('an unchanged reserved name is left alone, so old stores keep working', async () => {
      execFileSync('psql', [DB_URL, '-q', '-c', `alter table public.profiles disable trigger trg_profiles_name_rules; update public.profiles set business_name = 'Legacy Support' where id = '${fx!.seller.id}'; alter table public.profiles enable trigger trg_profiles_name_rules;`], { stdio: 'pipe' })
      const { error } = await update({ bio: 'still works' })
      expect(error).toBeNull()
      await fx!.svc.from('profiles').update({ business_name: null }).eq('id', fx!.seller.id)
    })

    it('the service role cannot set a reserved name either', async () => {
      const { error } = await fx!.svc.from('profiles').update({ shop_name: 'DropMarket' }).eq('id', fx!.seller.id)
      expect(error?.hint).toBe('name_rule')
    })
  })

  describe('a new account', () => {
    it('gets a neutral username instead of a failed signup', async () => {
      const email = `${fx!.ns.key}-admin@example.com`.toLowerCase()
      const { data, error } = await fx!.svc.auth.admin.createUser({ email, password: 'guard-test-pw-1', email_confirm: true, user_metadata: { username: 'DropMarket' } })
      expect(error).toBeNull()
      const id = data.user!.id
      const { data: profile } = await fx!.svc.from('profiles').select('username').eq('id', id).single()
      expect(profile?.username).toBe(`user_${id.slice(0, 8)}`)
      await fx!.svc.auth.admin.deleteUser(id)
    })
  })
})

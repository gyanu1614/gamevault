/**
 * Admin search (integration) — migration 20261103143657_admin_search.
 *
 *   · the header box answers staff with two-factor, nobody else;
 *   · typed % and _ match themselves;
 *   · text a staff member types into a search can never add a filter: commas,
 *     parentheses and quotes stay part of the search (a typed
 *     "x,status.eq.approved" used to become a second condition).
 */
import { execFileSync } from 'node:child_process'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { hasEnv, makeFixture, type Fixture } from './throwaway'
import { ilikeContains, orIlike } from '@/lib/db/ilike'
import { orderNumberSearchPattern } from '@/lib/orders/order-number'

const DB_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

let fx: Fixture | null = null
let sellerName = ''

const search = (client: Fixture['svc'], term: string) =>
  client.rpc('admin_quick_search', { p_like: ilikeContains(term), p_order_like: orderNumberSearchPattern(term) })

describe.skipIf(!hasEnv)('admin search (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    const { data } = await fx.svc.from('profiles').select('username').eq('id', fx.seller.id).single()
    sellerName = (data as any).username
  }, 60_000)

  afterAll(async () => {
    if (fx) await fx.cleanup()
  }, 60_000)

  it('finds a person for staff', async () => {
    const { data, error } = await search(fx!.admin.client, sellerName)
    expect(error).toBeNull()
    expect(data.users.map((u: any) => u.id)).toContain(fx!.seller.id)
    expect(data).toEqual(expect.objectContaining({ applications: expect.any(Array), disputes: expect.any(Array), orders: expect.any(Array) }))
  })

  it('finds an order by part of its number', async () => {
    const { data: order } = await fx!.svc.from('orders').select('order_number').eq('id', fx!.completedOrderId).single()
    const { data } = await search(fx!.admin.client, (order as any).order_number)
    expect(data.orders.map((o: any) => o.id)).toContain(fx!.completedOrderId)
  })

  it('answers no one else', async () => {
    expect((await search(fx!.buyer.client, sellerName)).data).toBeNull()
    expect((await search(await fx!.adminPasswordOnly(), sellerName)).data).toBeNull()
  })

  it('a typed % or _ matches itself, not everything', async () => {
    const everything = await search(fx!.admin.client, '%')
    expect(everything.data.users.map((u: any) => u.id)).not.toContain(fx!.seller.id)

    // The name with one letter swapped for _: a wildcard would still find it.
    const swapped = `${sellerName.slice(0, -1)}_`
    expect(sellerName.endsWith('_')).toBe(false)
    const { data } = await search(fx!.admin.client, swapped)
    expect(data.users.map((u: any) => u.id)).not.toContain(fx!.seller.id)
  })

  it('search text can never add a filter', async () => {
    const attempts = [
      'x,id.not.is.null',
      'x),id.not.is.null,(y',
      'x%,email.ilike.%',
      'a"b',
      'back\\slash',
      'semi;colon',
    ]
    for (const term of attempts) {
      const { data, error } = await fx!.svc.from('profiles').select('id').or(orIlike(['username', 'email'], term)).limit(5)
      expect(error, term).toBeNull()
      expect(data, term).toEqual([])
    }
  })

  it('a term with syntax in it still finds what it spells', async () => {
    const title = `${fx!.ns.listingTitle()} (rare, 100%)`
    const { error } = await fx!.svc.from('listings').update({ title }).eq('id', fx!.listingId)
    expect(error).toBeNull()
    const { data } = await fx!.svc.from('listings').select('id').or(orIlike(['title'], '(rare, 100%)')).limit(5)
    expect((data ?? []).map((r: any) => r.id)).toContain(fx!.listingId)
  })

  it('the tables that grow have an index for it', () => {
    const rows = execFileSync('psql', [DB_URL, '-Atq', '-c', "select indexname from pg_indexes where schemaname = 'public' and indexdef ilike '%gin_trgm_ops%'"], { stdio: 'pipe' })
      .toString()
      .trim()
      .split('\n')
    expect(rows).toEqual(
      expect.arrayContaining([
        'profiles_username_trgm_idx',
        'profiles_email_trgm_idx',
        'profiles_full_name_trgm_idx',
        'profiles_shop_name_trgm_idx',
        'listings_title_trgm_idx',
        'orders_order_number_search_trgm_idx',
        'reviews_comment_trgm_idx',
      ]),
    )
  })
})

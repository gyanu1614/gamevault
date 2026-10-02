import { describe, it, expect, vi } from 'vitest'

import { createSupabaseRecorder } from '@/test/fakes/supabase-recorder'
import {
  VALUE_CHANGE_MIN_ABSOLUTE_USD,
  VALUE_CHANGE_MIN_RELATIVE,
  changedItemSlugs,
  isMaterialValueChange,
  loadAdoptMeSamples,
  loadEggSamples,
  loadSabSamples,
  submitChangedValuePages,
  valuePageUrls,
} from '@/lib/seo/indexnow/value-changes'

describe('isMaterialValueChange: a cash value moved enough to be worth a re-crawl', () => {
  it('uses a 5% and 25-cent threshold together', () => {
    expect(VALUE_CHANGE_MIN_RELATIVE).toBe(0.05)
    expect(VALUE_CHANGE_MIN_ABSOLUTE_USD).toBe(0.25)
  })
  it.each([
    [100, 106, true], // +6%, $6
    [100, 94, true],
    [100, 104, false], // +4%
    [100, 100, false],
    [2, 2.2, false], // 10% but 20 cents
    [2, 2.3, true], // 15%, 30 cents
    [0, 0.5, true], // from nothing
    [0, 0.1, false],
  ])('%s -> %s is %s', (prev, next, expected) => {
    expect(isMaterialValueChange(prev, next)).toBe(expected)
  })
  it('a price appearing or disappearing always counts; no price on either side never does', () => {
    expect(isMaterialValueChange(null, 12)).toBe(true)
    expect(isMaterialValueChange(12, null)).toBe(true)
    expect(isMaterialValueChange(null, null)).toBe(false)
  })
})

describe('changedItemSlugs', () => {
  it('lists an item once if any of its values moved materially', () => {
    expect(
      changedItemSlugs([
        { slug: 'a', previous: 10, current: 20 },
        { slug: 'a', previous: 5, current: 5 },
        { slug: 'b', previous: 10, current: 10.1 },
        { slug: 'c', previous: null, current: 3 },
      ]),
    ).toEqual(['a', 'c'])
  })
})

describe('valuePageUrls', () => {
  it('nothing changed: nothing to submit (no more "send everything")', () => {
    expect(valuePageUrls('steal-a-brainrot', [])).toEqual([])
  })
  it('the changed items plus the game pages whose numbers they feed', () => {
    expect(valuePageUrls('adopt-me', ['bat-dragon'])).toEqual([
      '/adopt-me/values/bat-dragon',
      '/adopt-me/values',
      '/adopt-me/calculator',
    ])
  })
  it('steal-a-brainrot: its landing, calculator and price index move too', () => {
    const urls = valuePageUrls('steal-a-brainrot', ['x'])
    expect(urls).toEqual(expect.arrayContaining(['/steal-a-brainrot/values/x', '/steal-a-brainrot', '/steal-a-brainrot/values', '/steal-a-brainrot/calculator', '/steal-a-brainrot/price-index']))
  })
})

const TODAY = '2026-10-02'

describe('per-game loaders compare today with the last EARLIER snapshot', () => {
  it('steal-a-brainrot: sab_price_display (default mutation) vs sab_price_history', async () => {
    const db = createSupabaseRecorder({
      sab_price_display: [
        { brainrot_id: 'b1', brainrot_slug: 'alpha', mutation_id: 'm0', mutation_slug: 'default', market_value_usd: 10 },
        { brainrot_id: 'b2', brainrot_slug: 'beta', mutation_id: 'm0', mutation_slug: 'default', market_value_usd: 7 },
      ],
      sab_price_history: [
        { brainrot_id: 'b1', mutation_id: 'm0', history_date: '2026-10-02', median_usd: 10 }, // today's own snapshot: ignored
        { brainrot_id: 'b1', mutation_id: 'm0', history_date: '2026-10-01', median_usd: 8 },
        { brainrot_id: 'b1', mutation_id: 'm0', history_date: '2026-09-30', median_usd: 1 },
        // b2 has no history: a price that appeared
      ],
    }).client
    const samples = await loadSabSamples(db, TODAY)
    expect(samples).toEqual(
      expect.arrayContaining([
        { slug: 'alpha', current: 10, previous: 8 },
        { slug: 'beta', current: 7, previous: null },
      ]),
    )
  })

  it('adopt-me: every variant of a pet counts toward that pet', async () => {
    const db = createSupabaseRecorder({
      adopt_me_pet_values: [
        { pet_id: 'p1', variant: 'normal', cash_value_usd: 5, pet: { slug: 'bat-dragon', has_page: true } },
        { pet_id: 'p1', variant: 'neon', cash_value_usd: 20, pet: { slug: 'bat-dragon', has_page: true } },
        { pet_id: 'p2', variant: 'normal', cash_value_usd: 1, pet: { slug: 'cat', has_page: false } },
      ],
      adopt_me_price_history: [
        { pet_id: 'p1', variant: 'normal', history_date: '2026-10-01', cash_value_usd: 5 },
        { pet_id: 'p1', variant: 'neon', history_date: '2026-10-01', cash_value_usd: 10 },
      ],
    }).client
    const samples = await loadAdoptMeSamples(db, TODAY)
    expect(changedItemSlugs(samples)).toEqual(['bat-dragon']) // neon doubled; the unpublished pet is ignored
  })

  it('generic pipeline (steal-an-egg): values_prices vs values_price_history', async () => {
    const db = createSupabaseRecorder({
      values_prices: [{ item_id: 'i1', cheapest_usd: 9, item: { slug: 'golden-egg', games: { slug: 'steal-an-egg' } } }],
      values_price_history: [{ item_id: 'i1', history_date: '2026-10-01', cheapest_usd: 6 }],
    }).client
    expect(await loadEggSamples(db, TODAY, 'steal-an-egg')).toEqual([{ slug: 'golden-egg', current: 9, previous: 6 }])
  })
})

describe('submitChangedValuePages', () => {
  it('submits the changed items and their hubs, with the game as the reason', async () => {
    const submit = vi.fn(async () => undefined)
    const db = createSupabaseRecorder({
      values_prices: [{ item_id: 'i1', cheapest_usd: 9, item: { slug: 'golden-egg', games: { slug: 'steal-an-egg' } } }],
      values_price_history: [{ item_id: 'i1', history_date: '2026-10-01', cheapest_usd: 6 }],
    }).client
    const n = await submitChangedValuePages(db, 'steal-an-egg', { submit, today: TODAY })
    expect(n).toBe(1)
    expect((submit.mock.calls[0] as unknown as [string[], { reason: string }])[1]).toEqual({ reason: 'value-change:steal-an-egg' })
    expect((submit.mock.calls[0] as unknown as [string[]])[0]).toContain('/steal-an-egg/values/golden-egg')
  })

  it('submits nothing when no value moved', async () => {
    const submit = vi.fn(async () => undefined)
    const db = createSupabaseRecorder({
      values_prices: [{ item_id: 'i1', cheapest_usd: 9, item: { slug: 'golden-egg', games: { slug: 'steal-an-egg' } } }],
      values_price_history: [{ item_id: 'i1', history_date: '2026-10-01', cheapest_usd: 9 }],
    }).client
    expect(await submitChangedValuePages(db, 'steal-an-egg', { submit, today: TODAY })).toBe(0)
    expect(submit).not.toHaveBeenCalled()
  })

  it('never throws on a read failure', async () => {
    const db = { from: () => { throw new Error('db down') } }
    await expect(submitChangedValuePages(db, 'adopt-me', { submit: vi.fn(), today: TODAY })).resolves.toBe(0)
  })
})

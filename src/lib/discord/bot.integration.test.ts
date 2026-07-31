/**
 * Live checks that the bot quotes exactly what the site quotes.
 *
 * Hits the real Supabase project through the same anon path production uses,
 * so it self-skips when credentials are absent (CI without secrets, fresh
 * clones) rather than failing.
 */

import { beforeAll, describe, expect, it } from 'vitest'

import { runValue } from './commands/value'
import { runTop } from './commands/top'
import { runWfl } from './commands/wfl'
import { botSupabase } from './supabase'

const hasCredentials = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

const describeLive = hasCredentials ? describe : describe.skip

describeLive('discord bot against live data', () => {
  let catalogValue: number | null = null

  beforeAll(async () => {
    const { data } = await botSupabase()
      .from('sab_public_price_catalog_corrected')
      .select('market_value_usd')
      .eq('brainrot_slug', 'spyder-elephant')
      .eq('mutation_slug', 'default')
      .maybeSingle()

    catalogValue =
      data?.market_value_usd == null ? null : Number(data.market_value_usd)
  })

  it('quotes the corrected catalog value, not the raw listing', async () => {
    const payload = await runValue('spyder elephant', undefined)
    const embed = payload.embeds?.[0]

    expect(embed).toBeDefined()
    expect(embed?.title).toBe('Spyder Elephant')

    const valueField = embed?.fields?.find((field) => field.name === 'Value')
    expect(valueField).toBeDefined()

    // The whole point of the correction layer: the bot must NOT say $9.98.
    expect(valueField?.value).not.toContain('9.98')

    if (catalogValue != null) {
      const digits = valueField!.value.replace(/[^0-9.]/g, '')
      expect(Number(digits)).toBeCloseTo(catalogValue, 0)
    }
  })

  it('resolves a typo to the right item', async () => {
    const payload = await runValue('skibdi toilet', undefined)
    expect(payload.embeds?.[0]?.title).toBe('Skibidi Toilet')
  })

  it('always attaches a DropMarket link button', async () => {
    const payload = await runValue('garama', undefined)
    const flattened = JSON.stringify(payload.components ?? [])
    expect(flattened).toContain('dropmarket.gg')
    expect(flattened).toContain('ref=discord-bot')
  })

  it('returns an ephemeral miss instead of guessing', async () => {
    const payload = await runValue('zzzzzzzzzzzz', undefined)
    expect(payload.flags).toBeDefined()
    expect(payload.content).toContain("couldn't find")
  })

  it('does not mistake the item "Gold Elf" for a gold mutation', async () => {
    const payload = await runWfl('gold elf', 'garama')
    const body = JSON.stringify(payload)

    // It must have matched the ITEM, so the name survives intact.
    expect(body).toContain('Gold Elf')
    expect(body).not.toContain('Not recognised')
  })

  it('parses a real trade and reaches a verdict', async () => {
    const payload = await runWfl('garama, skibidi toilet', 'tralalero diamond')
    const title = payload.embeds?.[0]?.title ?? ''

    expect(title).toMatch(/WIN|LOSS|FAIR/)

    const fields = payload.embeds?.[0]?.fields ?? []
    expect(fields.some((field) => field.name === 'You give')).toBe(true)
    expect(fields.some((field) => field.name === 'You get')).toBe(true)
  })

  it('reports unmatched items rather than silently dropping them', async () => {
    const payload = await runWfl('garama, qqqqqqqqqq', 'skibidi toilet')
    const body = JSON.stringify(payload)
    expect(body).toContain('qqqqqqqqqq')
  })

  it('builds a top list for a real rarity', async () => {
    const payload = await runTop('Secret', undefined)
    expect(payload.embeds?.[0]?.title).toBe('Top Secret Values')
    expect(payload.embeds?.[0]?.description ?? '').toContain('1.')
  })

  it('rejects an unknown rarity', async () => {
    const payload = await runTop('Ultra', undefined)
    expect(payload.content).toContain('Unknown rarity')
  })
})

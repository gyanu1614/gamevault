import { describe, expect, it } from 'vitest'
import { amSelect, amSelectorGroups, formGroup, mutationGroup } from './variant-selector'

const usd = (n: number) => `$${n}`

describe('amSelectorGroups', () => {
  it('Default tier: Tier group (single) + split Fly / Ride toggles', () => {
    const [tier, potion] = amSelectorGroups('FR', { format: usd })
    expect(tier).toMatchObject({ id: 'tier', label: 'Tier', mode: 'single' })
    expect(tier.options.map((o) => [o.key, o.active])).toEqual([['default', true], ['neon', false], ['mega', false]])
    expect(potion).toMatchObject({ id: 'potion', label: 'Potion', mode: 'toggle' })
    expect(potion.options.map((o) => [o.key, o.active])).toEqual([['fly', true], ['ride', true]])
  })

  it('tier chips use the names the title and table use: Normal, Neon, Mega', () => {
    const [tier] = amSelectorGroups('MFR', { format: usd })
    expect(tier.options.map((o) => o.label)).toEqual(['Normal', 'Neon', 'Mega'])
  })

  it('Neon / Mega: one Fly Ride toggle (no fly-only form exists)', () => {
    const [, potion] = amSelectorGroups('NEON', { format: usd })
    expect(potion.options.map((o) => [o.key, o.label, o.active])).toEqual([['flyride', 'Fly Ride', false]])
  })

  it('each tier shows the price it would switch to, keeping the potions', () => {
    const prices: Record<string, number> = { FR: 3, NFR: 9.8, MFR: 24.9 }
    const [tier] = amSelectorGroups('FR', { format: usd, priceOf: (v) => prices[v] ?? null })
    expect(tier.options.map((o) => o.hint)).toEqual(['$3', '$9.8', '$24.9'])
  })

  it('a tier with no priced form is disabled', () => {
    const [tier] = amSelectorGroups('FR', { format: usd, isAvailable: (v) => v !== 'MEGA' && v !== 'MFR' })
    expect(tier.options.find((o) => o.key === 'mega')?.disabled).toBe(true)
  })
})

describe('amSelect', () => {
  it('switches tier and keeps a valid potion state', () => {
    expect(amSelect('FR', 'tier', 'neon')).toBe('NFR')
    expect(amSelect('F', 'tier', 'mega')).toBe('MFR')
    expect(amSelect('NFR', 'tier', 'default')).toBe('FR')
  })
  it('toggles Fly / Ride on Default and Fly Ride on Neon', () => {
    expect(amSelect('FR', 'potion', 'fly')).toBe('R')
    expect(amSelect('N', 'potion', 'ride')).toBe('R')
    expect(amSelect('NEON', 'potion', 'flyride')).toBe('NFR')
    expect(amSelect('MFR', 'potion', 'flyride')).toBe('MEGA')
  })
})

describe('mutationGroup', () => {
  it('one single-choice group, colours and prices from the data', () => {
    const g = mutationGroup(
      [
        { slug: 'default', name: 'Default', color: '#aaa', priceUsd: 11.5 },
        { slug: 'gold', name: 'Gold', color: '#fc0', priceUsd: null },
      ],
      'gold',
      usd,
    )
    expect(g).toMatchObject({ id: 'mutation', label: 'Mutation', mode: 'single' })
    expect(g.options).toEqual([
      { key: 'default', label: 'Default', color: '#aaa', hint: '$11.5', active: false },
      { key: 'gold', label: 'Gold', color: '#fc0', hint: null, active: true },
    ])
  })
})

describe('formGroup', () => {
  it('links each form to its own page; the current one is active', () => {
    const g = formGroup(
      [
        { key: 'a', label: 'Standard', href: '/mm2/values/a', priceUsd: 5, color: '#fff', current: true },
        { key: 'b', label: 'Chroma', href: '/mm2/values/b', priceUsd: null, color: '#f0f', current: false },
      ],
      usd,
    )
    expect(g.options.map((o) => [o.key, o.href, o.active, o.hint])).toEqual([
      ['a', '/mm2/values/a', true, '$5'],
      ['b', '/mm2/values/b', false, null],
    ])
  })
})

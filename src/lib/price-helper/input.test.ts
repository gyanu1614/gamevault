import { describe, expect, it } from 'vitest'
import { parseHintInput } from './input'

const ok = {
  gameSlug: 'steal-a-brainrot',
  categorySlug: 'items',
  gameCategoryId: '6f1c1f2e-3b7a-4d43-9a39-0d6d3a3f5e11',
  templateData: { 'select-brainrot': 'dragon-cannelloni', mutation: 'gold' },
  optionLabels: { mutation: { gold: 'Gold' } },
  bundleId: null,
}

describe('parseHintInput', () => {
  it('accepts a normal wizard payload', () => {
    expect(parseHintInput(ok)).toMatchObject({ gameSlug: 'steal-a-brainrot', templateData: { 'select-brainrot': 'dragon-cannelloni' } })
  })

  it('rejects a non-uuid pair id', () => {
    expect(parseHintInput({ ...ok, gameCategoryId: 'abc' })).toBeNull()
  })

  it('rejects a slug with odd characters', () => {
    expect(parseHintInput({ ...ok, gameSlug: 'Roblox; drop' })).toBeNull()
  })

  it('drops non-string template answers (nothing the matcher reads)', () => {
    const parsed = parseHintInput({ ...ok, templateData: { a: 'b', n: 4, list: ['x'], o: { deep: 1 } } })
    expect(parsed?.templateData).toEqual({ a: 'b' })
  })

  it('caps the number of template fields', () => {
    const many = Object.fromEntries(Array.from({ length: 81 }, (_, i) => [`k${i}`, 'v']))
    expect(parseHintInput({ ...ok, templateData: many })).toBeNull()
  })

  it('rejects garbage', () => {
    expect(parseHintInput(null)).toBeNull()
    expect(parseHintInput('hi')).toBeNull()
  })
})

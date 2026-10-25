import { describe, expect, it } from 'vitest'
import { savedTraitMismatch, traitHint, traitHintText } from './trait-hint'

// Today's live Trait choices (value = code, label = code).
const CHOICES = ['none', 'n', 'm', 'f', 'r', 'fr', 'nf', 'nr', 'mf', 'mr', 'nfr', 'mfr'].map((value) => ({
  value,
  label: value === 'none' ? 'None' : value.toUpperCase(),
}))

const hint = (title: string, picked: string | null, choices = CHOICES) => traitHint({ title, picked, choices })

describe('traitHint — the four owner cases', () => {
  it('picked FR, title FR → nothing', () => {
    expect(hint('FR Frost Dragon', 'fr')).toBeNull()
  })

  it('picked nothing, title says nothing → nothing', () => {
    expect(hint('Frost Dragon', null)).toBeNull()
    expect(hint('Frost Dragon', '')).toBeNull()
  })

  it('picked nothing, title FR → pre-select FR', () => {
    expect(hint('FR Frost Dragon', null)).toEqual({ kind: 'preselect', titleVariant: 'FR', choice: { value: 'fr', label: 'FR' } })
  })

  it('picked R, title FR → one mismatch line, the pick stays', () => {
    const h = hint('FR Frost Dragon', 'r')
    expect(h).toEqual({ kind: 'mismatch', titleVariant: 'FR', choice: { value: 'fr', label: 'FR' } })
    expect(traitHintText(h!)).toBe('Your title says FR. Switch to Fly Ride?')
  })
})

describe('traitHint — edges', () => {
  it('picked R, title says nothing → nothing', () => {
    expect(hint('Frost Dragon', 'r')).toBeNull()
  })

  it('unclear title → nothing', () => {
    expect(hint('FR + NFR Frost Dragon', 'r')).toBeNull()
    expect(hint('Frost Dragon not FR', null)).toBeNull()
  })

  it('no choice for what the title says → nothing', () => {
    expect(hint('FR Frost Dragon', 'r', CHOICES.filter((c) => c.value !== 'fr'))).toBeNull()
  })

  it('a code the field no longer offers counts as a mismatch', () => {
    expect(hint('FR Frost Dragon', 'fly-ride-fr')?.kind).toBe('mismatch')
  })

  it('finds the choice by label, whatever its stored code', () => {
    const old = [
      { value: 'r', label: 'Fly Ride (FR)' },
      { value: 'fr', label: 'Neon' },
    ]
    expect(hint('FR Frost Dragon', null, old)?.choice).toEqual({ value: 'r', label: 'Fly Ride (FR)' })
    expect(hint('Neon Frost Dragon', 'r', old)?.choice.value).toBe('fr')
  })

  it('skips the pet name', () => {
    expect(traitHint({ title: 'Neon Ride Dragon', itemName: 'Neon Ride Dragon', picked: null, choices: CHOICES })).toBeNull()
  })
})

describe('traitHintText', () => {
  it.each([
    ['NFR Frost Dragon', 'Your title says NFR. Switch to Neon Fly Ride?'],
    ['MFR Frost Dragon', 'Your title says MFR. Switch to Mega Fly Ride?'],
    ['Neon Frost Dragon', 'Your title says Neon. Switch to Neon?'],
    ['R Frost Dragon', 'Your title says R. Switch to Ride?'],
  ])('%s', (title, text) => {
    expect(traitHintText(hint(title, 'f')!)).toBe(text)
  })
})

describe('savedTraitMismatch', () => {
  const labels = { r: 'R', fr: 'FR' }
  it('flags a saved R under an FR title, with the label it has today', () => {
    expect(savedTraitMismatch({ title: 'FR Frost Dragon', templateData: { trait: 'r' }, traitLabels: labels })).toEqual({
      picked: 'r',
      pickedLabel: 'R',
      hint: { kind: 'mismatch', titleVariant: 'FR', choice: { value: 'fr', label: 'FR' } },
    })
  })
  it('a code the field no longer offers has no label', () => {
    expect(savedTraitMismatch({ title: 'FR Frost Dragon', templateData: { trait: 'old' }, traitLabels: labels })?.pickedLabel).toBeNull()
  })
  it('nothing picked, agreeing, or a silent title → null', () => {
    expect(savedTraitMismatch({ title: 'FR Frost Dragon', templateData: {}, traitLabels: labels })).toBeNull()
    expect(savedTraitMismatch({ title: 'FR Frost Dragon', templateData: { trait: 'fr' }, traitLabels: labels })).toBeNull()
    expect(savedTraitMismatch({ title: 'Frost Dragon', templateData: { trait: 'r' }, traitLabels: labels })).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { titleWithoutVariant, variantFromTitle } from './variant-from-title'

describe('variantFromTitle', () => {
  it.each([
    // FR in every spelling sellers use
    ['FR Frost Dragon', 'FR'],
    ['Frost Dragon FR', 'FR'],
    ['Frost Dragon (FR)', 'FR'],
    ['Frost Dragon [FR]', 'FR'],
    ['Fr Kangaroo | Quick Delivery | Adopt Me', 'FR'],
    ['FR  bat dragon |quick delivery| adopt me', 'FR'],
    ['Fly Ride Frost Dragon', 'FR'],
    ['Fly-Ride Frost Dragon', 'FR'],
    ['FlyRide Frost Dragon', 'FR'],
    ['Fly & Ride Frost Dragon', 'FR'],
    ['Fly and Ride Frost Dragon', 'FR'],
    ['Frost Dragon F/R', 'FR'],
    ['Frost Dragon with Fly Ride Potions', 'FR'],
    ['Normal FR Frost Dragon', 'FR'],
    // the same variant named twice is still one variant
    ['FR Shadow Dragon (Fly Ride) – Adopt Me Pet | Quick Delivery', 'FR'],
    ['2x FR Frost Dragon', 'FR'],
    // Neon
    ['NFR Frost Dragon', 'NFR'],
    ['Neon Fly Ride Frost Dragon', 'NFR'],
    ['Neon FR Frost Dragon', 'NFR'],
    ['N-FR Frost Dragon', 'NFR'],
    ['Neon Frost Dragon', 'NEON'],
    ['Neon Frost Dragon (NFR)', 'NFR'],
    ['Neon No Potion Frost Dragon', 'NEON'],
    // Mega
    ['MFR Shadow Dragon', 'MFR'],
    ['Mega Neon FR Shadow Dragon', 'MFR'],
    ['Mega Neon Fly Ride Shadow Dragon', 'MFR'],
    ['MEGA NEON FLY RIDE SHADOW DRAGON', 'MFR'],
    ['Mega Fly Ride Shadow Dragon', 'MFR'],
    ['Mega-Neon FR Shadow Dragon', 'MFR'],
    ['M-FR Shadow Dragon', 'MFR'],
    ['Mega Neon Shadow Dragon', 'MEGA'],
    ['Mega Neon Shadow Dragon MFR', 'MFR'],
    // one potion
    ['Alley cat R', 'R'],
    ['Ride Frost Dragon', 'R'],
    ['F Frost Dragon', 'F'],
    ['Fly Potion Frost Dragon', 'F'],
    // no potion
    ['No Potion Frost Dragon', 'N'],
    ['NP Frost Dragon', 'N'],
    ['Normal Frost Dragon', 'N'],
  ])('%s → %s', (title, expected) => {
    expect(variantFromTitle(title)).toBe(expected)
  })

  it.each([
    // says nothing about the variant
    ['Frost Dragon'],
    ['Frost Dragon | Quick Delivery | Adopt Me'],
    [''],
    // two different variants
    ['FR + NFR Frost Dragon'],
    ['FR or NFR Frost Dragon'],
    ['Frost Dragon FR/NFR'],
    ['Frost Dragon FR NFR'],
    ['Neon Frost Dragon FR'],
    ['Mega deal FR Frost Dragon'],
    // negated
    ['Frost Dragon not FR'],
    ['Frost Dragon (no NFR)'],
    ['Non FR Frost Dragon'],
    ['Frost Dragon without Fly Ride'],
    // bundles and mixes
    ['FR Frost Dragon + FR Bat Dragon'],
    ['FR Frost Dragon & Shadow Dragon'],
    ['Bundle: FR Frost Dragon, FR Owl'],
    ['FR Pets Set'],
    ['NFR Combo Pack'],
    // variants the value pages don't have
    ['MR Moon Rabbit'],
    ['Scarebear MR'],
    ['NR Frost Dragon'],
    ['Neon Fly Frost Dragon'],
    ['Mega Ride Shadow Dragon'],
    // a lone N or M is not a code anyone agrees on
    ['N Frost Dragon'],
    ['Frost Dragon M'],
    ['Fly Ride Potion + Neon'],
  ])('%s → null', (title) => {
    expect(variantFromTitle(title)).toBeNull()
  })

  it('ignores the pet name itself', () => {
    // a made-up pet whose name holds variant words
    expect(variantFromTitle('FR Neon Ride Dragon', { itemName: 'Neon Ride Dragon' })).toBe('FR')
    expect(variantFromTitle('Neon Ride Dragon', { itemName: 'Neon Ride Dragon' })).toBeNull()
  })

  it('does not read variant letters inside other words', () => {
    expect(variantFromTitle('Mecha R4BBIT')).toBeNull()
    expect(variantFromTitle('T-Rex | Fast Delivery')).toBeNull()
    expect(variantFromTitle('Frost Fury FR')).toBe('FR')
    expect(variantFromTitle('Tió De Nadal NFR')).toBe('NFR')
  })
})

describe('titleWithoutVariant', () => {
  it.each([
    ['FR Frost Dragon', 'frost dragon'],
    ['Neon Fly Ride Frost Dragon', 'frost dragon'],
    ['Mega Neon FR Shadow Dragon', 'shadow dragon'],
    ['Frost Dragon (NFR)', 'frost dragon'],
    ['Frost Dragon', 'frost dragon'],
  ])('%s → %s', (title, expected) => {
    expect(titleWithoutVariant(title)).toBe(expected)
  })
})

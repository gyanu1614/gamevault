import { describe, it, expect } from 'vitest'
import {
  fillForBackground,
  resolveMarkFill,
  MARK_FILL_LIGHT,
  MARK_FILL_DARK,
} from './contrast'

describe('fillForBackground', () => {
  it('picks light on dark tiles', () => {
    expect(fillForBackground('#0B0B0C')).toBe('light')
    expect(fillForBackground('#1E6F3C')).toBe('light')
  })

  it('picks dark on light tiles', () => {
    expect(fillForBackground('#FFFFFF')).toBe('dark')
    expect(fillForBackground('#E8D44D')).toBe('dark')
  })

  it('beats the naive brightness threshold on saturated mid-value colours', () => {
    // Pure green: naive (r*299+g*587+b*114)/1000 = 149 > 128 => "light bg,
    // use a dark mark", but WCAG luminance is 0.715 and white actually loses.
    expect(fillForBackground('#00FF00')).toBe('dark')
    // Pure blue: naive = 29 => dark bg. WCAG agrees, luminance is only 0.072.
    expect(fillForBackground('#0000FF')).toBe('light')
    // Saturated red is the closest call: naive = 76 says "dark bg, light
    // mark", but the real ratios are 4.00 against white vs 4.92 against
    // near-black, so the dark mark genuinely wins.
    expect(fillForBackground('#FF0000')).toBe('dark')
  })

  it('accepts shorthand hex and stray whitespace', () => {
    expect(fillForBackground('#fff')).toBe('dark')
    expect(fillForBackground('  #000  ')).toBe('light')
  })

  it('falls back to light for missing or malformed values', () => {
    expect(fillForBackground(null)).toBe('light')
    expect(fillForBackground(undefined)).toBe('light')
    expect(fillForBackground('')).toBe('light')
    expect(fillForBackground('not-a-hex')).toBe('light')
    expect(fillForBackground('#12345')).toBe('light')
  })
})

describe('resolveMarkFill', () => {
  it('derives the fill when no override is set', () => {
    expect(resolveMarkFill('#1E6F3C', null)).toBe(MARK_FILL_LIGHT)
    expect(resolveMarkFill('#E8D44D', null)).toBe(MARK_FILL_DARK)
  })

  it('lets an explicit override win outright', () => {
    // Both of these contradict the computed pick.
    expect(resolveMarkFill('#1E6F3C', 'dark')).toBe(MARK_FILL_DARK)
    expect(resolveMarkFill('#E8D44D', 'light')).toBe(MARK_FILL_LIGHT)
  })

  it('ignores unrecognised override values and computes instead', () => {
    expect(resolveMarkFill('#E8D44D', 'chartreuse')).toBe(MARK_FILL_DARK)
    expect(resolveMarkFill('#E8D44D', '')).toBe(MARK_FILL_DARK)
  })
})

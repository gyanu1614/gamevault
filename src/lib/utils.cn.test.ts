/**
 * `cn()` must know the custom type scale in tailwind.config.ts.
 *
 * Stock tailwind-merge only knows Tailwind's default sizes (`text-sm`,
 * `text-lg`, ...). It read `text-body-sm` as a text COLOUR, so a later real
 * colour in the same call dropped it: `cn('text-body-sm', 'text-text-secondary')`
 * returned `text-text-secondary` and the element inherited its parent's size.
 * Found 2026-09-25 on the items-page filter dropdowns (16px rows instead of 14px).
 */
import { describe, expect, it } from 'vitest'
import tailwindConfig from '../../tailwind.config'
import { cn } from './utils'

const customSizes = Object.keys(
  (tailwindConfig.theme?.extend?.fontSize ?? {}) as Record<string, unknown>,
)

describe('cn() with the custom font-size scale', () => {
  it('reads the scale from tailwind.config.ts', () => {
    expect(customSizes).toContain('body-sm')
  })

  it('keeps a custom size when a colour follows it', () => {
    expect(cn('text-body-sm', 'text-text-secondary')).toBe('text-body-sm text-text-secondary')
  })

  it('keeps a colour when a custom size follows it', () => {
    expect(cn('text-text-secondary', 'text-body-sm')).toBe('text-text-secondary text-body-sm')
  })

  // A size added to tailwind.config.ts without registering it in cn() fails here.
  it.each(customSizes)('registers text-%s as a font size, not a colour', (size) => {
    const cls = `text-${size}`
    expect(cn(cls, 'text-text-secondary')).toBe(`${cls} text-text-secondary`)
    expect(cn(cls, 'text-sm')).toBe('text-sm')
    expect(cn('text-sm', cls)).toBe(cls)
    expect(cn(`md:${cls}`, 'md:text-lime')).toBe(`md:${cls} md:text-lime`)
  })

  it('lets a later custom size override an earlier one', () => {
    expect(cn('text-body-sm', 'text-caption')).toBe('text-caption')
  })

  it('still merges colours with each other', () => {
    expect(cn('text-text-secondary', 'text-text-primary')).toBe('text-text-primary')
  })
})

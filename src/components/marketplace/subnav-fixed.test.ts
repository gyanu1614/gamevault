/**
 * The game sub-navbar (owner, 2026-11-04, GameBoost's as the reference): fixed
 * under the navbar, slides away on scroll down, one step darker than the navbar
 * with a thin neutral line between them, Join Discord on the bar. The scroll rule
 * itself is in src/hooks/useHideOnScroll.test.ts.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SUBNAV_HIDDEN, SUBNAV_HIDDEN_MD, SUBNAV_STRIP } from './subnav-tab'

const root = process.cwd()
const globals = readFileSync(join(root, 'src/app/globals.css'), 'utf8')
const nav = readFileSync(join(root, 'src/components/marketplace/GameSubNav.tsx'), 'utf8')

describe('game sub-navbar', () => {
  it('is fixed flush under the navbar and can slide', () => {
    const classes = SUBNAV_STRIP.split(/\s+/)
    expect(classes).toContain('fixed')
    expect(classes).toContain('top-[var(--subnav-top)]')
    expect(SUBNAV_STRIP).toContain('transition-[transform,opacity]')
    expect(SUBNAV_HIDDEN).toContain('-translate-y-full')
  })

  it('hides on scroll, except a phone back row, which keeps its back button in reach', () => {
    expect(nav).toContain('useHideOnScroll()')
    expect(nav).toContain('phoneBack ? SUBNAV_HIDDEN_MD : SUBNAV_HIDDEN')
    expect(SUBNAV_HIDDEN_MD.split(/\s+/).every((c) => c.startsWith('md:'))).toBe(true)
  })

  it('one step darker than the navbar, with a thin neutral line and no green', () => {
    expect(globals).not.toMatch(/--subnav-bg:\s*var\(--navbar-bg\)/)
    expect(SUBNAV_STRIP).toContain('after:bg-white/[0.07]')
    expect(SUBNAV_STRIP).not.toMatch(/rgba\(57,\s*227,\s*122/)
    expect(SUBNAV_STRIP.split(/\s+/)).toContain('max-lg:!bg-[#16171B]')
  })

  it('Join Discord is on every form of the bar', () => {
    expect(nav.match(/<SubnavDiscordButton/g)?.length).toBe(3)
  })

  it('scroll targets clear both bars', () => {
    expect(globals).toMatch(/--game-chrome-bottom:\s*calc\(var\(--subnav-top\)\s*\+\s*52px\)/)
  })
})

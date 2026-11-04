/**
 * The game sub-navbar stays on screen with the navbar, on every game page and
 * width (owner, 2026-11-04, reversing 2026-11-03). The filters still scroll.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SUBNAV_STRIP } from './subnav-tab'

const globals = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')

describe('game sub-navbar', () => {
  it('is fixed flush under the navbar, not in the page', () => {
    const classes = SUBNAV_STRIP.split(/\s+/)
    expect(classes).toContain('fixed')
    expect(classes).toContain('top-[var(--subnav-top)]')
    expect(classes).not.toContain('absolute')
  })

  it('nothing separates it from the navbar: no line, same colour on every width', () => {
    expect(SUBNAV_STRIP).not.toMatch(/after:|rgba\(57,\s*227,\s*122/)
    expect(SUBNAV_STRIP.split(/\s+/)).toContain('max-lg:!bg-[#1C1D22]') // the navbar's solid colour below lg
    expect(globals).toMatch(/--subnav-bg:\s*var\(--navbar-bg\)/) // the same surface at lg and up
  })

  it('scroll targets clear both bars', () => {
    expect(globals).toMatch(/--game-chrome-bottom:\s*calc\(var\(--subnav-top\)\s*\+\s*52px\)/)
  })
})

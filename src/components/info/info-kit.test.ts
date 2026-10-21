import { describe, it, expect, vi } from 'vitest'
import React, { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ShieldCheckIcon } from '@phosphor-icons/react/dist/ssr/ShieldCheck'

vi.stubGlobal('React', React)
vi.mock('@/components/navigation/AppLink', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => h('a', { href, ...rest }, children),
}))

import { InfoHero } from './InfoHero'
import { InfoSection } from './InfoSection'
import { FactStrip } from './FactStrip'
import { InfoTable } from './InfoTable'
import { StepsRow } from './StepsRow'
import { InfoCtaBand } from './InfoCtaBand'
import { INFO_TONE } from './tones'

const html = (el: React.ReactElement) => renderToStaticMarkup(el)
const text = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

// The shared kit for the site's info pages (owner, 2026-10-15: /safedrop,
// /blog, /browse and /sell/fees in the new UI). Global-navbar pages, so the
// hero does NOT carry HubHero's HubNav clearance.
describe('info page kit', () => {
  it('hero: one h1 with the HubHero type scale, no hub-nav clearance, tone wash', () => {
    const out = html(h(InfoHero, { icon: ShieldCheckIcon, tone: 'blue', title: 'SafeDrop Protection', lead: 'Covered.' }))
    expect(out.match(/<h1/g)).toHaveLength(1)
    expect(out).toMatch(/text-\[30px\][^"]*sm:text-\[42px\]/)
    expect(out).not.toMatch(/pt-\[133px\]/)
    expect(out).toContain(INFO_TONE.blue.wash)
  })

  it('section: labelled by its own heading, with the icon tile in the section tone', () => {
    const out = html(h(InfoSection, { id: 'covered', icon: ShieldCheckIcon, tone: 'green', title: 'What SafeDrop Covers', sub: 'Plain rules.', children: 'body' }))
    expect(out).toMatch(/<section[^>]*aria-labelledby="covered"/)
    expect(out).toMatch(/<h2[^>]*id="covered"[^>]*>What SafeDrop Covers<\/h2>/)
    expect(out).toContain(INFO_TONE.green.hue)
    expect(text(out)).toContain('Plain rules. body')
  })

  it('fact strip: every fact, linked ones as links', () => {
    const out = html(
      h(FactStrip, {
        label: 'Why it is safe',
        items: [
          { icon: ShieldCheckIcon, title: 'Free', body: 'On every order.' },
          { icon: ShieldCheckIcon, title: 'UK Company', body: 'No. 1', href: '/company' },
        ],
      }),
    )
    expect(text(out)).toContain('Free On every order. UK Company No. 1')
    expect(out).toMatch(/<a href="\/company"/)
  })

  it('table: a real table with header cells and banded rows', () => {
    const out = html(
      h(InfoTable, {
        caption: 'Windows',
        columns: [{ key: 'c', label: 'Category' }, { key: 'w', label: 'Window', align: 'right' }],
        rows: [
          { key: 'a', cells: ['Currency', '1 Day'] },
          { key: 'b', cells: ['Items', '3 Days'] },
        ],
      }),
    )
    expect(out).toMatch(/<table/)
    expect(out.match(/<th\b/g)).toHaveLength(2)
    expect(text(out)).toContain('Currency 1 Day Items 3 Days')
    expect(out).toMatch(/even:bg-/)
  })

  it('steps: an ordered list, numbered in order', () => {
    const out = html(
      h(StepsRow, {
        tone: 'blue',
        steps: [
          { icon: ShieldCheckIcon, title: 'You Pay', body: 'a' },
          { icon: ShieldCheckIcon, title: 'Seller Delivers', body: 'b' },
          { icon: ShieldCheckIcon, title: 'You Confirm', body: 'c' },
        ],
      }),
    )
    expect(out).toMatch(/<ol/)
    expect(text(out)).toMatch(/1 You Pay a .*2 Seller Delivers b .*3 You Confirm c/)
  })

  it('cta band: one heading and one action', () => {
    const out = html(h(InfoCtaBand, { icon: ShieldCheckIcon, tone: 'blue', title: 'Shop Safely', body: 'b', action: { href: '/browse', label: 'Browse the Marketplace' } }))
    expect(out.match(/<h2/g)).toHaveLength(1)
    expect(out).toMatch(/<a href="\/browse"[^>]*>.*Browse the Marketplace/)
  })
})

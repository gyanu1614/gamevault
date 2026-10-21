import { describe, it, expect, vi } from 'vitest'
import React, { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

vi.stubGlobal('React', React)
vi.mock('@/components/navigation/AppLink', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => h('a', { href, ...rest }, children),
}))

import {
  DISPUTE_DECISION_DAYS,
  DISPUTE_EVIDENCE_HOURS,
  DISPUTE_WINDOW_DAYS,
  PROTECTION_WINDOW_HOURS as WIN,
  SELLER_RESPONSE_HOURS,
  hoursAsDaysTitle,
} from '@/lib/legal/protection-windows'
import { SAFEDROP_FAQ, SAFEDROP_FACTS } from './_content'
import { WindowsTable } from './_WindowsTable'
import { DisputeTimeline } from './_DisputeTimeline'
import { Coverage } from './_Coverage'

const DIR = join(process.cwd(), 'src/app/(marketing)/safedrop')
const text = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()

// Owner, 2026-10-15: the old-look /safedrop, redesigned. Short, organised,
// the new card system, every number from the same module as the legal terms.
describe('/safedrop', () => {
  it('protection windows come from the legal module, every category', () => {
    const t = text(renderToStaticMarkup(h(WindowsTable)))
    for (const [label, hours] of [
      ['In-Game Currency', WIN.currency],
      ['Items', WIN.items],
      ['Top-Ups', WIN.top_up],
      ['Gift Cards', WIN.gift_card],
      ['Boosting & Coaching', WIN.service],
      ['Game Accounts', WIN.account],
    ] as const) {
      expect(t).toContain(`${label} ${hoursAsDaysTitle(hours)}`)
    }
    expect(t).toContain(`${DISPUTE_WINDOW_DAYS} days`)
  })

  it('the dispute steps state the policy numbers, in order', () => {
    const t = text(renderToStaticMarkup(h(DisputeTimeline)))
    const at = (s: string) => t.indexOf(s)
    expect(at(`${SELLER_RESPONSE_HOURS} Hours`)).toBeGreaterThan(-1)
    expect(at(`${DISPUTE_EVIDENCE_HOURS} Hours`)).toBeGreaterThan(at(`${SELLER_RESPONSE_HOURS} Hours`))
    expect(at(`${DISPUTE_DECISION_DAYS} Days`)).toBeGreaterThan(at(`${DISPUTE_EVIDENCE_HOURS} Hours`))
  })

  it('covered and not covered side by side, the account window from the module', () => {
    const t = text(renderToStaticMarkup(h(Coverage)))
    expect(t.indexOf('Covered')).toBeLessThan(t.indexOf('Not Covered'))
    expect(t).toContain(hoursAsDaysTitle(WIN.account).toLowerCase())
  })

  it('the FAQ markup is built from the same items the page shows', () => {
    const page = readFileSync(join(DIR, 'page.tsx'), 'utf8')
    expect(page).toMatch(/faqPage\(SAFEDROP_FAQ\)/)
    expect(page).toMatch(/items=\{SAFEDROP_FAQ\}/)
    expect(SAFEDROP_FAQ.length).toBeGreaterThanOrEqual(4)
  })

  it('never claims sellers are verified before they can sell (they list first, ID check before payout)', () => {
    const all = SAFEDROP_FACTS.map((f) => `${f.title} ${f.body}`).join(' ')
    expect(all).not.toMatch(/before they can (sell|list)/i)
    expect(all).toMatch(/before their first payout/i)
  })

  it('no em dash in any visible string of the page', () => {
    for (const f of readdirSync(DIR).filter((n) => /\.tsx?$/.test(n) && !n.endsWith('.test.ts'))) {
      const code = readFileSync(join(DIR, f), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      expect(code, f).not.toMatch(/[—–]/)
    }
  })
})

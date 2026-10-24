import * as React from 'react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect, vi } from 'vitest'

// vitest compiles .tsx with the classic JSX runtime (React.createElement).
;(globalThis as { React?: typeof React }).React = React

vi.mock('@/components/analytics/ConsentBanner', () => ({ CookieSettingsButton: () => null }))

import { Footer } from '@/components/footer'
import { HubFooter } from '@/components/content/HubFooter'
import { BRAND_PROFILES, DISCORD_INVITE_URL } from '@/lib/config/social'

// Owner, 2026-10-23: our profiles show in both footers, from the same list the
// Organization JSON-LD sameAs carries — so Google and visitors see one set.
describe('footer social profiles', () => {
  const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'))

  it('the site footer links every profile, labelled for screen readers', () => {
    const html = renderToStaticMarkup(createElement(Footer))
    for (const p of BRAND_PROFILES) {
      expect(hrefs(html), p.name).toContain(p.url)
      expect(html).toContain(`aria-label="DropMarket on ${p.name}"`)
    }
  })

  it('the hub footer links Discord and every profile', () => {
    const html = renderToStaticMarkup(
      createElement(HubFooter, { gameName: 'Adopt Me', gameSlug: 'adopt-me', tools: [], itemsHref: null, accountsHref: null }),
    )
    expect(hrefs(html)).toContain(DISCORD_INVITE_URL)
    for (const p of BRAND_PROFILES) expect(hrefs(html), p.name).toContain(p.url)
  })
})

// @vitest-environment node
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

;(globalThis as { React?: unknown }).React = React

vi.mock('@/components/navigation/AppLink', () => ({
  default: ({ href, children }: { href: string; children: unknown }) => createElement('a', { href }, children as never),
}))

import KycCompletePage from './page'

describe('/kyc/complete', () => {
  const html = renderToStaticMarkup(createElement(KycCompletePage))

  it('sends the seller back to Settings', () => {
    expect(html).toContain('href="/account/settings?tab=seller"')
    expect(html).toContain('Back To Settings')
  })

  it('makes no claim about the result, and no longer mentions an application', () => {
    expect(html).not.toMatch(/verified|approved|application/i)
  })

  it('uses the dark theme, not the old light one', () => {
    expect(html).toContain('bg-bg-base')
    expect(html).not.toContain('#FAFAF7')
  })
})

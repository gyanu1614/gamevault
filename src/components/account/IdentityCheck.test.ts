// @vitest-environment node
/**
 * What a seller sees for each state of their ID check, on the Settings card and
 * on the withdrawal page.
 */
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

;(globalThis as { React?: unknown }).React = React

vi.mock('@/lib/actions/identity-check', () => ({ startIdentityCheck: vi.fn() }))

import { IdentityCheckButton, IdentityCheckCard } from './IdentityCheck'
import type { IdentityState } from '@/lib/identity/state'

function render(component: typeof IdentityCheckCard, state: IdentityState | null, available = true): string {
  const client = new QueryClient()
  if (state) client.setQueryData(['identity-check'], { state, available })
  return renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(component)))
}

describe('IdentityCheckCard', () => {
  it('says when it is needed', () => {
    expect(render(IdentityCheckCard, 'not_started')).toContain('Needed before your first withdrawal.')
  })

  it('not started: offers the check', () => {
    const html = render(IdentityCheckCard, 'not_started')
    expect(html).toContain('Not Started')
    expect(html).toContain('Verify Identity')
  })

  it('in review: no button to start another', () => {
    const html = render(IdentityCheckCard, 'in_review')
    expect(html).toContain('In Review')
    expect(html).not.toContain('Verify Identity')
    expect(html).not.toContain('Try Again')
  })

  it('needs attention: offers another try and support', () => {
    const html = render(IdentityCheckCard, 'needs_attention')
    expect(html).toContain('Needs Attention')
    expect(html).toContain('Try Again')
    expect(html).toContain('support@dropmarket.gg')
  })

  it('verified: shows the state and no button', () => {
    const html = render(IdentityCheckCard, 'verified')
    expect(html).toContain('Verified')
    expect(html).not.toContain('Verify Identity')
  })

  it('checks not open: says so, and offers no button', () => {
    const html = render(IdentityCheckCard, 'not_started', false)
    expect(html).toContain('not open right now')
    expect(html).not.toContain('Verify Identity')
  })

  it('still loading: a placeholder, not a wrong state', () => {
    const html = render(IdentityCheckCard, null)
    expect(html).toContain('skeleton')
    expect(html).not.toContain('Not Started')
  })
})

describe('IdentityCheckButton on the withdrawal page', () => {
  it('offers the check to a seller who has not done it', () => {
    expect(render(IdentityCheckButton, 'not_started')).toContain('Verify Identity')
  })

  it('offers another try after a declined check', () => {
    expect(render(IdentityCheckButton, 'needs_attention')).toContain('Try Again')
  })

  it('explains the wait while in review, with no button', () => {
    const html = render(IdentityCheckButton, 'in_review')
    expect(html).toContain('being checked')
    expect(html).not.toContain('<button')
  })

  it.each([['verified', true], ['not_started', false]] as const)('draws nothing when %s and open=%s', (state, available) => {
    expect(render(IdentityCheckButton, state, available)).toBe('')
  })
})

// @vitest-environment node
/**
 * Admin → Listings rows: what staff see and which action each status offers.
 */
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

;(globalThis as { React?: unknown }).React = React

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/components/navigation/AppLink', () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown }) => createElement('a', { href, ...rest }, children as never),
}))
vi.mock('@/lib/actions/admin-moderation-tools', () => ({ takedownListing: vi.fn(), restoreListing: vi.fn() }))

import AdminListingsClient from './AdminListingsClient'
import type { AdminListingRow } from '@/lib/admin/admin-listings'

function row(patch: Partial<AdminListingRow> = {}): AdminListingRow {
  return {
    id: 'listing-1',
    title: 'Neon Unicorn',
    slug: 'neon-unicorn',
    image: null,
    price: 12.5,
    status: 'active',
    created_at: '2026-11-01T12:00:00Z',
    note: null,
    seller: { id: 'seller-1', name: 'GGTrading', status: 'active' },
    game: { name: 'Adopt Me', slug: 'adopt-me' },
    category: { name: 'Pets', slug: 'pets' },
    ...patch,
  }
}

function render(rows: AdminListingRow[], filters = {}, total = rows.length): string {
  return renderToStaticMarkup(
    createElement(AdminListingsClient, { result: { rows, total, page: 1, pageSize: 25 }, filters }),
  )
}

describe('AdminListingsClient', () => {
  it('a live listing links to its public page and to its seller, and offers Take Down', () => {
    const html = render([row()])
    expect(html).toContain('href="/adopt-me/pets/neon-unicorn"')
    expect(html).toContain('href="/admin/active-sellers/seller-1"')
    expect(html).toContain('GGTrading')
    expect(html).toContain('$12.50')
    expect(html).toContain('Live')
    expect(html).toContain('Take Down')
    expect(html).not.toContain('Restore')
  })

  it('a taken-down listing shows the reason without the staff prefix, and offers Restore', () => {
    const html = render([row({ status: 'suspended', note: 'Taken down: No offsite trading' })])
    expect(html).toContain('No offsite trading')
    expect(html).not.toContain('Taken down:')
    expect(html).toContain('Taken Down')
    expect(html).toContain('Restore')
    expect(html).not.toContain('href="/adopt-me/pets/neon-unicorn"')
  })

  it('a refused listing shows why, and offers neither action', () => {
    const html = render([row({ status: 'rejected', note: 'Wrong game' })])
    expect(html).toContain('Wrong game')
    expect(html).toContain('Not Approved')
    expect(html).not.toContain('>Take Down<')
    expect(html).not.toContain('>Restore<')
  })

  it.each(['pending_approval', 'changes_requested', 'paused'])('%s can be taken down', (status) => {
    expect(render([row({ status })])).toContain('>Take Down<')
  })

  it('keeps the status filter when searching, and marks the chosen status', () => {
    const html = render([row()], { status: 'suspended', q: 'neon' })
    expect(html).toContain('name="status" value="suspended"')
    expect(html).toContain('value="neon"')
    expect(html).toMatch(/aria-current="true"[^>]*>Taken Down|href="\/admin\/listings\?q=neon&amp;status=suspended"[^>]*aria-current="true"/)
  })

  it('shows a plain empty state', () => {
    expect(render([])).toContain('No listings match')
  })

  it('a listing whose seller is gone still renders', () => {
    const html = render([row({ seller: { id: null, name: null, status: null } })])
    expect(html).toContain('Unknown')
  })

  it('pages only when there is more than one page', () => {
    expect(render([row()], {}, 1)).not.toContain('listings</')
    expect(render([row()], {}, 60)).toMatch(/60/)
  })
})

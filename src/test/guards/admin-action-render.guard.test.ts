/**
 * One admin click, one page load.
 *
 *   · a page whose client owns its data skips its loaders on the refresh Next
 *     sends back in a server action's response (isActionResponseRender), but runs
 *     them on a real visit, including the render for an action's redirect();
 *   · router.refresh() after an action that already refreshed the page runs the
 *     whole page a second time, so admin code may only call it from the files
 *     listed here, each with the reason the action's own refresh is not enough.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Vitest compiles JSX classically (React.createElement).
;(globalThis as any).React = React

const state = vi.hoisted(() => ({ headers: new Headers(), loaderCalls: 0 }))

vi.mock('next/headers', () => ({ headers: () => state.headers }))
vi.mock('@/lib/actions/admin-permissions', () => ({ requireAdmin: async () => ({ userId: 'admin' }) }))
vi.mock('@/lib/actions/moderation', () => ({
  getPendingListings: async () => {
    state.loaderCalls += 1
    return { success: true, listings: [] }
  },
  getModerationStats: async () => {
    state.loaderCalls += 1
    return { success: true, stats: null }
  },
}))
vi.mock('@/app/(admin)/admin/moderation/_components/ModerationPageClient', () => ({ default: () => null }))

import { isActionResponseRender } from '@/lib/admin/action-render'
import ModerationQueuePage from '@/app/(admin)/admin/moderation/page'

const ADMIN = join(process.cwd(), 'src/app/(admin)/admin')

/** Pages that must not run their loaders for an action's refresh. */
const CLIENT_OWNED_PAGES = [
  'moderation',
  'sellers',
  'active-sellers',
  'active-sellers/[id]',
  'games',
  'orders',
  'disputes',
  'promos',
  'seller-leads',
  'founding-notices',
  'reviews',
]

/** Files that may call router.refresh(), and why the action's own refresh is not enough. */
const REFRESH_ALLOWED: Record<string, string> = {
  'fraud/FraudClient.tsx': 'the actions do not revalidate; the numbers come from the server page',
  'inform/InformAdminClient.tsx': 'the scan does not revalidate; the required list comes from the server page',
  'profile/ProfileSettings.tsx': 'saves through an API route, not a server action',
  'variant-mismatches/_components/VariantMismatchesClient.tsx': 'nothing fixed means no action refresh and an out-of-date list',
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(name) ? [path] : []
  })
}

describe('one admin click, one page load', () => {
  beforeEach(() => {
    state.headers = new Headers()
    state.loaderCalls = 0
  })

  it('tells an action refresh from a visit and from a redirect render', () => {
    expect(isActionResponseRender()).toBe(false)
    state.headers = new Headers({ 'next-action': 'abc' })
    expect(isActionResponseRender()).toBe(true)
    state.headers = new Headers({ 'next-action': 'abc', rsc: '1' })
    expect(isActionResponseRender()).toBe(false)
  })

  it('the moderation page runs its loaders on a visit only', async () => {
    await ModerationQueuePage()
    expect(state.loaderCalls).toBe(2)

    state.loaderCalls = 0
    state.headers = new Headers({ 'next-action': 'abc' })
    const element = await ModerationQueuePage()
    expect(state.loaderCalls).toBe(0)
    expect(element.props).toEqual({})
  })

  it.each(CLIENT_OWNED_PAGES)('%s checks before it loads anything', (route) => {
    const source = readFileSync(join(ADMIN, route, 'page.tsx'), 'utf8')
    const body = source.slice(source.indexOf('export default async function'))
    const check = body.indexOf('isActionResponseRender()')
    expect(check).toBeGreaterThan(-1)
    const firstLoad = body.search(/await (?!requireAdmin\(\))/)
    if (firstLoad !== -1) expect(check).toBeLessThan(firstLoad)
  })

  it('router.refresh() in admin code is only where the action refreshes nothing', () => {
    const roots = [ADMIN, join(process.cwd(), 'src/components/admin')]
    const callers = roots
      .flatMap(sourceFiles)
      .filter((path) => /^(?!\s*(\*|\/\/)).*router\.refresh\(\)/m.test(readFileSync(path, 'utf8')))
      .map((path) => path.replace(`${ADMIN}/`, ''))
    expect(callers.sort()).toEqual(Object.keys(REFRESH_ALLOWED).sort())
  })
})

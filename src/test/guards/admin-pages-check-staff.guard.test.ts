/**
 * Every admin server page checks staff itself, before it reads anything.
 *
 * The check in (admin)/layout.tsx is not enough. Next renders from the first segment
 * that differs from the Next-Router-State-Tree header, and a client can forge that
 * header, so a request can render a page without running the layout above it. The
 * middleware only checks that a session exists. A buyer used that to reach the card
 * case data on /admin/orders/[orderId] for their own order.
 *
 * requireAdmin is memoized per request (lib/admin/context), so this adds no database
 * calls on top of the layout's.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const ADMIN = join(process.cwd(), 'src/app/(admin)/admin')

/** Pages with no server data, and why they are safe without a check. */
const EXEMPT: Record<string, string> = {
  'disputes/[id]/page.tsx': 'a client page: its data comes from actions that check staff themselves',
  'settings/page.tsx': 'only redirects',
}

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return pages(path)
    return name === 'page.tsx' ? [path] : []
  })
}

const rel = (path: string) => relative(ADMIN, path)
const checked = pages(ADMIN).filter((path) => !(rel(path) in EXEMPT))

describe('admin pages check staff themselves', () => {
  it('finds the pages', () => {
    expect(checked.length).toBeGreaterThan(30)
  })

  it('the exemptions still exist', () => {
    for (const path of Object.keys(EXEMPT)) expect(() => readFileSync(join(ADMIN, path))).not.toThrow()
  })

  it.each(checked.map((path) => [rel(path), path]))('%s', (_label, path) => {
    const source = readFileSync(path, 'utf8')
    const body = source.slice(source.indexOf('export default async function'))
    expect(body.startsWith('export default async function')).toBe(true)
    const firstAwait = body.match(/await ([A-Za-z]+)/)
    expect(firstAwait?.[1]).toMatch(/^(requireAdmin|requireRole|requirePermission)$/)
  })
})

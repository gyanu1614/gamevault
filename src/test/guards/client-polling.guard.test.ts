/**
 * Client-side Supabase polling budget.
 *
 * The 2026-10-09 usage audit found the navbar and the account sidebar each
 * polling the unread-messages count every 5 s (2 requests a tick, two query
 * keys, so React Query could not dedupe them), the admin header every 10 s,
 * and a realtime `orders` channel opened for every visitor that could never
 * fire. Each rule below pins one fix.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) {
      if (name === 'test' || name === 'node_modules') continue
      walk(full, out)
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(full)
    }
  }
  return out
}

describe('client polling budget', () => {
  const files = walk(path.join(ROOT, 'src'))

  it('no refetchInterval literal is under 60 s', () => {
    const offenders: string[] = []
    for (const file of files) {
      const src = readFileSync(file, 'utf8')
      for (const m of src.matchAll(/refetchInterval:\s*([\d_]+(?:\s*\*\s*[\d_]+)*)/g)) {
        const ms = m[1]
          .split('*')
          .map((p) => Number(p.trim().replace(/_/g, '')))
          .reduce((a, b) => a * b, 1)
        if (ms < 60_000) offenders.push(`${path.relative(ROOT, file)}: ${m[0]}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('nothing polls in a background tab', () => {
    const offenders = files.filter((f) => /refetchIntervalInBackground:\s*true/.test(readFileSync(f, 'utf8')))
    expect(offenders.map((f) => path.relative(ROOT, f))).toEqual([])
  })

  it('the navbar and the account sidebar share ONE unread-messages query', () => {
    for (const rel of ['src/components/navbar-floating.tsx', 'src/components/account/AccountSidebar.tsx']) {
      const src = read(rel)
      expect(src, rel).toContain("from '@/hooks/use-unread-messages'")
      expect(src, rel).toMatch(/useUnreadMessagesCount\(/)
      expect(src, rel).not.toContain("from('messages')")
    }
    expect(read('src/components/account/AccountSidebar.tsx')).not.toContain('unread-messages-sidebar')
  })

  it('the seller-approval profile poll is gated to in-flight applications and visible tabs', () => {
    const src = read('src/hooks/use-auth.tsx')
    expect(src).toContain('shouldPollSellerApproval(')
    expect(src).toContain('isTabVisible(')
    expect(src).not.toMatch(/setInterval\(refetch,/)
  })

  it('no client opens a realtime channel on `orders` INSERTs for every visitor', () => {
    const src = read('src/components/marketplace/RecentPurchaseToast.tsx')
    expect(src).not.toContain('postgres_changes')
    expect(src).not.toContain("table: 'orders'")
  })

  it('the daily stats toast only queries for signed-in users, once per tab', () => {
    const src = read('src/components/marketplace/RecentPurchaseToast.tsx')
    expect(src).toContain('useAuth(')
    expect(src).toMatch(/sessionStorage/)
  })
})

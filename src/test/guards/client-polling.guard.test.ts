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

  // 2026-10-20 usage audit (4.3) + incident 2026-11-02: the order chat re-read
  // the WHOLE thread every 20 s, then every 60 s, and twice more on each
  // return to the tab. Realtime delivers new messages; the re-sync is the
  // safety net for a silently deaf channel and reads only the newest slice.
  it('the chat thread re-syncs only its newest messages, on the shared budget, once per return to the tab', () => {
    const src = read('src/hooks/use-chat-thread.ts')
    expect(src).toMatch(/setInterval\(\(\) => void resyncRef\.current\(\), POLL_MS\.chatResync\)/)
    expect(src).not.toMatch(/setInterval\([^)]*,\s*20_000\)/)
    // visibilitychange + focus + online collapse into one read.
    expect(src).toMatch(/RESYNC_MIN_GAP_MS/)
    // The re-sync reads a limited tail, merged in place.
    const resync = src.slice(src.indexOf('const resync = useCallback'), src.indexOf('const resyncRef'))
    expect(resync).toMatch(/fetchTail\(/)
    expect(resync).toMatch(/mergeServerTail\(/)
    expect(src).toMatch(/\.limit\(RESYNC_TAIL\)/)
  })

  // Incident 2026-11-02: the inbox ran one "last message" query PER
  // conversation and refetched the whole list on every message, send and
  // read. It is one RPC page now, kept current from the user's live channel.
  it('the inbox reads one RPC page and updates from events, not refetches', () => {
    const api = read('src/lib/api/seller/messages.ts')
    expect(api).toMatch(/rpc as any\)\('my_inbox'/)
    expect(api).not.toMatch(/from\('messages'\)\s*\.select\(/)
    const hook = read('src/hooks/use-seller-messages.ts')
    expect(hook).toMatch(/useInfiniteQuery/)
    expect(hook).toMatch(/applyInboxMessage/)
    expect(hook).not.toMatch(/refetchInterval/)
    const thread = read('src/hooks/use-chat-thread.ts')
    expect(thread).not.toMatch(/queryKey: \['seller', 'messages', 'conversations'\]/)
  })

  it('the Messages badge is one RPC', () => {
    const src = read('src/hooks/use-unread-messages.ts')
    expect(src).toMatch(/'my_unread_message_count'/)
    expect(src).not.toMatch(/from\('messages'\)/)
  })

  // Incident 2026-11-02: Postgres Changes re-checks RLS per subscriber per
  // row inside the database. Live updates come from Broadcast topics only
  // (chat:<conversation id>, user:<id>).
  it('no browser code subscribes to Postgres Changes', () => {
    const offenders = files
      .filter((f) => /['"]postgres_changes['"]/.test(readFileSync(f, 'utf8')))
      .map((f) => path.relative(ROOT, f))
    expect(offenders).toEqual([])
  })

  // 2026-10-20 usage audit (4.5): buyers loaded the full SELLER order history
  // on /account/orders (the hook was not gated), and the seller heartbeat
  // wrote presence on every visibility change with no throttle.
  it('/account/orders reads seller orders only for approved sellers', () => {
    expect(read('src/app/account/orders/page.tsx')).toMatch(/useSellerOrders\(\{\}, \{ enabled: [^}]*isApprovedSeller/)
    expect(read('src/hooks/use-seller-orders.ts')).toMatch(/enabled/)
  })

  it('the presence heartbeat is throttled on tab switches', () => {
    const src = read('src/hooks/use-seller-presence.ts')
    expect(src).toMatch(/lastBeatRef/)
    expect(src).toMatch(/HEARTBEAT_MIN_GAP_MS/)
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

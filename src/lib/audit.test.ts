/**
 * AUTH-012 — the audit logger must not be a forgeable, anonymous server action.
 *
 * With `'use server'` at the top of audit.ts, `logAudit` and its six wrappers
 * were directly invokable actions that tolerated `user == null` and inserted
 * `audit_logs` rows under the service role with caller-controlled action /
 * table_name / record_id / payload / ip / user-agent. The exploit is "POST the
 * action from anywhere with anything". It is closed when:
 *   1. the module is `server-only` library code (no action registration),
 *   2. a missing session means NO row,
 *   3. action / table_name are validated against a strict shape/allowlist,
 *   4. ip / user-agent come from the request headers, never the caller.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  insert: vi.fn(),
  headers: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ headers: h.headers }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: h.getUser },
    from: () => ({
      select: () => ({
        eq: () => ({ single: async () => ({ data: { email: 'u@example.com', role: 'user' } }) }),
      }),
    }),
  })),
}))
vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: () => ({ from: () => ({ insert: h.insert }) }),
}))

import { logAudit, logOrderAction } from '@/lib/audit'

const SRC = readFileSync('src/lib/audit.ts', 'utf8')

function requestHeaders(map: Record<string, string>) {
  h.headers.mockResolvedValue({ get: (k: string) => map[k.toLowerCase()] ?? null })
}

beforeEach(() => {
  h.getUser.mockReset()
  h.insert.mockReset().mockResolvedValue({ error: null })
  h.headers.mockReset()
  requestHeaders({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1', 'user-agent': 'UA/1.0' })
})

describe('AUTH-012 — audit.ts is a server-only library, not an action module', () => {
  it('has no "use server" directive and imports server-only', () => {
    expect(SRC).not.toMatch(/^\s*['"]use server['"]\s*$/m)
    expect(SRC).toMatch(/^import ['"]server-only['"]/m)
  })

  it('writes nothing when there is no session (anonymous callers cannot forge rows)', async () => {
    h.getUser.mockResolvedValue({ data: { user: null } })
    await logAudit({ action: 'order_created', table_name: 'orders', record_id: 'o1' })
    expect(h.insert).not.toHaveBeenCalled()
  })

  it('writes a row for a signed-in caller with ip/user-agent taken from request headers', async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    await logAudit({
      action: 'order_created',
      table_name: 'orders',
      record_id: 'o1',
      // caller-supplied network identity must be ignored
      ...({ ip_address: '1.2.3.4', user_agent: 'forged' } as object),
    })
    expect(h.insert).toHaveBeenCalledTimes(1)
    const row = h.insert.mock.calls[0][0]
    expect(row.user_id).toBe('user-1')
    expect(row.ip_address).toBe('203.0.113.9')
    expect(row.user_agent).toBe('UA/1.0')
  })

  it('rejects an action that is not a lowercase snake_case token', async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    await logAudit({ action: 'order_created; DROP TABLE audit_logs', table_name: 'orders' })
    await logAudit({ action: '<script>alert(1)</script>', table_name: 'orders' })
    await logAudit({ action: 'x'.repeat(200), table_name: 'orders' })
    expect(h.insert).not.toHaveBeenCalled()
  })

  it('rejects a table_name outside the audited-table allowlist', async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    await logAudit({ action: 'order_created', table_name: 'evil_table' })
    await logAudit({ action: 'order_created', table_name: 'orders; --' })
    expect(h.insert).not.toHaveBeenCalled()
  })

  it('the typed wrappers still log for a signed-in caller', async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    await logOrderAction('created', 'o1', undefined, { total: 1 })
    expect(h.insert).toHaveBeenCalledTimes(1)
    expect(h.insert.mock.calls[0][0]).toMatchObject({ action: 'order_created', table_name: 'orders', record_id: 'o1' })
  })
})

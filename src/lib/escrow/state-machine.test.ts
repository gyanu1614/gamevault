import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  type OrderStatus,
  ALLOWED_TRANSITIONS,
  TERMINAL_STATES,
  isValidTransition,
  assertTransition,
  targetFor,
  EVENT_TARGET,
} from '@/lib/escrow/state-machine'
import { InvalidTransitionError } from '@/lib/errors'

const ALL_STATES: OrderStatus[] = [
  'pending',
  'paid',
  'delivering',
  'delivered',
  'disputed',
  'completed',
  'cancelled',
  'refunded',
]

describe('state machine: terminal states', () => {
  it('completed/cancelled/refunded are terminal — no outgoing transitions', () => {
    for (const t of ['completed', 'cancelled', 'refunded'] as OrderStatus[]) {
      expect(TERMINAL_STATES.has(t)).toBe(true)
      expect(ALLOWED_TRANSITIONS[t]).toEqual([])
      for (const to of ALL_STATES) {
        if (to === t) continue
        expect(isValidTransition(t, to)).toBe(false)
      }
    }
  })
})

describe('state machine: full transition matrix', () => {
  it('allows exactly the documented moves and rejects everything else', () => {
    for (const from of ALL_STATES) {
      for (const to of ALL_STATES) {
        const expected =
          from === to
            ? !TERMINAL_STATES.has(from) // same-status allowed unless terminal
            : ALLOWED_TRANSITIONS[from].includes(to)
        expect(isValidTransition(from, to)).toBe(expected)
      }
    }
  })

  it('rejects classic illegal jumps', () => {
    expect(isValidTransition('pending', 'completed')).toBe(false)
    expect(isValidTransition('pending', 'delivered')).toBe(false)
    expect(isValidTransition('refunded', 'paid')).toBe(false)
    expect(isValidTransition('completed', 'disputed')).toBe(false)
  })

  it('allows the happy path end to end', () => {
    expect(isValidTransition('pending', 'paid')).toBe(true)
    expect(isValidTransition('paid', 'delivered')).toBe(true)
    expect(isValidTransition('delivered', 'completed')).toBe(true)
  })

  it('allows same-status (idempotent) on non-terminal states', () => {
    expect(isValidTransition('paid', 'paid')).toBe(true)
    expect(isValidTransition('completed', 'completed')).toBe(false) // terminal: even same is blocked
  })

  it('assertTransition throws on illegal, passes on legal', () => {
    expect(() => assertTransition('pending', 'completed')).toThrow(InvalidTransitionError)
    expect(() => assertTransition('paid', 'delivered')).not.toThrow()
  })
})

describe('state machine: events map to legal targets', () => {
  it('every event resolves to a known status', () => {
    for (const ev of Object.keys(EVENT_TARGET)) {
      expect(ALL_STATES).toContain(targetFor(ev as any))
    }
  })
})

// ─── THE drift guard: TS map must equal the SQL migration map ──────
describe('state machine: TS map agrees with the SQL trigger (no drift)', () => {
  it('parses is_valid_order_transition and matches ALLOWED_TRANSITIONS', () => {
    const sql = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/20260628_fix_refunded_transition.sql'),
      'utf8'
    )

    // Parse lines like:  WHEN 'paid' THEN new_status IN ('delivering', 'delivered', ...)
    const sqlMap: Record<string, string[]> = {}
    const re = /WHEN\s+'([a-z_]+)'\s+THEN\s+new_status\s+IN\s+\(([^)]*)\)/gi
    let m: RegExpExecArray | null
    while ((m = re.exec(sql)) !== null) {
      const from = m[1]
      const targets = m[2]
        .split(',')
        .map((s) => s.trim().replace(/^'|'$/g, ''))
        .filter(Boolean)
      sqlMap[from] = targets.sort()
    }

    // Terminal states appear in the SQL guard `old_status IN (...)`, not the CASE.
    const terminalMatch = sql.match(/old_status\s+IN\s+\(([^)]*)\)/i)
    const sqlTerminals = (terminalMatch ? terminalMatch[1] : '')
      .split(',')
      .map((s) => s.trim().replace(/^'|'$/g, ''))
      .filter(Boolean)
      .sort()

    // Compare non-terminal transition rows.
    for (const from of Object.keys(sqlMap)) {
      expect(ALLOWED_TRANSITIONS[from as OrderStatus].slice().sort()).toEqual(sqlMap[from])
    }
    // Compare terminal set.
    expect([...TERMINAL_STATES].sort()).toEqual(sqlTerminals)

    // And the reverse: every non-terminal TS state with transitions appears in SQL.
    for (const from of ALL_STATES) {
      if (TERMINAL_STATES.has(from)) continue
      expect(sqlMap[from], `SQL missing transition row for "${from}"`).toBeDefined()
    }
  })
})

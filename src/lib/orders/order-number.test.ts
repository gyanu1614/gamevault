/**
 * Order-number helpers (migration 20260921234649).
 *
 *   · the stored number is rendered as stored — GV- rows issued before the
 *     DM- format are never rewritten or prefix-swapped at display time;
 *   · lookups normalise the typed query (upper-case, strip everything that
 *     is not a letter or digit) to match orders.order_number_search, which
 *     the DB generates with the identical expression.
 */
import { describe, it, expect } from 'vitest'

import {
  ORDER_NUMBER_RE,
  displayOrderRef,
  normalizeOrderNumber,
  orderNumberSearchPattern,
} from './order-number'

describe('ORDER_NUMBER_RE (new format)', () => {
  it('accepts DM- + 4 + - + 4 from the unambiguous alphabet', () => {
    expect(ORDER_NUMBER_RE.test('DM-ABCD-2345')).toBe(true)
    expect(ORDER_NUMBER_RE.test('DM-ZZZZ-9999')).toBe(true)
  })
  it('rejects the ambiguous symbols, wrong grouping and the legacy prefix', () => {
    for (const bad of ['DM-ABC0-EFGH', 'DM-ABCO-EFGH', 'DM-ABC1-EFGH', 'DM-ABCI-EFGH', 'DM-ABCDEFGH', 'GV-ABCD-EFGH', 'dm-abcd-efgh', 'DM-ABCD-EFGH-']) {
      expect(ORDER_NUMBER_RE.test(bad), bad).toBe(false)
    }
  })
})

describe('displayOrderRef', () => {
  it('renders a DM- number as stored', () => {
    expect(displayOrderRef('DM-ABCD-EFGH', '0f1e2d3c-0000-0000-0000-000000000000')).toBe('DM-ABCD-EFGH')
  })
  it('renders an old GV- number as stored — no prefix swap', () => {
    expect(displayOrderRef('GV-123456', '0f1e2d3c-0000-0000-0000-000000000000')).toBe('GV-123456')
    expect(displayOrderRef('GV-ABCDEFGHJK', '0f1e2d3c-0000-0000-0000-000000000000')).toBe('GV-ABCDEFGHJK')
  })
  it('falls back to the upper-cased 8-char id prefix when there is no number', () => {
    expect(displayOrderRef(null, '0f1e2d3c-0000-0000-0000-000000000000')).toBe('0F1E2D3C')
    expect(displayOrderRef(undefined, '0f1e2d3c-0000-0000-0000-000000000000')).toBe('0F1E2D3C')
    expect(displayOrderRef('', '0f1e2d3c-0000-0000-0000-000000000000')).toBe('0F1E2D3C')
  })
})

describe('normalizeOrderNumber', () => {
  it('upper-cases and strips dashes and spaces', () => {
    expect(normalizeOrderNumber('dm-abcd-efgh')).toBe('DMABCDEFGH')
    expect(normalizeOrderNumber(' DM ABCD EFGH ')).toBe('DMABCDEFGH')
    expect(normalizeOrderNumber('DM-ABCD-EFGH')).toBe('DMABCDEFGH')
  })
  it('normalises legacy GV- numbers the same way', () => {
    expect(normalizeOrderNumber('gv-123 456')).toBe('GV123456')
    expect(normalizeOrderNumber('#GV-123456')).toBe('GV123456')
  })
  it('strips every non-alphanumeric, matching the DB expression [^A-Za-z0-9]', () => {
    expect(normalizeOrderNumber('d.m/a_b:c;d')).toBe('DMABCD')
  })
  it('is empty for null, undefined and symbol-only input', () => {
    expect(normalizeOrderNumber(null)).toBe('')
    expect(normalizeOrderNumber(undefined)).toBe('')
    expect(normalizeOrderNumber('--  ')).toBe('')
  })
})

describe('orderNumberSearchPattern', () => {
  it('wraps the normalised key as a contains pattern', () => {
    expect(orderNumberSearchPattern('dm-abcd')).toBe('%DMABCD%')
    expect(orderNumberSearchPattern(' gv 12 ')).toBe('%GV12%')
  })
  it('a query with nothing searchable can match no order (never "everything")', () => {
    const p = orderNumberSearchPattern('---')
    expect(p).not.toBe('%%')
    expect(p).not.toBe('')
    // the impossible pattern uses a character the search key can never hold
    expect(p).toBe('%-%')
  })
})

/**
 * insertPendingOrder's 23505 policy (fee engine PR 3 addendum).
 *
 * A unique violation on the pending-order INSERT means one of three things and
 * they must NOT be conflated (they were: every 23505 used to be read as the
 * buyer+listing double-submit, so an order_number collision surfaced as
 * "Could not open checkout — please try again" with no order):
 *
 *   one_pending_order_per_buyer_listing → the buyer double-submitted; reuse.
 *   orders_order_number_key             → generate_order_number() collided;
 *                                         retry the INSERT exactly once.
 *   any other unique index              → its own typed error, no retry.
 */
import { describe, it, expect } from 'vitest'

import { classifyUniqueViolation, runOrderInsert, OrderInsertConflictError } from './order-insert'

const pg = (constraint: string) => ({
  code: '23505',
  message: `duplicate key value violates unique constraint "${constraint}"`,
  details: `Key (x)=(y) already exists.`,
  hint: null,
})

describe('classifyUniqueViolation', () => {
  it('names the buyer+listing partial index as a duplicate submit', () => {
    expect(classifyUniqueViolation(pg('one_pending_order_per_buyer_listing'))).toBe('duplicate_submit')
  })
  it('names the order_number key as a generator collision', () => {
    expect(classifyUniqueViolation(pg('orders_order_number_key'))).toBe('order_number_collision')
  })
  it('any other unique index is "other"', () => {
    expect(classifyUniqueViolation(pg('orders_stripe_payment_intent_id_key'))).toBe('other')
  })
  it('a non-23505 error is not a unique violation', () => {
    expect(classifyUniqueViolation({ code: '42501', message: 'permission denied' })).toBeNull()
    expect(classifyUniqueViolation(null)).toBeNull()
  })
  it('reads the constraint from details when the message omits it', () => {
    expect(classifyUniqueViolation({ code: '23505', message: 'conflict', details: 'constraint "one_pending_order_per_buyer_listing"' })).toBe('duplicate_submit')
  })
})

describe('runOrderInsert', () => {
  it('returns the id on the first success and calls the insert once', async () => {
    let calls = 0
    const r = await runOrderInsert(async () => { calls++; return { data: { id: 'o1' }, error: null } })
    expect(r).toEqual({ orderId: 'o1' })
    expect(calls).toBe(1)
  })

  it('buyer+listing collision → { duplicate: true }, no retry', async () => {
    let calls = 0
    const r = await runOrderInsert(async () => { calls++; return { data: null, error: pg('one_pending_order_per_buyer_listing') } })
    expect(r).toEqual({ duplicate: true })
    expect(calls).toBe(1)
  })

  it('order_number collision → the insert is retried exactly once and the retry result is used', async () => {
    let calls = 0
    const r = await runOrderInsert(async () => {
      calls++
      return calls === 1 ? { data: null, error: pg('orders_order_number_key') } : { data: { id: 'o2' }, error: null }
    })
    expect(r).toEqual({ orderId: 'o2' })
    expect(calls).toBe(2)
  })

  it('order_number collision twice → OrderInsertConflictError naming the constraint, no third attempt', async () => {
    let calls = 0
    const p = runOrderInsert(async () => { calls++; return { data: null, error: pg('orders_order_number_key') } })
    await expect(p).rejects.toBeInstanceOf(OrderInsertConflictError)
    await expect(p).rejects.toMatchObject({ constraint: 'orders_order_number_key', attempts: 2 })
    expect(calls).toBe(2)
  })

  it('a retry that then hits the buyer+listing index is classified as a duplicate submit', async () => {
    let calls = 0
    const r = await runOrderInsert(async () => {
      calls++
      return { data: null, error: calls === 1 ? pg('orders_order_number_key') : pg('one_pending_order_per_buyer_listing') }
    })
    expect(r).toEqual({ duplicate: true })
    expect(calls).toBe(2)
  })

  it('any other unique index → OrderInsertConflictError on the first attempt, no retry', async () => {
    let calls = 0
    const p = runOrderInsert(async () => { calls++; return { data: null, error: pg('orders_stripe_payment_intent_id_key') } })
    await expect(p).rejects.toBeInstanceOf(OrderInsertConflictError)
    await expect(p).rejects.toMatchObject({ constraint: 'orders_stripe_payment_intent_id_key', attempts: 1 })
    expect(calls).toBe(1)
  })

  it('a non-unique failure is returned as a plain error message, no retry', async () => {
    let calls = 0
    const r = await runOrderInsert(async () => { calls++; return { data: null, error: { code: '23514', message: 'check violated' } } })
    expect(r).toEqual({ error: 'check violated' })
    expect(calls).toBe(1)
  })

  it('the typed error carries a buyer-safe message, not the constraint text', async () => {
    const p = runOrderInsert(async () => ({ data: null, error: pg('orders_stripe_payment_intent_id_key') }))
    await expect(p).rejects.toThrow('Could not create the order — please try again')
    await expect(p).rejects.not.toThrow(/stripe/)
  })
})

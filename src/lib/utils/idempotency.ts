/**
 * P2.3 — Idempotency Key System
 *
 * Prevents duplicate payment operations caused by:
 * - Double-clicks on payment buttons
 * - Network retries
 * - Browser tab race conditions
 *
 * Usage:
 *   // Client-side: generate key and pass with request
 *   const key = generateIdempotencyKey()
 *   await createPaymentIntent({ listingId, idempotencyKey: key })
 *
 *   // Server-side: check before processing
 *   const cached = await getIdempotentResult(key, 'create_payment_intent')
 *   if (cached) return cached
 *   // ... process ...
 *   await storeIdempotentResult(key, 'create_payment_intent', result)
 */

import { createClient } from '@/lib/supabase/server'

export type OperationType =
  | 'create_payment_intent'
  | 'confirm_payment'
  | 'release_escrow'
  | 'create_order'
  | 'refund_order'
  | 'stripe_transfer'

interface IdempotentResult {
  response_status: number
  response_body: Record<string, unknown>
  related_order_id?: string
}

/**
 * generateIdempotencyKey — creates a collision-resistant UUID for use as
 * an idempotency key. Call this client-side before initiating any payment.
 *
 * @example
 * const idempotencyKey = generateIdempotencyKey()
 * // → '550e8400-e29b-41d4-a716-446655440000'
 */
export function generateIdempotencyKey(): string {
  // Use crypto.randomUUID() in both browser and Node.js 19+
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

/**
 * getIdempotentResult — server-side check for an existing result.
 * Returns the cached response if the key was already processed, or null.
 *
 * Call this at the START of any payment server action.
 */
export async function getIdempotentResult(
  idempotencyKey: string,
  operationType: OperationType,
  userId?: string
): Promise<IdempotentResult | null> {
  try {
    const supabase = await createClient()

    const { data, error } = await (supabase as any)
      .from('processed_operations')
      .select('response_status, response_body, related_order_id, expires_at')
      .eq('idempotency_key', idempotencyKey)
      .eq('operation_type', operationType)
      .single() as {
        data: {
          response_status: number
          response_body: Record<string, unknown>
          related_order_id: string | null
          expires_at: string
        } | null
        error: Error | null
      }

    if (error || !data) return null

    // Check if the record has expired
    if (new Date(data.expires_at) < new Date()) {
      return null
    }

    return {
      response_status: data.response_status,
      response_body: data.response_body as Record<string, unknown>,
      related_order_id: data.related_order_id ?? undefined,
    }
  } catch {
    // On error, allow the operation to proceed (fail open for idempotency)
    return null
  }
}

/**
 * storeIdempotentResult — server-side: persist the result of a payment operation.
 * Call this at the END of a successful payment server action.
 */
export async function storeIdempotentResult(
  idempotencyKey: string,
  operationType: OperationType,
  result: IdempotentResult,
  userId?: string
): Promise<void> {
  try {
    const supabase = await createClient()

    // Use upsert — if a concurrent request already stored it, that's fine
    await (supabase as any).from('processed_operations').upsert(
      {
        idempotency_key: idempotencyKey,
        operation_type: operationType,
        user_id: userId ?? null,
        response_status: result.response_status,
        response_body: result.response_body,
        related_order_id: result.related_order_id ?? null,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        onConflict: 'idempotency_key,operation_type',
        ignoreDuplicates: true, // first write wins
      }
    )
  } catch {
    // Non-fatal — idempotency storage failure shouldn't block the payment response
    console.error('[idempotency] Failed to store result for key:', idempotencyKey)
  }
}

/**
 * withIdempotency — higher-order helper for wrapping server actions.
 *
 * @example
 * export async function createPaymentIntentAction(input: { idempotencyKey: string; listingId: string }) {
 *   return withIdempotency(
 *     input.idempotencyKey,
 *     'create_payment_intent',
 *     input.userId,
 *     async () => {
 *       // ... your payment logic here ...
 *       return { clientSecret: '...' }
 *     }
 *   )
 * }
 */
export async function withIdempotency<T extends Record<string, unknown>>(
  idempotencyKey: string,
  operationType: OperationType,
  userId: string | undefined,
  operation: () => Promise<{ data: T; orderId?: string }>
): Promise<T> {
  // Check for existing result
  const cached = await getIdempotentResult(idempotencyKey, operationType, userId)
  if (cached) {
    return cached.response_body as T
  }

  // Execute the operation
  const { data, orderId } = await operation()

  // Store the result
  await storeIdempotentResult(
    idempotencyKey,
    operationType,
    {
      response_status: 200,
      response_body: data,
      related_order_id: orderId,
    },
    userId
  )

  return data
}

/**
 * validateIdempotencyKey — basic validation that a key looks like a UUID.
 * Call server-side to reject malformed keys before DB queries.
 */
export function validateIdempotencyKey(key: unknown): key is string {
  if (typeof key !== 'string') return false
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(key)
}

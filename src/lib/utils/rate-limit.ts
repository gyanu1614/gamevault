/**
 * Rate Limiting Utility
 * Priority 0 - Security Feature
 *
 * Simple in-memory rate limiter using Map
 * For production, consider Redis-based rate limiting
 *
 * Usage:
 * if (!rateLimit(`action:${userId}`, 5, 60000)) {
 *   throw new Error('Too many requests. Please wait.')
 * }
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

// In-memory storage for rate limit tracking
const rateLimitMap = new Map<string, RateLimitEntry>()

// Cleanup old entries every 5 minutes to prevent memory leaks
const CLEANUP_INTERVAL = 5 * 60 * 1000
let lastCleanup = Date.now()

/**
 * Check if an action is rate limited
 *
 * @param key - Unique identifier for the rate limit (e.g., "create-order:user-id")
 * @param limit - Maximum number of requests allowed in the window
 * @param windowMs - Time window in milliseconds (default: 60000ms = 1 minute)
 * @returns true if request is allowed, false if rate limited
 */
export function rateLimit(
  key: string,
  limit: number = 10,
  windowMs: number = 60000
): boolean {
  const now = Date.now()

  // Perform periodic cleanup
  if (now - lastCleanup > CLEANUP_INTERVAL) {
    cleanup()
    lastCleanup = now
  }

  const entry = rateLimitMap.get(key)

  // No entry or window expired - start new window
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  // Rate limit exceeded
  if (entry.count >= limit) {
    return false
  }

  // Increment count
  entry.count++
  return true
}

/**
 * Get remaining requests for a key
 * Useful for showing users how many attempts they have left
 */
export function getRateLimitStatus(
  key: string,
  limit: number = 10
): {
  remaining: number
  resetAt: number | null
  isLimited: boolean
} {
  const entry = rateLimitMap.get(key)
  const now = Date.now()

  if (!entry || now > entry.resetAt) {
    return {
      remaining: limit,
      resetAt: null,
      isLimited: false,
    }
  }

  const remaining = Math.max(0, limit - entry.count)

  return {
    remaining,
    resetAt: entry.resetAt,
    isLimited: remaining === 0,
  }
}

/**
 * Reset rate limit for a specific key
 * Useful for testing or admin overrides
 */
export function resetRateLimit(key: string): void {
  rateLimitMap.delete(key)
}

/**
 * Clear all rate limit entries
 * Use with caution - only for testing
 */
export function clearAllRateLimits(): void {
  rateLimitMap.clear()
}

/**
 * Remove expired entries from the map
 * Called automatically during rate limit checks
 */
function cleanup(): void {
  const now = Date.now()
  const keysToDelete: string[] = []

  for (const [key, entry] of Array.from(rateLimitMap.entries())) {
    if (now > entry.resetAt) {
      keysToDelete.push(key)
    }
  }

  for (const key of keysToDelete) {
    rateLimitMap.delete(key)
  }

  if (keysToDelete.length > 0) {
    console.log(`[Rate Limit] Cleaned up ${keysToDelete.length} expired entries`)
  }
}

/**
 * Get current map size (for monitoring)
 */
export function getRateLimitMapSize(): number {
  return rateLimitMap.size
}

// ============================================================================
// PRESET RATE LIMITS (for common operations)
// ============================================================================

/**
 * Rate limit for order creation
 * 5 orders per minute per user
 */
export function rateLimitCreateOrder(userId: string): boolean {
  return rateLimit(`create-order:${userId}`, 5, 60000)
}

/**
 * Rate limit for payment intent creation
 * 3 payment attempts per minute per user
 */
export function rateLimitPayment(userId: string): boolean {
  return rateLimit(`payment:${userId}`, 3, 60000)
}

/**
 * Rate limit for auth attempts (login/signup)
 * 5 attempts per 5 minutes per IP
 */
export function rateLimitAuth(identifier: string): boolean {
  return rateLimit(`auth:${identifier}`, 5, 5 * 60000)
}

/**
 * Rate limit for listing creation
 * 10 listings per hour per seller
 */
export function rateLimitCreateListing(sellerId: string): boolean {
  return rateLimit(`create-listing:${sellerId}`, 10, 60 * 60000)
}

/**
 * Rate limit for messaging
 * 30 messages per minute per user
 */
export function rateLimitMessage(userId: string): boolean {
  return rateLimit(`message:${userId}`, 30, 60000)
}

/**
 * Rate limit for API calls (general)
 * 100 requests per minute per user
 */
export function rateLimitAPI(userId: string): boolean {
  return rateLimit(`api:${userId}`, 100, 60000)
}

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/**
 * Example 1: In a server action
 *
 * export async function createOrder(data: CreateOrderData) {
 *   const { data: { user } } = await supabase.auth.getUser()
 *
 *   if (!rateLimitCreateOrder(user.id)) {
 *     return { success: false, error: 'Too many orders. Please wait 1 minute.' }
 *   }
 *
 *   // Proceed with order creation...
 * }
 */

/**
 * Example 2: In an API route
 *
 * export async function POST(req: Request) {
 *   const userId = await getUserId(req)
 *
 *   if (!rateLimitAPI(userId)) {
 *     return new Response('Rate limit exceeded', { status: 429 })
 *   }
 *
 *   // Proceed with request...
 * }
 */

/**
 * Example 3: Custom rate limit with status
 *
 * const status = getRateLimitStatus(`custom:${userId}`, 10)
 * if (status.isLimited) {
 *   const resetIn = Math.ceil((status.resetAt! - Date.now()) / 1000)
 *   throw new Error(`Rate limited. Try again in ${resetIn} seconds.`)
 * }
 */

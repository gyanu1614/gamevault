'use server'

/**
 * P2.7 — Cloudflare Turnstile server-side verification
 *
 * Call this from any server action before processing a form submission.
 * Returns { success: true } or { success: false, error: '...' }.
 *
 * Env var required: TURNSTILE_SECRET_KEY
 * In development without the env var, validation is bypassed with a warning.
 */
export async function verifyTurnstileToken(token: string): Promise<{
  success: boolean
  error?: string
}> {
  // Allow bypass in development if secret key is not configured
  const secretKey = process.env.TURNSTILE_SECRET_KEY
  if (!secretKey) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Turnstile] TURNSTILE_SECRET_KEY not set — skipping CAPTCHA check in dev')
      return { success: true }
    }
    return { success: false, error: 'CAPTCHA configuration error. Please contact support.' }
  }

  if (!token || token.trim() === '') {
    return { success: false, error: 'Please complete the CAPTCHA challenge.' }
  }

  try {
    const response = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ secret: secretKey, response: token }),
        cache:   'no-store',
      }
    )

    if (!response.ok) {
      return { success: false, error: 'CAPTCHA service unavailable. Please try again.' }
    }

    const data = await response.json()

    if (data.success) {
      return { success: true }
    }

    // data['error-codes'] may contain details, but we don't expose them to client
    return { success: false, error: 'CAPTCHA verification failed. Please refresh and try again.' }
  } catch {
    return { success: false, error: 'CAPTCHA check failed. Please try again.' }
  }
}

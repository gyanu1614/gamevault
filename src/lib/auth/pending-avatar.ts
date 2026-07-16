'use client'

/**
 * Beta A — Signup avatar persistence across email confirmation.
 *
 * When Supabase "Confirm email" is ON, signup() returns no session, so the
 * avatar the user picked can't be uploaded server-side (storage + profiles
 * RLS both need an authenticated session). We stash the picked avatar in
 * localStorage at signup and flush it via uploadProfileAvatar() on the first
 * authenticated session (see src/hooks/use-auth.tsx).
 *
 * Guardrails:
 *  - Downscale to <=512px + WebP so the base64 stays small.
 *  - Skip the stash entirely if the string is still too big (shared ~5MB
 *    localStorage quota — the gamevault_* profile caches live here too).
 *  - 7-day TTL so a never-confirmed signup doesn't linger forever.
 *  - Email-scoped so a shared device doesn't apply one person's avatar to
 *    another (the flush also re-checks the email against the session user).
 */

const KEY = 'dm_pending_signup_avatar'
const MAX_STASH_CHARS = 1_500_000 // ~1.1MB of base64 — safe within the shared quota
const TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

interface PendingAvatar {
  email: string
  dataUrl: string
  ts: number
}

/**
 * Downscale a data-URL image to a square <=`maxSize`px and re-encode as WebP.
 * Falls back to the original string on any canvas/encode error (e.g. SSR,
 * tainted canvas, unsupported format).
 */
export function downscaleAvatarDataUrl(dataUrl: string, maxSize = 512): Promise<string> {
  return new Promise((resolve) => {
    try {
      if (typeof document === 'undefined') {
        resolve(dataUrl)
        return
      }
      const img = new Image()
      img.onload = () => {
        try {
          const w = img.naturalWidth || img.width
          const h = img.naturalHeight || img.height
          if (!w || !h) {
            resolve(dataUrl)
            return
          }
          const scale = Math.min(1, maxSize / Math.max(w, h))
          const outW = Math.max(1, Math.round(w * scale))
          const outH = Math.max(1, Math.round(h * scale))
          const canvas = document.createElement('canvas')
          canvas.width = outW
          canvas.height = outH
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve(dataUrl)
            return
          }
          ctx.drawImage(img, 0, 0, outW, outH)
          const out = canvas.toDataURL('image/webp', 0.85)
          // Some browsers silently return a PNG (or an empty string) when WebP
          // isn't supported — only trust a real data URL that came out smaller.
          resolve(out && out.startsWith('data:image') && out.length < dataUrl.length ? out : dataUrl)
        } catch {
          resolve(dataUrl)
        }
      }
      img.onerror = () => resolve(dataUrl)
      img.src = dataUrl
    } catch {
      resolve(dataUrl)
    }
  })
}

/**
 * Downscale then stash {email, dataUrl, ts}. Silently no-ops on a quota error
 * (Safari private mode / QuotaExceeded) or if the payload is still too large.
 */
export async function stashPendingSignupAvatar(email: string, dataUrl: string): Promise<void> {
  try {
    if (typeof window === 'undefined' || !dataUrl) return
    const scaled = await downscaleAvatarDataUrl(dataUrl, 512)
    if (scaled.length > MAX_STASH_CHARS) return
    const payload: PendingAvatar = { email, dataUrl: scaled, ts: Date.now() }
    localStorage.setItem(KEY, JSON.stringify(payload))
  } catch {
    // Quota exceeded / private mode / serialization error — drop silently.
    // The user can always re-upload from /account/settings.
  }
}

/**
 * Read the stashed avatar. Clears and returns null if missing, malformed, or
 * older than the TTL.
 */
export function readPendingSignupAvatar(): PendingAvatar | null {
  try {
    if (typeof window === 'undefined') return null
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PendingAvatar>
    if (
      !parsed ||
      typeof parsed.email !== 'string' ||
      typeof parsed.dataUrl !== 'string' ||
      typeof parsed.ts !== 'number'
    ) {
      clearPendingSignupAvatar()
      return null
    }
    if (Date.now() - parsed.ts > TTL_MS) {
      clearPendingSignupAvatar()
      return null
    }
    return parsed as PendingAvatar
  } catch {
    clearPendingSignupAvatar()
    return null
  }
}

export function clearPendingSignupAvatar(): void {
  try {
    if (typeof window === 'undefined') return
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}

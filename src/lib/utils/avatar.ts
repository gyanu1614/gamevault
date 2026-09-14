/**
 * Avatar utility functions
 */

/**
 * Generate a DiceBear avatar URL
 * Returns a URL to DiceBear's API instead of base64 to avoid bloating session cookies
 */
export function generateDiceBearAvatar(username: string): string {
  // Return DiceBear API URL (60 bytes) instead of base64 data URI (5-6 KB)
  // This prevents HTTP 431 errors from session cookie overflow
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`
}

/**
 * Get avatar URL or generate fallback
 */
export function getAvatarUrl(avatarUrl: string | null | undefined, username: string): string {
  if (avatarUrl) return avatarUrl
  return generateDiceBearAvatar(username)
}

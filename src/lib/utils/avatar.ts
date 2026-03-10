/**
 * Avatar utility functions
 */

import { createAvatar } from '@dicebear/core'
import { avataaars } from '@dicebear/collection'

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
 * Generate a simple initials avatar as fallback
 */
function generateInitialsAvatar(username: string): string {
  const initials = username.slice(0, 2).toUpperCase()
  const colors = ['6366f1', 'ec4899', '8b5cf6', 'f59e0b', '10b981', '3b82f6']
  const colorIndex = username.charCodeAt(0) % colors.length
  const bgColor = colors[colorIndex]

  const svg = `
    <svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
      <circle cx="64" cy="64" r="64" fill="#${bgColor}"/>
      <text x="64" y="64" text-anchor="middle" dy=".35em" fill="white" font-size="48" font-family="Arial, sans-serif" font-weight="bold">${initials}</text>
    </svg>
  `

  // Browser-compatible base64 encoding
  const base64 = typeof window !== 'undefined'
    ? btoa(unescape(encodeURIComponent(svg)))
    : Buffer.from(svg).toString('base64')
  return `data:image/svg+xml;base64,${base64}`
}

/**
 * Get avatar URL or generate fallback
 */
export function getAvatarUrl(avatarUrl: string | null | undefined, username: string): string {
  if (avatarUrl) return avatarUrl
  return generateDiceBearAvatar(username)
}

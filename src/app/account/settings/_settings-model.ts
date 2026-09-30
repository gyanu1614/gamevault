/**
 * Settings page rules that don't need React: which tabs a person gets, which
 * one a `?tab=` link may open, whether a card has unsaved edits, and the
 * 30-day shop-name cooldown. Tested in settings-model.test.ts.
 */

export type SettingsTab = 'profile' | 'seller' | 'payouts' | 'notifications' | 'security' | 'privacy' | 'inform'

const SELLER_ONLY: ReadonlySet<SettingsTab> = new Set(['seller', 'payouts', 'inform'])

const ALL_TABS: { id: SettingsTab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'seller', label: 'Seller' },
  { id: 'payouts', label: 'Payouts' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'security', label: 'Security' },
  { id: 'privacy', label: 'Privacy & Data' },
  { id: 'inform', label: 'INFORM Disclosure' },
]

export function settingsTabs(isSeller: boolean) {
  return ALL_TABS.filter((tab) => isSeller || !SELLER_ONLY.has(tab.id))
}

/** A `?tab=` value, validated for this person; anything else opens Profile. */
export function parseSettingsTab(raw: string | null | undefined, isSeller: boolean): SettingsTab {
  const match = settingsTabs(isSeller).find((tab) => tab.id === raw)
  return match ? match.id : 'profile'
}

/** True when any field differs from its saved value (ends trimmed). */
export function isDirty<T extends Record<string, string>>(saved: T, current: T): boolean {
  return (Object.keys(saved) as (keyof T)[]).some((key) => (saved[key] ?? '').trim() !== (current[key] ?? '').trim())
}

/**
 * Same rule the server enforces (settingsApi.updateProfile), checked while
 * typing so the error sits under the field instead of arriving as a toast.
 */
export function usernameError(raw: string): string | null {
  const value = raw.trim()
  if (!value) return 'Username can’t be empty.'
  if (value.length < 3 || value.length > 30) return 'Use 3 to 30 characters.'
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) return 'Use only letters, numbers, hyphens and underscores.'
  return null
}

const SHOP_NAME_COOLDOWN_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

/** A named shop can be renamed once every 30 days. */
export function shopNameCooldown(
  currentShopName: string | null | undefined,
  updatedAt: string | null | undefined,
  now: number = Date.now(),
): { locked: boolean; daysRemaining: number } {
  if (!currentShopName || !updatedAt) return { locked: false, daysRemaining: 0 }
  const daysSince = (now - new Date(updatedAt).getTime()) / DAY_MS
  const daysRemaining = Math.ceil(SHOP_NAME_COOLDOWN_DAYS - daysSince)
  return daysRemaining > 0 ? { locked: true, daysRemaining } : { locked: false, daysRemaining: 0 }
}

/** The /shop/<slug> the name will produce (display only; the server slugs). */
export function shopSlugPreview(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

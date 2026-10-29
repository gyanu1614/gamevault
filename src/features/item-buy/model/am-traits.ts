/**
 * Adopt Me traits as the game thinks of them (owner, 2026-10-27: traits are
 * filters, on or off): a tier — Normal, Neon or Mega — and the Fly and Ride
 * potions. The market sells eight forms, and Neon / Mega only come plain or
 * Fly Ride, so on those tiers the two potions switch together; every toggle
 * lands on a form sellers can list.
 */

export type AmTier = 'normal' | 'neon' | 'mega'

export interface AmTrait {
  tier: AmTier
  fly: boolean
  ride: boolean
}

const FORMS: Record<string, AmTrait> = {
  normal: { tier: 'normal', fly: false, ride: false },
  fly: { tier: 'normal', fly: true, ride: false },
  ride: { tier: 'normal', fly: false, ride: true },
  'fly-ride': { tier: 'normal', fly: true, ride: true },
  neon: { tier: 'neon', fly: false, ride: false },
  'neon-fly-ride': { tier: 'neon', fly: true, ride: true },
  'mega-neon': { tier: 'mega', fly: false, ride: false },
  'mega-fly-ride': { tier: 'mega', fly: true, ride: true },
}

const NORMAL = FORMS.normal

/** The form's tier and potions; null for a key that is not an Adopt Me form. */
export function amTrait(variant: string | null): AmTrait | null {
  return (variant && FORMS[variant]) || null
}

function formKey({ tier, fly, ride }: AmTrait): string {
  if (tier === 'normal') return fly && ride ? 'fly-ride' : fly ? 'fly' : ride ? 'ride' : 'normal'
  const potions = fly || ride
  return tier === 'neon' ? (potions ? 'neon-fly-ride' : 'neon') : potions ? 'mega-fly-ride' : 'mega-neon'
}

/** Switch one potion; on Neon / Mega both potions switch together. */
export function withPotion(variant: string | null, potion: 'fly' | 'ride'): string {
  const t = amTrait(variant) ?? NORMAL
  if (t.tier !== 'normal') return formKey({ ...t, fly: !t.fly, ride: !t.ride })
  return formKey({ ...t, [potion]: !t[potion] })
}

/** Move to a tier, keeping the potions (one potion becomes Fly Ride on Neon / Mega). */
export function withTier(variant: string | null, tier: AmTier): string {
  return formKey({ ...(amTrait(variant) ?? NORMAL), tier })
}

export type AmLetter = 'N' | 'M' | 'F' | 'R'

/** Which filter letters a form lights up (Normal lights none). */
export function formLetters(variant: string | null): AmLetter[] {
  const t = amTrait(variant)
  if (!t) return []
  const out: AmLetter[] = []
  if (t.tier === 'neon') out.push('N')
  if (t.tier === 'mega') out.push('M')
  if (t.fly) out.push('F')
  if (t.ride) out.push('R')
  return out
}

/**
 * The offer filter (owner, 2026-10-28): N / M / F / R toggles that pick ONE
 * form, so F + R shows the Fly Ride offers and N + F + R the Neon Fly Ride
 * ones. Same rules as the picker (N and M exclude each other; on Neon / Mega
 * the potions switch together). `filter` is the form shown, null = every
 * offer; switching the last letter off goes back to every offer.
 */
export function toggleFilterLetter(filter: string | null, letter: AmLetter): string | null {
  const t = amTrait(filter) ?? NORMAL
  let next: string
  if (letter === 'N' || letter === 'M') {
    const tier: AmTier = letter === 'N' ? 'neon' : 'mega'
    next = withTier(formKey(t), t.tier === tier ? 'normal' : tier)
  } else {
    next = withPotion(formKey(t), letter === 'F' ? 'fly' : 'ride')
  }
  return next === 'normal' ? null : next
}

/**
 * Adopt Me's variant axis — the canonical list.
 *
 * `adopt_me_pet_values.variant` stores these codes, so they are data, not
 * presentation. The calculator, the values pages and the bulk importer all read
 * them from here; before Step 4 the list lived in the calculator's route folder
 * with a second copy in the values client, which is how two of the labels had
 * already started to drift apart in earlier edits.
 *
 * Plain TS, no imports: safe from a server component, a client component and a
 * plain Node script alike.
 */

export const VARIANTS = ['N', 'F', 'R', 'FR', 'NEON', 'NFR', 'MEGA', 'MFR'] as const
export type Variant = (typeof VARIANTS)[number]

export const VARIANT_LABEL: Record<Variant, string> = {
  N: 'Normal',
  F: 'Fly',
  R: 'Ride',
  FR: 'Fly Ride',
  NEON: 'Neon',
  NFR: 'Neon Fly Ride',
  MEGA: 'Mega Neon',
  MFR: 'Mega Fly Ride',
}

/**
 * The names a BUYER reads on value pages (owner, 2026-10-12): three tiers,
 * Normal → Neon → Mega, so the picker chips, the hero title and the Variants
 * table all say the same thing ("Mega", "Mega Fly Ride" = MFR). VARIANT_LABEL
 * stays as is: the importer and listing matcher key on it.
 */
export const VARIANT_DISPLAY: Record<Variant, string> = { ...VARIANT_LABEL, MEGA: 'Mega' }

/**
 * What each variant IS, in one line — the game's own mechanics. Fly and Ride
 * come from potions; a Neon is four fully grown copies of one pet combined; a
 * Mega Neon is four fully grown Neons combined. Normal needs no explanation.
 */
export const VARIANT_NOTE: Record<Variant, string | null> = {
  N: null,
  F: 'Fly (F): this pet can fly.',
  R: 'Ride (R): you can ride this pet.',
  FR: 'Fly Ride (FR): this pet can fly and you can ride it.',
  NEON: 'Neon: a glowing version, made by combining four fully grown pets.',
  NFR: 'Neon Fly Ride (NFR): a glowing Neon that can fly and be ridden.',
  MEGA: 'Mega Neon: made from four Neon pets, with a rainbow glow.',
  MFR: 'Mega Fly Ride (MFR): a Mega Neon that can fly and be ridden.',
}

/** True when `raw` is one of the eight codes. */
export function isVariant(raw: string): raw is Variant {
  return (VARIANTS as readonly string[]).includes(raw)
}

/** The value-page URL segment for each code, also stored as `listings.value_variant`. */
export const VARIANT_KEY: Record<Variant, string> = {
  N: 'normal',
  F: 'fly',
  R: 'ride',
  FR: 'fly-ride',
  NEON: 'neon',
  NFR: 'neon-fly-ride',
  MEGA: 'mega-neon',
  MFR: 'mega-fly-ride',
}

export function variantFromKey(key: string): Variant | null {
  return VARIANTS.find((code) => VARIANT_KEY[code] === key) ?? null
}

/**
 * Every name a Trait choice label may use for a code: today's short labels
 * ("FR", "N" = Neon, "M" = Mega, "None") and the older long ones ("Fly Ride
 * (FR)", "Mega Neon"). The listing matcher and the sell form both read
 * choices through this, never through the choice's stored code: the codes
 * have meant different things over time.
 */
export const VARIANT_ALIASES: Record<Variant, readonly string[]> = {
  N: ['Normal', 'No Potion', 'None'],
  F: ['Fly', 'F'],
  R: ['Ride', 'R'],
  FR: ['Fly Ride', 'FR'],
  NEON: ['Neon', 'N'],
  NFR: ['Neon Fly Ride', 'NFR'],
  MEGA: ['Mega Neon', 'Mega', 'M'],
  MFR: ['Mega Fly Ride', 'Mega Neon Fly Ride', 'MFR'],
}

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

const BY_ALIAS: ReadonlyMap<string, Variant> = new Map(
  VARIANTS.flatMap((code) => VARIANT_ALIASES[code].map((name) => [squash(name), code] as const)),
)

/** The code a Trait choice label names: "Fly Ride (FR)", its "(FR)", or the whole label. */
export function variantFromChoiceLabel(label: string): Variant | null {
  const paren = label.match(/\(([^)]+)\)/)?.[1]
  for (const candidate of [label.replace(/\([^)]*\)/g, ''), paren, label]) {
    const hit = candidate ? BY_ALIAS.get(squash(candidate)) : undefined
    if (hit) return hit
  }
  return null
}

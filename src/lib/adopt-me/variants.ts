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

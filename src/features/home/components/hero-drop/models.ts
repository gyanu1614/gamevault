/**
 * Model slots for the Drop. Every slot is `null` until its GLB exists, and
 * a `null` slot renders the code-built placeholder. To drop a model in:
 *
 *   1. Put the file in `public/models/drop/`, e.g. `public/models/drop/coin.glb`.
 *   2. Set its slot here to the public path: `coin: '/models/drop/coin.glb'`.
 *
 * Nothing else changes. Each model is fitted to its placeholder's bounding
 * box on load (uniform scale, centred; see ModelSlot), so the motion never
 * depends on how the file was authored: any size, any origin.
 *   - crateBody: fitted into the body box (2.3 x 1.45 x 1.55), open top.
 *   - crateLid:  fitted into the lid box; its back edge sits on the hinge,
 *                so author it closed, lying flat.
 *   - coin | keycard | gem | bolt: fitted into a unit cube, front facing +Z.
 * The SafeDrop seal, the lid seam and the light are always code-built: they
 * are what the timeline animates.
 *
 * Draco-compressed files decode with the drei default decoder (fetched from
 * gstatic on first use); uncompressed GLBs fetch nothing extra.
 *
 * Licence: Meshy's free plan is CC BY 4.0. Shipping a Meshy model means a
 * credit line is owed (site credits / footer), per model.
 */
export const DROP_MODELS = {
  crateBody: null,
  crateLid: null,
  coin: null,
  keycard: null,
  gem: null,
  bolt: null,
} as {
  crateBody: string | null
  crateLid: string | null
  coin: string | null
  keycard: string | null
  gem: string | null
  bolt: string | null
}

export type LootKind = 'coin' | 'keycard' | 'gem' | 'bolt'

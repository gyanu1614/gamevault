import 'server-only'
import { unstable_cache } from 'next/cache'
import { SITE_URL } from '@/config/site'

/**
 * The accent colour of an icon (Robux → gold, V-Bucks → blue): the most
 * saturated common colour in the image, as "r,g,b". Used to tint a card in
 * its icon's own colour, so every game's currency card matches its art
 * without a per-game setting. Cached per URL for 30 days (an uploaded icon
 * gets a new URL). Null when the image can't be read or has no colour.
 */
export const getImageAccent = unstable_cache(
  async (url: string): Promise<string | null> => {
    try {
      const abs = url.startsWith('http') ? url : `${SITE_URL}${url}`
      const res = await fetch(abs, { cache: 'no-store' })
      if (!res.ok) return null
      const sharp = (await import('sharp')).default
      const { data, info } = await sharp(Buffer.from(await res.arrayBuffer()))
        .resize(32, 32, { fit: 'inside' })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })
      return accentFromPixels(data, info.channels)
    } catch {
      return null
    }
  },
  ['image-accent-v1'],
  { revalidate: 60 * 60 * 24 * 30 },
)

/**
 * Pure part: average of the opaque, saturated pixels, lifted to a usable
 * brightness. Exported for tests.
 */
export function accentFromPixels(data: Uint8Array | Buffer, channels: number): string | null {
  let r = 0
  let g = 0
  let b = 0
  let weight = 0
  for (let i = 0; i < data.length; i += channels) {
    const a = channels === 4 ? data[i + 3] / 255 : 1
    if (a < 0.5) continue
    const pr = data[i]
    const pg = data[i + 1]
    const pb = data[i + 2]
    const max = Math.max(pr, pg, pb)
    const min = Math.min(pr, pg, pb)
    const sat = max === 0 ? 0 : (max - min) / max
    if (sat < 0.25 || max < 60) continue
    const w = sat * a
    r += pr * w
    g += pg * w
    b += pb * w
    weight += w
  }
  if (weight === 0) return null
  r /= weight
  g /= weight
  b /= weight
  // Lift dark accents so the tint reads on a near-black card.
  const peak = Math.max(r, g, b)
  const lift = peak < 200 ? 200 / peak : 1
  return [r, g, b].map((v) => Math.min(255, Math.round(v * lift))).join(',')
}

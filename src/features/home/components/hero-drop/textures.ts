import { DataTexture, RGBAFormat, type Texture } from 'three'

/*
 * Tiny procedural textures, built once per page. Generated rather than
 * shipped as files: they are a few hundred bytes of gradient each, and
 * fetching them would be one more request between the page and its 3D.
 */

function build(width: number, height: number, alphaAt: (x: number, y: number) => number) {
  const data = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = Math.round(Math.min(1, Math.max(0, alphaAt(x, y))) * 255)
      // All four channels: alphaMap samples green, a map samples rgb.
      data.set([a, a, a, a], (y * width + x) * 4)
    }
  }
  const texture = new DataTexture(data, width, height, RGBAFormat)
  texture.needsUpdate = true
  return texture
}

let radial: Texture | null = null
/** A soft round falloff: dust motes and the glow inside the crate. */
export function radialTexture() {
  radial ??= build(32, 32, (x, y) => {
    const d = Math.hypot(x - 15.5, y - 15.5) / 15.5
    return (1 - d) ** 2
  })
  return radial
}

let fade: Texture | null = null
/** Opaque at the bottom (v = 0), gone at the top: the light shaft. */
export function verticalFadeTexture() {
  fade ??= build(1, 64, (_, y) => (1 - y / 63) ** 1.6)
  return fade
}

/**
 * Regenerates public/assets/heroes/order.avif.
 *
 * The previous file was a stock photo of a Super Mario figurine — third-party
 * character IP on a page every buyer sees. This replaces it with an original
 * composition built from geometry only: a receding corridor of rounded arches
 * converging on a lit vanishing point, in fog. No characters, no logos, no
 * photographic source. It reads as "something on its way to you", which is
 * what an order page is about, and it matches the other heroes' mood (dark,
 * cool, desaturated, atmospheric).
 *
 * Deterministic: the particle field is seeded, so re-running reproduces the
 * same image byte for byte.
 *
 * Requires ImageMagick 7 (`magick`) on PATH. Not a runtime dependency — this
 * is a one-off art tool, run by hand:
 *
 *   node scripts/art/gen-order-hero.mjs
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const W = 2880, H = 1600
const OUT = 'public/assets/heroes/order.avif'
const vx = W * 0.54, vy = H * 0.46

// Mulberry32 — small seeded PRNG so the output is reproducible.
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = rng(1409)

const args = ['-size', `${W}x${H}`, 'gradient:#18202b-#07090d', '-fill', 'none']

// Nine arches, scaled on a power curve so they bunch toward the vanishing
// point; stroke and opacity fall off with depth.
for (let i = 0; i < 9; i++) {
  const t = i / 8
  const w = W * (0.10 + 0.95 * t ** 1.6)
  const h = H * (0.13 + 1.05 * t ** 1.6)
  const v = Math.round(26 + 58 * (1 - t) ** 1.4)
  const rad = 40 * (1 - t) + 10
  args.push(
    '-stroke', `rgba(${v + 16},${v + 26},${v + 40},${(0.16 + 0.5 * (1 - t)).toFixed(2)})`,
    '-strokewidth', (1.2 + 5.0 * (1 - t)).toFixed(2),
    '-draw', `roundrectangle ${(vx - w / 2).toFixed(0)},${(vy - h / 2).toFixed(0)} ` +
             `${(vx + w / 2).toFixed(0)},${(vy + h / 2).toFixed(0)} ${rad.toFixed(0)},${rad.toFixed(0)}`,
  )
}

// Floor lines converging on the vanishing point — gives the corridor a ground.
for (let k = -7; k <= 7; k++) {
  const fx = vx + k * W * 0.085
  args.push(
    '-stroke', `rgba(120,140,170,${Math.max(0.03, 0.15 - Math.abs(k) * 0.017).toFixed(3)})`,
    '-strokewidth', '1.6',
    '-draw', `line ${fx.toFixed(0)},${H} ${vx.toFixed(0)},${vy.toFixed(0)}`,
  )
}

// Drifting motes for depth.
args.push('-stroke', 'none')
for (let i = 0; i < 150; i++) {
  const px = rand() * W
  const py = H * 0.12 + rand() * (H * 0.88)
  const r = 0.8 + rand() * 2.2
  const a = 0.05 + rand() * 0.25
  args.push('-fill', `rgba(190,210,240,${a.toFixed(2)})`,
            '-draw', `circle ${px.toFixed(0)},${py.toFixed(0)} ${(px + r).toFixed(0)},${py.toFixed(0)}`)
}

const tmp = mkdtempSync(join(tmpdir(), 'order-hero-'))
const base = join(tmp, 'base.png')
execFileSync('magick', [...args, base], { stdio: 'inherit' })

// Bloom + a cool key light at the vanishing point, darkened toward the top,
// then a soft vignette. Encoded at q66: smooth gradients compress hard, so
// this lands around 16 KB against the 300 KB budget.
execFileSync('magick', [
  base,
  '(', '+clone', '-blur', '0x30', ')', '-compose', 'screen', '-composite',
  '(', '-size', `${W}x${H}`, 'radial-gradient:rgba(120,158,215,0.42)-rgba(0,0,0,0)', ')',
  '-compose', 'screen', '-composite',
  '(', '-size', `${W}x${H}`, 'gradient:rgba(0,0,0,0.55)-rgba(0,0,0,0)', ')',
  '-compose', 'multiply', '-composite',
  '-brightness-contrast', '12x6',
  '(', '-size', `${W}x${H}`, 'radial-gradient:gray100-gray38', '-alpha', 'off', ')',
  '-compose', 'multiply', '-composite',
  '-modulate', '108,92,100',
  '-strip', '-quality', '66',
  OUT,
], { stdio: 'inherit' })

console.log(`wrote ${OUT}`)

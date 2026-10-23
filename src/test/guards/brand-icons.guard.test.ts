import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { organization } from '@/lib/seo/jsonld'

// Owner, 2026-10-23: the icon is green (#39E37A, pick "D"), not lime, and sharp
// everywhere. Every file is generated from one vector by `pnpm brand:icons`.
const ROOT = process.cwd()
const read = (f: string) => readFileSync(join(ROOT, f))
const pngSize = (f: string) => {
  const b = read(f)
  expect(b.subarray(1, 4).toString('ascii'), `${f} is a PNG`).toBe('PNG')
  return [b.readUInt32BE(16), b.readUInt32BE(20)]
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(ROOT, dir))) {
    const p = `${dir}/${name}`
    if (statSync(join(ROOT, p)).isDirectory()) sourceFiles(p, out)
    else if (/\.(tsx?|mjs|css)$/.test(name) && !name.includes('.test.')) out.push(p)
  }
  return out
}

describe('brand icons', () => {
  it('the vector master is the green mark, and the generator uses the same colour', () => {
    const svg = read('public/brand/logo-mark-green.svg').toString()
    expect(svg).toMatch(/viewBox="0 0 1000 1000"/)
    expect(svg).toMatch(/fill="#39E37A"/)
    expect(read('scripts/brand-icons.mjs').toString()).toMatch(/const BRAND = '#39E37A'/)
  })

  it('nothing in the app still points at the old lime files', () => {
    const hits = sourceFiles('src').filter((f) => read(f).toString().includes('/brand/logo-mark-lime'))
    expect(hits).toEqual([])
  })

  it('ships the favicon set at the sizes browsers and Google ask for', () => {
    expect(pngSize('src/app/icon.png')).toEqual([512, 512])
    expect(pngSize('src/app/apple-icon.png')).toEqual([180, 180])
    const ico = read('public/favicon.ico')
    expect(ico.readUInt16LE(2)).toBe(1) // icon
    expect(ico.readUInt16LE(4)).toBe(4) // 16, 32, 48, 64
  })

  it('the Organization logo is the green 256 px mark', () => {
    expect(organization().logo.url).toMatch(/\/brand\/logo-mark-green-256\.png$/)
    expect(pngSize('public/brand/logo-mark-green-256.png')).toEqual([256, 256])
  })
})

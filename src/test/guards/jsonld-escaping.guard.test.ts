/**
 * DLT-002 — JSON-LD must not let user content break out of the <script> tag.
 *
 * Root cause (2026-09-20 delta audit): every JSON-LD block rendered
 * `JSON.stringify(data)` straight into `dangerouslySetInnerHTML`.
 * `JSON.stringify` does not escape `<` or `/`, so a listing title containing
 * a literal `</script>` terminates the script element and everything after it
 * is parsed as HTML:
 *
 *   JSON.stringify({ t: 'x</script><img src=x onerror=alert(1)>' })
 *     → {"t":"x</script><img src=x onerror=alert(1)>"}
 *
 * Reachable by any seller: titles are only `.trim()`'d (sell-wizard.ts:670,
 * :830), the sole DB constraint is `char_length BETWEEN 5 AND 100`, and
 * pre-moderation stops after three approved listings — so a seller's fourth
 * listing publishes with no human review onto a public, ISR-cached page.
 *
 * The fix: `serializeJsonLd()` escapes `<` as `<` (a valid JSON string
 * escape that parses back to the identical value), and every JSON-LD site in
 * the app goes through it. This file pins both halves: the escaping itself,
 * and the absence of any raw `JSON.stringify` in a dangerouslySetInnerHTML.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { serializeJsonLd } from '@/lib/seo/jsonld'

const BREAKOUT = 'x</script><img src=x onerror=alert(1)>'

describe('DLT-002 — JSON-LD escaping', () => {
  it('escapes the closing-script sequence', () => {
    const out = serializeJsonLd({ title: BREAKOUT })
    expect(out).not.toContain('</script')
    expect(out).toContain('\\u003c')
  })

  it('escapes every < , not only the ones before /script', () => {
    const out = serializeJsonLd({ a: '<b>', b: 'x < y' })
    expect(out).not.toContain('<')
  })

  it('round-trips to the identical value (escaping is lossless)', () => {
    const data = { title: BREAKOUT, nested: { deep: ['<a>', '</SCRIPT >'] }, n: 42, ok: true }
    expect(JSON.parse(serializeJsonLd(data))).toEqual(data)
  })

  it('is case-insensitive proof — </ScRiPt> cannot survive either', () => {
    expect(serializeJsonLd({ t: 'a</ScRiPt>b' }).toLowerCase()).not.toContain('</script')
  })

  it('handles a title nested inside a real Product schema shape', () => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: BREAKOUT,
      offers: { '@type': 'Offer', price: '1.00' },
    }
    const out = serializeJsonLd(schema)
    expect(out).not.toContain('</script')
    expect(JSON.parse(out).name).toBe(BREAKOUT)
  })

  it('leaves ordinary content readable (no over-escaping of quotes/unicode)', () => {
    const out = serializeJsonLd({ name: 'Blade "Runner" — café' })
    expect(JSON.parse(out).name).toBe('Blade "Runner" — café')
  })
})

/** Every .ts/.tsx file under src/, excluding this guard itself. */
function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) sourceFiles(full, acc)
    else if (/\.(ts|tsx)$/.test(entry) && !entry.includes('jsonld-escaping.guard')) acc.push(full)
  }
  return acc
}

describe('DLT-002 — no raw JSON.stringify reaches dangerouslySetInnerHTML', () => {
  it('every JSON-LD site uses serializeJsonLd or <JsonLd>', () => {
    const offenders: string[] = []
    for (const file of sourceFiles(join(process.cwd(), 'src'))) {
      const src = readFileSync(file, 'utf8')
      if (!src.includes('dangerouslySetInnerHTML')) continue
      // Flag `dangerouslySetInnerHTML={{ __html: JSON.stringify(...) }}` in any
      // spacing/quoting variant. serializeJsonLd(...) is the sanctioned form.
      const re = /dangerouslySetInnerHTML\s*[:=]\s*\{\s*\{?\s*__html\s*:\s*JSON\.stringify\s*\(/g
      let m: RegExpExecArray | null
      while ((m = re.exec(src)) !== null) {
        const line = src.slice(0, m.index).split('\n').length
        offenders.push(`${file.replace(process.cwd() + '/', '')}:${line}`)
      }
    }
    expect(
      offenders,
      `raw JSON.stringify in dangerouslySetInnerHTML (use serializeJsonLd):\n${offenders.join('\n')}`,
    ).toEqual([])
  })
})

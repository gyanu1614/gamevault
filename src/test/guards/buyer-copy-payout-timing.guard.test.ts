/**
 * Buyer-facing copy must never describe WHEN money moves between buyer,
 * platform and seller, or say DropMarket holds funds.
 *
 * DropMarket is the seller's commercial agent: the buyer's debt to the seller
 * is discharged when the buyer pays, not when they confirm. Copy like "the
 * seller is paid only after you confirm" or "held in escrow until you say it's
 * delivered" describes hold-till-delivery custody, which the legal memo warns
 * may break the agent exemption. Describe the ORDER's state and the guarantee:
 * "Item Guaranteed or Full Refund", "Confirm and the order is complete".
 *
 * hub-copy-safedrop.guard.test.ts pins the content hub; this pins the rest of
 * the site. Legal documents are solicitor-owned and excluded. Seller-facing
 * "you get paid" copy is a separate decision and not matched here.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

const SCAN = ['src/app', 'src/components', 'src/features', 'src/lib']
const EXCLUDE = new Set(['src/lib/legal/documents.ts'])

function walk(p: string): string[] {
  const abs = path.join(ROOT, p)
  if (!fs.existsSync(abs)) return []
  if (fs.statSync(abs).isFile()) return [p]
  return fs.readdirSync(abs).flatMap((child) => walk(path.join(p, child)))
}

const FILES = SCAN.flatMap(walk).filter(
  (f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && !EXCLUDE.has(f),
)

/** User-visible strings only: rule documentation quotes the banned phrases. */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join('\n')
}

const BANNED = [
  /seller gets paid/i,
  /sellers? (are|is) (only )?paid/i,
  /paid (out )?only after/i,
  /paid out to the seller/i,
  /seller isn.t paid/i,
  /seller payout is paused/i,
  /funds (are )?held/i,
  /held by SafeDrop/i,
  /in escrow\b/i,
]

describe('buyer copy: never describe payout timing or custody', () => {
  it.each(BANNED.map((r) => [String(r)] as const))('no string matches %s', (pattern) => {
    const re = BANNED.find((r) => String(r) === pattern)!
    const offenders = FILES.filter((f) => re.test(code(fs.readFileSync(path.join(ROOT, f), 'utf8'))))
    expect(offenders).toEqual([])
  })
})

/**
 * No session-client read of `orders` asks for '*' or a private column (static).
 *
 * Since 20260927224019_orders_column_privacy, anon/authenticated may select
 * only the shared order columns (src/lib/orders/columns.ts). A session read
 * of '*' or of a private column is not a leak any more — it is a 42501, i.e.
 * a page that 404s or a total that silently reads 0. This finds every
 * select that reaches `orders` in src — `.from('orders').select(…)` and an
 * embed from another table (`order:orders(…)`, `orders!fk(…)`,
 * `order:order_id(…)`) — works out which client runs it, and fails on a
 * session client that names '*' or a private column. Use ORDER_PARTY_SELECT
 * and withOwnOrderFields, or the service role after an admin check.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { ORDER_BUYER_PRIVATE_COLUMNS, ORDER_SELLER_PRIVATE_COLUMNS } from '@/lib/orders/columns'

const ROOT = join(__dirname, '..', '..', '..')
const SRC = join(ROOT, 'src')
const PRIVATE = new Set<string>([...ORDER_SELLER_PRIVATE_COLUMNS, ...ORDER_BUYER_PRIVATE_COLUMNS])

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name === 'test' || name === 'types') continue
      walk(p, out)
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p)
  }
  return out
}

/** Text of the balanced (…) group opening at `open`. */
function group(src: string, open: number): string {
  let depth = 0
  for (let i = open; i < src.length; i++) {
    if (src[i] === '(') depth++
    else if (src[i] === ')' && --depth === 0) return src.slice(open + 1, i)
  }
  return src.slice(open + 1)
}

/** Resolve a select argument to its string: literals, templates, and same-file / ORDER_PARTY_SELECT constants. */
function resolveSelect(arg: string, file: string, seen = new Set<string>()): string {
  const a = arg.trim().replace(/\s+as\s+\w+$/, '')
  const lit = a.match(/^(['"`])([\s\S]*)\1(\s*,[\s\S]*)?$/)
  const body = lit ? lit[2] : a.split(',')[0].trim()
  const expand = (name: string): string => {
    if (name === 'ORDER_PARTY_SELECT') return 'id' // shared by definition (pinned by the integration guard)
    if (seen.has(name)) return ''
    seen.add(name)
    const m = file.match(new RegExp(`const ${name}\\s*=\\s*(['"\`])([\\s\\S]*?)\\1`))
    return m ? resolveSelect(`${m[1]}${m[2]}${m[1]}`, file, seen) : `<unresolved:${name}>`
  }
  if (!lit) return /^[A-Z_]+$/.test(body) ? expand(body) : `<unresolved:${body}>`
  return body.replace(/\$\{\s*([A-Z_]+)\s*\}/g, (_m, n) => expand(n))
}

/** Top-level column tokens of a PostgREST select (embeds collapsed). */
function topLevel(sel: string): string[] {
  let flat = ''
  let depth = 0
  for (const ch of sel) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (depth === 0) flat += ch
  }
  return flat
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t.includes(':') && !t.includes('::') ? t.split(':').pop()! : t).split('::')[0].split('!')[0].trim())
}

/** Embedded `orders` groups inside a select string. */
function orderEmbeds(sel: string): string[] {
  const out: string[] = []
  const re = /(?:\w+\s*:\s*)?(?:orders(?:!\w+)?|order_id)\s*\(/g
  let m: RegExpExecArray | null
  while ((m = re.exec(sel))) {
    const before = sel.slice(Math.max(0, m.index - 12), m.index)
    // `order_id (` only counts as an embed when aliased `order:` (reviews → orders).
    if (/order_id\s*\($/.test(m[0]) && !/order\s*:\s*order_id/.test(m[0])) continue
    if (/\w$/.test(before)) continue
    out.push(group(sel, m.index + m[0].length - 1))
  }
  return out
}

type Kind = 'service' | 'session' | 'unknown'

/** Which client runs the chain whose `.from(` starts at `at`. */
function clientAt(src: string, at: number): Kind {
  const head = src.slice(Math.max(0, at - 200), at).replace(/\)\s*as\s+any\)?\s*$/, ')').replace(/[\s(]+$/, '')
  if (/(createServiceRoleClient|createServiceClient)\(\)\s*\)?$/.test(head) || /svc$/.test(head)) return 'service'
  const recv = head.match(/([A-Za-z_$][\w$]*)\)?$/)?.[1]
  if (!recv) return 'unknown'
  const decls = [...src.slice(0, at).matchAll(new RegExp(`\\b${recv}\\s*=\\s*([^\\n;]+)`, 'g'))]
  const rhs = decls.length ? decls[decls.length - 1][1] : ''
  if (/createServiceRoleClient|createServiceClient|getServiceClient|SUPABASE_SERVICE_ROLE_KEY/.test(rhs)) return 'service'
  if (/createClient\(|createBrowserClient|createServerClient/.test(rhs)) return 'session'
  return 'unknown'
}

type Site = { where: string; client: Kind; select: string; bad: string[] }

function scan(): Site[] {
  const sites: Site[] = []
  for (const path of walk(SRC)) {
    const src = readFileSync(path, 'utf8')
    const rel = relative(ROOT, path)
    const line = (i: number) => src.slice(0, i).split('\n').length
    const fromRe = /\.from\(\s*['"](\w+)['"]\s*(?:as\s+any\s*)?\)/g
    let m: RegExpExecArray | null
    while ((m = fromRe.exec(src))) {
      const table = m[1]
      const chain = src.slice(m.index, m.index + 1500)
      const s = chain.match(/\.select\(/)
      const stop = chain.search(/;\s*\n|\n\s*\n/)
      if (!s || (stop >= 0 && s.index! > stop)) continue
      const sel = resolveSelect(group(chain, s.index! + s[0].length - 1), src)
      const groups = table === 'orders' ? [sel] : orderEmbeds(sel)
      for (const g of groups) {
        const bad = topLevel(g).filter((c) => c === '*' || PRIVATE.has(c) || c.startsWith('<unresolved'))
        sites.push({ where: `${rel}:${line(m.index)}`, client: clientAt(src, m.index), select: g.replace(/\s+/g, ' ').trim(), bad })
      }
    }
  }
  return sites
}

describe('orders: session-client selects stay inside the column grant (static)', () => {
  const sites = scan()

  it('the scan finds the order reads (not an empty pass)', () => {
    expect(sites.length).toBeGreaterThan(60)
    // Known shapes, so a regex regression cannot silently match nothing.
    expect(sites.some((s) => s.where.startsWith('src/lib/actions/orders.ts') && s.client === 'session')).toBe(true)
    expect(sites.some((s) => s.where.startsWith('src/lib/escrow/auto-release.ts') && s.client === 'service' && s.bad.includes('seller_payout'))).toBe(true)
    expect(sites.some((s) => s.where.startsWith('src/lib/api/reviews.ts') && s.select.includes('order_number'))).toBe(true)
  })

  it("no session (or unclassified) client selects '*' or a private order column", () => {
    const offenders = sites
      .filter((s) => s.client !== 'service' && s.bad.length > 0)
      .map((s) => `${s.where} [${s.client}] ${s.bad.join(', ')} ← ${s.select.slice(0, 120)}`)
    expect(offenders).toEqual([])
  })
})

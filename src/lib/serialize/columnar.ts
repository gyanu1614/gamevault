/**
 * Columnar packing for big client props.
 *
 * A server component that hands a client component 1,000 rows serialises
 * every key on every row into the page's RSC payload: the Adopt Me value list
 * carried "tradeValue" 4,016 times and weighed 1.2 MB of HTML (2026-10-07 Bing
 * scan: "HTML size is too long" on the three value lists; Bing's soft limit is
 * ~125 KB).
 *
 * `pack` turns an array of plain objects into its keys once plus one array per
 * key (a column), and packs each column the same way, so nested rows (Adopt
 * Me's per-variant prices, Steal a Brainrot's mutations) also carry their keys
 * once for the whole list, not once per row. `unpack` restores the exact
 * objects on the client. A key a row doesn't have stays absent.
 */

export type Packed = unknown

const TAG = '$c'
/** A string column with a shared prefix (image URLs): the prefix once. */
const PREFIX = '$p'
/** A string column with repeats (mutation names, rarities): each value once, then indexes. */
const DICT = '$s'

type Cell = string | null | undefined

function isStringColumn(v: unknown[]): v is Cell[] {
  return v.length > 1 && v.every((x) => x == null || typeof x === 'string') && v.some((x) => typeof x === 'string')
}

function commonPrefix(xs: string[]): string {
  if (xs.length === 0) return ''
  let pre = xs[0]
  for (const x of xs) {
    while (!x.startsWith(pre)) pre = pre.slice(0, -1)
    if (!pre) return ''
  }
  return pre
}

function packStrings(col: Cell[]): Packed {
  const strs = col.filter((x): x is string => typeof x === 'string')
  const pre = commonPrefix(strs)
  if (pre.length >= 8) {
    return { [PREFIX]: pre, v: packStrings(col.map((x) => (typeof x === 'string' ? x.slice(pre.length) : x))) }
  }
  const uniq = [...new Set(strs)]
  if (uniq.length * 2 <= col.length) {
    const at = new Map(uniq.map((u, i) => [u, i]))
    // -1 = null, -2 = missing
    return { [DICT]: uniq, i: col.map((x) => (x === null ? -1 : x === undefined ? -2 : at.get(x)!)) }
  }
  return col
}

function unpackStrings(v: Record<string, unknown>): Cell[] | null {
  if (typeof v[PREFIX] === 'string') {
    const inner = unpack<Cell[]>(v.v)
    return inner.map((x) => (typeof x === 'string' ? (v[PREFIX] as string) + x : x))
  }
  if (Array.isArray(v[DICT]) && Array.isArray(v.i)) {
    const dict = v[DICT] as string[]
    return (v.i as number[]).map((n) => (n === -1 ? null : n === -2 ? undefined : dict[n]))
  }
  return null
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype
}

export function pack(value: unknown): Packed {
  if (Array.isArray(value)) {
    if (value.length > 1 && value.every(isPlainObject)) {
      const keys: string[] = []
      const seen = new Set<string>()
      for (const row of value) {
        for (const k of Object.keys(row)) {
          if (!seen.has(k)) {
            seen.add(k)
            keys.push(k)
          }
        }
      }
      return {
        [TAG]: keys,
        n: value.length,
        // A missing key is undefined in its column; RSC keeps undefined, and
        // unpack skips it.
        c: keys.map((k) => pack(value.map((row) => (row as Record<string, unknown>)[k]))),
      }
    }
    if (isStringColumn(value)) return packStrings(value)
    return value.map(pack)
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) if (v !== undefined) out[k] = pack(v)
    return out
  }
  return value
}

export function unpack<T = unknown>(value: Packed): T {
  if (Array.isArray(value)) return value.map((v) => unpack(v)) as T
  if (isPlainObject(value)) {
    const keys = value[TAG]
    if (Array.isArray(keys) && typeof value.n === 'number' && Array.isArray(value.c)) {
      const cols = (value.c as Packed[]).map((col) => unpack<unknown[]>(col))
      const rows: Record<string, unknown>[] = []
      for (let i = 0; i < value.n; i++) {
        const obj: Record<string, unknown> = {}
        keys.forEach((k: string, j: number) => {
          const v = cols[j][i]
          if (v !== undefined) obj[k] = v
        })
        rows.push(obj)
      }
      return rows as T
    }
    const strings = unpackStrings(value)
    if (strings) return strings as T
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = unpack(v)
    return out as T
  }
  return value as T
}

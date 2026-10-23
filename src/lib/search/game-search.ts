/**
 * Per-game search for the hub navbar (owner, 2026-10-23): one game at a
 * time, its items first, then its guides. The index is a small static file
 * per game (/[game]/search.json); this module is the pure matching, shared by
 * the route's tests and the browser.
 *
 * Ranking: the whole name, then a name that starts with the query, then a
 * word that does, then anywhere; ties keep the index order (most popular /
 * most valuable first). A query with no such match falls back to close
 * spellings ("bat dargon"), never to random letters ("ushdushfjhf").
 */

import { contentHubSlugsFor } from '@/lib/content/theme'

/** Games with a search index: a values hub or a guides hub. */
export function searchIndexGames(): string[] {
  return [...new Set([...contentHubSlugsFor('values'), ...contentHubSlugsFor('blog')])]
}

export interface SearchItem {
  /** Name. */
  n: string
  /** Value page. */
  h: string
  /** Picture. */
  i: string | null
  /** Market price, USD. */
  p: number | null
  /** What it is: "Godly Knife", "Legendary Pet". */
  k: string
}

export interface SearchGuide {
  /** Title. */
  t: string
  /** Article. */
  h: string
}

export interface GameSearchIndex {
  game: string
  name: string
  items: SearchItem[]
  guides: SearchGuide[]
}

export const normalizeSearch = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** 4 whole name · 3 starts with · 2 a word starts with · 1 contains · 0 none. */
export function scoreName(name: string, query: string): number {
  const n = normalizeSearch(name)
  const q = normalizeSearch(query)
  if (!q) return 0
  if (n === q) return 4
  if (n.startsWith(q)) return 3
  if (n.split(' ').some((w) => w.startsWith(q)) || n.includes(` ${q}`)) return 2
  return n.includes(q) ? 1 : 0
}

/** Optimal-string-alignment distance, for the close-spelling fallback. */
function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array<number>(b.length).fill(0)])
  for (let j = 1; j <= b.length; j += 1) d[0][j] = j
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

/** How close a misspelt query is to a name (0..1), comparing against the name's start of the same length. */
export function closeness(name: string, query: string): number {
  const q = normalizeSearch(query)
  const n = normalizeSearch(name)
  if (q.length < 4 || !n) return 0
  const head = n.slice(0, Math.max(q.length, Math.min(n.length, q.length + 2)))
  return 1 - distance(q, head) / Math.max(q.length, head.length)
}

const CLOSE_ENOUGH = 0.75

export function searchGame(
  index: GameSearchIndex,
  query: string,
  limits: { items?: number; guides?: number } = {},
): { items: SearchItem[]; guides: SearchGuide[]; closeOnly: boolean } {
  const maxItems = limits.items ?? 8
  const maxGuides = limits.guides ?? 4
  const rank = <T>(rows: T[], text: (r: T) => string) =>
    rows
      .map((r, order) => ({ r, order, score: scoreName(text(r), query) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.order - b.order)
      .map((x) => x.r)
  const items = rank(index.items, (i) => i.n).slice(0, maxItems)
  const guides = rank(index.guides, (g) => g.t).slice(0, maxGuides)
  if (items.length || guides.length) return { items, guides, closeOnly: false }
  // Nothing contains the query: try close spellings of item names.
  const close = index.items
    .map((r, order) => ({ r, order, c: closeness(r.n, query) }))
    .filter((x) => x.c >= CLOSE_ENOUGH)
    .sort((a, b) => b.c - a.c || a.order - b.order)
    .slice(0, maxItems)
    .map((x) => x.r)
  return { items: close, guides: [], closeOnly: close.length > 0 }
}

/**
 * Combobox search, outside React so it is cheap and testable: each option's
 * search text is lower-cased ONCE per options list (indexOptions), then each
 * keystroke is one substring pass. At most RENDER_CAP rows are rendered —
 * an 800-name list mounted 800 DOM rows on every open — and `more` says how
 * many matches are hidden so the list can say "keep typing".
 */
export const RENDER_CAP = 100

export interface SearchableOption {
  value: string
  label: string
  keywords?: string[]
}

export interface IndexedOption<T extends SearchableOption> {
  option: T
  hay: string
}

export function indexOptions<T extends SearchableOption>(options: readonly T[]): IndexedOption<T>[] {
  return options.map((option) => ({
    option,
    hay: [option.label, option.value, ...(option.keywords ?? [])].join(' ').toLowerCase(),
  }))
}

/** 0: the name starts with the query. 1: a word in it does. 2: it's somewhere in the name or keywords. */
function matchRank(label: string, q: string): number {
  const name = label.toLowerCase()
  if (name.startsWith(q)) return 0
  return name.includes(` ${q}`) ? 1 : 2
}

export function filterOptions<T extends SearchableOption>(
  index: readonly IndexedOption<T>[],
  query: string,
  options: { rank?: boolean } = {},
): { items: T[]; more: number } {
  const q = query.trim().toLowerCase()
  // Every word, in any order: "emberbow chroma" finds Chroma Emberbow.
  const words = q.split(/\s+/).filter(Boolean)
  const matches: T[] = []
  for (const { option, hay } of index) {
    if (words.every((w) => hay.includes(w))) matches.push(option)
  }
  if (options.rank && q) {
    const rank = new Map(matches.map((o) => [o, matchRank(o.label, q)]))
    matches.sort((a, b) => rank.get(a)! - rank.get(b)! || a.label.length - b.label.length)
  }
  const items = matches.slice(0, RENDER_CAP)
  return { items, more: matches.length - items.length }
}

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

export function filterOptions<T extends SearchableOption>(
  index: readonly IndexedOption<T>[],
  query: string,
): { items: T[]; more: number } {
  const q = query.trim().toLowerCase()
  const items: T[] = []
  let total = 0
  for (const { option, hay } of index) {
    if (q && !hay.includes(q)) continue
    total += 1
    if (items.length < RENDER_CAP) items.push(option)
  }
  return { items, more: total - items.length }
}

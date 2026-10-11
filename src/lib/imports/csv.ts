/**
 * Step 4 bulk importer — turning what a supplier sent into rows.
 *
 * The input is whatever the owner has: a CSV export, or a paste straight out of
 * a spreadsheet (which arrives TAB separated, not comma). So the parser sniffs
 * the delimiter, tolerates a header or no header, accepts the column names
 * people actually use, and reads numbers the way people actually write them
 * ("$12.50", "1,299.99", "x3").
 *
 * It never drops a line. A row with an empty item, an unreadable price or too
 * few cells is still a row — it goes to the review file with whatever it had,
 * because a silently vanished line is how a supplier's stock goes missing.
 *
 * Pure: no I/O. The `game` column, if present, is ignored — a batch already
 * names its game, and honouring a per-row game would mean one batch writing into
 * several category pairs.
 */

/** One request's worth of rows. A bigger paste is refused, not truncated silently. */
export const MAX_INPUT_ROWS = 2000

export interface RawImportRow {
  /** 1-based, counting only non-blank data lines — what an error message cites. */
  rowNo: number
  item: string
  variant: string | null
  quantity: number | null
  price: number | null
  /** The cells as they arrived, for showing the row back and for the audit trail. */
  raw: Record<string, string>
}

export interface ParseResult {
  rows: RawImportRow[]
  /** Problems with the input as a whole. Per-row problems belong to the row. */
  errors: string[]
  delimiter: ',' | '\t' | ';'
  hadHeader: boolean
}

/** Column synonyms, normalised to our four fields. */
const COLUMN_ALIASES: Record<string, keyof Pick<RawImportRow, 'item' | 'variant' | 'quantity' | 'price'>> = {
  item: 'item', name: 'item', itemname: 'item', pet: 'item', brainrot: 'item', egg: 'item', product: 'item',
  variant: 'variant', type: 'variant', mutation: 'variant', kind: 'variant', version: 'variant', form: 'variant',
  quantity: 'quantity', qty: 'quantity', stock: 'quantity', amount: 'quantity', count: 'quantity',
  price: 'price', usd: 'price', cost: 'price', priceusd: 'price', unitprice: 'price',
}

/** Columns we knowingly ignore rather than treat as data. */
const IGNORED_COLUMNS = new Set(['game', 'gameslug', 'title', 'notes', 'note'])

function normaliseHeader(cell: string): string {
  return cell.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Split one line, honouring "quoted, cells" and doubled "" escapes. */
function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i += 1 } else inQuotes = false
      } else cur += ch
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out.map((c) => c.trim())
}

/**
 * Pick the delimiter by counting candidates OUTSIDE quotes on the first
 * non-blank line. Tab first: a spreadsheet paste is the common case and a tab
 * never appears inside a pasted name.
 */
function sniffDelimiter(line: string): ',' | '\t' | ';' {
  const counts = { '\t': 0, ';': 0, ',': 0 } as Record<string, number>
  let inQuotes = false
  for (const ch of line) {
    if (ch === '"') inQuotes = !inQuotes
    else if (!inQuotes && ch in counts) counts[ch] += 1
  }
  if (counts['\t'] > 0) return '\t'
  if (counts[';'] > counts[',']) return ';'
  return ','
}

/** "$12.50" / "1,299.99" / "USD 4" → 12.5 / 1299.99 / 4. */
function parseMoney(raw: string | undefined): number | null {
  if (raw == null) return null
  const cleaned = raw.replace(/[^0-9.]/g, '')
  if (!cleaned || !/\d/.test(cleaned)) return null
  const n = Number.parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

/** "3" / "x3" / "3x" / "1,000" → 3 / 3 / 3 / 1000. Rounds down a decimal. */
function parseCount(raw: string | undefined): number | null {
  if (raw == null) return null
  const cleaned = raw.replace(/[^0-9.]/g, '')
  if (!cleaned || !/\d/.test(cleaned)) return null
  const n = Number.parseFloat(cleaned)
  return Number.isFinite(n) ? Math.floor(n) : null
}

function blank(s: string | undefined): boolean {
  return !s || !s.trim()
}

export function parseImportInput(text: string): ParseResult {
  const errors: string[] = []
  const lines = (text ?? '')
    .split(/\r\n|\r|\n/)
    .filter((l) => l.trim().length > 0)

  if (lines.length === 0) {
    return { rows: [], errors: ['There is nothing to import — paste or upload some rows first.'], delimiter: ',', hadHeader: false }
  }

  const delimiter = sniffDelimiter(lines[0])
  const firstCells = splitLine(lines[0], delimiter)

  // A header is a first line whose cells are column NAMES rather than data.
  const headerKeys = firstCells.map(normaliseHeader)
  const hadHeader = headerKeys.some((k) => k in COLUMN_ALIASES || IGNORED_COLUMNS.has(k))

  /** Position → our field name. */
  const layout: Array<keyof Pick<RawImportRow, 'item' | 'variant' | 'quantity' | 'price'> | null> = hadHeader
    ? headerKeys.map((k) => COLUMN_ALIASES[k] ?? null)
    : // Positional fallback, the order the step spec documents.
      ['item', 'variant', 'quantity', 'price']

  const dataLines = hadHeader ? lines.slice(1) : lines
  if (dataLines.length === 0) {
    return { rows: [], errors: ['That file has a header but no rows.'], delimiter, hadHeader }
  }

  const capped = dataLines.slice(0, MAX_INPUT_ROWS)
  if (dataLines.length > capped.length) {
    errors.push(`Only the first ${MAX_INPUT_ROWS} rows were read (the file has ${dataLines.length}). Split it and import the rest as a second batch.`)
  }

  const rows: RawImportRow[] = capped.map((line, i) => {
    const cells = splitLine(line, delimiter)
    const picked: Partial<Record<'item' | 'variant' | 'quantity' | 'price', string>> = {}
    const raw: Record<string, string> = {}
    layout.forEach((field, pos) => {
      const cell = cells[pos] ?? ''
      if (hadHeader) raw[headerKeys[pos] || `col${pos}`] = cell
      else if (field) raw[field] = cell
      if (field && picked[field] === undefined) picked[field] = cell
    })

    return {
      rowNo: i + 1,
      item: (picked.item ?? '').trim(),
      variant: blank(picked.variant) ? null : picked.variant!.trim(),
      quantity: parseCount(picked.quantity),
      price: parseMoney(picked.price),
      raw,
    }
  })

  return { rows, errors, delimiter, hadHeader }
}

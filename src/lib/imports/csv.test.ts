import { describe, it, expect } from 'vitest'
import { parseImportInput, MAX_INPUT_ROWS } from './csv'

describe('parseImportInput — headers', () => {
  it('reads a header row and maps the known columns', () => {
    const r = parseImportInput('item,variant,quantity,price\nFrost Dragon,FR,3,12.50')
    expect(r.hadHeader).toBe(true)
    expect(r.rows).toEqual([
      { rowNo: 1, item: 'Frost Dragon', variant: 'FR', quantity: 3, price: 12.5, raw: { item: 'Frost Dragon', variant: 'FR', quantity: '3', price: '12.50' } },
    ])
  })

  it('accepts the columns in any order', () => {
    const r = parseImportInput('price,item,qty,variant\n12.50,Frost Dragon,3,FR')
    expect(r.rows[0]).toMatchObject({ item: 'Frost Dragon', variant: 'FR', quantity: 3, price: 12.5 })
  })

  it('accepts common column synonyms', () => {
    const r = parseImportInput('pet,type,stock,usd\nFrost Dragon,FR,3,12.50')
    expect(r.rows[0]).toMatchObject({ item: 'Frost Dragon', variant: 'FR', quantity: 3, price: 12.5 })
  })

  it('ignores a leading game column, since the batch already picks the game', () => {
    const r = parseImportInput('game,item,variant,quantity,price\nAdopt Me,Frost Dragon,FR,3,12.50')
    expect(r.rows[0]).toMatchObject({ item: 'Frost Dragon', variant: 'FR', quantity: 3 })
  })

  it('treats a first line with no known column as data, not a header', () => {
    const r = parseImportInput('Frost Dragon,FR,3,12.50')
    expect(r.hadHeader).toBe(false)
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0]).toMatchObject({ item: 'Frost Dragon', variant: 'FR', quantity: 3, price: 12.5 })
  })
})

describe('parseImportInput — delimiters', () => {
  it('handles tab-separated input, which is what a spreadsheet paste gives', () => {
    const r = parseImportInput('item\tvariant\tquantity\tprice\nFrost Dragon\tFR\t3\t12.50')
    expect(r.delimiter).toBe('\t')
    expect(r.rows[0]).toMatchObject({ item: 'Frost Dragon', variant: 'FR', quantity: 3, price: 12.5 })
  })

  it('handles semicolons, which is what a European Excel export gives', () => {
    const r = parseImportInput('item;variant;quantity;price\nFrost Dragon;FR;3;12.50')
    expect(r.delimiter).toBe(';')
    expect(r.rows[0]).toMatchObject({ item: 'Frost Dragon', quantity: 3 })
  })

  it('does not mistake a comma inside a quoted name for a delimiter', () => {
    const r = parseImportInput('item,variant,quantity,price\n"Dragon, Frost",FR,3,12.50')
    expect(r.rows[0].item).toBe('Dragon, Frost')
  })

  it('unescapes doubled quotes', () => {
    const r = parseImportInput('item\n"The ""Best"" Dragon"')
    expect(r.rows[0].item).toBe('The "Best" Dragon')
  })
})

describe('parseImportInput — numbers as people actually type them', () => {
  it.each([
    ['12.50', 12.5],
    ['$12.50', 12.5],
    [' 12.50 ', 12.5],
    ['1,299.99', 1299.99],
    ['USD 4', 4],
    ['4', 4],
  ])('price %s → %s', (raw, want) => {
    expect(parseImportInput(`item,price\nX,${raw.includes(',') ? `"${raw}"` : raw}`).rows[0].price).toBe(want)
  })

  it.each([['3', 3], ['x3', 3], ['3x', 3], [' 3 ', 3], ['1,000', 1000]])('quantity %s → %s', (raw, want) => {
    expect(parseImportInput(`item,quantity\nX,${raw.includes(',') ? `"${raw}"` : raw}`).rows[0].quantity).toBe(want)
  })

  it('leaves an unparseable number null rather than guessing zero', () => {
    const r = parseImportInput('item,quantity,price\nX,many,ask')
    expect(r.rows[0].quantity).toBeNull()
    expect(r.rows[0].price).toBeNull()
  })

  it('keeps the original text so the row can be shown back verbatim', () => {
    const r = parseImportInput('item,price\nX,$12.50')
    expect(r.rows[0].raw.price).toBe('$12.50')
  })
})

describe('parseImportInput — messy input', () => {
  it('skips blank and whitespace-only lines without shifting the numbering of real rows', () => {
    const r = parseImportInput('item,quantity\nA,1\n\n   \nB,2')
    expect(r.rows.map((x) => [x.rowNo, x.item])).toEqual([[1, 'A'], [2, 'B']])
  })

  it('handles CRLF line endings', () => {
    const r = parseImportInput('item,quantity\r\nA,1\r\nB,2')
    expect(r.rows.map((x) => x.item)).toEqual(['A', 'B'])
  })

  it('tolerates a trailing newline', () => {
    expect(parseImportInput('item\nA\n').rows).toHaveLength(1)
  })

  it('pads a short row instead of dropping it', () => {
    const r = parseImportInput('item,variant,quantity,price\nFrost Dragon,FR')
    expect(r.rows[0]).toMatchObject({ item: 'Frost Dragon', variant: 'FR', quantity: null, price: null })
  })

  it('keeps a row whose item cell is empty, so the reviewer sees it was sent', () => {
    const r = parseImportInput('item,quantity\n,5')
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0].item).toBe('')
  })

  it('reports an empty input as an input-level error, with no rows', () => {
    for (const text of ['', '   ', '\n\n']) {
      const r = parseImportInput(text)
      expect(r.rows).toEqual([])
      expect(r.errors.join(' ')).toMatch(/nothing to import/i)
    }
  })

  it('reports a header-only input', () => {
    const r = parseImportInput('item,variant,quantity,price')
    expect(r.rows).toEqual([])
    expect(r.errors.join(' ')).toMatch(/no rows/i)
  })

  it('caps an enormous paste and says so, instead of timing out the request', () => {
    const big = ['item,quantity', ...Array.from({ length: MAX_INPUT_ROWS + 50 }, (_, i) => `Item ${i},1`)].join('\n')
    const r = parseImportInput(big)
    expect(r.rows).toHaveLength(MAX_INPUT_ROWS)
    expect(r.errors.join(' ')).toMatch(new RegExp(String(MAX_INPUT_ROWS)))
  })

  it('normalises an empty variant cell to null', () => {
    const r = parseImportInput('item,variant\nA,\nB,   ')
    expect(r.rows.map((x) => x.variant)).toEqual([null, null])
  })
})

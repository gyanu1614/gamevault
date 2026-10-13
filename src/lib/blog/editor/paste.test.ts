import { describe, expect, it } from 'vitest'
import { fitHeadings, fitHtmlHeadings, looksLikeMarkdown } from './paste'

describe('paste from Claude (or any chat)', () => {
  it('spots Markdown: headings, bold, links, lists, tables', () => {
    expect(looksLikeMarkdown('## How To Get Candy\n\nText')).toBe(true)
    expect(looksLikeMarkdown('Intro with **bold** text')).toBe(true)
    expect(looksLikeMarkdown('See [values](/mm2/values)')).toBe(true)
    expect(looksLikeMarkdown('Steps:\n1. Join\n2. Collect')).toBe(true)
    expect(looksLikeMarkdown('- one\n- two')).toBe(true)
    expect(looksLikeMarkdown('| Item | Value |\n|---|---|\n| A | 1 |')).toBe(true)
  })
  it('leaves plain sentences alone', () => {
    expect(looksLikeMarkdown('Just a normal sentence, nothing else.')).toBe(false)
    expect(looksLikeMarkdown('Price is 5 * 3 = 15')).toBe(false)
  })
  it('the post title (#) becomes a section heading; level 4+ becomes a small heading', () => {
    expect(fitHeadings('# Big\n## Mid\n### Small\n#### Tiny\nnot # a heading')).toBe('## Big\n## Mid\n### Small\n### Tiny\nnot # a heading')
  })
  it('does the same for copied HTML', () => {
    expect(fitHtmlHeadings('<h1 class="x">A</h1><h4>B</h4><h6>C</h6>')).toBe('<h2 class="x">A</h2><h3>B</h3><h3>C</h3>')
  })
})

describe('the DropMarket post format (tip boxes, steps, image slots)', () => {
  it('spots its markers', async () => {
    const { hasPostMarkers } = await import('./paste')
    expect(hasPostMarkers(':::tip\nCheck prices.\n:::')).toBe(true)
    expect(hasPostMarkers('Intro\n\n![IMAGE: lobby](replace-me)')).toBe(true)
    expect(hasPostMarkers('## Just a heading\n\n- a list')).toBe(false)
  })
})

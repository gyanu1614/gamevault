import { describe, expect, it } from 'vitest'
import { fitHeadings, fitHtmlHeadings, hasPostMarkers, looksLikeMarkdown } from './paste'

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

describe('formatted copy (selected on screen) with the post markers', () => {
  const p = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
  const ul = (...items: string[]) => ({ type: 'bulletList', content: items.map((t) => ({ type: 'listItem', content: [p(t)] })) })

  it('::name … :: (two or three colons) wraps the blocks between into a box', async () => {
    const { wrapDirectives } = await import('./paste')
    const out = wrapDirectives([p('::takeaways'), ul('One', 'Two'), p(':::'), p('After')])
    expect(out).toEqual([{ type: 'callout', attrs: { tone: 'takeaways' }, content: [ul('One', 'Two')] }, p('After')])
  })
  it('steps become a numbered list, from lines or from a list', async () => {
    const { wrapDirectives } = await import('./paste')
    const out = wrapDirectives([p(':::steps'), p('Go to Sell'), p('Pick your pet'), p(':::')])
    expect(out[0]).toMatchObject({ type: 'orderedList', attrs: { start: 1 } })
    expect((out[0].content ?? []).length).toBe(2)
    expect(wrapDirectives([p(':::steps'), ul('A', 'B', 'C'), p(':::')])[0]).toMatchObject({ type: 'orderedList' })
  })
  it('a markdown image line becomes an empty image slot', async () => {
    const { wrapDirectives } = await import('./paste')
    expect(wrapDirectives([p('![IMAGE: Trade window](replace-me)')])[0]).toMatchObject({ type: 'figure', attrs: { src: '', alt: 'Trade window' } })
  })
  it('<img> placeholders in copied HTML become image slots; real addresses are kept', async () => {
    const { imgToFigureHtml } = await import('./paste')
    expect(imgToFigureHtml('<p>x</p><img src="replace-me" alt="IMAGE: Lobby">')).toBe('<p>x</p><figure data-block="figure" src="" alt="Lobby" layout="column"></figure>')
    expect(imgToFigureHtml('<img alt="Pic" src="https://cdn.x/a.png">')).toBe('<figure data-block="figure" src="https://cdn.x/a.png" alt="Pic" layout="column"></figure>')
  })
  it('blank lines from the copy are dropped', async () => {
    const { wrapDirectives } = await import('./paste')
    expect(wrapDirectives([p('A'), { type: 'paragraph' }, p('  '), p('B')])).toEqual([p('A'), p('B')])
  })
  it('two colons count as a marker', () => {
    expect(hasPostMarkers('::takeaways\n- a\n::')).toBe(true)
  })
})

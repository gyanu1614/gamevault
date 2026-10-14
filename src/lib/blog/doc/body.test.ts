import { describe, expect, it } from 'vitest'
import { makeBody, readBody } from './body'

const doc = { type: 'doc' as const, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hi' }] }] }

describe('readBody', () => {
  it('a legacy markdown array becomes a doc, flagged legacy', () => {
    const r = readBody(['## A', 'text'])
    expect(r.legacy).toBe(true)
    expect(r.doc.content[0]).toMatchObject({ type: 'heading' })
    expect(r.cover).toBeNull()
  })
  it('a v2 body is read as is, with its cover', () => {
    const cover = { src: 'c.webp', width: 1920, height: 1080, blur: null, sources: { avif: [], webp: [] } }
    expect(readBody({ v: 2, doc, cover })).toEqual({ doc, cover, legacy: false, note: null })
  })
  it('anything else is an empty doc, never a crash', () => {
    for (const raw of [null, undefined, 'x', { v: 3 }, { v: 2, doc: { type: 'nope' } }]) {
      expect(readBody(raw)).toEqual({ doc: { type: 'doc', content: [{ type: 'paragraph' }] }, cover: null, legacy: false, note: null })
    }
  })
  it('makeBody round-trips', () => {
    expect(readBody(makeBody(doc, null))).toEqual({ doc, cover: null, legacy: false, note: null })
  })
})

describe('readBody: codes update note (Blog v2)', () => {
  it('returns the note of a codes post, trimmed; none when blank', () => {
    const doc = { type: 'doc' as const, content: [] }
    expect(readBody({ v: 2, doc, note: '  2 new codes ' }).note).toBe('2 new codes')
    expect(readBody({ v: 2, doc, note: '   ' }).note).toBeNull()
  })
})


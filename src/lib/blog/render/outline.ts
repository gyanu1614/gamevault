/**
 * What a post's doc says about itself: its headings (the contents list and
 * the heading ids the renderer stamps, in the same order), its length and
 * read time, and the item cards it needs live data for. Pure.
 */
import type { BlogDoc, DocNode } from '@/lib/blog/doc/types'

/**
 * The contents list shows from this many sections (fewer is noise). Lives here,
 * not in the client component: a server page can't read plain values out of a
 * 'use client' module (it gets a reference, so the check was always false).
 */
export const TOC_MIN_SECTIONS = 3

export interface HeadingEntry {
  id: string
  text: string
  level: number
}

export interface ItemRef {
  gameSlug: string
  itemSlug: string
  name: string
  imageUrl: string
}

function walk(node: DocNode, visit: (n: DocNode) => void) {
  visit(node)
  for (const child of node.content ?? []) walk(child, visit)
}

export function nodeText(node: DocNode): string {
  if (node.type === 'text') return node.text ?? ''
  return (node.content ?? []).map(nodeText).join('')
}

function slug(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60)
}

/** Every heading, depth-first (the renderer numbers headings in this same order). */
export function collectHeadings(doc: BlogDoc): HeadingEntry[] {
  const seen = new Map<string, number>()
  const out: HeadingEntry[] = []
  walk(doc, (n) => {
    if (n.type !== 'heading') return
    const text = nodeText(n).trim()
    const base = slug(text) || `section-${out.length + 1}`
    const count = (seen.get(base) ?? 0) + 1
    seen.set(base, count)
    out.push({ id: count === 1 ? base : `${base}-${count}`, text, level: Number(n.attrs?.level ?? 2) })
  })
  return out
}

export function docWordCount(doc: BlogDoc): number {
  let words = 0
  walk(doc, (n) => {
    if (n.type === 'text' && n.text) words += n.text.split(/\s+/).filter(Boolean).length
  })
  return words
}

/** ~220 words a minute, never under 1. */
export function docReadMinutes(doc: BlogDoc): number {
  return Math.max(1, Math.round(docWordCount(doc) / 220))
}

export function collectItemRefs(doc: BlogDoc): ItemRef[] {
  const out = new Map<string, ItemRef>()
  walk(doc, (n) => {
    if (n.type !== 'itemCard') return
    const gameSlug = String(n.attrs?.gameSlug ?? '')
    const itemSlug = String(n.attrs?.itemSlug ?? '')
    if (!gameSlug || !itemSlug) return
    const key = `${gameSlug}/${itemSlug}`
    if (!out.has(key)) out.set(key, { gameSlug, itemSlug, name: String(n.attrs?.name ?? itemSlug), imageUrl: String(n.attrs?.imageUrl ?? '') })
  })
  return [...out.values()]
}

/**
 * The blog block set — ONE definition used by both the admin editor (which
 * adds React node views on top) and the server renderer (which maps each
 * node to a React component). No React here, so the server renderer never
 * pulls editor UI into a public bundle.
 *
 * Built-in (StarterKit): paragraph, heading 2/3, bold, italic, link, bullet
 * and numbered lists, quote, divider, hard break. Tables via TableKit. Text
 * colour via TextStyle + Color (hex only on the page — doc/color.ts).
 * Ours: figure, imagePair, callout, faq, codes, itemCard, cta, youtube.
 */
import { Node, mergeAttributes, type Extensions } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { TableKit } from '@tiptap/extension-table'
import { Color, TextStyle } from '@tiptap/extension-text-style'

/** A JSON-valued attribute (stored as is in the doc). */
const json = <T>(fallback: T) => ({
  default: fallback,
  parseHTML: () => fallback,
  renderHTML: () => ({}),
})
const text = (fallback = '') => ({ default: fallback })

/** Atom block: one unit, edited through its node view / side form. */
function atom(name: string, attrs: Record<string, unknown>, tag = 'div') {
  return Node.create({
    name,
    group: 'block',
    atom: true,
    draggable: true,
    selectable: true,
    addAttributes: () => attrs as never,
    parseHTML: () => [{ tag: `${tag}[data-block="${name}"]` }],
    renderHTML: ({ HTMLAttributes }) => [tag, mergeAttributes(HTMLAttributes, { 'data-block': name })],
  })
}

/** An image: the processed source set (StoredImage fields) + how it sits on the page. */
export const Figure = atom(
  'figure',
  {
    src: text(),
    sources: json(null),
    width: json(null),
    height: json(null),
    blur: json(null),
    /** A cut-out (see-through pixels): no rounded box (render/picture-size.ts). */
    alpha: json(null),
    alt: text(),
    caption: text(),
    /** column = the reading column; wide = the column with a taller height cap (picture-size.ts). */
    layout: text('column'),
  },
  'figure',
)

/** Two images side by side (stacked on phones). `a` / `b` = { image: StoredImage, alt, caption }. */
export const ImagePair = atom('imagePair', { a: json(null), b: json(null) }, 'figure')

/** Tip / Warning / Note / Key takeaways — holds normal blocks. */
export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes: () => ({ tone: { default: 'tip' } }),
  parseHTML: () => [{ tag: 'aside[data-block="callout"]' }],
  renderHTML: ({ HTMLAttributes }) => ['aside', mergeAttributes(HTMLAttributes, { 'data-block': 'callout' }), 0],
})

/** FAQ: [{ q, a }] — readers get a <details> list. */
export const Faq = atom('faq', { items: json([] as Array<{ q: string; a: string }>) })

/** Codes: [{ code, reward, isNew, expired }] — active table + collapsed expired list, copy buttons. */
export const Codes = atom('codes', {
  rows: json([] as Array<{ code: string; reward: string; isNew?: boolean; expired?: boolean }>),
  checkedAt: text(),
})

/** A live item card: value + offers resolved on the server at render time. */
export const ItemCard = atom('itemCard', { gameSlug: text(), itemSlug: text(), name: text(), imageUrl: text() })

/** One buy/sell button. */
export const Cta = atom('cta', { label: text('Shop Now'), href: text('/') })

/** YouTube: a thumbnail until clicked (no iframe on page load). */
export const YouTube = atom('youtube', { id: text(), title: text() })

/** A small uploaded picture inside a table cell (Blog v2): one fixed square (render/picture-size.ts). */
export const CellImage = Node.create({
  name: 'cellImage',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes: () => ({ src: text(), alt: text() }),
  parseHTML: () => [{ tag: 'img[data-cell-image]' }],
  renderHTML: ({ HTMLAttributes }) => ['img', mergeAttributes(HTMLAttributes, { 'data-cell-image': '', width: 40, height: 40 })],
})

export const CUSTOM_NODES = [Figure, ImagePair, Callout, Faq, Codes, ItemCard, Cta, YouTube, CellImage]

/** StarterKit + tables: the built-in half of the block set (the editor adds node views to CUSTOM_NODES). */
export function blogBaseExtensions(): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      underline: false,
      code: false,
      codeBlock: false,
      // The renderer has no strikethrough; keep the editor to what readers get.
      strike: false,
    }),
    TableKit.configure({ table: { resizable: false } }),
    TextStyle,
    Color.configure({ types: ['textStyle'] }),
  ]
}

/** The full block set. `link` opens nothing in the editor; the renderer decides rel/target. */
export function blogExtensions(): Extensions {
  return [...blogBaseExtensions(), ...CUSTOM_NODES]
}

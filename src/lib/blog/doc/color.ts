/**
 * Text colour for blog posts (owner, 2026-10-13: "a colour picker … we need a
 * lot of colours, not just green"). The editor stores a picked colour on the
 * `textStyle` mark (Tiptap Color); this file is the one rule for what a
 * colour may be, used by the editor's picker and the server renderer.
 *
 * Only a plain hex colour ever reaches the page (safeColor): the value goes
 * into a style attribute, so anything else (names, rgb(), injected CSS) is
 * dropped at render time — the text stays, uncoloured.
 */

/** The picker's swatches: bright enough to read on the dark cards and ground. */
export const TEXT_COLORS: ReadonlyArray<{ name: string; hex: string }> = [
  { name: 'Green', hex: '#56b87f' },
  { name: 'Lime', hex: '#a3e635' },
  { name: 'Yellow', hex: '#facc15' },
  { name: 'Orange', hex: '#fb923c' },
  { name: 'Red', hex: '#f87171' },
  { name: 'Pink', hex: '#f472b6' },
  { name: 'Purple', hex: '#a78bfa' },
  { name: 'Blue', hex: '#60a5fa' },
  { name: 'Cyan', hex: '#22d3ee' },
  { name: 'Teal', hex: '#2dd4bf' },
  { name: 'White', hex: '#ffffff' },
  { name: 'Grey', hex: '#9ca3af' },
]

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

/** The colour as lowercase hex, or null when it is anything but #rgb / #rrggbb. */
export function safeColor(value: unknown): string | null {
  return typeof value === 'string' && HEX.test(value) ? value.toLowerCase() : null
}

/**
 * Pasted HTML without its text colours (a web page's are often black, which
 * vanishes on our dark page); every other style stays. `background-color` is
 * not a text colour and is kept.
 */
export function stripPastedColors(html: string): string {
  return html.replace(/\sstyle="([^"]*)"/gi, (_match, css: string) => {
    const kept = css.replace(/(^|;)\s*color\s*:[^;]*;?/gi, '$1').trim()
    return kept ? ` style="${kept}"` : ''
  })
}

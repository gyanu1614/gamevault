/**
 * Pasting a post written elsewhere (2026-10-13). A chat's Copy button hands
 * over Markdown as plain text ("## Heading", "**bold**"), which would paste
 * as literal symbols; these helpers let the editor turn it into real blocks.
 * Posts use two heading sizes, so a pasted title (#) becomes a section
 * heading and anything below ### becomes a small heading. Pure, for tests.
 */

const MD_SIGNS = [
  /^#{1,6}\s+\S/m, // heading
  /\*\*[^*\n]+\*\*/, // bold
  /\[[^\]\n]+\]\([^)\s]+\)/, // link
  /^\s*[-*+]\s+\S/m, // bullet
  /^\s*\d+[.)]\s+\S/m, // numbered
  /^\|.+\|\s*$/m, // table row
]

export function looksLikeMarkdown(text: string): boolean {
  return MD_SIGNS.some((re) => re.test(text))
}

/** The post format the old editor read: :::tip / :::steps boxes and image slots. */
export function hasPostMarkers(text: string): boolean {
  return /^\s*:::\s*(tip|warning|note|takeaways|steps)\b/im.test(text) || /!\[[^\]]*\]\([^)\s]+\)/.test(text)
}

export function fitHeadings(markdown: string): string {
  return markdown.replace(/^#{1,6}(?=\s)/gm, (h) => (h.length <= 2 ? '##' : '###'))
}

export function fitHtmlHeadings(html: string): string {
  return html.replace(/<(\/?)h([1-6])\b/gi, (_, slash: string, level: string) => {
    const n = Number(level)
    return `<${slash}h${n <= 2 ? 2 : 3}`
  })
}

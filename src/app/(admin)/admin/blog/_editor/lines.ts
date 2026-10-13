/**
 * Heading / Subheading / Text change a whole paragraph (like Google Docs).
 * A paragraph built from line breaks (Shift+Enter, or text pasted as one
 * block) would then turn into one giant heading, so first split the
 * paragraphs under the selection at their line breaks: only the line(s)
 * you are on change.
 */
import type { CommandProps } from '@tiptap/core'

export function splitLines({ tr, state, dispatch }: CommandProps): boolean {
  const { from, to } = state.selection
  const breaks: number[] = []
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isTextblock) return true
    node.forEach((child, offset) => {
      if (child.type.name === 'hardBreak') breaks.push(pos + 1 + offset)
    })
    return false
  })
  if (!dispatch || breaks.length === 0) return true
  // Last first, so the earlier positions stay valid.
  for (const at of breaks.sort((a, b) => b - a)) {
    tr.delete(at, at + 1)
    tr.split(at)
  }
  return true
}

/**
 * The editor's block set: the SAME schema the public renderer reads
 * (blogBaseExtensions + CUSTOM_NODES), with a React node view on each custom
 * block, plus writing helpers that never reach a post: the "/" menu, the
 * empty-line hint, word count, paste / drop an image straight in, and paste
 * a post written in a chat (its Copy button gives Markdown) as real blocks.
 */
import { Extension, type Editor, type Extensions } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { Markdown } from '@tiptap/markdown'
import { ReactNodeViewRenderer } from '@tiptap/react'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import FileHandler from '@tiptap/extension-file-handler'
import { toast } from 'sonner'
import { blogBaseExtensions, Callout, Codes, Cta, Faq, Figure, ImagePair, ItemCard, YouTube } from '@/lib/blog/doc/schema'
import { CalloutNV, CodesNV, CtaNV, FaqNV, FigureNV, ImagePairNV, ItemCardNV, YouTubeNV } from './node-views'
import { SlashCommand } from './slash'
import { uploadImage } from './upload'
import { fitHeadings, hasPostMarkers, looksLikeMarkdown } from '@/lib/blog/editor/paste'
import { legacyToDoc } from '@/lib/blog/doc/legacy'

/** Copied rich text that already carries structure. */
const RICH_HTML = /<(h[1-6]|ul|ol|table|strong|b|em|a)\b/i

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif']

/** Upload each file, then drop a figure for it at `pos` (or the cursor). */
async function insertImages(editor: Editor, files: File[], pos?: number) {
  for (const file of files) {
    const id = toast.loading(`Uploading ${file.name}…`)
    const r = await uploadImage(file)
    if (!r.ok) {
      toast.error(r.error, { id })
      continue
    }
    toast.dismiss(id)
    if (editor.isDestroyed) return
    const node = { type: 'figure', attrs: { ...r.image, alt: '', caption: '', layout: 'column' } }
    if (pos === undefined) editor.chain().focus().insertContent(node).run()
    else editor.chain().focus().insertContentAt(pos, node).run()
  }
}

/**
 * Paste a post written in a chat:
 *  - our post format (:::tip / :::steps boxes, ![IMAGE: …](replace-me) image
 *    slots) → the same converter that opens old posts;
 *  - other Markdown → headings, lists, bold, links, tables;
 *  - copied rich text with real headings/lists, and images, keep their own
 *    handlers. (A chat often wraps plain text in bare HTML, so HTML alone
 *    does not decide.)
 */
const PasteMarkdown = Extension.create({
  name: 'pasteMarkdown',
  addProseMirrorPlugins() {
    const editor = this.editor
    return [
      new Plugin({
        props: {
          handlePaste: (_view, event) => {
            const data = event.clipboardData
            if (!data || data.files.length > 0) return false
            const text = data.getData('text/plain')
            if (!text) return false
            const markers = hasPostMarkers(text)
            if (!markers && RICH_HTML.test(data.getData('text/html'))) return false
            if (markers) return editor.commands.insertContent(legacyToDoc(fitHeadings(text).split('\n')).content)
            if (looksLikeMarkdown(text)) return editor.commands.insertContent(fitHeadings(text), { contentType: 'markdown' })
            // Plain lines (a chat often sends them as one <div> with <br>s): one paragraph each,
            // never one giant paragraph that a Heading click would swallow whole.
            const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
            if (lines.length < 2) return false
            return editor.commands.insertContent(lines.map((l) => ({ type: 'paragraph', content: [{ type: 'text', text: l }] })))
          },
        },
      }),
    ]
  },
})

export function editorExtensions(): Extensions {
  return [
    ...blogBaseExtensions(),
    Figure.extend({ addNodeView: () => ReactNodeViewRenderer(FigureNV) }),
    ImagePair.extend({ addNodeView: () => ReactNodeViewRenderer(ImagePairNV) }),
    Callout.extend({ addNodeView: () => ReactNodeViewRenderer(CalloutNV) }),
    Faq.extend({ addNodeView: () => ReactNodeViewRenderer(FaqNV) }),
    Codes.extend({ addNodeView: () => ReactNodeViewRenderer(CodesNV) }),
    ItemCard.extend({ addNodeView: () => ReactNodeViewRenderer(ItemCardNV) }),
    Cta.extend({ addNodeView: () => ReactNodeViewRenderer(CtaNV) }),
    YouTube.extend({ addNodeView: () => ReactNodeViewRenderer(YouTubeNV) }),
    Placeholder.configure({
      placeholder: ({ node }) => (node.type.name === 'heading' ? 'Heading' : 'Write, or type / for images, tables, tips and more'),
    }),
    CharacterCount,
    Markdown,
    PasteMarkdown,
    SlashCommand,
    FileHandler.configure({
      allowedMimeTypes: IMAGE_TYPES,
      onPaste: (editor, files) => void insertImages(editor, files),
      onDrop: (editor, files, pos) => void insertImages(editor, files, pos),
    }),
  ]
}

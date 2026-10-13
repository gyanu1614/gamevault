/**
 * The editor's block set: the SAME schema the public renderer reads
 * (blogBaseExtensions + CUSTOM_NODES), with a React node view on each custom
 * block, plus writing helpers that never reach a post: the "/" menu, the
 * empty-line hint, word count, and paste / drop an image straight in.
 */
import type { Editor, Extensions } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import FileHandler from '@tiptap/extension-file-handler'
import { toast } from 'sonner'
import { blogBaseExtensions, Callout, Codes, Cta, Faq, Figure, ImagePair, ItemCard, YouTube } from '@/lib/blog/doc/schema'
import { CalloutNV, CodesNV, CtaNV, FaqNV, FigureNV, ImagePairNV, ItemCardNV, YouTubeNV } from './node-views'
import { SlashCommand } from './slash'
import { uploadImage } from './upload'

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
    SlashCommand,
    FileHandler.configure({
      allowedMimeTypes: IMAGE_TYPES,
      onPaste: (editor, files) => void insertImages(editor, files),
      onDrop: (editor, files, pos) => void insertImages(editor, files, pos),
    }),
  ]
}

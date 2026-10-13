'use client'

/**
 * The post body editor (Tiptap 3, MIT). Write like a doc: type, select text
 * for bold / link / heading, "/" or Insert for images, tables, tip boxes,
 * item cards and the rest; drag the handle on the left to move a block; paste
 * or drop an image to upload it. Text sizes match the article, so what you
 * see here is close to what readers get (Preview shows the exact page).
 */
import { useMemo } from 'react'
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { DragHandle } from '@tiptap/extension-drag-handle-react'
import DragIndicatorRounded from '@mui/icons-material/DragIndicatorRounded'
import type { BlogDoc } from '@/lib/blog/doc/types'
import { fitHtmlHeadings } from '@/lib/blog/editor/paste'
import { editorExtensions } from './extensions'
import { SelectionMenu, Toolbar } from './Toolbar'

/** Mirrors the public renderer's type (BlogDocView): same sizes, top margins only. */
const PROSE =
  'blog-editor min-h-[420px] pb-16 text-[16.5px] leading-[1.7] text-text-secondary outline-none sm:text-[17px] ' +
  '[&>*:first-child]:mt-0 [&>p]:mt-5 ' +
  '[&>h2]:mt-11 [&>h2]:text-[22px] [&>h2]:font-bold [&>h2]:leading-tight [&>h2]:tracking-[-0.01em] [&>h2]:text-text-primary sm:[&>h2]:text-[26px] ' +
  '[&>h3]:mt-8 [&>h3]:text-[19px] [&>h3]:font-semibold [&>h3]:leading-snug [&>h3]:text-text-primary sm:[&>h3]:text-[20px] ' +
  '[&>h2+*]:mt-4 [&>h3+*]:mt-3 ' +
  '[&_ul]:mt-5 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mt-5 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mt-2 [&_li]:pl-1 [&_li>p]:mt-0 [&_li]:marker:text-text-tertiary ' +
  '[&_blockquote]:mt-7 [&_blockquote]:border-l-2 [&_blockquote]:border-white/15 [&_blockquote]:pl-5 [&_blockquote]:text-text-primary [&_blockquote>p]:mt-0 ' +
  '[&>hr]:mb-5 [&>hr]:mt-10 [&>hr]:border-white/[0.08] [&_hr.ProseMirror-selectednode]:border-white/40 ' +
  '[&_strong]:font-semibold [&_strong]:text-text-primary ' +
  '[&_a]:font-medium [&_a]:text-text-primary [&_a]:underline [&_a]:decoration-white/30 [&_a]:underline-offset-[3px] ' +
  '[&_.tableWrapper]:mt-7 [&_.tableWrapper]:overflow-x-auto [&_table]:w-full [&_table]:border-collapse [&_table]:text-[15px] ' +
  '[&_th]:border [&_th]:border-white/[0.08] [&_th]:bg-white/[0.04] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-[13px] [&_th]:font-semibold [&_th]:text-text-primary ' +
  '[&_td]:border [&_td]:border-white/[0.08] [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_td>p]:mt-0 [&_th>p]:mt-0 [&_.selectedCell]:bg-white/[0.06] ' +
  // The hint on the empty line the cursor is on.
  '[&_.is-empty]:before:pointer-events-none [&_.is-empty]:before:float-left [&_.is-empty]:before:h-0 [&_.is-empty]:before:text-text-tertiary [&_.is-empty]:before:content-[attr(data-placeholder)]'

export function BlockEditor({ initial, onChange }: { initial: BlogDoc; onChange: (doc: BlogDoc) => void }) {
  const extensions = useMemo(() => editorExtensions(), [])
  const editor = useEditor({
    extensions,
    content: initial as JSONContent,
    immediatelyRender: false,
    // Typing re-renders only the controls that read editor state.
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: { class: PROSE, 'aria-label': 'Post body' },
      // Copied rich text: a page title (h1) becomes a section heading, h4–h6 small headings.
      transformPastedHTML: fitHtmlHeadings,
    },
    onUpdate: ({ editor: e }) => onChange(e.getJSON() as BlogDoc),
  })

  if (!editor) return <div className="min-h-[420px]" aria-busy="true" />

  return (
    <div className="relative">
      <Toolbar editor={editor} />
      <BubbleMenu
        editor={editor}
        options={{ placement: 'top', offset: 8 }}
        // Above the pinned toolbar when the selection is the first line under it.
        className="z-40"
        // Text selections only: images and other blocks have their own controls.
        shouldShow={({ editor: e, from, to }) => from !== to && !e.isActive('figure') && !e.isActive('imagePair') && e.view.hasFocus()}
      >
        <SelectionMenu editor={editor} />
      </BubbleMenu>
      <DragHandle editor={editor}>
        <span
          aria-label="Drag to move this block"
          title="Drag to move this block"
          className="mr-1 grid h-7 w-5 cursor-grab place-items-center rounded text-text-tertiary hover:bg-white/[0.06] hover:text-text-primary active:cursor-grabbing"
        >
          <DragIndicatorRounded sx={{ fontSize: 18 }} />
        </span>
      </DragHandle>
      <div className="pt-6 sm:pl-6">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

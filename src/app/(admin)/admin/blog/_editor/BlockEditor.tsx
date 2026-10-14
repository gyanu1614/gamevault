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

/**
 * The writing area uses the public article's own stylesheet (`.blog-prose`,
 * src/styles/blog-prose.css) — same font, sizes, spacing and colours — plus a
 * few editor-only bits: the empty-line hint and table cell selection.
 */
const PROSE =
  // No focus ring on the writing area itself: the caret is the cue, and the
  // site-wide ring drew a box around the whole post while typing.
  'blog-prose blog-type blog-editor min-h-[420px] pb-16 outline-none focus-visible:shadow-none ' +
  '[&_.selectedCell]:bg-white/[0.06] ' +
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
      // Keep the cursor clear of the pinned toolbar (admin header + two toolbar rows on
      // phones) and of the action bar at the bottom while typing.
      scrollThreshold: { top: 180, bottom: 110, left: 0, right: 0 },
      scrollMargin: { top: 180, bottom: 110, left: 0, right: 0 },
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
        // Typing a link address moves focus into the menu itself; it must stay open then.
        shouldShow={({ editor: e, element, from, to }) => {
          const inMenu = element.contains(document.activeElement)
          return from !== to && !e.isActive('figure') && !e.isActive('imagePair') && (e.view.hasFocus() || inMenu)
        }}
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
      {/* The article's reading column (820px) + the drag-handle gutter: lines wrap where readers' do. */}
      <div className="mx-auto max-w-[844px] pt-6 sm:pl-6">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

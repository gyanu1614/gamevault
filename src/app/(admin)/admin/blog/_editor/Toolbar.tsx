'use client'

/**
 * The editor's controls: a toolbar pinned above the text (works on touch,
 * where a "/" is awkward) and a small menu over selected text. Both edit the
 * same marks; links are typed in place (no browser prompt).
 */
import { useState, type ReactNode } from 'react'
import type { Editor } from '@tiptap/core'
import { useEditorState } from '@tiptap/react'
import FormatBoldRounded from '@mui/icons-material/FormatBoldRounded'
import FormatItalicRounded from '@mui/icons-material/FormatItalicRounded'
import LinkRounded from '@mui/icons-material/LinkRounded'
import FormatListBulletedRounded from '@mui/icons-material/FormatListBulletedRounded'
import FormatListNumberedRounded from '@mui/icons-material/FormatListNumberedRounded'
import UndoRounded from '@mui/icons-material/UndoRounded'
import RedoRounded from '@mui/icons-material/RedoRounded'
import AddRounded from '@mui/icons-material/AddRounded'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { SLASH_ITEMS } from './slash'

const btn = (on = false) =>
  cn(
    'inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-md px-2 text-[12.5px] font-medium transition-colors disabled:opacity-40',
    on ? 'bg-white/[0.14] text-text-primary' : 'text-text-secondary hover:bg-white/[0.06] hover:text-text-primary',
  )

function useMarks(editor: Editor) {
  return useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      link: e.isActive('link'),
      href: String(e.getAttributes('link').href ?? ''),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
      words: (e.storage as { characterCount?: { words: () => number } }).characterCount?.words() ?? 0,
    }),
  })
}

/** "dropmarket.gg/x" → https://…; "/mm2/values" stays a site path. */
export function normalizeHref(raw: string): string {
  const v = raw.trim()
  if (!v || v.startsWith('/') || v.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(v)) return v
  return `https://${v}`
}

function LinkField({ editor, href, onDone }: { editor: Editor; href: string; onDone: () => void }) {
  const [value, setValue] = useState(href)
  const apply = () => {
    const v = normalizeHref(value)
    const chain = editor.chain().focus().extendMarkRange('link')
    if (v) chain.setLink({ href: v }).run()
    else chain.unsetLink().run()
    onDone()
  }
  return (
    <form
      className="flex items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault()
        apply()
      }}
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onDone()}
        placeholder="/mm2/values or https://…"
        aria-label="Link address"
        className="h-8 w-56 rounded-md border border-white/[0.1] bg-[#141518] px-2.5 text-base text-text-primary outline-none placeholder:text-text-tertiary focus:border-white/25 sm:text-[13px]"
      />
      <button type="submit" className={btn()}>Apply</button>
      {href && (
        <button
          type="button"
          className={btn()}
          onClick={() => {
            editor.chain().focus().extendMarkRange('link').unsetLink().run()
            onDone()
          }}
        >
          Remove
        </button>
      )}
    </form>
  )
}

function Icon({ label, on, onClick, disabled, children }: { label: string; on?: boolean; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} aria-pressed={on} disabled={disabled} onClick={onClick} className={btn(on)}>
      {children}
    </button>
  )
}

/** Bold, italic, link + the heading levels — shared by the toolbar and the selection menu. */
function TextControls({ editor, onLink }: { editor: Editor; onLink: () => void }) {
  const s = useMarks(editor)
  const c = () => editor.chain().focus()
  return (
    <>
      <button type="button" className={btn(!s.h2 && !s.h3)} onClick={() => c().setParagraph().run()}>Text</button>
      <button type="button" className={btn(s.h2)} onClick={() => c().toggleHeading({ level: 2 }).run()}>Heading</button>
      <button type="button" className={btn(s.h3)} onClick={() => c().toggleHeading({ level: 3 }).run()}>Subheading</button>
      <span aria-hidden className="mx-1 h-5 w-px bg-white/[0.08]" />
      <Icon label="Bold" on={s.bold} onClick={() => c().toggleBold().run()}><FormatBoldRounded sx={{ fontSize: 18 }} /></Icon>
      <Icon label="Italic" on={s.italic} onClick={() => c().toggleItalic().run()}><FormatItalicRounded sx={{ fontSize: 18 }} /></Icon>
      <Icon label="Link" on={s.link} onClick={onLink}><LinkRounded sx={{ fontSize: 18 }} /></Icon>
    </>
  )
}

export function Toolbar({ editor }: { editor: Editor }) {
  const s = useMarks(editor)
  const [linking, setLinking] = useState(false)
  const c = () => editor.chain().focus()
  return (
    <div className="sticky top-16 z-20 -mx-4 flex min-h-12 flex-wrap items-center gap-0.5 border-b border-white/[0.06] bg-[#1D1E23] px-3 py-2 sm:-mx-6 sm:px-5">
      {linking ? (
        <LinkField editor={editor} href={s.href} onDone={() => setLinking(false)} />
      ) : (
        <>
          <TextControls editor={editor} onLink={() => setLinking(true)} />
          <Icon label="Bullet list" on={s.bullet} onClick={() => c().toggleBulletList().run()}><FormatListBulletedRounded sx={{ fontSize: 18 }} /></Icon>
          <Icon label="Numbered list" on={s.ordered} onClick={() => c().toggleOrderedList().run()}><FormatListNumberedRounded sx={{ fontSize: 18 }} /></Icon>
          <span aria-hidden className="mx-1 h-5 w-px bg-white/[0.08]" />
          <DropdownMenu>
            <DropdownMenuTrigger className={cn(btn(), 'bg-white/[0.06] text-text-primary')}>
              <AddRounded sx={{ fontSize: 17 }} />
              Insert
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-[60vh] w-64 overflow-y-auto">
              {SLASH_ITEMS.map((it) => (
                <DropdownMenuItem key={it.title} onSelect={() => it.run(editor.chain().focus())} className="flex-col items-start gap-0">
                  <span className="text-[13px] font-medium text-text-primary">{it.title}</span>
                  <span className="text-[11.5px] text-text-tertiary">{it.hint}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="ml-auto flex items-center gap-0.5">
            <Icon label="Undo" disabled={!s.canUndo} onClick={() => c().undo().run()}><UndoRounded sx={{ fontSize: 18 }} /></Icon>
            <Icon label="Redo" disabled={!s.canRedo} onClick={() => c().redo().run()}><RedoRounded sx={{ fontSize: 18 }} /></Icon>
            <span className="hidden pl-2 text-[12px] tabular-nums text-text-tertiary sm:inline">{s.words.toLocaleString('en-US')} words</span>
          </span>
        </>
      )}
    </div>
  )
}

/** The small menu over selected text. */
export function SelectionMenu({ editor }: { editor: Editor }) {
  const s = useMarks(editor)
  const [linking, setLinking] = useState(false)
  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-[#26272D] p-1 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.8)]">
      {linking ? (
        <LinkField editor={editor} href={s.href} onDone={() => setLinking(false)} />
      ) : (
        <TextControls editor={editor} onLink={() => setLinking(true)} />
      )}
    </div>
  )
}

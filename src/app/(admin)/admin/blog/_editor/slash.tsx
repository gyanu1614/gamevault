'use client'

/**
 * The "/" menu: type / on any line, pick a block. Arrow keys move, Enter
 * inserts, Esc closes. Built on @tiptap/suggestion (MIT) with our own list.
 */
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { Extension, type ChainedCommands, type Editor, type Range } from '@tiptap/core'
import Suggestion, { type SuggestionProps } from '@tiptap/suggestion'
import { ReactRenderer } from '@tiptap/react'
import { cn } from '@/lib/utils'

export interface SlashItem {
  title: string
  hint: string
  keywords?: string
  run: (chain: ChainedCommands) => void
}

export const SLASH_ITEMS: SlashItem[] = [
  { title: 'Heading', hint: 'A section (shows in the contents list)', keywords: 'h2 title section', run: (c) => c.setNode('heading', { level: 2 }).run() },
  { title: 'Small Heading', hint: 'A part inside a section', keywords: 'h3 subheading', run: (c) => c.setNode('heading', { level: 3 }).run() },
  { title: 'Bullet List', hint: 'Points in any order', keywords: 'ul list', run: (c) => c.toggleBulletList().run() },
  { title: 'Numbered List', hint: 'Steps in order', keywords: 'ol steps', run: (c) => c.toggleOrderedList().run() },
  { title: 'Image', hint: 'Upload a picture', keywords: 'photo picture screenshot', run: (c) => c.insertContent({ type: 'figure', attrs: { layout: 'column' } }).run() },
  { title: 'Two Images', hint: 'Side by side', keywords: 'pair gallery', run: (c) => c.insertContent({ type: 'imagePair' }).run() },
  { title: 'Table', hint: '3 × 3, first row is the header', keywords: 'grid', run: (c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { title: 'Tip Box', hint: 'Tip, warning, note or key takeaways', keywords: 'callout warning note takeaways', run: (c) => c.insertContent({ type: 'callout', attrs: { tone: 'tip' }, content: [{ type: 'paragraph' }] }).run() },
  { title: 'Item Card', hint: 'Live value and offers for an item', keywords: 'pet knife value price', run: (c) => c.insertContent({ type: 'itemCard' }).run() },
  { title: 'Codes Table', hint: 'Codes with copy buttons', keywords: 'redeem promo', run: (c) => c.insertContent({ type: 'codes', attrs: { rows: [{ code: '', reward: '', isNew: true }] } }).run() },
  { title: 'FAQ', hint: 'Questions and answers', keywords: 'questions', run: (c) => c.insertContent({ type: 'faq', attrs: { items: [{ q: '', a: '' }] } }).run() },
  { title: 'Button', hint: 'One link button', keywords: 'cta buy shop', run: (c) => c.insertContent({ type: 'cta', attrs: { label: 'Shop Now', href: '/' } }).run() },
  { title: 'YouTube', hint: 'A video, loads on click', keywords: 'video', run: (c) => c.insertContent({ type: 'youtube' }).run() },
  { title: 'Quote', hint: 'A highlighted quote', keywords: 'blockquote', run: (c) => c.toggleBlockquote().run() },
  { title: 'Divider', hint: 'A line between parts', keywords: 'hr rule', run: (c) => c.setHorizontalRule().run() },
]

type ListRef = { onKeyDown: (e: KeyboardEvent) => boolean }

const SlashList = forwardRef<ListRef, SuggestionProps<SlashItem>>(function SlashList({ items, command }, ref) {
  const [at, setAt] = useState(0)
  useEffect(() => setAt(0), [items])
  useImperativeHandle(ref, () => ({
    onKeyDown: (e) => {
      if (e.key === 'ArrowDown') return setAt((i) => (i + 1) % Math.max(items.length, 1)), true
      if (e.key === 'ArrowUp') return setAt((i) => (i - 1 + items.length) % Math.max(items.length, 1)), true
      if (e.key === 'Enter') {
        if (items[at]) command(items[at])
        return true
      }
      return false
    },
  }))
  if (items.length === 0) return <div className="rounded-lg bg-[#26272D] px-3 py-2 text-[12.5px] text-text-tertiary shadow-xl">No block matches</div>
  return (
    <div role="listbox" className="max-h-80 w-72 overflow-y-auto rounded-lg bg-[#26272D] p-1 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.8)]">
      {items.map((it, i) => (
        <button
          key={it.title}
          type="button"
          role="option"
          aria-selected={i === at}
          onMouseEnter={() => setAt(i)}
          onClick={() => command(it)}
          className={cn('flex w-full flex-col rounded-md px-2.5 py-1.5 text-left', i === at ? 'bg-white/[0.08]' : '')}
        >
          <span className="text-[13px] font-medium text-text-primary">{it.title}</span>
          <span className="text-[11.5px] text-text-tertiary">{it.hint}</span>
        </button>
      ))}
    </div>
  )
})

function place(el: HTMLElement, rect: DOMRect | null | undefined) {
  if (!rect) return
  el.style.position = 'fixed'
  el.style.zIndex = '80'
  el.style.left = `${Math.min(rect.left, window.innerWidth - 300)}px`
  const below = rect.bottom + 6
  el.style.top = below + 330 > window.innerHeight ? `${Math.max(8, rect.top - 336)}px` : `${below}px`
}

export const SlashCommand = Extension.create({
  name: 'slashCommand',
  addProseMirrorPlugins() {
    return [
      Suggestion<SlashItem, SlashItem>({
        editor: this.editor,
        char: '/',
        items: ({ query }) => {
          const q = query.toLowerCase()
          return SLASH_ITEMS.filter((i) => `${i.title} ${i.keywords ?? ''}`.toLowerCase().includes(q))
        },
        command: ({ editor, range, props }: { editor: Editor; range: Range; props: SlashItem }) => {
          props.run(editor.chain().focus().deleteRange(range))
        },
        render: () => {
          let r: ReactRenderer<ListRef, SuggestionProps<SlashItem>> | null = null
          return {
            onStart: (props) => {
              r = new ReactRenderer(SlashList, { props, editor: props.editor })
              document.body.appendChild(r.element)
              place(r.element as HTMLElement, props.clientRect?.())
            },
            onUpdate: (props) => {
              r?.updateProps(props)
              if (r) place(r.element as HTMLElement, props.clientRect?.())
            },
            onKeyDown: ({ event }) => {
              if (event.key === 'Escape') {
                r?.element.remove()
                r?.destroy()
                r = null
                return true
              }
              return r?.ref?.onKeyDown(event) ?? false
            },
            onExit: () => {
              r?.element.remove()
              r?.destroy()
              r = null
            },
          }
        },
      }),
    ]
  },
})

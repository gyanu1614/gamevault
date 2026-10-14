'use client'

/**
 * Text colour (owner, 2026-10-13: "highlight text and colour it using a
 * picker — we need a lot of colours, not just green"). Select text, open the
 * picker in the toolbar, tap a swatch or choose any colour. Works in table
 * cells too. Stored on the `textStyle` mark; the page shows hex colours only
 * (lib/blog/doc/color.ts).
 *
 * In the pinned toolbar only: the selection menu hides when focus leaves the
 * editor, which would close a popover opened from it. Commands run without
 * focusing the editor first (its selection stays in the editor state), so the
 * native colour dialog is not closed mid-drag.
 */
import { useState } from 'react'
import type { Editor } from '@tiptap/core'
import FormatColorTextRounded from '@mui/icons-material/FormatColorTextRounded'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { TEXT_COLORS, safeColor } from '@/lib/blog/doc/color'
import { cn } from '@/lib/utils'

const NO_SCROLL = { scrollIntoView: false }
const CHIP = 'h-8 rounded-md px-2 text-[12.5px] font-medium text-text-secondary transition-colors hover:bg-white/[0.08] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring'

export function ColorPicker({ editor, current, className }: { editor: Editor; current: string; className: string }) {
  const [open, setOpen] = useState(false)
  const active = safeColor(current)
  const set = (hex: string | null) => (hex ? editor.chain().setColor(hex) : editor.chain().unsetColor()).run()
  const pick = (hex: string | null) => {
    set(hex)
    setOpen(false)
    editor.commands.focus(undefined, NO_SCROLL)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger aria-label="Text colour" title="Text colour" className={className}>
        <span className="flex flex-col items-center leading-none">
          <FormatColorTextRounded sx={{ fontSize: 17 }} />
          {/* The bar under the "A" shows the colour at the cursor. */}
          <span aria-hidden className="mt-px h-[3px] w-4 rounded-full" style={{ background: active ?? 'currentColor' }} />
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="w-[236px] rounded-lg border-0 bg-[#26272D] p-3 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.8)]"
      >
        <p className="mb-2 text-[12px] font-semibold text-text-tertiary">Text Colour</p>
        <div className="grid grid-cols-6 gap-1.5">
          {TEXT_COLORS.map((c) => (
            <button
              key={c.hex}
              type="button"
              title={c.name}
              aria-label={c.name}
              aria-pressed={active === c.hex}
              onClick={() => pick(c.hex)}
              className={cn(
                'h-7 w-7 rounded-md transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring motion-reduce:transition-none motion-reduce:hover:scale-100',
                active === c.hex && 'ring-2 ring-white ring-offset-2 ring-offset-[#26272D]',
              )}
              style={{ background: c.hex }}
            />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-1.5">
          <label className={cn(CHIP, 'flex flex-1 cursor-pointer items-center gap-2 bg-white/[0.06] focus-within:ring-2 focus-within:ring-focus-ring')}>
            <input
              type="color"
              aria-label="Any colour"
              value={active && active.length === 7 ? active : '#ffffff'}
              onChange={(e) => set(e.target.value)}
              className="h-5 w-5 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
            />
            Any Colour
          </label>
          <button type="button" onClick={() => pick(null)} className={CHIP}>Remove</button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

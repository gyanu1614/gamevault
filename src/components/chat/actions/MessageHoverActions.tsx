'use client'

/**
 * Desktop message actions (mouse / trackpad): a small toolbar beside the
 * bubble while the row is hovered or focused. React (emoji row), Reply, and
 * ⋯ with the same actions plus Copy Text. Hidden on touch screens, where a
 * long-press opens MessageActionSheet instead.
 */

import { useState } from 'react'
import { SmileyIcon } from '@phosphor-icons/react/dist/csr/Smiley'
import { ArrowBendUpLeftIcon } from '@phosphor-icons/react/dist/csr/ArrowBendUpLeft'
import { DotsThreeIcon } from '@phosphor-icons/react/dist/csr/DotsThree'
import { CopyIcon } from '@phosphor-icons/react/dist/csr/Copy'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { ReactionPicker } from './ReactionPicker'

const ICON_BTN =
  'grid h-8 w-8 place-items-center rounded-md text-text-secondary transition-colors hover:bg-white/[0.08] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring data-[state=open]:bg-white/[0.08] data-[state=open]:text-text-primary'

export interface MessageActionHandlers {
  /** The viewer's reaction on this message, if any. */
  myReaction: string | null
  /** Null when reacting/replying isn't allowed here (read-only chat, unsent message). */
  onReact: ((emoji: string) => void) | null
  onReply: (() => void) | null
  /** Null when there is no text to copy (a file-only message). */
  onCopy: (() => void) | null
}

export function MessageHoverActions({
  side,
  myReaction,
  onReact,
  onReply,
  onCopy,
}: MessageActionHandlers & {
  /** Which side of the bubble the toolbar sits on. */
  side: 'left' | 'right'
}) {
  const [open, setOpen] = useState<'react' | 'more' | null>(null)
  if (!onReact && !onReply && !onCopy) return null

  return (
    <div
      className={cn(
        'pointer-events-none absolute top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-lg bg-[#24252B] p-0.5 opacity-0 shadow-[0_4px_14px_rgba(0,0,0,0.35)] transition-opacity duration-150',
        '[@media(hover:hover)_and_(pointer:fine)]:flex',
        'group-hover/msg:pointer-events-auto group-hover/msg:opacity-100 group-focus-within/msg:pointer-events-auto group-focus-within/msg:opacity-100',
        open && 'pointer-events-auto opacity-100',
        side === 'left' ? 'right-full mr-1.5' : 'left-full ml-1.5',
      )}
    >
      {onReact && (
        <Popover open={open === 'react'} onOpenChange={(o) => setOpen(o ? 'react' : null)}>
          <PopoverTrigger className={ICON_BTN} aria-label="React">
            <SmileyIcon className="h-[18px] w-[18px]" aria-hidden />
          </PopoverTrigger>
          <PopoverContent side="top" className="max-w-none rounded-full p-1">
            <ReactionPicker
              current={myReaction}
              onPick={(emoji) => {
                onReact(emoji)
                setOpen(null)
              }}
            />
          </PopoverContent>
        </Popover>
      )}
      {onReply && (
        <button type="button" className={ICON_BTN} aria-label="Reply" onClick={onReply}>
          <ArrowBendUpLeftIcon className="h-[18px] w-[18px]" aria-hidden />
        </button>
      )}
      <DropdownMenu open={open === 'more'} onOpenChange={(o) => setOpen(o ? 'more' : null)}>
        <DropdownMenuTrigger className={ICON_BTN} aria-label="More actions">
          <DotsThreeIcon className="h-[18px] w-[18px]" weight="bold" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align={side === 'left' ? 'end' : 'start'} className="min-w-[200px]">
          {onReact && (
            <>
              <ReactionPicker
                current={myReaction}
                className="justify-between px-1 py-0.5"
                onPick={(emoji) => {
                  onReact(emoji)
                  setOpen(null)
                }}
              />
              <DropdownMenuSeparator />
            </>
          )}
          {onReply && (
            <DropdownMenuItem onSelect={onReply} className="gap-2.5">
              <ArrowBendUpLeftIcon className="h-4 w-4" aria-hidden />
              Reply
            </DropdownMenuItem>
          )}
          {onCopy && (
            <DropdownMenuItem onSelect={onCopy} className="gap-2.5">
              <CopyIcon className="h-4 w-4" aria-hidden />
              Copy Text
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

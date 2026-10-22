'use client'

/**
 * Phone message actions: a bottom sheet opened by a long-press on a
 * message. The emoji row first (one tap reacts and closes), then Reply and
 * Copy Text as full-width rows with 48px targets. One sheet per thread,
 * owned by MessageList.
 */

import { Drawer } from 'vaul'
import { ArrowBendUpLeftIcon } from '@phosphor-icons/react/dist/csr/ArrowBendUpLeft'
import { CopyIcon } from '@phosphor-icons/react/dist/csr/Copy'
import { ReactionPicker } from './ReactionPicker'
import type { MessageActionHandlers } from './MessageHoverActions'

const ROW =
  'flex h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-[15px] font-medium text-text-primary transition-colors active:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring'

export function MessageActionSheet({
  open,
  onOpenChange,
  preview,
  myReaction,
  onReact,
  onReply,
  onCopy,
}: MessageActionHandlers & {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** One line of the message, so it's clear which one the sheet is for. */
  preview: { name: string; snippet: string } | null
}) {
  const close = () => onOpenChange(false)
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-[480px] flex-col rounded-t-lg bg-bg-raised pb-[max(12px,env(safe-area-inset-bottom))] text-text-primary shadow-elevated outline-none">
          <div aria-hidden className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-white/15" />
          <Drawer.Title className="sr-only">Message Actions</Drawer.Title>
          {preview && (
            <Drawer.Description className="mx-5 mt-3 line-clamp-2 text-[13px] leading-snug text-text-secondary">
              <span className="font-semibold text-text-primary">{preview.name}: </span>
              {preview.snippet}
            </Drawer.Description>
          )}
          {onReact && (
            <ReactionPicker
              size="lg"
              current={myReaction}
              className="mx-3 mt-3 justify-between rounded-full bg-white/[0.04] px-1.5 py-1"
              onPick={(emoji) => {
                onReact(emoji)
                close()
              }}
            />
          )}
          <div className="mt-2 px-2">
            {onReply && (
              <button
                type="button"
                className={ROW}
                onClick={() => {
                  onReply()
                  close()
                }}
              >
                <ArrowBendUpLeftIcon className="h-5 w-5 text-text-secondary" aria-hidden />
                Reply
              </button>
            )}
            {onCopy && (
              <button
                type="button"
                className={ROW}
                onClick={() => {
                  onCopy()
                  close()
                }}
              >
                <CopyIcon className="h-5 w-5 text-text-secondary" aria-hidden />
                Copy Text
              </button>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

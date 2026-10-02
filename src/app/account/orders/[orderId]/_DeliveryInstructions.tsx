'use client'

/**
 * DeliveryInstructions
 *
 * Buyer + admin: a compact row ("How To Receive Your Order", step count,
 * Action Needed while the order is still being delivered). Clicking it opens
 * a small popup with the seller's instructions in full, as numbered steps
 * when the seller wrote one per line.
 *
 * Seller: quiet single row (they authored the steps in the wizard) with an
 * Edit link.
 *
 * Empty: returns null so no empty card renders.
 */

import Link from '@/components/navigation/AppLink'
import { useMemo, useState } from 'react'
import { ChevronRight, Info, ListChecks, Pencil } from 'lucide-react'
import { OrderCard } from './_OrderCard'
import { OrderModal, modalButton } from './_OrderModal'

interface DeliveryInstructionsProps {
  role: 'buyer' | 'seller' | 'admin'
  /** The seller's instructions: listing.description (the listing page shows
   *  the same text under "Delivery Instructions"). There is no
   *  delivery_instructions column — reading one hid this card on every order. */
  instructions: string | null
  /** The order still needs delivering (paid / delivering): shows the
   *  "Action Needed" badge. Finished orders keep the text as a reference. */
  active?: boolean
  /** Used for the seller's "Edit" link target. */
  listingId?: string | null
}

export function DeliveryInstructions({
  role,
  instructions,
  listingId,
  active = false,
}: DeliveryInstructionsProps) {
  const trimmed = instructions?.trim() ?? ''

  // Split on newlines; each non-empty line becomes a numbered step.
  // If the seller didn't break it into lines, render as a single para.
  // Runs before the empty-state return — hooks must stay unconditional.
  const steps = useMemo(() => {
    const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    return lines.length > 1 ? lines : null
  }, [trimmed])

  if (!trimmed) return null

  if (role === 'seller') {
    return (
      <OrderCard className="flex items-center justify-between gap-3 px-4 py-3" padded={false}>
        <div className="flex items-center gap-3 text-[12.5px] text-text-secondary">
          <Info className="h-4 w-4 text-text-tertiary" />
          Your Delivery Instructions ·{' '}
          {steps ? `${steps.length} Steps` : 'Shown To The Buyer'}
        </div>
        {listingId && (
          <Link
            href={`/sell/edit/${listingId}`}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-lime-text hover:underline"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Link>
        )}
      </OrderCard>
    )
  }

  // Buyer + admin view
  return <BuyerInstructionsRow steps={steps} text={trimmed} active={active} />
}

function BuyerInstructionsRow({
  steps,
  text,
  active,
}: {
  steps: string[] | null
  text: string
  active: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <OrderCard padded={false}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className="flex w-full items-center gap-3 rounded-lg px-5 py-4 text-left transition-colors hover:bg-white/[0.02] max-sm:rounded-none"
        >
          <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-[9px] bg-lime-tint-bg text-lime-text">
            <ListChecks className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block text-body-sm font-bold text-text-primary">How To Receive Your Order</span>
            <span className="mt-0.5 block text-[12.5px] text-text-secondary">
              {steps ? `${steps.length} steps from the seller` : 'Instructions from the seller'}
            </span>
          </span>
          {active && (
            <span className="flex-shrink-0 rounded-[7px] border border-lime-tint-border px-2 py-0.5 text-label font-bold text-lime-text">
              Action Needed
            </span>
          )}
          <ChevronRight className="h-4 w-4 flex-shrink-0 text-text-tertiary" aria-hidden />
        </button>
      </OrderCard>
      <OrderModal
        open={open}
        onOpenChange={setOpen}
        icon={ListChecks}
        title="How To Receive Your Order"
        description="Follow the seller's steps, then check your order arrived."
        footer={
          <button type="button" onClick={() => setOpen(false)} className={modalButton('primary')}>
            Got It
          </button>
        }
      >
        <div className="mt-3.5">
          <InstructionsBody steps={steps} text={text} />
        </div>
      </OrderModal>
    </>
  )
}

/** The popup body: the seller's steps in full (exported for tests; the
 *  dialog itself only renders once opened). */
export function InstructionsBody({ steps, text }: { steps: string[] | null; text: string }) {
  return (
    <div className="max-h-[55vh] overflow-y-auto rounded-[10px] border border-border-subtle bg-white/[0.02] px-4 py-3.5">
      {steps ? (
        <ol className="flex flex-col gap-2.5">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-2.5 text-body-sm leading-[1.5] text-text-secondary">
              <span className="font-bold tabular-nums text-lime-text">{i + 1}.</span>
              <span className="min-w-0 break-words">{step}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="whitespace-pre-line break-words text-body-sm leading-[1.55] text-text-secondary">{text}</p>
      )}
    </div>
  )
}

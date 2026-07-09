'use client'

/**
 * DeliveryInstructions — V21/P6
 *
 * Buyer view: prominent lime-tinted panel with numbered steps. Renders
 * the seller's delivery instructions verbatim (plain text for now, can
 * upgrade to markdown later if sellers ask). Collapses to 5 lines with
 * a "View More" toggle when long.
 *
 * Seller view: quiet single-row card so they don't dwell on it (they
 * already authored these steps in the wizard). Links to edit.
 *
 * Empty: returns null so we don't render an empty card.
 */

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Info, Pencil } from 'lucide-react'
import { OrderCard } from './_OrderCard'
import { cn } from '@/lib/utils'

interface DeliveryInstructionsProps {
  role: 'buyer' | 'seller' | 'admin'
  /** Raw text from listing.delivery_instructions. */
  instructions: string | null
  /** Used for the seller's "Edit" link target. */
  listingId?: string | null
}

export function DeliveryInstructions({
  role,
  instructions,
  listingId,
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
  return (
    <OrderCard variant="lime" className="px-5 py-4" padded={false}>
      <div className="mb-3 flex items-center gap-2.5">
        <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-[7px] bg-lime/[0.16] text-lime-text">
          <Info className="h-3.5 w-3.5" />
        </span>
        <span className="text-[13.5px] font-bold tracking-tight text-text-primary">
          How To Receive Your Order
        </span>
        <span className="ml-auto rounded-[7px] border border-lime/30 px-2 py-0.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-lime-text">
          Action Needed
        </span>
      </div>
      {steps ? (
        <StepsList steps={steps} />
      ) : (
        <Paragraph text={trimmed} />
      )}
    </OrderCard>
  )
}

function StepsList({ steps }: { steps: string[] }) {
  const [expanded, setExpanded] = useState(false)
  const showToggle = steps.length > 5
  const visible = expanded || !showToggle ? steps : steps.slice(0, 5)
  return (
    <>
      <ol className="flex flex-col gap-2.5">
        {visible.map((step, i) => (
          <li
            key={i}
            className="flex gap-2.5 text-[13px] leading-[1.5] text-text-secondary"
          >
            <span className="font-bold text-lime-text">{i + 1}.</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      {showToggle && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            'mt-2.5 text-[12px] font-semibold text-lime-text transition-colors',
            'hover:text-lime',
          )}
        >
          {expanded ? 'View Less' : `View ${steps.length - 5} More`}
        </button>
      )}
    </>
  )
}

function Paragraph({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = text.length > 220
  return (
    <>
      <p
        className={cn(
          'whitespace-pre-line text-[13px] leading-[1.55] text-text-secondary',
          !expanded && isLong && 'line-clamp-5',
        )}
      >
        {text}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2.5 text-[12px] font-semibold text-lime-text transition-colors hover:text-lime"
        >
          {expanded ? 'View Less' : 'View More'}
        </button>
      )}
    </>
  )
}

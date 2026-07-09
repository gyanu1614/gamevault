'use client'

/**
 * ActionPanel — V21/P4
 *
 * Role + state driven action surface in the right rail. Renders:
 * - A primary CTA that flips on tap to reveal a confirmation face
 *   (handoff specifies hover-flip for demo; production uses click/tap
 *   so it works on touch and we honor prefers-reduced-motion)
 * - Two secondary tiles below for the alternate actions per state
 *
 * For the buyer/delivering state the primary CTA stays disabled
 * (delivery hasn't arrived yet); the panel still renders so the
 * user can see what's coming. Once status → 'delivered' the CTA
 * activates.
 *
 * Action wiring (open dispute, mark received, leave review, etc.)
 * is stubbed with TODO comments and will be wired in P4.b — the
 * shapes match the existing server actions in @/lib/actions/orders.
 */

import { useMemo, useState } from 'react'
import {
  CheckCircle2,
  AlertTriangle,
  Star,
  Zap,
  ChevronRight,
  Lock,
} from 'lucide-react'
import { OrderCard } from './_OrderCard'
import { cn } from '@/lib/utils'

type Role = 'buyer' | 'seller' | 'admin'

interface ActionPanelProps {
  role: Role
  status: string
  /** Amount that will be released — interpolated into the confirm face. */
  releaseAmount: number
  /** Whether the primary CTA is enabled. Buyer waits until `delivered`,
   *  seller is always active during paid/delivering. Disabled CTAs still
   *  render so the user knows what's coming. */
  primaryEnabled: boolean
  /** Optional href when an action navigates instead of mutating. */
  disputeHref?: string
}

interface CTAConfig {
  /** Title block shown on the panel above the primary CTA. */
  title: string
  /** Front face button label. */
  primaryLabel: string
  /** Back face confirm label (after the flip). */
  confirmLabel: string
  /** Front face icon. */
  PrimaryIcon: React.ComponentType<{ className?: string }>
  /** Subtle caption above the tiles. */
  hint?: string
  /** Two secondary tiles below. */
  tiles: Array<{
    Icon: React.ComponentType<{ className?: string }>
    label: string
    caption: string
    tone: 'red' | 'lime' | 'amber' | 'neutral'
    disabled?: boolean
    onClick?: () => void
    href?: string
  }>
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`
}

export function ActionPanel({
  role,
  status,
  releaseAmount,
  primaryEnabled,
  disputeHref = '#',
}: ActionPanelProps) {
  const cfg = useMemo<CTAConfig | null>(() => buildCfg(role, status, releaseAmount, disputeHref), [
    role,
    status,
    releaseAmount,
    disputeHref,
  ])

  if (!cfg) return null

  return (
    <OrderCard className="px-5 pb-5 pt-4">
      <div className="mb-3 inline-flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-lime-text">
        <Zap className="h-3 w-3" />
        {cfg.title}
      </div>
      <FlipPrimary
        label={cfg.primaryLabel}
        confirmLabel={cfg.confirmLabel}
        Icon={cfg.PrimaryIcon}
        disabled={!primaryEnabled}
      />
      {cfg.hint && (
        <p className="mt-2 text-center text-[11px] text-text-tertiary">{cfg.hint}</p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {cfg.tiles.map((t, i) => (
          <Tile key={i} {...t} />
        ))}
      </div>
    </OrderCard>
  )
}

/* ────────────────────────────────────────────────────────────
   FLIP CARD PRIMARY CTA — click/tap to reveal confirmation
   ──────────────────────────────────────────────────────────── */

function FlipPrimary({
  label,
  confirmLabel,
  Icon,
  disabled,
}: {
  label: string
  confirmLabel: string
  Icon: React.ComponentType<{ className?: string }>
  disabled: boolean
}) {
  const [flipped, setFlipped] = useState(false)
  if (disabled) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-[12px] border border-white/[0.08] bg-white/[0.03] text-[14px] font-bold text-text-tertiary"
      >
        <Lock className="h-4 w-4" />
        {label}
      </button>
    )
  }
  return (
    <div className="[perspective:1200px]">
      <div
        className={cn(
          'relative h-[52px] [transform-style:preserve-3d] transition-transform duration-500 motion-reduce:transition-none',
          flipped ? '[transform:rotateY(180deg)]' : '',
        )}
      >
        {/* FRONT */}
        <button
          type="button"
          onClick={() => setFlipped(true)}
          className="absolute inset-0 inline-flex items-center justify-center gap-2 rounded-[12px] bg-lime text-[14px] font-bold text-text-inverse shadow-[0_6px_22px_rgba(198,255,61,0.18)] transition-transform [backface-visibility:hidden] hover:-translate-y-[1px]"
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
        {/* BACK */}
        <button
          type="button"
          onClick={() => {
            // TODO V21/P4.b — wire to confirmReceipt / markAsDelivered server action
            setFlipped(false)
          }}
          className="absolute inset-0 inline-flex items-center justify-center gap-2 rounded-[12px] bg-[#dff58a] text-[13px] font-bold text-text-inverse shadow-[0_6px_22px_rgba(198,255,61,0.18)] transition-transform [backface-visibility:hidden] [transform:rotateY(180deg)] hover:-translate-y-[1px]"
        >
          {confirmLabel}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
   SECONDARY TILE — icon + label + caption, hover lifts
   ──────────────────────────────────────────────────────────── */

function Tile({
  Icon,
  label,
  caption,
  tone,
  disabled,
  onClick,
  href,
}: CTAConfig['tiles'][number]) {
  const toneClass =
    tone === 'red'
      ? 'text-red-400 bg-red-400/[0.10]'
      : tone === 'lime'
      ? 'text-lime-text bg-lime/[0.12]'
      : tone === 'amber'
      ? 'text-amber bg-amber/[0.10]'
      : 'text-text-secondary bg-white/[0.05]'

  const innerCommon = (
    <>
      <span className={cn('grid h-8 w-8 place-items-center rounded-[9px]', toneClass)}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="block">
        <span className="block text-[12.5px] font-semibold text-text-primary">{label}</span>
        <span className="mt-0.5 block text-[10.5px] text-text-tertiary">{caption}</span>
      </span>
    </>
  )

  const outerCommon = cn(
    'group flex flex-col gap-2 rounded-[12px] border border-white/[0.09] card-frost p-3 text-left transition-all',
    disabled
      ? 'cursor-not-allowed opacity-50'
      : 'cursor-pointer hover:-translate-y-[2px] hover:border-white/[0.20] hover:card-frost',
  )

  if (href && !disabled) {
    return (
      <a href={href} className={outerCommon}>
        {innerCommon}
      </a>
    )
  }
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={outerCommon}>
      {innerCommon}
    </button>
  )
}

/* ────────────────────────────────────────────────────────────
   PER (role × status) CTA CONFIG
   ──────────────────────────────────────────────────────────── */

function buildCfg(
  role: Role,
  status: string,
  releaseAmount: number,
  disputeHref: string,
): CTAConfig | null {
  if (role === 'buyer') {
    if (status === 'paid' || status === 'delivering') {
      return {
        title: 'Your Actions',
        primaryLabel: 'Mark As Received',
        confirmLabel: `Confirm — Release ${fmtUsd(releaseAmount)} →`,
        PrimaryIcon: CheckCircle2,
        hint: 'Available once the seller marks delivered',
        tiles: [
          { Icon: AlertTriangle, label: 'Open Dispute', caption: 'Something Wrong?', tone: 'red', href: disputeHref },
          { Icon: Star, label: 'Leave Review', caption: 'After Completion', tone: 'neutral', disabled: true },
        ],
      }
    }
    if (status === 'delivered') {
      return {
        title: 'Your Actions',
        primaryLabel: 'Mark As Received',
        confirmLabel: `Confirm — Release ${fmtUsd(releaseAmount)} →`,
        PrimaryIcon: CheckCircle2,
        tiles: [
          { Icon: AlertTriangle, label: 'Open Dispute', caption: 'Something Wrong?', tone: 'red', href: disputeHref },
          { Icon: Star, label: 'Leave Review', caption: 'After Completion', tone: 'neutral', disabled: true },
        ],
      }
    }
    if (status === 'completed') {
      return {
        title: 'Your Actions',
        primaryLabel: 'Leave A Review',
        confirmLabel: 'Open Review Form →',
        PrimaryIcon: Star,
        tiles: [
          { Icon: AlertTriangle, label: 'Report Issue', caption: 'Within 30 Days', tone: 'red', href: disputeHref },
          { Icon: CheckCircle2, label: 'View Receipt', caption: 'Download PDF', tone: 'neutral' },
        ],
      }
    }
    return null
  }

  // V21/P4.d — Seller branch removed. Seller's only action (Mark As
  // Delivered) lives inline in the status strip; opening the modal is
  // wired in _OrderClient.tsx. Keeping the panel buyer + admin only.
  return null
}

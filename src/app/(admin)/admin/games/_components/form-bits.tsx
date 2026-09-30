'use client'

/**
 * Shared pieces for the game config forms (Accounts, Boosting, SEO, …):
 * a titled card, an on/off row, the sticky save bar and a loading
 * skeleton. Flat fills only, no outlines — same kit as the rest of /admin.
 */

import { FloppyDisk, CircleNotch } from '@phosphor-icons/react'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { PanelHead, adminBtn } from '../../components/kit'

export const FIELD_LABEL = 'mb-1.5 block text-[13px] font-medium text-text-secondary'

export function FormSection({
  title,
  subtitle,
  aside,
  children,
  className,
}: {
  title: string
  subtitle?: React.ReactNode
  aside?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-lg bg-bg-raised p-4 sm:p-5', className)}>
      <PanelHead title={title} subtitle={subtitle} aside={aside} />
      {children}
    </section>
  )
}

/** A labelled on/off row on a card: title + hint on the left, a Switch on the right. */
export function SwitchRow({
  label,
  hint,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string
  hint?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-md bg-bg-overlay px-3.5 py-3 transition-colors hover:bg-bg-overlay-2">
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-semibold text-text-primary">{label}</span>
        {hint && <span className="mt-0.5 block text-[12px] leading-relaxed text-text-tertiary">{hint}</span>}
      </span>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={label}
        className="data-[state=unchecked]:bg-white/[0.12]"
      />
    </label>
  )
}

/** The form's save button, floating at the bottom right while the form scrolls. */
export function SaveBar({ label, pending, note }: { label: string; pending: boolean; note?: React.ReactNode }) {
  return (
    <div className="pointer-events-none sticky bottom-4 z-10 flex justify-end">
      <div className="pointer-events-auto flex w-full items-center gap-3 rounded-lg bg-bg-overlay-2 p-2 sm:w-auto">
        {note && <p className="min-w-0 truncate pl-2 text-[12.5px] text-text-tertiary">{note}</p>}
        <button type="submit" disabled={pending} className={cn(adminBtn.primary, 'w-full sm:w-auto')}>
          {pending ? (
            <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
          ) : (
            <FloppyDisk aria-hidden weight="bold" className="h-4 w-4" />
          )}
          {label}
        </button>
      </div>
    </div>
  )
}

/** Placeholder while a config loads: `cards` titled cards with a few rows. */
export function FormLoading({ cards = 3 }: { cards?: number }) {
  return (
    <div className="space-y-4" aria-busy aria-label="Loading">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="rounded-lg bg-bg-raised p-4 sm:p-5">
          <div className="skeleton h-4 w-40 rounded" />
          <div className="skeleton mt-2 h-3 w-64 max-w-full rounded" />
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="skeleton h-14 rounded-md" />
            <div className="skeleton h-14 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  )
}

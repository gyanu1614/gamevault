'use client'

/**
 * Shared pieces for the /founding checklist: field wrapper, step body
 * (the content of the one open checklist row), the footer actions. Dark site
 * theme (card-surface tokens), Inter, Title Case labels; inputs are 16px on
 * phones so iOS never zooms. Focus = the neutral near-white ring tokens.
 */
import * as React from 'react'
import { CircleNotch } from '@phosphor-icons/react/dist/ssr/CircleNotch'
import { cn } from '@/lib/utils'

export const INPUT_CLS =
  'h-11 w-full rounded-md border border-border-default bg-bg-overlay px-3.5 text-[16px] text-text-primary placeholder:text-text-tertiary transition-colors ' +
  'hover:border-border-strong focus:border-focus-border focus:outline-none focus:ring-2 focus:ring-focus-soft sm:h-10 sm:text-body-sm ' +
  'disabled:cursor-not-allowed disabled:opacity-60'

export function Field({
  label,
  hint,
  error,
  optional,
  htmlFor,
  children,
  className,
}: {
  label: string
  hint?: React.ReactNode
  error?: string | null
  optional?: boolean
  htmlFor?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-body-sm font-medium text-text-primary">
          {label}
        </label>
        {optional && <span className="text-caption text-text-tertiary">Optional</span>}
      </div>
      {children}
      {error ? (
        <p role="alert" className="mt-1.5 text-caption text-error">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-caption font-normal text-text-tertiary">{hint}</p>
      ) : null}
    </div>
  )
}

/**
 * The body of the open checklist row. The row header already shows the
 * step's name, so the title here is for screen readers only; `lead` is the
 * one line of plain guidance under it.
 */
export function StepCard({
  title,
  lead,
  children,
}: {
  title: string
  lead?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section aria-label={title}>
      {lead && <p className="text-body-sm leading-relaxed text-text-secondary">{lead}</p>}
      <div className={lead ? 'mt-5' : ''}>{children}</div>
    </section>
  )
}

export function PrimaryButton({
  children,
  busy,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return (
    <button
      type="submit"
      {...rest}
      disabled={rest.disabled || busy}
      className={cn(
        'inline-flex h-11 min-w-[160px] items-center justify-center gap-2 rounded-md bg-white px-5 text-body-sm font-semibold text-black transition-[background-color,transform] hover:bg-white/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50 sm:h-10',
        className,
      )}
    >
      {busy && <CircleNotch className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

export function GhostButton({ children, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        'inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 text-body-sm font-medium text-text-secondary transition-colors hover:bg-white/[0.06] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-50 sm:h-10',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-md bg-error-bg px-3 py-2.5 text-body-sm text-text-primary">
      {message}
    </p>
  )
}

/** The footer of every step: Back on the left, the one primary action on the right. */
export function StepActions({
  onBack,
  backLabel = 'Back',
  children,
}: {
  onBack?: () => void
  backLabel?: string
  children: React.ReactNode
}) {
  return (
    <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>{onBack && <GhostButton onClick={onBack} className="w-full sm:w-auto">{backLabel}</GhostButton>}</div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">{children}</div>
    </div>
  )
}

'use client'

/**
 * Six-box one-time code field (authenticator / TOTP codes).
 *
 * Built on `input-otp`: one real, invisible <input> sits over the boxes, so
 * paste, iOS/Android code autofill ("From Messages"), password managers and
 * screen readers all see a normal field. Its font size tracks the box height
 * (48px+), so iOS Safari never zooms on focus.
 *
 * Fill-only boxes (no outline); the active box gets the neutral focus ring
 * (focus states are never lime). `invalid` tints the boxes and shakes the
 * row once, for a wrong code.
 */

import { forwardRef, useEffect } from 'react'
import { OTPInput, REGEXP_ONLY_DIGITS, type SlotProps } from 'input-otp'
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface CodeInputProps {
  value: string
  onChange: (value: string) => void
  /** Fires once when the last digit lands (e.g. to submit). */
  onComplete?: (value: string) => void
  length?: number
  disabled?: boolean
  autoFocus?: boolean
  /** Wrong code: error tint + one shake. Bump `invalidKey` to shake again. */
  invalid?: boolean
  invalidKey?: number
  'aria-label'?: string
  className?: string
}

export const CodeInput = forwardRef<HTMLInputElement, CodeInputProps>(function CodeInput(
  {
    value,
    onChange,
    onComplete,
    length = 6,
    disabled,
    autoFocus,
    invalid,
    invalidKey = 0,
    'aria-label': ariaLabel = 'Verification code',
    className,
  },
  ref,
) {
  const reduceMotion = useReducedMotion()
  // Shake through animation controls, never a `key` change: remounting the
  // field would drop focus and reset input-otp's completion tracking.
  const controls = useAnimationControls()
  useEffect(() => {
    if (!invalid || reduceMotion) return
    void controls.start({ x: [0, -8, 8, -5, 5, 0], transition: { duration: 0.36, ease: 'easeOut' } })
    // Shake once per failed attempt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invalidKey])
  return (
    <motion.div animate={controls} className={className}>
      <OTPInput
        ref={ref}
        value={value}
        onChange={onChange}
        onComplete={onComplete}
        maxLength={length}
        pattern={REGEXP_ONLY_DIGITS}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus={autoFocus}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        containerClassName="group flex w-full items-center justify-between gap-2 has-[:disabled]:opacity-60"
        render={({ slots }) => (
          <>
            {slots.map((slot, i) => (
              <Slot key={i} {...slot} invalid={invalid} />
            ))}
          </>
        )}
      />
    </motion.div>
  )
})

function Slot({ char, isActive, hasFakeCaret, invalid }: SlotProps & { invalid?: boolean }) {
  return (
    <div
      className={cn(
        'relative flex h-14 min-w-0 flex-1 items-center justify-center rounded-md bg-bg-overlay',
        'text-[22px] font-semibold tabular-nums text-text-primary transition-[background-color,box-shadow] duration-150',
        isActive && 'bg-bg-overlay-2 ring-2 ring-focus-soft',
        invalid && 'bg-[color-mix(in_srgb,var(--color-error)_10%,transparent)] text-error',
      )}
    >
      {char}
      {hasFakeCaret && (
        <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="h-6 w-px animate-caret-blink bg-text-primary" />
        </span>
      )}
    </div>
  )
}

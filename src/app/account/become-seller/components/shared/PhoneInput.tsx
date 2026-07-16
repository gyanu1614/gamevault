/**
 * PhoneInput — international phone input.
 *
 * Country calling-code combobox (full country dataset) + national number
 * field. Emits a single E.164 string (`+14155550123`) and validates syntax
 * with libphonenumber-js as the user types.
 */

'use client'

import * as React from 'react'
import { parsePhoneNumberFromString, AsYouType, type CountryCode } from 'libphonenumber-js'
import { Check } from 'lucide-react'
import { Combobox } from '@/components/ui/combobox'
import { cn } from '@/lib/utils'
import { COUNTRIES } from '../../data/countries'

interface PhoneInputProps {
  /** E.164 value, e.g. +14155550123 (empty string when unset). */
  value: string
  onChange: (e164: string) => void
  /** External invalid state (e.g. from schema errors). */
  invalid?: boolean
  /** Preselect the calling code from a country name (Step 2 country field). */
  defaultCountryName?: string
  id?: string
}

const CODE_OPTIONS = COUNTRIES.map((c) => ({
  value: c.iso2,
  label: `${c.name} (+${c.callingCode})`,
  keywords: [`+${c.callingCode}`, c.callingCode],
}))

export default function PhoneInput({
  value,
  onChange,
  invalid,
  defaultCountryName,
  id,
}: PhoneInputProps) {
  // Derive initial country + national number from an existing E.164 value
  const parsed = React.useMemo(
    () => (value ? parsePhoneNumberFromString(value) : undefined),
    // Only parse the incoming value on mount / external resets
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const defaultIso2 =
    parsed?.country ??
    COUNTRIES.find((c) => c.name === defaultCountryName)?.iso2 ??
    'US'

  const [iso2, setIso2] = React.useState<string>(defaultIso2)
  const [national, setNational] = React.useState<string>(parsed?.nationalNumber?.toString() ?? '')

  const country = COUNTRIES.find((c) => c.iso2 === iso2)
  const callingCode = country?.callingCode ?? '1'

  const emit = React.useCallback(
    (nextIso2: string, nextNational: string) => {
      const code = COUNTRIES.find((c) => c.iso2 === nextIso2)?.callingCode ?? '1'
      const digits = nextNational.replace(/\D/g, '')
      onChange(digits ? `+${code}${digits}` : '')
    },
    [onChange]
  )

  const isValid = React.useMemo(() => {
    if (!national.trim()) return false
    const digits = national.replace(/\D/g, '')
    return parsePhoneNumberFromString(`+${callingCode}${digits}`)?.isValid() === true
  }, [national, callingCode])

  // Pretty national formatting as the user types (e.g. (415) 555-0123)
  const formatted = React.useMemo(() => {
    const digits = national.replace(/\D/g, '')
    if (!digits) return ''
    return new AsYouType(iso2 as CountryCode).input(digits)
  }, [national, iso2])

  return (
    <div>
      <div className="flex gap-2">
        <Combobox
          value={iso2}
          onChange={(v) => {
            setIso2(v)
            emit(v, national)
          }}
          options={CODE_OPTIONS}
          placeholder="Code"
          ariaLabel="Country calling code"
          className="h-[42px] w-32 flex-shrink-0 sm:w-36"
          invalid={invalid}
        />
        <div className="relative min-w-0 flex-1">
          <input
            id={id}
            type="tel"
            inputMode="tel"
            value={formatted}
            onChange={(e) => {
              const next = e.target.value
              setNational(next)
              emit(iso2, next)
            }}
            placeholder="Phone number"
            aria-invalid={invalid || undefined}
            className={cn(
              'w-full rounded-md border bg-transparent px-3 py-2.5 pr-9 text-xs text-white placeholder:text-text-tertiary transition-colors focus:outline-none sm:text-sm',
              invalid
                ? 'border-error ring-2 ring-error-bg'
                : 'border-border-default hover:border-border-strong focus:border-lime-tint-border focus:ring-1 focus:ring-lime/30'
            )}
          />
          {isValid && (
            <Check
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lime-text"
              strokeWidth={3}
            />
          )}
        </div>
      </div>
      <p className="mt-1 text-[10px] text-text-tertiary">
        Includes country code +{callingCode}
        {national.trim() && !isValid && (
          <span className="ml-1.5 text-error">— number looks incomplete for {country?.name ?? 'this country'}</span>
        )}
      </p>
    </div>
  )
}

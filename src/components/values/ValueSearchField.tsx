'use client'

import { MagnifyingGlassIcon } from '@phosphor-icons/react/dist/csr/MagnifyingGlass'
import { VALUE_FIELD } from './styles'

/** Search box for value lists / pickers. 16px text on phones (no iOS zoom). */
export function ValueSearchField({
  value,
  onChange,
  placeholder,
  label,
  className = '',
  autoFocus = false,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  label: string
  className?: string
  autoFocus?: boolean
}) {
  return (
    <div className={`relative ${className}`}>
      <MagnifyingGlassIcon
        aria-hidden
        size={18}
        weight="bold"
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        autoFocus={autoFocus}
        spellCheck={false}
        autoComplete="off"
        className={`h-12 w-full pl-11 pr-3 text-base placeholder:text-text-disabled sm:text-body [&::-webkit-search-cancel-button]:hidden ${VALUE_FIELD}`}
      />
    </div>
  )
}

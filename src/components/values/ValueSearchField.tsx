'use client'

import { MagnifyingGlassIcon } from '@phosphor-icons/react/dist/csr/MagnifyingGlass'
import { XIcon } from '@phosphor-icons/react/dist/csr/X'
import { VALUE_FIELD } from './styles'

/** Search box for value lists / pickers. 16px text on phones (no iOS zoom).
 *  `clearable` shows an ✕ button while there is text. */
export function ValueSearchField({
  value,
  onChange,
  placeholder,
  label,
  className = '',
  autoFocus = false,
  clearable = false,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  label: string
  className?: string
  autoFocus?: boolean
  clearable?: boolean
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
        className={`h-12 w-full pl-11 ${clearable ? 'pr-11' : 'pr-3'} text-base placeholder:text-text-disabled sm:text-body [&::-webkit-search-cancel-button]:hidden ${VALUE_FIELD}`}
      />
      {clearable && value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-white/[0.06] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <XIcon size={15} weight="bold" aria-hidden />
        </button>
      )}
    </div>
  )
}

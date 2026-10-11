'use client'

import { useState } from 'react'
import { Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Combobox } from '@/components/ui/combobox'
import { type Attribute } from '@/lib/actions/new-schema'
import { inputCls } from '@/app/(sell)/_components/sell-wizard/styles'
import { FieldError, TipBox } from '@/app/(sell)/_components/sell-wizard/ui/form-fields'

/** Admin placeholders like "Choose.." / "Select…" say nothing; name the field instead ("Choose Item Type"). */
const GENERIC_PLACEHOLDER = /^\s*(choose|select|pick)\s*(an?|one)?\s*[.…]*\s*$/i
function selectPlaceholder(a: Attribute): string {
  const own = a.placeholder?.trim()
  return own && !GENERIC_PLACEHOLDER.test(own) ? own : `Choose ${a.name}`
}

export function PillRow<T extends { value: string; label: string }>({
  options, value, onChange,
}: {
  options: T[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              'h-9 rounded-full border px-3 text-xs font-medium transition-colors sm:h-8',
              on
                ? 'border-lime-tint-border bg-lime-tint-bg text-lime-text'
                : 'border-border-default bg-bg-raised text-text-secondary hover:text-text-primary'
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── FieldInput: renders the right control for the attribute type ──────────

export function FieldInput({
  attribute, value, onChange,
}: {
  attribute: Attribute
  value: unknown
  onChange: (v: unknown) => void
}) {
  const v = value as any

  // R14 — per-field touched state so required attributes show "required" only
  // after the user has interacted and moved on (not on first paint).
  const [touched, setTouched] = useState(false)
  const isEmpty =
    v === undefined ||
    v === null ||
    v === '' ||
    (Array.isArray(v) && v.length === 0)
  const showError = attribute.is_required && touched && isEmpty
  const markTouched = () => setTouched(true)

  return (
    <div>
      <label className="mb-1.5 block">
        <span className="text-[13px] font-medium text-text-secondary">
          {attribute.name}
          {attribute.is_required && <span className="ml-1 text-error">*</span>}
        </span>
      </label>

      {attribute.type === 'text' && (
        <input
          value={v ?? ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={markTouched}
          placeholder={attribute.placeholder ?? ''}
          maxLength={attribute.max_length ?? undefined}
          aria-invalid={showError || undefined}
          aria-required={attribute.is_required || undefined}
          className={inputCls}
        />
      )}

      {attribute.type === 'textarea' && (
        <textarea
          value={v ?? ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={markTouched}
          placeholder={attribute.placeholder ?? ''}
          maxLength={attribute.max_length ?? undefined}
          rows={3}
          aria-invalid={showError || undefined}
          aria-required={attribute.is_required || undefined}
          className={cn(inputCls, 'h-auto py-2 sm:h-auto')}
        />
      )}

      {attribute.type === 'number' && (
        <input
          type="number"
          value={v ?? ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={markTouched}
          placeholder={attribute.placeholder ?? ''}
          min={attribute.min_value ?? undefined}
          max={attribute.max_value ?? undefined}
          aria-invalid={showError || undefined}
          aria-required={attribute.is_required || undefined}
          className={inputCls}
        />
      )}

      {attribute.type === 'boolean' && (
        <div className="flex gap-2">
          {['true', 'false'].map((opt) => {
            const on = v === opt
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onChange(opt)}
                className={cn(
                  'h-10 flex-1 rounded-md border text-sm font-medium transition-colors',
                  on
                    ? 'border-lime-tint-border bg-lime-tint-bg text-lime-text'
                    : 'border-border-default bg-bg-raised text-text-secondary hover:text-text-primary'
                )}
              >
                {opt === 'true' ? 'Yes' : 'No'}
              </button>
            )
          })}
        </div>
      )}

      {attribute.type === 'select' && (
        <Combobox
          value={typeof v === 'string' ? v : ''}
          onChange={(val) => { onChange(val); markTouched() }}
          onBlur={markTouched}
          invalid={showError}
          placeholder={selectPlaceholder(attribute)}
          ariaLabel={attribute.name}
          options={(attribute.options ?? []).map((o) => ({
            value: o.value,
            label: o.label,
            icon_url: o.icon_url,
          }))}
          tone="neutral"
          iconInTrigger
          size="lg"
          sheetOnTouch
        />
      )}

      {attribute.type === 'multiselect' && (
        <PillRow
          options={(attribute.options ?? []).map((o) => ({ value: o.value, label: o.label }))}
          value={Array.isArray(v) && v.length === 1 ? (v as string[])[0] : ''}
          onChange={(val) => {
            const arr = Array.isArray(v) ? (v as string[]) : []
            if (arr.includes(val)) onChange(arr.filter((x) => x !== val))
            else onChange([...arr, val])
          }}
        />
      )}

      {attribute.type === 'image_select' && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {(attribute.options ?? []).length === 0 ? (
            <p className="col-span-full text-xs text-text-tertiary">No choices yet.</p>
          ) : attribute.options!.map((o) => {
            const on = v === o.value
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => onChange(on ? '' : o.value)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-xl border p-2 transition-colors',
                  on
                    ? 'border-lime bg-lime-tint-bg'
                    : 'border-border-default bg-bg-inset hover:bg-bg-raised-hover'
                )}
              >
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg bg-bg-raised-hover">
                  {o.icon_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={o.icon_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-text-disabled" />
                  )}
                </div>
                <span className="line-clamp-1 text-xs text-text-primary">{o.label}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Required-field error — beats the hint when both would show. */}
      {showError ? (
        <FieldError className="mt-1.5">This field is required.</FieldError>
      ) : (
        attribute.help_text &&
        !(['select', 'multiselect', 'image_select', 'boolean'] as const).includes(attribute.type as any) && (
          <TipBox>{attribute.help_text}</TipBox>
        )
      )}
    </div>
  )
}

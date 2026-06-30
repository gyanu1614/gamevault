'use client'

/**
 * V19/P3 — Seller-facing platform/region/device picker block. Renders
 * one shadcn Select per enabled kind on the currency category config.
 *
 * V19/P24/P7 — Platform options now carry an optional `icon_url`. The
 * Select trigger shows the chosen platform's logo inline, and each
 * SelectItem renders the logo on the left of the label. Region/Device
 * stay text-only (no icons in V1). Legacy `string[]` option lists are
 * normalized at read time.
 *
 * Lives next to SellWizard so its prop shape can move freely. Imported
 * by Step 4 publish; not re-used elsewhere yet.
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  normalizePlatformOptions,
  type PlatformFields,
  type PlatformFieldKind,
  type PlatformOption,
} from '@/lib/types/category-configs'

type Kind = PlatformFieldKind

type Props = {
  fields: PlatformFields | null | undefined
  values: Record<Kind, string>
  onChange: (kind: Kind, value: string) => void
  /** When true, render errors for required fields that are empty. */
  showErrors?: boolean
}

const KIND_LABELS: Record<Kind, { label: string; placeholder: string; supportsIcons: boolean }> = {
  region:   { label: 'Region',   placeholder: 'Select a region',   supportsIcons: false },
  platform: { label: 'Platform', placeholder: 'Select a platform', supportsIcons: true },
  device:   { label: 'Device',   placeholder: 'Select a device',   supportsIcons: false },
}

const ORDER: Kind[] = ['region', 'platform', 'device']

/**
 * Returns the kinds that are both enabled AND have at least one
 * option. Anything else is conceptually off — same rule the admin
 * editor enforces by tone (yellow hint), here it gates rendering.
 */
export function visiblePlatformKinds(fields: PlatformFields | null | undefined): Kind[] {
  if (!fields) return []
  return ORDER.filter((k) => {
    const f = fields[k]
    if (!f?.enabled) return false
    return normalizePlatformOptions(f.options).length > 0
  })
}

export function PlatformFieldsBlock({ fields, values, onChange, showErrors }: Props) {
  const visible = visiblePlatformKinds(fields)
  if (visible.length === 0) return null

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {visible.map((kind) => {
        const cfg = KIND_LABELS[kind]
        const value = values[kind]
        const options: PlatformOption[] = normalizePlatformOptions(fields?.[kind]?.options)
        const invalid = !!showErrors && !value
        const selected = options.find((o) => o.value === value)
        return (
          <div key={kind} className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
              {cfg.label} <span className="text-error">*</span>
            </label>
            <Select value={value || undefined} onValueChange={(v) => onChange(kind, v)}>
              <SelectTrigger
                aria-invalid={invalid || undefined}
                aria-required
                className={invalid ? 'border-error focus:ring-error/40' : ''}
              >
                <SelectValue placeholder={cfg.placeholder}>
                  {selected && (
                    <span className="flex items-center gap-2">
                      {cfg.supportsIcons && selected.icon_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={selected.icon_url}
                          alt=""
                          className="h-4 w-4 shrink-0 rounded-sm object-cover"
                        />
                      ) : null}
                      <span className="truncate">{selected.value}</span>
                    </span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="flex items-center gap-2">
                      {cfg.supportsIcons && opt.icon_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={opt.icon_url}
                          alt=""
                          className="h-4 w-4 shrink-0 rounded-sm object-cover"
                        />
                      ) : null}
                      <span>{opt.value}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {invalid && (
              <p className="text-[11px] font-medium text-error">{cfg.label} is required.</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

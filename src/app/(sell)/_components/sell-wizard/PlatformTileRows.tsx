'use client'

import { cn } from '@/lib/utils'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { type PlatformFieldKind, type PlatformFields, normalizePlatformOptions } from '@/lib/types/category-configs'
import { visiblePlatformKinds } from '@/app/(sell)/_components/PlatformFieldsBlock'

// ─── PlatformTileRows — seller-side tile picker for Listing details ─────────
//
// V19/P24/P7.b — Replaces the prior PlatformFieldsBlock dropdowns. Each
// enabled kind (region / platform / device) renders as a single row of
// tile chips. Platform tiles show the admin-uploaded logo when one is
// set; region/device tiles stay text-only (admin doesn't upload icons
// for those). Picking a tile sets the value; the publish gate stays in
// canPublish, no change there.

export const TILE_KIND_LABELS: Record<PlatformFieldKind, string> = {
  region: 'Region',
  platform: 'Platform',
  device: 'Device',
}

export function PlatformTileRows({
  fields,
  values,
  onChange,
}: {
  fields: PlatformFields | null | undefined
  values: Record<PlatformFieldKind, string>
  onChange: (kind: PlatformFieldKind, v: string) => void
}) {
  const visible = visiblePlatformKinds(fields)
  if (visible.length === 0) return null

  return (
    <div className="space-y-4">
      {visible.map((kind) => {
        const options = normalizePlatformOptions(fields?.[kind]?.options)
        const value = values[kind]
        return (
          <div key={kind} className="space-y-2">
            <label className="block text-[13px] font-medium text-text-secondary">
              {TILE_KIND_LABELS[kind]} <span className="text-error">*</span>
            </label>
            <RadioGroup
              value={value || undefined}
              onValueChange={(v) => onChange(kind, v)}
              className="flex flex-wrap gap-2"
            >
              {options.map((opt) => {
                const on = value === opt.value
                return (
                  <label
                    key={opt.value}
                    className={cn(
                      // Compact translucent chips that sit ON the card
                      // rather than solid black boxes inside it. Rectangular
                      // (rounded-md) like every other control on the form.
                      'relative flex h-9 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-[12.5px] font-semibold transition-colors',
                      'has-[:focus-visible]:border-text-secondary',
                      on
                        ? 'border-lime bg-lime-tint-bg text-lime-text'
                        : 'border-white/[0.08] bg-white/[0.03] text-text-secondary hover:border-white/[0.16] hover:bg-white/[0.06] hover:text-text-primary',
                    )}
                  >
                    <RadioGroupItem value={opt.value} className="sr-only" />
                    {kind === 'platform' && opt.icon_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={opt.icon_url}
                        alt=""
                        className="h-4 w-4 shrink-0 object-contain"
                      />
                    ) : null}
                    <span className="uppercase tracking-wide">{opt.value}</span>
                  </label>
                )
              })}
            </RadioGroup>
          </div>
        )
      })}
    </div>
  )
}

// ─── Shared input styles ─────────────────────────────────────────────────────

// R14 — reverted to rounded-md from R12's rounded-none after seller feedback

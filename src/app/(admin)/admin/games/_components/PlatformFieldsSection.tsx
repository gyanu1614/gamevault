'use client'

/**
 * V19/P3 — Reusable admin editor for "platform-style" required fields
 * on a category config. Three kinds — Region, Platform, Device — each
 * with an enabled toggle and an editable options list.
 *
 * V19/P24/P7 — `platform` options now carry an optional icon_url so
 * the buyer page can render PS5 / Xbox / PC logos. Admin sees an
 * inline thumbnail uploader on each platform option row. Region and
 * Device stay as plain pills (no icons yet). Reads support legacy
 * `string[]` data via `normalizePlatformOptions`.
 *
 * Shape lives in src/lib/types/category-configs.ts (PlatformFields).
 */

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, Upload, X } from 'lucide-react'
import { uploadCurrencyImage } from '@/lib/actions/admin-category-configs'
import {
  type PlatformFields,
  type PlatformFieldKind,
  type PlatformFieldDef,
  type PlatformOption,
  DEFAULT_PLATFORM_FIELDS,
  normalizePlatformOptions,
} from '@/lib/types/category-configs'
import {
  REGION_PRESETS,
  PLATFORM_PRESETS,
  DEVICE_PRESETS,
  type PresetOption,
} from '@/lib/marketplace/region-platform-presets'

type Props = {
  gameId: string
  value: PlatformFields | undefined
  onChange: (next: PlatformFields) => void
}

const KINDS: Array<{
  key: PlatformFieldKind
  label: string
  hint: string
  placeholder: string
  supportsIcons: boolean
  /** V51 — One-click preset options (value + bundled static icon). */
  presets: PresetOption[]
}> = [
  {
    key: 'region',
    label: 'Region',
    hint: 'Server region the listing is for. e.g. NA, EU, Asia',
    placeholder: 'Add a custom region (e.g. NA)',
    // V51 — Regions now carry flag icons (preset art in
    // public/regions/); the buyer page renders flag + name tiles.
    supportsIcons: true,
    presets: REGION_PRESETS,
  },
  {
    key: 'platform',
    label: 'Platform',
    hint: 'Where the buyer plays. e.g. PC, PlayStation, Xbox, Mobile',
    placeholder: 'Add a custom platform (e.g. PC)',
    supportsIcons: true,
    presets: PLATFORM_PRESETS,
  },
  {
    key: 'device',
    label: 'Device',
    hint: 'Specific device when the platform isn’t enough. e.g. iOS, Android',
    placeholder: 'Add a custom device (e.g. iOS)',
    supportsIcons: true,
    presets: DEVICE_PRESETS,
  },
]

export function PlatformFieldsSection({ gameId, value, onChange }: Props) {
  // Merge missing kinds onto defaults so the toggle UI is always
  // complete even for older config rows that pre-date this field.
  const merged: PlatformFields = {
    ...DEFAULT_PLATFORM_FIELDS,
    ...(value ?? {}),
  }

  const patchKind = (kind: PlatformFieldKind, next: Partial<PlatformFieldDef>) => {
    const cur = merged[kind] ?? { enabled: false, options: [] }
    onChange({
      ...merged,
      [kind]: { ...cur, ...next },
    })
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border-default bg-bg-raised p-5">
      <header className="space-y-1">
        <h3 className="text-[15px] font-semibold text-text-primary">Platform fields</h3>
        <p className="text-[12.5px] text-text-secondary">
          Required dropdowns the seller must pick from when listing for this game. Leave a field off
          when the game doesn&rsquo;t care (e.g. Roblox is platform-agnostic, Path of Exile needs
          Region + League).
        </p>
      </header>

      <div className="space-y-3">
        {KINDS.map((k) => {
          const raw = merged[k.key] ?? { enabled: false, options: [] }
          // V19/P24/P7 — Normalize at read-time so old string[] data
          // becomes PlatformOption[] before we touch it.
          const field: PlatformFieldDef = {
            enabled: raw.enabled,
            options: normalizePlatformOptions(raw.options),
          }
          return (
            <PlatformKindCard
              key={k.key}
              gameId={gameId}
              label={k.label}
              hint={k.hint}
              placeholder={k.placeholder}
              supportsIcons={k.supportsIcons}
              presets={k.presets}
              field={field}
              onToggle={() => patchKind(k.key, { enabled: !field.enabled })}
              onAddOption={(opt) => {
                // Dedupe by value (case-insensitive).
                const lowered = opt.value.toLowerCase()
                if (field.options.some((o) => o.value.toLowerCase() === lowered)) return
                patchKind(k.key, { options: [...field.options, opt] })
              }}
              onUpdateOption={(value, patch) => {
                patchKind(k.key, {
                  options: field.options.map((o) =>
                    o.value === value ? { ...o, ...patch } : o,
                  ),
                })
              }}
              onRemoveOption={(value) =>
                patchKind(k.key, { options: field.options.filter((o) => o.value !== value) })
              }
            />
          )
        })}
      </div>
    </section>
  )
}

/* ── Single-kind card ──────────────────────────────────────────── */

function PlatformKindCard({
  gameId,
  label,
  hint,
  placeholder,
  supportsIcons,
  presets,
  field,
  onToggle,
  onAddOption,
  onUpdateOption,
  onRemoveOption,
}: {
  gameId: string
  label: string
  hint: string
  placeholder: string
  supportsIcons: boolean
  presets: PresetOption[]
  field: PlatformFieldDef
  onToggle: () => void
  onAddOption: (opt: PlatformOption) => void
  onUpdateOption: (value: string, patch: Partial<PlatformOption>) => void
  onRemoveOption: (value: string) => void
}) {
  const [draft, setDraft] = useState('')

  const submit = () => {
    const trimmed = draft.trim()
    if (!trimmed) return
    onAddOption({ value: trimmed, icon_url: null })
    setDraft('')
  }

  // V51 — Preset toggle: click adds the option with its bundled icon;
  // clicking an already-added preset removes it. Matched by value
  // (case-insensitive) so custom rows with the same name count too.
  const isPicked = (preset: PresetOption) =>
    field.options.some((o) => o.value.toLowerCase() === preset.value.toLowerCase())
  const togglePreset = (preset: PresetOption) => {
    const existing = field.options.find(
      (o) => o.value.toLowerCase() === preset.value.toLowerCase(),
    )
    if (existing) onRemoveOption(existing.value)
    else onAddOption({ value: preset.value, icon_url: preset.icon_url })
  }

  return (
    <div
      className={
        'rounded-xl border p-3 transition-colors ' +
        (field.enabled
          ? 'border-lime-tint-border bg-lime-tint-bg/30'
          : 'border-border-default bg-bg-overlay/40')
      }
    >
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={field.enabled}
          onChange={onToggle}
          className="mt-1 h-4 w-4 rounded border-border-default accent-lime"
        />
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold text-text-primary">{label}</div>
          <div className="text-[12px] text-text-tertiary">{hint}</div>
        </div>
      </label>

      {field.enabled && (
        <div className="mt-3 space-y-2 pl-7">
          {/* V51 — Preset quick-add: curated options with bundled
              icons. Lit = already added; click again to remove. */}
          {presets.length > 0 && (
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                Presets
              </div>
              <div className="flex flex-wrap gap-1.5">
                {presets.map((preset) => {
                  const picked = isPicked(preset)
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => togglePreset(preset)}
                      aria-pressed={picked}
                      className={
                        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors ' +
                        (picked
                          ? 'border-lime-tint-border bg-lime-tint-bg text-lime-text'
                          : 'border-border-default bg-bg-overlay text-text-secondary hover:border-border-strong hover:text-text-primary')
                      }
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={preset.icon_url} alt="" className="h-4 w-4 shrink-0 object-contain" />
                      {preset.value}
                      {picked && <X className="h-3 w-3" />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* V19/P24/P7 — Options with icons render as rows with inline
              icon uploader (regions/devices included as of V51). */}
          {supportsIcons ? (
            field.options.length > 0 && (
              <ul className="space-y-1.5">
                {field.options.map((opt) => (
                  <PlatformOptionRow
                    key={opt.value}
                    gameId={gameId}
                    option={opt}
                    presetIcon={
                      presets.find(
                        (pr) => pr.value.toLowerCase() === opt.value.toLowerCase(),
                      )?.icon_url ?? null
                    }
                    onChange={(patch) => onUpdateOption(opt.value, patch)}
                    onRemove={() => onRemoveOption(opt.value)}
                  />
                ))}
              </ul>
            )
          ) : (
            field.options.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {field.options.map((opt) => (
                  <li
                    key={opt.value}
                    className="inline-flex items-center gap-1 rounded-full border border-border-default bg-bg-overlay px-2.5 py-1 text-[12px] text-text-primary"
                  >
                    <span>{opt.value}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${opt.value}`}
                      onClick={() => onRemoveOption(opt.value)}
                      className="rounded-full p-0.5 text-text-tertiary transition-colors hover:bg-bg-raised hover:text-text-primary"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )
          )}

          {/* Add option */}
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  submit()
                }
              }}
              placeholder={placeholder}
              className="flex-1 rounded-lg border border-border-default bg-bg-base px-3 py-1.5 text-[13px] text-text-primary placeholder:text-text-disabled focus:border-lime focus:outline-none"
            />
            <button
              type="button"
              onClick={submit}
              disabled={!draft.trim()}
              className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-bg-overlay px-3 py-1.5 text-[12.5px] font-semibold text-text-primary transition-colors hover:bg-bg-raised-hover disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>

          {field.options.length === 0 && (
            <p className="text-[11.5px] text-text-tertiary">
              Field is enabled but has no options yet &mdash; the seller wizard will skip it.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Single option row (platform-only, with icon uploader) ──────── */

function PlatformOptionRow({
  gameId,
  option,
  presetIcon,
  onChange,
  onRemove,
}: {
  gameId: string
  option: PlatformOption
  /** V51 — Display fallback when the stored option has no icon but a
   *  preset with the same name ships one (legacy string configs). */
  presetIcon?: string | null
  onChange: (patch: Partial<PlatformOption>) => void
  onRemove: () => void
}) {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)

  const onPickFile = (file: File | null | undefined) => {
    if (!file) return
    setUploading(true)
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = String(reader.result ?? '')
      const res = await uploadCurrencyImage(gameId, {
        name: file.name,
        type: file.type,
        size: file.size,
        base64,
      })
      setUploading(false)
      if (!res.success) {
        toast.error(res.error)
        return
      }
      onChange({ icon_url: res.data.url })
    }
    reader.readAsDataURL(file)
  }

  return (
    <li className="flex items-center gap-2 rounded-lg border border-border-default bg-bg-overlay/60 p-2">
      {/* Image tile */}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border-default bg-bg-base transition-colors hover:border-lime-tint-border"
        aria-label={`Upload icon for ${option.value}`}
      >
        {option.icon_url || presetIcon ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={option.icon_url ?? presetIcon ?? ''} alt="" className="h-full w-full object-contain" />
        ) : uploading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-text-tertiary" />
        ) : (
          <Upload className="h-3.5 w-3.5 text-text-tertiary" />
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          className="hidden"
          onChange={(e) => onPickFile(e.target.files?.[0])}
        />
      </button>

      {/* Label (read-only; renaming would orphan listings) */}
      <span className="flex-1 truncate text-[13px] text-text-primary">{option.value}</span>

      {/* Optional remove-icon button when one's set */}
      {option.icon_url && (
        <button
          type="button"
          onClick={() => onChange({ icon_url: null })}
          aria-label="Remove icon"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border-default bg-bg-overlay text-text-tertiary transition-colors hover:bg-bg-raised-hover hover:text-text-primary"
        >
          <X className="h-3 w-3" />
        </button>
      )}

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${option.value}`}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border-default bg-bg-overlay text-error transition-colors hover:bg-error-bg/30"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </li>
  )
}

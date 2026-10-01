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
 *
 * Look: flat admin kit — one bg-bg-raised card, the three kinds split by
 * hairlines, a Switch per kind, preset chips (selected = lighter fill),
 * option rows as bg-bg-overlay boxes.
 */

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { CircleNotch, Plus, Trash, UploadSimple, X } from '@phosphor-icons/react'
import { Switch } from '@/components/ui/switch'
import { accountInputCls } from '@/components/account/AccountSurface'
import { cn } from '@/lib/utils'
import { PanelHead, adminBtn } from '../../components/kit'
import { uploadCurrencyImage } from '@/lib/actions/admin-category-configs'
import { imageTooLargeMessage, readFileAsDataUrl, uploadErrorMessage } from '@/lib/uploads/image-upload'
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

/** Icon-only row action. 36px tap target. */
const ICON_BTN =
  'grid h-9 w-9 shrink-0 place-items-center rounded-md text-text-secondary transition-colors hover:bg-white/[0.08] hover:text-text-primary'

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
    <section className="rounded-lg bg-bg-raised p-4 sm:p-5">
      <PanelHead
        title="Platform Fields"
        subtitle={
          <>
            Required dropdowns the seller must pick from when listing for this game. Leave a field off
            when the game doesn&rsquo;t care (e.g. Roblox is platform-agnostic, Path of Exile needs
            Region + League).
          </>
        }
      />

      <div className="divide-y divide-white/[0.06]">
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
    <div className="py-4 first:pt-0 last:pb-0">
      <label className="flex cursor-pointer items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold text-text-primary">{label}</span>
          <span className="mt-0.5 block text-[12.5px] leading-relaxed text-text-tertiary">{hint}</span>
        </span>
        <Switch
          checked={field.enabled}
          onCheckedChange={() => onToggle()}
          aria-label={`${label} field`}
        />
      </label>

      {field.enabled && (
        <div className="mt-3 space-y-3">
          {/* V51 — Preset quick-add: curated options with bundled
              icons. Lit = already added; click again to remove. */}
          {presets.length > 0 && (
            <div>
              <div className="mb-1.5 text-[12px] font-medium text-text-tertiary">
                Presets
              </div>
              {/* Phones: one sideways-scrolling row. From sm: wraps. */}
              <div
                role="group"
                aria-label={`${label} presets`}
                className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
              >
                {presets.map((preset) => {
                  const picked = isPicked(preset)
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => togglePreset(preset)}
                      aria-pressed={picked}
                      className={cn(
                        'inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[12.5px] font-medium transition-colors',
                        picked
                          ? 'bg-white/[0.14] text-text-primary'
                          : 'bg-bg-overlay text-text-secondary hover:bg-bg-overlay-2 hover:text-text-primary',
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={preset.icon_url} alt="" className="h-4 w-4 shrink-0 object-contain" />
                      {preset.value}
                      {picked && <X aria-hidden weight="bold" className="h-3 w-3 text-text-tertiary" />}
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
                    className="inline-flex h-8 items-center gap-1 rounded-full bg-bg-overlay pl-3 pr-1 text-[12.5px] font-medium text-text-primary"
                  >
                    <span>{opt.value}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${opt.value}`}
                      onClick={() => onRemoveOption(opt.value)}
                      className="grid h-6 w-6 place-items-center rounded-full text-text-tertiary transition-colors hover:bg-white/[0.08] hover:text-text-primary"
                    >
                      <X aria-hidden weight="bold" className="h-3 w-3" />
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
              aria-label={placeholder}
              className={cn(accountInputCls, 'h-10 min-w-0 flex-1 py-0')}
            />
            <button
              type="button"
              onClick={submit}
              disabled={!draft.trim()}
              className={cn(adminBtn.secondary, 'shrink-0 px-3.5')}
            >
              <Plus aria-hidden weight="bold" className="h-4 w-4" /> Add
            </button>
          </div>

          {field.options.length === 0 && (
            <p className="text-[12.5px] text-text-tertiary">
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

  const onPickFile = async (file: File | null | undefined) => {
    if (!file) return
    const tooLarge = imageTooLargeMessage(file, 2_097_152, 'Icon')
    if (tooLarge) {
      toast.error(tooLarge)
      return
    }
    setUploading(true)
    try {
      const base64 = await readFileAsDataUrl(file)
      const res = await uploadCurrencyImage(gameId, {
        name: file.name,
        type: file.type,
        size: file.size,
        base64,
      })
      if (!res.success) {
        toast.error(res.error)
        return
      }
      onChange({ icon_url: res.data.url })
    } catch (error) {
      toast.error(uploadErrorMessage(error))
    } finally {
      setUploading(false)
    }
  }

  return (
    <li className="flex items-center gap-2 rounded-md bg-bg-overlay p-1.5 pr-1">
      {/* Image tile */}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        aria-busy={uploading}
        className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white/[0.06] transition-colors hover:bg-white/[0.10] disabled:cursor-wait"
        aria-label={`Upload icon for ${option.value}`}
      >
        {option.icon_url || presetIcon ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={option.icon_url ?? presetIcon ?? ''} alt="" className="h-full w-full object-contain" />
        ) : (
          <UploadSimple aria-hidden weight="bold" className="h-4 w-4 text-text-tertiary" />
        )}
        {uploading && (
          <span className="absolute inset-0 grid place-items-center bg-black/55">
            <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin text-text-primary" />
          </span>
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        tabIndex={-1}
        aria-hidden
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.currentTarget.value = ''
          onPickFile(file)
        }}
      />

      {/* Label (read-only; renaming would orphan listings) */}
      <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-text-primary">{option.value}</span>

      {/* Optional remove-icon button when one's set */}
      {option.icon_url && (
        <button
          type="button"
          onClick={() => onChange({ icon_url: null })}
          aria-label="Remove icon"
          title="Remove icon"
          className={ICON_BTN}
        >
          <X aria-hidden weight="bold" className="h-4 w-4" />
        </button>
      )}

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${option.value}`}
        title={`Remove ${option.value}`}
        className={cn(
          ICON_BTN,
          'text-text-tertiary hover:bg-[color-mix(in_srgb,var(--color-error)_14%,transparent)] hover:text-error',
        )}
      >
        <Trash aria-hidden weight="bold" className="h-4 w-4" />
      </button>
    </li>
  )
}

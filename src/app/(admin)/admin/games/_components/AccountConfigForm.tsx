'use client'

/**
 * V17y — Per-game ACCOUNT config editor.
 *
 * Picks which seller-side wizard fields are required when listing a
 * game account, available delivery methods, and whether 2FA accounts
 * are allowed. Stored under category_configs (game_id, 'account').
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  fetchCategoryConfigAdmin,
  upsertCategoryConfig,
} from '@/lib/actions/admin-category-configs'
import {
  DEFAULT_ACCOUNT_CONFIG,
  type AccountConfig,
  type AccountField,
} from '@/lib/types/category-configs'

const ACCOUNT_FIELDS: Array<{ value: AccountField; label: string; hint: string }> = [
  { value: 'level', label: 'Level', hint: 'Account level or progress number' },
  { value: 'rank', label: 'Rank', hint: 'Competitive tier (e.g. Diamond)' },
  { value: 'region', label: 'Region', hint: 'Server region of the account' },
  { value: 'platform', label: 'Platform', hint: 'PC / PS / Xbox / Mobile' },
  { value: 'skins_count', label: 'Skins count', hint: 'Number of skins/cosmetics' },
  { value: 'hours_played', label: 'Hours played', hint: 'Time invested in the account' },
  { value: 'email_changeable', label: 'Email changeable', hint: 'Whether the buyer can swap the email' },
]

export function AccountConfigForm({ gameId }: { gameId: string }) {
  const qc = useQueryClient()
  const [draft, setDraft] = useState<AccountConfig | null>(null)

  const query = useQuery({
    queryKey: ['admin-category-config', gameId, 'account'],
    queryFn: async () => {
      const cfg = await fetchCategoryConfigAdmin(gameId, 'account')
      setDraft(cfg ?? DEFAULT_ACCOUNT_CONFIG)
      return cfg
    },
    staleTime: 30_000,
  })

  const mutation = useMutation({
    mutationFn: async (next: AccountConfig) =>
      upsertCategoryConfig(gameId, 'account', next),
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.error)
        return
      }
      toast.success('Account settings saved')
      qc.invalidateQueries({ queryKey: ['admin-category-config', gameId, 'account'] })
    },
    onError: (err: any) => toast.error(err?.message ?? 'Save failed'),
  })

  if (query.isLoading || !draft) {
    return (
      <div className="flex items-center gap-2 p-6 text-text-secondary">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading account settings…
      </div>
    )
  }

  const patch = (p: Partial<AccountConfig>) =>
    setDraft((d) => (d ? { ...d, ...p } : d))

  const toggleField = (f: AccountField) => {
    const has = draft.required_fields.includes(f)
    patch({
      required_fields: has
        ? draft.required_fields.filter((x) => x !== f)
        : [...draft.required_fields, f],
    })
  }

  const toggleDelivery = (m: 'manual' | 'instant') => {
    const has = draft.delivery_methods.includes(m)
    if (has && draft.delivery_methods.length === 1) return // keep at least one
    patch({
      delivery_methods: has
        ? draft.delivery_methods.filter((x) => x !== m)
        : [...draft.delivery_methods, m],
    })
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!draft) return
        mutation.mutate(draft)
      }}
      className="space-y-7"
    >
      <section className="space-y-4 rounded-2xl border border-border-default bg-bg-raised p-5">
        <h3 className="text-[15px] font-semibold text-text-primary">Required listing fields</h3>
        <p className="text-[12.5px] text-text-secondary">
          Sellers must fill these in when listing an account for this game.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {ACCOUNT_FIELDS.map((f) => {
            const checked = draft.required_fields.includes(f.value)
            return (
              <label
                key={f.value}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-border-default bg-bg-overlay/40 p-3 transition-colors hover:bg-bg-overlay/70"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleField(f.value)}
                  className="mt-1 h-4 w-4 rounded border-border-default accent-lime"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold text-text-primary">{f.label}</div>
                  <div className="text-[12px] text-text-tertiary">{f.hint}</div>
                </div>
              </label>
            )
          })}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border-default bg-bg-raised p-5">
        <h3 className="text-[15px] font-semibold text-text-primary">Delivery methods</h3>
        <p className="text-[12.5px] text-text-secondary">
          Which delivery types sellers can pick from when creating a listing.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <DeliveryToggle
            label="Manual"
            hint="Seller hands over credentials in chat after sale"
            checked={draft.delivery_methods.includes('manual')}
            onToggle={() => toggleDelivery('manual')}
          />
          <DeliveryToggle
            label="Instant"
            hint="Pre-stored credentials released to the buyer automatically"
            checked={draft.delivery_methods.includes('instant')}
            onToggle={() => toggleDelivery('instant')}
          />
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border-default bg-bg-raised p-5">
        <h3 className="text-[15px] font-semibold text-text-primary">Policy</h3>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border-default bg-bg-overlay/40 p-3 transition-colors hover:bg-bg-overlay/70">
          <input
            type="checkbox"
            checked={draft.allow_2fa_accounts}
            onChange={(e) => patch({ allow_2fa_accounts: e.target.checked })}
            className="mt-1 h-4 w-4 rounded border-border-default accent-lime"
          />
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-semibold text-text-primary">Allow 2FA-protected accounts</div>
            <div className="text-[12px] text-text-tertiary">
              When off, listings must indicate 2FA is removed. Keeps support cost down for buyers.
            </div>
          </div>
        </label>
      </section>

      <section className="space-y-4 rounded-2xl border border-border-default bg-bg-raised p-5">
        <h3 className="text-[15px] font-semibold text-text-primary">Seller instructions</h3>
        <div className="space-y-1.5">
          <Label>Placeholder text</Label>
          <Textarea
            value={draft.seller_instructions_placeholder}
            onChange={(e) => patch({ seller_instructions_placeholder: e.target.value })}
            rows={3}
            placeholder="What sellers should write in their description"
          />
        </div>
      </section>

      <div className="sticky bottom-4 z-10 flex justify-end rounded-xl border border-border-default bg-bg-raised/95 p-3 backdrop-blur-md shadow-elevated">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-lime px-4 py-2 text-[13px] font-semibold text-text-inverse transition-colors hover:bg-lime-hover disabled:opacity-60"
        >
          {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Save account settings
        </button>
      </div>
    </form>
  )
}

function DeliveryToggle({
  label,
  hint,
  checked,
  onToggle,
}: {
  label: string
  hint: string
  checked: boolean
  onToggle: () => void
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
        checked
          ? 'border-lime-tint-border bg-lime-tint-bg/40'
          : 'border-border-default bg-bg-overlay/40 hover:bg-bg-overlay/70'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-1 h-4 w-4 rounded border-border-default accent-lime"
      />
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold text-text-primary">{label}</div>
        <div className="text-[12px] text-text-tertiary">{hint}</div>
      </div>
    </label>
  )
}

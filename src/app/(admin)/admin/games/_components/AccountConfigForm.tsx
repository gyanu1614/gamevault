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
import { cn } from '@/lib/utils'
import { accountInputCls } from '@/components/account/AccountSurface'
import { FIELD_LABEL, FormLoading, FormSection, SaveBar, SwitchRow } from './form-bits'
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
  { value: 'skins_count', label: 'Skins Count', hint: 'Number of skins/cosmetics' },
  { value: 'hours_played', label: 'Hours Played', hint: 'Time invested in the account' },
  { value: 'email_changeable', label: 'Email Changeable', hint: 'Whether the buyer can swap the email' },
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
    // The queryFn seeds the editable draft, so a background refetch (tab refocus)
    // would wipe unsaved edits. Refetch only after a save (invalidate).
    refetchOnWindowFocus: false,
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
    return <FormLoading cards={4} />
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
      className="space-y-4"
    >
      <FormSection
        title="Required Listing Fields"
        subtitle="Sellers must fill these in when listing an account for this game."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {ACCOUNT_FIELDS.map((f) => (
            <SwitchRow
              key={f.value}
              label={f.label}
              hint={f.hint}
              checked={draft.required_fields.includes(f.value)}
              onCheckedChange={() => toggleField(f.value)}
            />
          ))}
        </div>
      </FormSection>

      <FormSection
        title="Delivery Methods"
        subtitle="Which delivery types sellers can pick from when creating a listing. At least one stays on."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <SwitchRow
            label="Manual"
            hint="Seller hands over credentials in chat after sale"
            checked={draft.delivery_methods.includes('manual')}
            onCheckedChange={() => toggleDelivery('manual')}
          />
          <SwitchRow
            label="Instant"
            hint="Pre-stored credentials released to the buyer automatically"
            checked={draft.delivery_methods.includes('instant')}
            onCheckedChange={() => toggleDelivery('instant')}
          />
        </div>
      </FormSection>

      <FormSection title="Policy">
        <SwitchRow
          label="Allow 2FA-Protected Accounts"
          hint="When off, listings must indicate 2FA is removed. Keeps support cost down for buyers."
          checked={draft.allow_2fa_accounts}
          onCheckedChange={(checked) => patch({ allow_2fa_accounts: checked })}
        />
      </FormSection>

      <FormSection title="Seller Instructions">
        <label htmlFor="account-instructions" className={FIELD_LABEL}>Placeholder Text</label>
        <textarea
          id="account-instructions"
          value={draft.seller_instructions_placeholder}
          onChange={(e) => patch({ seller_instructions_placeholder: e.target.value })}
          rows={3}
          placeholder="What sellers should write in their description"
          className={cn(accountInputCls, 'resize-none')}
        />
      </FormSection>

      <SaveBar label="Save Account Settings" pending={mutation.isPending} />
    </form>
  )
}

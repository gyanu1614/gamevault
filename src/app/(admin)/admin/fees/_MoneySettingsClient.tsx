'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { AdminPanel, LabeledField, PanelHead, adminBtnSm, adminNumCls } from '../components/kit'
import {
  updateMoneySetting, updateCompletionWindow, updateWithdrawalMethodFees,
  type MoneySettingKey, type fetchMoneySettings,
} from '@/lib/actions/admin-fees'
import { payoutMethodState } from '@/lib/wallet/payout-method-state'

type Data = Awaited<ReturnType<typeof fetchMoneySettings>>

const SETTING_LABELS: Record<MoneySettingKey, { label: string; unit: string; help: string }> = {
  completion_hold_hours: { label: 'Completion Hold', unit: 'hours', help: 'How long a buyer-confirmed sale stays pending before it is withdrawable. Auto-completed sales are withdrawable at once.' },
  dispute_window_days: { label: 'Dispute Window', unit: 'days', help: 'From delivery. Binds buyers only — admins can dispute at any time from the order page.' },
  withdrawal_min_account_age_days: { label: 'New-Seller Withdrawal Rule', unit: 'days', help: 'Counted from the seller application approval (fallback: profile creation).' },
  payout_details_freeze_hours: { label: 'Payout-Details Freeze', unit: 'hours', help: 'Withdrawals pause for this long after a seller changes their payout address or Payoneer email.' },
}

const titleCase = (s: string) => s.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

export function MoneySettingsClient({ initial }: { initial: Data }) {
  const router = useRouter()
  const [busy, start] = useTransition()
  const [settings, setSettings] = useState<Record<MoneySettingKey, string>>(
    Object.fromEntries(Object.entries(initial.settings).map(([k, v]) => [k, String(v)])) as Record<MoneySettingKey, string>,
  )
  const [windows, setWindows] = useState<Record<string, string>>(
    Object.fromEntries(initial.windows.map((w) => [w.category_type, String(w.auto_complete_hours)])),
  )
  const [methods, setMethods] = useState(
    Object.fromEntries(initial.methods.map((m) => [m.id, {
      feePct: String(m.fee_percentage), feeFixed: String(m.fee_fixed), feeMin: String(m.fee_min),
      minWithdrawal: String(m.min_withdrawal), maxWithdrawal: String(m.max_withdrawal), isActive: m.is_active,
      comingSoon: m.coming_soon,
    }])),
  )

  const run = (fn: () => Promise<{ success: boolean; error?: string }>, ok: string) =>
    start(async () => {
      const r = await fn()
      if (!r.success) return void toast.error(r.error || 'Save failed')
      toast.success(ok)
      router.refresh()
    })

  return (
    <div className="space-y-5">
      <AdminPanel>
        <PanelHead title="Timing and Gates" />
        <div className="divide-y divide-white/[0.06]">
          {(Object.keys(SETTING_LABELS) as MoneySettingKey[]).map((key) => (
            <div key={key} className="flex flex-col gap-3 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 max-w-xl">
                <div className="text-[14px] font-medium text-text-primary">{SETTING_LABELS[key].label}</div>
                <div className="mt-0.5 text-[12.5px] leading-relaxed text-text-tertiary">{SETTING_LABELS[key].help}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  aria-label={`${SETTING_LABELS[key].label} (${SETTING_LABELS[key].unit})`}
                  value={settings[key]}
                  onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                  className={cn(adminNumCls, 'w-24')}
                />
                <span className="w-10 text-[12.5px] text-text-tertiary">{SETTING_LABELS[key].unit}</span>
                <button
                  type="button"
                  className={adminBtnSm.secondary}
                  disabled={busy || String(initial.settings[key]) === settings[key]}
                  onClick={() => run(() => updateMoneySetting({ key, value: Number(settings[key]) }), `${SETTING_LABELS[key].label} saved`)}
                >
                  Save
                </button>
              </div>
            </div>
          ))}
        </div>
      </AdminPanel>

      <AdminPanel>
        <PanelHead
          title="Auto-Complete Windows"
          subtitle="SafeDrop Protection: hours after the seller marks delivered before an unconfirmed order completes automatically. The buyer reminder goes out at the halfway point."
        />
        <div className="divide-y divide-white/[0.06]">
          {initial.windows.map((w) => (
            <div key={w.category_type} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <div className="text-[14px] font-medium text-text-primary">{titleCase(w.category_type)}</div>
                <div className="text-[12px] text-text-tertiary">
                  Changed {new Date(w.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  aria-label={`${titleCase(w.category_type)} window (hours)`}
                  value={windows[w.category_type]}
                  onChange={(e) => setWindows({ ...windows, [w.category_type]: e.target.value })}
                  className={cn(adminNumCls, 'w-24')}
                />
                <span className="w-10 text-[12.5px] text-text-tertiary">hours</span>
                <button
                  type="button"
                  className={adminBtnSm.secondary}
                  disabled={busy || String(w.auto_complete_hours) === windows[w.category_type]}
                  onClick={() => run(() => updateCompletionWindow({ categoryType: w.category_type, hours: Number(windows[w.category_type]) }), `${w.category_type} window saved`)}
                >
                  Save
                </button>
              </div>
            </div>
          ))}
        </div>
      </AdminPanel>

      <div>
        <PanelHead
          title="Withdrawal Methods"
          subtitle="fee = max(amount × % + fixed, minimum fee), rounded half-up to the cent. Quoted live on the withdraw page and /sell/fees."
          className="mb-3"
        />
        <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
          {initial.methods.map((m) => {
            const v = methods[m.id]
            const set = (patch: Partial<typeof v>) => setMethods({ ...methods, [m.id]: { ...v, ...patch } })
            const num = (k: 'feePct' | 'feeFixed' | 'feeMin' | 'minWithdrawal' | 'maxWithdrawal', label: string) => (
              <LabeledField label={label} htmlFor={`${m.id}-${k}`}>
                <input
                  id={`${m.id}-${k}`}
                  type="number"
                  step="0.01"
                  min={0}
                  inputMode="decimal"
                  value={String(v[k])}
                  onChange={(e) => set({ [k]: e.target.value })}
                  className={adminNumCls}
                />
              </LabeledField>
            )
            return (
              <AdminPanel key={m.id} pad={false}>
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-5">
                  <div className="min-w-0">
                    <p className="text-[14.5px] font-semibold text-text-primary">{m.display_name}</p>
                    <p className="text-[12px] text-text-tertiary">
                      {payoutMethodState(m)} · {m.method_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-[12.5px] text-text-secondary">
                      <Switch checked={Boolean(v.isActive)} onCheckedChange={(c) => set({ isActive: c })} aria-label={`${m.display_name} active`} />
                      Active
                    </label>
                    <label className="flex items-center gap-2 text-[12.5px] text-text-secondary">
                      <Switch checked={Boolean(v.comingSoon)} onCheckedChange={(c) => set({ comingSoon: c })} aria-label={`${m.display_name} coming soon`} />
                      Coming Soon
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 px-4 py-4 sm:grid-cols-5 sm:px-5">
                  {num('feePct', 'Fee %')}
                  {num('feeFixed', 'Fixed $')}
                  {num('feeMin', 'Min Fee $')}
                  {num('minWithdrawal', 'Min Payout $')}
                  {num('maxWithdrawal', 'Max $')}
                </div>
                <div className="flex justify-end border-t border-white/[0.06] px-4 py-3 sm:px-5">
                  <button
                    type="button"
                    className={adminBtnSm.primary}
                    disabled={busy}
                    onClick={() => run(() => updateWithdrawalMethodFees({ methodId: m.id, ...v }), `${m.display_name} saved`)}
                  >
                    Save {m.display_name}
                  </button>
                </div>
              </AdminPanel>
            )
          })}
        </div>
      </div>
    </div>
  )
}

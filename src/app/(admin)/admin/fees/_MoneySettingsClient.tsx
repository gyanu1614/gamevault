'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AdminPanel, TABLE } from '../components/kit'
import {
  updateMoneySetting, updateCompletionWindow, updateWithdrawalMethodFees,
  type MoneySettingKey, type fetchMoneySettings,
} from '@/lib/actions/admin-fees'
import { payoutMethodState } from '@/lib/wallet/payout-method-state'

type Data = Awaited<ReturnType<typeof fetchMoneySettings>>

const SETTING_LABELS: Record<MoneySettingKey, { label: string; unit: string; help: string }> = {
  completion_hold_hours: { label: 'Completion hold', unit: 'hours', help: 'How long a buyer-confirmed sale stays pending before it is withdrawable. Auto-completed sales are withdrawable at once.' },
  dispute_window_days: { label: 'Dispute window', unit: 'days', help: 'From delivery. Binds buyers only — admins can dispute at any time from the order page.' },
  withdrawal_min_account_age_days: { label: 'New-seller withdrawal rule', unit: 'days', help: 'Counted from the seller application approval (fallback: profile creation).' },
  payout_details_freeze_hours: { label: 'Payout-details freeze', unit: 'hours', help: 'Withdrawals pause for this long after a seller changes their payout address or Payoneer email.' },
}

const inputCls = 'w-28 rounded-lg border border-border-default bg-bg-overlay px-3 py-1.5 text-[13.5px] tabular-nums text-text-primary focus:outline-none focus:ring-1 focus:ring-lime-text'

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
        <PanelHead title="Timing and gates" />
        <div className="divide-y divide-border-subtle">
          {(Object.keys(SETTING_LABELS) as MoneySettingKey[]).map((key) => (
            <div key={key} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0 max-w-xl">
                <div className="text-[13.5px] font-medium text-text-primary">{SETTING_LABELS[key].label}</div>
                <div className="text-[12px] text-text-tertiary">{SETTING_LABELS[key].help}</div>
              </div>
              <div className="flex items-center gap-2">
                <input type="number" min={0} step={1} value={settings[key]} onChange={(e) => setSettings({ ...settings, [key]: e.target.value })} className={inputCls} />
                <span className="text-[12px] text-text-tertiary">{SETTING_LABELS[key].unit}</span>
                <Button size="sm" variant="outline" disabled={busy || String(initial.settings[key]) === settings[key]}
                  onClick={() => run(() => updateMoneySetting({ key, value: Number(settings[key]) }), `${SETTING_LABELS[key].label} saved`)}>
                  Save
                </Button>
              </div>
            </div>
          ))}
        </div>
      </AdminPanel>

      <AdminPanel>
        <PanelHead title="Auto-complete windows (SafeDrop Protection)" subtitle="Hours after the seller marks delivered before an unconfirmed order completes automatically. The buyer reminder goes out at the halfway point." />
        <div className={TABLE.wrap}>
          <table className={TABLE.table}>
            <thead><tr><th className={TABLE.th}>Category type</th><th className={TABLE.th}>Window</th><th className={TABLE.th}>Last change</th><th className={TABLE.th}></th></tr></thead>
            <tbody>
              {initial.windows.map((w) => (
                <tr key={w.category_type} className={TABLE.row}>
                  <td className={TABLE.tdPrimary}>{w.category_type}</td>
                  <td className={TABLE.td}>
                    <div className="flex items-center gap-2">
                      <input type="number" min={1} step={1} value={windows[w.category_type]} onChange={(e) => setWindows({ ...windows, [w.category_type]: e.target.value })} className={inputCls} />
                      <span className="text-[12px] text-text-tertiary">hours</span>
                    </div>
                  </td>
                  <td className={TABLE.td}>{new Date(w.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td className={TABLE.td}>
                    <Button size="sm" variant="outline" disabled={busy || String(w.auto_complete_hours) === windows[w.category_type]}
                      onClick={() => run(() => updateCompletionWindow({ categoryType: w.category_type, hours: Number(windows[w.category_type]) }), `${w.category_type} window saved`)}>
                      Save
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminPanel>

      <AdminPanel>
        <PanelHead title="Withdrawal methods" subtitle="fee = max(amount × % + fixed, minimum fee), rounded half-up to the cent. Quoted live on the withdraw page and /sell/fees." />
        <div className={TABLE.wrap}>
          <table className={TABLE.table}>
            <thead>
              <tr>
                <th className={TABLE.th}>Method</th><th className={TABLE.th}>%</th><th className={TABLE.th}>Fixed $</th><th className={TABLE.th}>Min fee $</th>
                <th className={TABLE.th}>Min withdrawal $</th><th className={TABLE.th}>Max $</th><th className={TABLE.th}>Active</th>
                <th className={TABLE.th}>Coming soon</th><th className={TABLE.th}></th>
              </tr>
            </thead>
            <tbody>
              {initial.methods.map((m) => {
                const v = methods[m.id]
                const field = (k: keyof typeof v) => {
                  const toggle = k === 'isActive' || k === 'comingSoon'
                  return (
                    <input type={toggle ? 'checkbox' : 'number'} step="0.01" min={0}
                      checked={toggle ? Boolean(v[k]) : undefined}
                      aria-label={toggle ? `${m.display_name} ${k === 'isActive' ? 'active' : 'coming soon'}` : undefined}
                      value={toggle ? undefined : String(v[k])}
                      onChange={(e) => setMethods({ ...methods, [m.id]: { ...v, [k]: toggle ? e.target.checked : e.target.value } })}
                      className={toggle ? 'h-4 w-4 accent-lime' : `${inputCls} w-24`} />
                  )
                }
                return (
                  <tr key={m.id} className={TABLE.row}>
                    <td className={TABLE.tdPrimary}>{m.display_name}<div className="text-[11px] font-normal text-text-tertiary">{payoutMethodState(m)} · {m.method_name}</div></td>
                    <td className={TABLE.td}>{field('feePct')}</td>
                    <td className={TABLE.td}>{field('feeFixed')}</td>
                    <td className={TABLE.td}>{field('feeMin')}</td>
                    <td className={TABLE.td}>{field('minWithdrawal')}</td>
                    <td className={TABLE.td}>{field('maxWithdrawal')}</td>
                    <td className={TABLE.td}>{field('isActive')}</td>
                    <td className={TABLE.td}>{field('comingSoon')}</td>
                    <td className={TABLE.td}>
                      <Button size="sm" variant="outline" disabled={busy}
                        onClick={() => run(() => updateWithdrawalMethodFees({ methodId: m.id, ...v }), `${m.display_name} saved`)}>
                        Save
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </AdminPanel>
    </div>
  )
}


function PanelHead({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-[15px] font-semibold text-text-primary">{title}</h2>
      {subtitle && <p className="mt-0.5 text-[12.5px] text-text-tertiary">{subtitle}</p>}
    </div>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Warning } from '@phosphor-icons/react'
import { Switch } from '@/components/ui/switch'
import { setBuyRailSurface } from '@/lib/actions/admin-buy-rails'
import type { RailSettings, RailSurface } from '@/lib/buy-rails/model'
import { AdminEmpty, PageHeader, PanelHead } from '../components/kit'

const ROWS: Array<{ key: RailSurface; label: string; detail: string }> = [
  { key: 'blog', label: 'Blog Posts', detail: 'Currency card left, items card right on desktop; bottom bar after a third of the post on phones.' },
  { key: 'value_item', label: 'Value Item Pages', detail: 'Currency card left, the item’s buy card right; the item bar on phones.' },
  { key: 'value_list', label: 'Value Lists', detail: 'The Buy line on every card and the game bar on phones.' },
  { key: 'calculator', label: 'Calculators', detail: 'The buy box under the trade result.' },
]

export default function BuyRailsClient({ initial, fetchError }: { initial: RailSettings | null; fetchError?: string }) {
  const [settings, setSettings] = useState<RailSettings | null>(initial)
  const [pending, startTransition] = useTransition()

  if (!settings) {
    return (
      <>
        <PageHeader title="Buy Rails" />
        <AdminEmpty icon={Warning} tone="error" title="Could not load the buy rail settings" hint={fetchError} />
      </>
    )
  }

  const toggle = (key: RailSurface, on: boolean) => {
    const before = settings
    setSettings({ ...settings, [key]: on })
    startTransition(async () => {
      const res = await setBuyRailSurface(key, on)
      if (!res.ok) {
        setSettings(before)
        toast.error(res.error)
      } else {
        toast.success(`${ROWS.find((r) => r.key === key)?.label} ${on ? 'On' : 'Off'}`)
      }
    })
  }

  return (
    <>
      <PageHeader
        title="Buy Rails"
        description="Live offers beside blog posts and value pages. Turn a surface off and its pages drop the rails on their next visit."
      />
      <div className="rounded-lg bg-bg-raised p-4 sm:p-5">
        <PanelHead title="Surfaces" subtitle="All on by default." />
        <ul className="divide-y divide-white/[0.07]">
          {ROWS.map((r) => (
            <li key={r.key} className="flex items-center justify-between gap-4 py-3.5">
              <div className="min-w-0">
                <p className="text-body-sm font-semibold text-text-primary">{r.label}</p>
                <p className="mt-0.5 text-caption text-text-tertiary">{r.detail}</p>
              </div>
              <Switch
                checked={settings[r.key]}
                disabled={pending}
                onCheckedChange={(on) => toggle(r.key, on)}
                aria-label={`${r.label} buy rails`}
              />
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}

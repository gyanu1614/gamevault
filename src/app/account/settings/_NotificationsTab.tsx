'use client'

/**
 * Settings → Notifications. Each switch saves the moment it flips (no Save
 * button), optimistically, and snaps back with a toast if the save fails.
 * The emails check these before sending (src/lib/email/preferences.ts).
 */

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { toast } from 'sonner'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Switch } from '@/components/ui/switch'
import { SettingsCard, accountBtn } from '@/components/account/AccountSurface'
import { getMyEmailPreferences, setMyEmailPreference } from '@/lib/actions/email-preferences'
import type { EmailPrefKey, EmailPrefs } from '@/lib/email/preferences'

const ROWS: { key: EmailPrefKey; label: string; desc: string; sellerOnly: boolean }[] = [
  { key: 'new_order', label: 'New Orders', desc: 'When a buyer purchases one of your offers.', sellerOnly: true },
  { key: 'new_message', label: 'New Messages', desc: 'When someone messages you about an order.', sellerOnly: false },
  { key: 'new_review', label: 'New Reviews', desc: 'When a buyer leaves you a review.', sellerOnly: true },
  { key: 'payout_processed', label: 'Payout Processed', desc: 'When a withdrawal has been paid out.', sellerOnly: true },
  { key: 'marketing', label: 'Marketing & Tips', desc: 'Promotions, tips and platform updates.', sellerOnly: false },
]

const QUERY_KEY = ['settings', 'email-preferences'] as const

export function NotificationsTab({ isSeller }: { isSeller: boolean }) {
  const queryClient = useQueryClient()
  const [savedKey, setSavedKey] = useState<EmailPrefKey | null>(null)
  const [pending, setPending] = useState<EmailPrefKey | null>(null)

  const { data: prefs, isLoading, isError, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const result = await getMyEmailPreferences()
      if (!result.success) throw new Error(result.error)
      return result.prefs
    },
    staleTime: 60_000,
  })

  const rows = ROWS.filter((row) => isSeller || !row.sellerOnly)

  const flip = async (key: EmailPrefKey, value: boolean) => {
    const previous = queryClient.getQueryData<EmailPrefs>(QUERY_KEY)
    queryClient.setQueryData<EmailPrefs>(QUERY_KEY, (old) => (old ? { ...old, [key]: value } : old))
    setPending(key)
    try {
      const result = await setMyEmailPreference(key, value)
      if (!result.success) throw new Error(result.error)
      setSavedKey(key)
      window.setTimeout(() => setSavedKey((k) => (k === key ? null : k)), 1600)
    } catch (err) {
      queryClient.setQueryData(QUERY_KEY, previous)
      toast.error('Couldn’t save that setting', {
        description: err instanceof Error && err.message ? err.message : 'Try again in a moment.',
      })
    } finally {
      setPending(null)
    }
  }

  return (
    <SettingsCard
      title="Email Notifications"
      description="Choose which emails DropMarket sends you. Changes save instantly."
      footerHint="Order receipts, delivery updates, disputes and refunds are always emailed."
    >
      {isError ? (
        <div className="flex flex-col items-center gap-3 rounded-md bg-bg-overlay px-4 py-8 text-center">
          <p className="text-[13px] text-text-secondary">We couldn’t load your email settings.</p>
          <button type="button" onClick={() => void refetch()} className={accountBtn.secondary}>
            Try Again
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-white/[0.07]">
          {rows.map((row) => (
            <li key={row.key}>
              <label className="flex cursor-pointer items-center justify-between gap-4 py-3.5 first:pt-0">
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-sm font-medium text-text-primary">
                    {row.label}
                    <AnimatePresence>
                      {savedKey === row.key && (
                        <motion.span
                          initial={{ opacity: 0, y: 2 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="inline-flex items-center gap-1 text-[12px] font-medium text-success"
                          aria-live="polite"
                        >
                          <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                          Saved
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </span>
                  <span className="mt-0.5 block text-[12.5px] text-text-tertiary">{row.desc}</span>
                </span>
                {isLoading || !prefs ? (
                  <span className="skeleton block h-6 w-11 shrink-0 rounded-full" aria-hidden />
                ) : (
                  <Switch
                    checked={prefs[row.key]}
                    disabled={pending === row.key}
                    onCheckedChange={(on) => void flip(row.key, on)}
                    aria-label={row.label}
                  />
                )}
              </label>
            </li>
          ))}
        </ul>
      )}
    </SettingsCard>
  )
}

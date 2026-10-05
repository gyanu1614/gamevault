'use client'

import { useState } from 'react'
import StorefrontRounded from '@mui/icons-material/StorefrontRounded'
import ScheduleRounded from '@mui/icons-material/ScheduleRounded'
import ErrorOutlineRounded from '@mui/icons-material/ErrorOutlineRounded'
import { toast } from 'sonner'
import StoreAvailabilitySection from '@/components/account/settings/StoreAvailabilitySection'
import { SettingsCard, Field, accountInputCls, accountBtn } from '@/components/account/AccountSurface'
import { SaveButton } from '@/components/account/SaveButton'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useFormState, useSavedFlash } from './_useFormState'
import { StoreBannerCard } from './_StoreBannerCard'
import { shopNameCooldown, shopSlugPreview } from './_settings-model'

interface SellerTabProps {
  /** Saved shop name, or null before the seller has picked one. */
  shopName: string | null
  shopNameUpdatedAt: string | null
  businessName: string
  loading: boolean
  saveShop: (updates: { shop_name?: string; business_name: string }) => Promise<void>
}

export function SellerTab(props: SellerTabProps) {
  return (
    <>
      <StoreAvailabilitySection />
      <ShopIdentityCard {...props} />
      <StoreBannerCard />
    </>
  )
}

function ShopIdentityCard({ shopName, shopNameUpdatedAt, businessName, loading, saveShop }: SellerTabProps) {
  const form = useFormState({ shop_name: shopName ?? '', business_name: businessName })
  const [saving, setSaving] = useState(false)
  const [saved, flashSaved] = useSavedFlash()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const cooldown = shopNameCooldown(shopName, shopNameUpdatedAt)
  const nextName = form.values.shop_name.trim()
  const nameChanged = nextName !== (shopName ?? '')
  const nameError =
    nameChanged && (nextName.length < 3 || nextName.length > 50) ? 'Use 3 to 50 characters.' : null
  const slug = shopSlugPreview(nextName)

  const persist = async () => {
    setSaving(true)
    try {
      await saveShop({
        ...(nameChanged ? { shop_name: nextName } : {}),
        business_name: form.values.business_name.trim(),
      })
      form.commit()
      flashSaved()
      setConfirmOpen(false)
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Couldn’t save your shop details. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const onSave = () => {
    if (nameError) return
    // A rename locks the name for 30 days, so it gets a second look.
    if (nameChanged) setConfirmOpen(true)
    else void persist()
  }

  return (
    <SettingsCard
      title="Shop Identity"
      description="Your shop name is your public storefront and its web address."
      footerHint={
        cooldown.locked ? (
          <span className="inline-flex items-center gap-1.5 text-warning">
            <ScheduleRounded style={{ fontSize: 15 }} aria-hidden />
            You can rename your shop again in {cooldown.daysRemaining} day{cooldown.daysRemaining === 1 ? '' : 's'}.
          </span>
        ) : (
          'You can rename your shop once every 30 days.'
        )
      }
      footerAction={
        <>
          {form.dirty && !saving && (
            <button type="button" onClick={form.discard} className={accountBtn.secondary}>
              Discard
            </button>
          )}
          <SaveButton saving={saving} saved={saved} disabled={!form.dirty || !!nameError || loading} onClick={onSave} label="Save Shop" />
        </>
      }
    >
      <div className="space-y-5">
        {!loading && !shopName && (
          <div className="flex items-start gap-2.5 rounded-md bg-warning-bg px-3.5 py-2.5 text-[13px] text-warning">
            <ErrorOutlineRounded style={{ fontSize: 17 }} className="mt-px shrink-0" aria-hidden />
            Set a shop name before your store goes live.
          </div>
        )}

        <Field
          label="Shop Name"
          htmlFor="settings-shop-name"
          required={!shopName}
          error={nameError}
          hint={
            slug ? (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <StorefrontRounded style={{ fontSize: 15 }} className="shrink-0" aria-hidden />
                <span className="min-w-0 break-all">
                  dropmarket.gg/shop/<span className="text-text-secondary">{slug}</span>
                </span>
              </span>
            ) : null
          }
        >
          {loading ? (
            <div className="skeleton h-11 w-full rounded-md" aria-hidden />
          ) : (
            <input
              id="settings-shop-name"
              name="shop_name"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={form.values.shop_name}
              onChange={(e) => form.set('shop_name', e.target.value)}
              placeholder="Your shop name…"
              disabled={cooldown.locked}
              maxLength={50}
              className={cn(accountInputCls, cooldown.locked && 'cursor-not-allowed')}
            />
          )}
        </Field>

        <Field label="Business Name" htmlFor="settings-business-name" hint="Shown on invoices and your seller profile.">
          <input
            id="settings-business-name"
            name="business_name"
            type="text"
            autoComplete="organization"
            value={form.values.business_name}
            onChange={(e) => form.set('business_name', e.target.value)}
            placeholder="Optional"
            className={accountInputCls}
          />
        </Field>
      </div>

      <Dialog open={confirmOpen} onOpenChange={(open) => !saving && setConfirmOpen(open)}>
        <DialogContent className="max-w-[420px] gap-0 p-5 sm:p-6">
          <DialogTitle className="pr-8 text-base font-semibold text-text-primary">Rename Your Shop?</DialogTitle>
          <DialogDescription className="mt-1.5 text-[13px] leading-relaxed text-text-secondary">
            Your shop will be called <span className="break-words font-semibold text-text-primary">{nextName}</span>.
            You won&apos;t be able to change it again for 30 days.
          </DialogDescription>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setConfirmOpen(false)} disabled={saving} className={accountBtn.secondary}>
              Cancel
            </button>
            <SaveButton saving={saving} saved={false} onClick={() => void persist()} label="Rename Shop" />
          </div>
        </DialogContent>
      </Dialog>
    </SettingsCard>
  )
}

'use client'

/**
 * Account settings. Each tab is a stack of cards (see AccountSurface), and
 * each card saves itself, so Profile edits never ride along with a shop
 * rename or get lost behind one page-wide Save button.
 *
 * No page-level loader: the account layout only mounts this once the user is
 * known, and the forms start from the cached profile, then quietly adopt the
 * fresh one (useFormState) unless the person has started typing.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth, invalidateAuthCache } from '@/hooks/use-auth'
import { useSellerSettings } from '@/hooks/use-seller-settings'
import { settingsApi } from '@/lib/api/seller-compatible'
import { createClient } from '@/lib/supabase/client'
import { getAvatarUrl } from '@/lib/utils/avatar'
import { sellerDisplayName, sellerShopSlug } from '@/lib/seller/identity'
import AccountPageHeader from '@/components/account/AccountPageHeader'
import { SegmentedTabs } from '@/components/account/SegmentedTabs'
import { InformTab, PrivacyTab } from './_PrivacyInformTabs'
import { ProfileTab } from './_ProfileTab'
import { SellerTab } from './_SellerTab'
import { PayoutsTab } from './_PayoutsTab'
import { NotificationsTab } from './_NotificationsTab'
import { SecurityTab } from './_SecurityTab'
import { parseSettingsTab, settingsTabs, type SettingsTab } from './_settings-model'

type FreshProfile = {
  username: string | null
  full_name: string | null
  bio: string | null
  avatar_url: string | null
  business_name: string | null
  created_at: string | null
}

export default function SettingsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const reduceMotion = useReducedMotion()
  const isSeller = user?.isApprovedSeller === true
  const tabs = useMemo(() => settingsTabs(isSeller), [isSeller])

  // ── Tab ⇄ URL (?tab=payouts deep links from the dashboard and wallet) ──
  const [tab, setTab] = useState<SettingsTab>('profile')
  useEffect(() => {
    setTab(parseSettingsTab(new URLSearchParams(window.location.search).get('tab'), isSeller))
  }, [isSeller])
  const selectTab = useCallback((next: SettingsTab) => {
    setTab(next)
    const url = new URL(window.location.href)
    if (next === 'profile') url.searchParams.delete('tab')
    else url.searchParams.set('tab', next)
    window.history.replaceState(null, '', `${url.pathname}${url.search}`)
  }, [])

  // ── Profile: cached first, fresh when it lands ──
  const { data: fresh } = useQuery({
    queryKey: ['settings', 'profile', user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async (): Promise<FreshProfile> => {
      const { data, error } = await createClient()
        .from('profiles')
        // Explicit columns: this runs in the browser.
        .select('username, full_name, bio, avatar_url, business_name, created_at')
        .eq('id', user!.id)
        .single()
      if (error) throw error
      return data as FreshProfile
    },
  })
  const cached = user?.profile
  const username = fresh?.username ?? cached?.username ?? ''
  const profile = useMemo(
    () => ({
      username,
      full_name: fresh?.full_name ?? cached?.full_name ?? '',
      bio: fresh?.bio ?? cached?.bio ?? '',
    }),
    [username, fresh?.full_name, fresh?.bio, cached?.full_name, cached?.bio],
  )
  const businessName = fresh?.business_name ?? cached?.business_name ?? ''
  const createdAt = fresh?.created_at ?? (cached as { created_at?: string } | null)?.created_at ?? null
  const memberSince = createdAt
    ? new Date(createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null

  const [avatarOverride, setAvatarOverride] = useState<string | null>(null)
  const avatarUrl = avatarOverride ?? getAvatarUrl(fresh?.avatar_url ?? cached?.avatar_url, username)

  // Supabase keeps an unconfirmed address on the auth user as `new_email`.
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    createClient().auth.getUser().then(({ data }) => {
      if (active) setPendingEmail((data.user as { new_email?: string } | null)?.new_email ?? null)
    })
    return () => { active = false }
  }, [user?.id])

  /** After any profile write: refresh every copy of the profile on screen. */
  const afterProfileWrite = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['settings', 'profile'] })
    void queryClient.invalidateQueries({ queryKey: ['seller'] })
    if (user?.id) {
      // The navbar and sidebar read the cached auth profile.
      invalidateAuthCache(user.id)
      await createClient().auth.refreshSession()
    }
  }, [queryClient, user?.id])

  const saveProfile = useCallback(
    async (updates: { username: string; full_name: string; bio: string }) => {
      await settingsApi.updateProfile(updates)
      await afterProfileWrite()
    },
    [afterProfileWrite],
  )

  const saveShop = useCallback(
    async (updates: { shop_name?: string; business_name: string }) => {
      await settingsApi.updateProfile(updates)
      await afterProfileWrite()
    },
    [afterProfileWrite],
  )

  if (!user) return null // the layout shows the skeleton until then

  const displayName = isSeller
    ? sellerDisplayName({ shop_name: cached?.shop_name, username }, username)
    : username || 'Your Name'

  return (
    <div className="pb-12">
      <div className="mx-auto w-full max-w-full px-4 sm:px-6 md:max-w-7xl lg:px-8">
        <AccountPageHeader title="Settings" subtitle="Manage your account preferences and configuration" />

        <div className="mt-5 w-full max-w-4xl">
          <SegmentedTabs
            tabs={tabs}
            value={tab}
            onChange={selectTab}
            layoutId="settings-tab-pill"
            idPrefix="settings"
            ariaLabel="Settings sections"
          />

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              role="tabpanel"
              id={`settings-panel-${tab}`}
              aria-labelledby={`settings-tab-${tab}`}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.08 } }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="mt-5 space-y-4"
            >
              {tab === 'profile' && (
                <ProfileTab
                  email={user.email ?? ''}
                  pendingEmail={pendingEmail}
                  onEmailChangeStarted={setPendingEmail}
                  isSeller={isSeller}
                  displayName={displayName}
                  shopSlug={isSeller ? sellerShopSlug({ shop_slug: cached?.shop_slug, username }) : null}
                  memberSince={memberSince}
                  avatarUrl={avatarUrl}
                  onAvatarChanged={(url) => {
                    setAvatarOverride(url)
                    invalidateAuthCache(user.id)
                    void queryClient.invalidateQueries({ queryKey: ['settings', 'profile'] })
                  }}
                  profile={profile}
                  saveProfile={saveProfile}
                />
              )}
              {tab === 'seller' && isSeller && <SellerTabContainer businessName={businessName} saveShop={saveShop} />}
              {tab === 'payouts' && isSeller && <PayoutsTab />}
              {tab === 'notifications' && <NotificationsTab isSeller={isSeller} />}
              {tab === 'security' && <SecurityTab email={user.email ?? null} />}
              {tab === 'privacy' && <PrivacyTab />}
              {tab === 'inform' && isSeller && <InformTab />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

/** Shop name + its 30-day cooldown come from the seller settings query. */
function SellerTabContainer({
  businessName,
  saveShop,
}: {
  businessName: string
  saveShop: (updates: { shop_name?: string; business_name: string }) => Promise<void>
}) {
  const { profile, isLoading } = useSellerSettings()
  return (
    <SellerTab
      shopName={profile.shop_name ?? null}
      shopNameUpdatedAt={profile.shop_name_updated_at ?? null}
      businessName={businessName}
      loading={isLoading}
      saveShop={saveShop}
    />
  )
}

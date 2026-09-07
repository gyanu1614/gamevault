'use client'

import { useState, useEffect } from 'react'
import { useAuth, invalidateAuthCache } from '@/hooks/use-auth'
import { useSellerSettings } from '@/hooks/use-seller-settings'
import { useSellerEarnings } from '@/hooks/use-seller-earnings'
import { uploadProfileAvatar, updatePassword, changeEmail } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  User,
  Bell,
  CreditCard,
  Shield,
  Store,
  Mail,
  Lock,
  Globe,
  Eye,
  EyeOff,
  Save,
  Check,
  AlertCircle,
  Upload,
  Clock,
  DollarSign,
  Loader2,
  Smartphone,
  ChevronRight,
  Zap,
  ShieldCheck,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getAvatarUrl } from '@/lib/utils/avatar'
import { downscaleImageToDataUrl, ImageDecodeError } from '@/lib/utils/image-downscale'
// V19/P21 — Library primitives: shadcn Switch / Card / Tabs replace
// the hand-rolled Toggle / SectionCard / button-sidebar tab UI. ARIA
// + keyboard nav for free.
import { Switch } from '@/components/ui/switch'
import AccountPageHeader from '@/components/account/AccountPageHeader'
import TwoFactorSection from '@/components/account/settings/TwoFactorSection'
import DataPrivacySection from '@/components/account/settings/DataPrivacySection'
import StoreAvailabilitySection from '@/components/account/settings/StoreAvailabilitySection'
import { Label } from '@/components/ui/label'
// Mobile-audit — hand-rolled fixed-center modals replaced with the shared
// dialog base (bottom sheet below sm, centered at sm+, dvh-capped scroll).
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'

type SettingsTab = 'profile' | 'seller' | 'payouts' | 'notifications' | 'security'

// ── Reusable input wrapper (label + hint) ────────────────────────
// V19/P21 — Thin Label-driven wrapper. The actual <input> element is
// passed as children and styled via inputCls (kept consistent with
// the rest of the seller surfaces).
function SettingInput({
  label, hint, required, children,
}: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-text-secondary">
        {label}{required && <span className="ml-1 text-error">*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-text-tertiary">{hint}</p>}
    </div>
  )
}

// ── Section wrapper ──────────────────────────────────────────────
// Deliberately invisible: no surface, no border, no padding. Settings
// content floats directly on the account hero, and sections are separated
// by rhythm (space-y on the parent) plus their own headings rather than by
// stacked panels. Was a shadcn <Card>, whose hard-coded `bg-card` utility
// outranked `.card-frost` (an @layer components class) and painted an
// opaque black box over the hero.
function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>
}

// V19/P21 — Input style. Replaced the violet-500 ring with the
// project's lime-tinted ring so focus matches the rest of the site.
// Mobile-audit — text-base (16px) below sm so iOS Safari doesn't auto-zoom
// + pan on input focus (worst inside the email-change bottom sheet).
const inputCls = 'w-full rounded-lg border border-border-subtle bg-bg-raised px-4 py-2.5 text-base sm:text-sm text-text-primary placeholder:text-text-disabled focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime-tint-bg transition-all'

const usd = (n: number) =>
  (n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth()
  const { profile, isLoading: profileLoading, updateProfile, isUpdating } = useSellerSettings()
  const { stats: earnings, payouts, isLoadingStats, isLoadingPayouts } = useSellerEarnings()
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  // Profile
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [bio, setBio] = useState('')
  const [avatar, setAvatar] = useState('')

  // Email change flow
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [showEmailChange, setShowEmailChange] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailChangeError, setEmailChangeError] = useState<string | null>(null)
  const [emailChangeSent, setEmailChangeSent] = useState(false)
  const [changingEmail, setChangingEmail] = useState(false)

  // Seller
  const [businessName, setBusinessName] = useState('')
  const [shopName, setShopName] = useState('')
  const [shopNameUpdatedAt, setShopNameUpdatedAt] = useState<string | null>(null)
  const [showShopNameConfirmation, setShowShopNameConfirmation] = useState(false)

  // Payouts
  const [paypalEmail, setPaypalEmail] = useState('')

  // Notifications
  const [emailNotifications, setEmailNotifications] = useState({
    newOrder: true,
    newMessage: true,
    newReview: true,
    payoutProcessed: true,
    marketingEmails: false,
  })

  // Security
  const [showPassword, setShowPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)

  // Fetch fresh profile data on mount and when user changes
  useEffect(() => {
    const fetchFreshProfile = async () => {
      if (!user?.id) return

      try {
        const supabase = createClient()
        const { data: freshProfile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single() as any

        if (error) {
          console.error('Error fetching fresh profile:', error)
          // Fall back to cached user.profile data
          if (user.profile) {
            setUsername(user.profile.username || '')
            setFullName(user.profile.full_name || '')
            setEmail(user.email || '')
            setBio(user.profile.bio || '')
            setAvatar(getAvatarUrl(user.profile.avatar_url, user.profile.username))
            setBusinessName(user.profile.business_name || '')
            setPaypalEmail(user.profile.paypal_email || '')
          }
          return
        }

        // Use fresh profile data
        if (freshProfile) {
          setUsername(freshProfile.username || '')
          setFullName(freshProfile.full_name || '')
          setEmail(user.email || '')
          setBio(freshProfile.bio || '')
          setAvatar(getAvatarUrl(freshProfile.avatar_url, freshProfile.username))
          setBusinessName(freshProfile.business_name || '')
          setPaypalEmail(freshProfile.paypal_email || '')
        }
      } catch (err) {
        console.error('Failed to fetch fresh profile:', err)
        // Fall back to cached data
        if (user.profile) {
          setUsername(user.profile.username || '')
          setFullName(user.profile.full_name || '')
          setEmail(user.email || '')
          setBio(user.profile.bio || '')
          setAvatar(user.profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.profile.username}`)
          setBusinessName(user.profile.business_name || '')
          setPaypalEmail(user.profile.paypal_email || '')
        }
      }
    }

    fetchFreshProfile()
  }, [user])

  useEffect(() => {
    if (profile?.shop_name !== undefined) setShopName(profile.shop_name || '')
  }, [profile?.shop_name])

  useEffect(() => {
    if (profile?.shop_name_updated_at !== undefined) setShopNameUpdatedAt(profile.shop_name_updated_at)
  }, [profile?.shop_name_updated_at])

  // Surface a pending email change (Supabase stores the unconfirmed address on
  // the auth user as `new_email` until both inboxes confirm it).
  useEffect(() => {
    let active = true
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (active) setPendingEmail((data.user as any)?.new_email || null)
    })
    return () => { active = false }
  }, [user?.id])

  const handleChangeEmail = async () => {
    setEmailChangeError(null)
    setChangingEmail(true)
    try {
      const result = await changeEmail(newEmail)
      if (result.error) {
        setEmailChangeError(result.error)
        return
      }
      setEmailChangeSent(true)
      setPendingEmail(newEmail.trim().toLowerCase())
    } catch (err: any) {
      setEmailChangeError(err?.message || 'Could not start the email change. Try again.')
    } finally {
      setChangingEmail(false)
    }
  }

  const handleUpdatePassword = async () => {
    if (newPassword.length < 6) {
      toast.error('Password too short', { description: 'Use at least 6 characters.' })
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords don’t match', { description: 'Re-enter your new password.' })
      return
    }
    if (!user?.email) {
      toast.error('Couldn’t verify your account', { description: 'Please sign in again.' })
      return
    }

    setPasswordSaving(true)
    try {
      // Verify the current password before changing it — Supabase itself
      // doesn't require it, so we re-authenticate to confirm identity.
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      })
      if (signInError) {
        toast.error('Current password is incorrect')
        return
      }

      const result = await updatePassword(newPassword)
      if (result.error) {
        toast.error('Couldn’t update password', { description: result.error })
        return
      }

      toast.success('Password updated', { description: 'Use your new password next time you sign in.' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      toast.error('Couldn’t update password', { description: err?.message || 'Try again in a moment.' })
    } finally {
      setPasswordSaving(false)
    }
  }

  const handleSave = async () => {
    try {
      const isShopNameChanged = shopName && shopName !== profile?.shop_name
      if (isShopNameChanged) {
        if (shopName.length < 3 || shopName.length > 50) {
          // Previously thrown into a catch that only console.error'd, so a
          // bad shop name made the Save button do visibly nothing.
          toast.error('Shop name must be between 3 and 50 characters')
          return
        }
        setShowShopNameConfirmation(true)
        return
      }
      await saveSettings()
    } catch (error: any) {
      console.error('Failed to save settings:', error)
      toast.error(error?.message || 'Couldn’t save settings')
    }
  }

  const saveSettings = async () => {
    try {
      // avatar_url is deliberately NOT sent here. `avatar` holds the
      // *rendered* avatar, which is a generated DiceBear URL when the user
      // has none — saving it turned "no avatar" into a permanent hardcoded
      // one seeded with their old username. The upload handler is the only
      // thing that writes avatar_url.
      const updates: any = { username, full_name: fullName, bio, business_name: businessName }
      if (paypalEmail?.trim()) updates.paypal_email = paypalEmail
      if (shopName && shopName !== profile?.shop_name) updates.shop_name = shopName
      await updateProfile(updates)

      // Invalidate cache and force fresh fetch
      if (user?.id) {
        invalidateAuthCache(user.id)
        // Trigger a fresh fetch by forcing auth state change
        const supabase = createClient()
        await supabase.auth.refreshSession()
      }

      toast.success('Settings saved', { description: 'Your changes are live' })
      setShowShopNameConfirmation(false)
    } catch (error: any) {
      console.error('Failed to save settings:', error)
      // updateProfile now throws human-readable messages (taken username,
      // shop-name cooldown, …). Show that, not a generic retry line.
      toast.error(error?.message || 'Couldn’t save settings', {
        description: error?.message ? undefined : 'Try again in a moment.',
      })
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('File size must be less than 5MB')
      return
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setAvatarError('File must be an image')
      return
    }

    try {
      setUploadingAvatar(true)
      setAvatarError(null)

      // Downscale BEFORE encoding. Sending the raw file as base64 blew the
      // Server Action 1 MB body cap for anything over ~750 KB ("Body
      // exceeded 1 MB limit"), which production reported only as an opaque
      // Server Components digest error. 512px is 6x what the largest avatar
      // tile renders at.
      const base64 = await downscaleImageToDataUrl(file, { maxDimension: 512 })

      // Upload to server
      const result = await uploadProfileAvatar(base64)

      if (result.error) {
        setAvatarError(result.error)
        return
      }

      // Update avatar preview with new URL
      if (result.avatarUrl) {
        setAvatar(result.avatarUrl)
        // Without this the navbar and sidebar kept serving the old avatar
        // from the cached auth profile until a full page reload.
        if (user?.id) invalidateAuthCache(user.id)
        toast.success('Avatar updated')
      }
    } catch (error: any) {
      console.error('Avatar upload error:', error)
      // Never surface a framework message. `error.message` here used to be
      // Next's raw body-limit / Server Components text.
      setAvatarError(
        error instanceof ImageDecodeError
          ? error.message
          : 'Couldn’t upload that image. Try a different file.',
      )
    } finally {
      setUploadingAvatar(false)
    }
  }

  const isApprovedSeller = user?.isApprovedSeller === true

  const tabs: { id: SettingsTab; label: string; icon: React.ElementType; desc: string }[] = [
    { id: 'profile',       label: 'Profile',       icon: User,       desc: 'Personal info & avatar' },
    ...(isApprovedSeller ? [
      { id: 'seller' as SettingsTab,  label: 'Seller',        icon: Store,      desc: 'Shop & store settings' },
      { id: 'payouts' as SettingsTab, label: 'Payouts',       icon: CreditCard, desc: 'Earnings & withdrawals' },
    ] : []),
    { id: 'notifications', label: 'Notifications', icon: Bell,       desc: 'Email & push alerts' },
    { id: 'security',      label: 'Security',      icon: Shield,     desc: 'Password & 2FA' },
  ]

  // Cooldown calc for shop name
  let isWithinCooldown = false
  let daysRemaining = 0
  if (profile?.shop_name && shopNameUpdatedAt) {
    const daysSince = (Date.now() - new Date(shopNameUpdatedAt).getTime()) / (1000 * 60 * 60 * 24)
    daysRemaining = Math.ceil(30 - daysSince)
    isWithinCooldown = daysRemaining > 0
  }

  if (authLoading || profileLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-7 w-7 animate-spin text-lime-text" />
          <p className="text-sm text-text-tertiary">Loading settings…</p>
        </div>
      </div>
    )
  }

  return (
    // V22 — Transparent shell (was opaque bg-bg-base "black box") so the
    // account hero bleeds through like every other sidebar page; max-w-7xl
    // + shared AccountPageHeader to match their alignment + title size.
    <div className="min-h-[calc(100vh-3.5rem)] pb-12">
      <div className="mx-auto w-full max-w-full px-4 sm:px-6 md:max-w-7xl lg:px-8">
        {/* V19/P21 — Success toasts now go through the global sonner
            instance (RootLayout). No more page-local AnimatePresence. */}

        <AccountPageHeader
          icon="settings"
          title="Settings"
          subtitle="Manage your account preferences and configuration"
        />

        {/* Settings is a form surface, not a data table: at the page's full
            max-w-7xl the inputs stretched to ~1900px and the eye lost the
            label→field relationship. The PAGE container stays max-w-7xl (site
            standard); only this column is constrained and centred. */}
        <div className="mt-5 w-full max-w-4xl">

          {/* ── Tab nav ── */}
          {/* Full-bleed segmented bar above the content (was a 220px
              vertical card to the left). Tabs share the width evenly at
              sm+; below that the strip scrolls sideways rather than
              wrapping to a second row. 48px targets throughout. */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="min-w-0"
          >
            <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:overflow-visible sm:px-0">
              <div
                role="tablist"
                aria-label="Settings sections"
                className="flex w-full min-w-max gap-1 rounded-lg border border-border-subtle card-frost p-1 sm:min-w-0"
              >
                {tabs.map((tab) => {
                  const active = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      role="tab"
                      aria-selected={active}
                      title={tab.desc}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'flex min-h-[38px] flex-1 shrink-0 items-center justify-center whitespace-nowrap rounded-lg px-4 text-sm font-medium transition-colors duration-150',
                        // The site-wide :focus-visible ring is lime, which
                        // painted a green box around a tab after clicking it.
                        // Overridden to a neutral line rather than removed —
                        // it is the only cue a keyboard user gets.
                        'focus-visible:shadow-[0_0_0_1.5px_rgba(255,255,255,0.22)]',
                        // Selection reads as a filled pill, not an accent:
                        // a lime tint competed with the real lime CTAs.
                        active
                          ? 'bg-bg-overlay-2 text-text-primary shadow-sm'
                          : 'text-text-secondary hover:bg-bg-overlay/60 hover:text-text-primary',
                      )}
                    >
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </motion.div>

          {/* ── Main content ── */}
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-6 min-w-0 space-y-6"
          >

            {/* ── PROFILE ── */}
            {activeTab === 'profile' && (
              <>
                {/* Hero avatar card */}
                <SectionCard>
                  <div className="flex items-start gap-5">
                    {/* Mobile-audit — whole avatar is the file-picker label
                        (80px tap target) and the corner badge grew 28→36px. */}
                    <label className={cn(
                      "relative block shrink-0",
                      uploadingAvatar ? "cursor-not-allowed" : "cursor-pointer"
                    )}>
                      <img
                        src={avatar}
                        alt="Avatar"
                        className={cn(
                          "h-20 w-20 rounded-lg object-cover ring-2 ring-white/10",
                          uploadingAvatar && "opacity-50"
                        )}
                      />
                      <span className={cn(
                        "absolute -bottom-1.5 -right-1.5 flex h-9 w-9 items-center justify-center rounded-full border border-border-subtle bg-bg-overlay text-text-primary shadow-lg transition hover:bg-bg-raised-hover",
                        uploadingAvatar && "opacity-50"
                      )}>
                        {uploadingAvatar ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                      </span>
                      <span className="sr-only">Change avatar</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        className="hidden"
                        disabled={uploadingAvatar}
                      />
                    </label>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-semibold text-text-primary">{username || 'Your Name'}</div>
                      <div className="break-all text-sm text-text-tertiary mt-0.5">{email}</div>
                      <div className="mt-2 text-xs text-text-disabled">JPG, PNG or GIF · Max 5 MB</div>
                      {avatarError && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-error">
                          <AlertCircle className="h-3 w-3" />
                          {avatarError}
                        </div>
                      )}
                      {uploadingAvatar && (
                        <div className="mt-2 text-xs text-lime-text">
                          Uploading avatar...
                        </div>
                      )}
                    </div>
                  </div>
                </SectionCard>

                <SectionCard>
                  <h2 className="text-sm font-semibold text-text-primary mb-4">Profile Information</h2>
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <SettingInput label="Username" required hint="Your unique handle on DropMarket">
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className={inputCls}
                        />
                      </SettingInput>
                      <SettingInput label="Full Name">
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Optional"
                          className={inputCls}
                        />
                      </SettingInput>
                    </div>

                    <SettingInput label="Email" required hint="Your sign-in email — changing it needs confirmation from both your old and new inbox">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="relative flex-1">
                          <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                          <input
                            type="email"
                            value={email}
                            readOnly
                            disabled
                            className={cn(inputCls, 'pl-10 cursor-not-allowed opacity-70')}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => { setNewEmail(''); setEmailChangeError(null); setEmailChangeSent(false); setShowEmailChange(true) }}
                          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-border-subtle bg-bg-overlay px-4 py-3 text-sm font-medium text-text-primary transition-all hover:bg-bg-raised-hover active:scale-95"
                        >
                          Change Email
                        </button>
                      </div>
                      {pendingEmail && pendingEmail !== email && (
                        <div className="mt-2 flex items-center gap-2 rounded-lg border border-warning/20 bg-warning-bg px-4 py-2.5">
                          <Clock className="h-4 w-4 shrink-0 text-warning" />
                          <span className="min-w-0 text-sm text-warning">
                            Pending change to <span className="font-medium break-all">{pendingEmail}</span> — confirm the link sent to both inboxes.
                          </span>
                        </div>
                      )}
                    </SettingInput>

                    <SettingInput label="Bio" hint={`${bio.length}/500`}>
                      <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        rows={4}
                        maxLength={500}
                        placeholder="Tell buyers a little about yourself…"
                        className={cn(inputCls, 'resize-none')}
                      />
                    </SettingInput>
                  </div>
                </SectionCard>
              </>
            )}

            {/* ── SELLER ── */}
            {activeTab === 'seller' && (
              <>
                {/* Vacation mode. Was only reachable from a toggle in the
                    navbar dropdown — nobody going away for a week looks
                    there. eBay and Etsy both put it in settings. */}
                <StoreAvailabilitySection />

                <SectionCard>
                  <h2 className="text-sm font-semibold text-text-primary mb-4">Shop Identity</h2>
                  <div className="space-y-4">
                    {/* Shop name */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-text-secondary">
                        Shop Name{!profile?.shop_name && <span className="ml-1 text-error">*</span>}
                      </label>

                      {!profile?.shop_name && (
                        <div className="mb-3 flex items-center gap-2 rounded-lg border border-warning/20 bg-warning-bg px-4 py-2.5">
                          <AlertCircle className="h-4 w-4 shrink-0 text-warning" />
                          <span className="text-sm text-warning">You must set a shop name before your store goes live</span>
                        </div>
                      )}

                      <input
                        type="text"
                        value={shopName}
                        onChange={(e) => setShopName(e.target.value)}
                        placeholder="My Awesome Game Store"
                        disabled={isWithinCooldown}
                        minLength={3}
                        maxLength={50}
                        className={cn(inputCls, isWithinCooldown && 'cursor-not-allowed opacity-40')}
                      />

                      {isWithinCooldown ? (
                        <div className="mt-2 flex items-center gap-2 text-xs text-warning">
                          <Clock className="h-3.5 w-3.5" />
                          <span>Next change in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}</span>
                        </div>
                      ) : shopName ? (
                        <div className="mt-2 flex items-center gap-2 text-xs text-text-tertiary">
                          <Globe className="h-3.5 w-3.5 shrink-0" />
                          <span className="min-w-0 break-all">
                            dropmarket.gg/shop/
                            <span className="text-lime-text">
                              {shopName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}
                            </span>
                          </span>
                        </div>
                      ) : null}
                      <p className="mt-1.5 text-xs text-text-disabled">You can change your shop name once every 30 days</p>
                    </div>

                    <SettingInput label="Business Name" hint="Shown on invoices and your seller profile">
                      <input
                        type="text"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        className={inputCls}
                      />
                    </SettingInput>
                  </div>
                </SectionCard>
              </>
            )}

            {/* ── PAYOUTS ── */}
            {activeTab === 'payouts' && (
              <>
                {/* Balance hero — real figures from the ledger (same source as /account/wallet) */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg border border-success/30 bg-success-bg p-6"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="h-4 w-4 text-success" />
                    <span className="text-sm font-medium text-success">Available Balance</span>
                  </div>
                  <div className="text-4xl font-bold text-text-primary tracking-tight mb-1">
                    {isLoadingStats ? '—' : usd(earnings.available_balance)}
                  </div>
                  <div className="text-xs text-text-tertiary mb-4">
                    {isLoadingStats ? '' : `${usd(earnings.pending_balance)} pending release`}
                  </div>
                  <Link
                    href="/account/wallet/withdraw"
                    className="inline-flex items-center gap-2 rounded-lg bg-lime px-5 py-3 text-sm font-semibold text-text-inverse transition-all hover:bg-lime-hover active:scale-95"
                  >
                    <DollarSign className="h-4 w-4" />
                    Request Payout
                  </Link>
                </motion.div>

                <SectionCard>
                  <h2 className="text-sm font-semibold text-text-primary mb-4">Payout Method</h2>
                  <div className="space-y-4">
                    <SettingInput label="PayPal Email" required hint="Earnings will be sent to this PayPal account">
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                        <input
                          type="email"
                          value={paypalEmail}
                          onChange={(e) => setPaypalEmail(e.target.value)}
                          className={cn(inputCls, 'pl-10')}
                        />
                      </div>
                    </SettingInput>
                    <Link
                      href="/account/wallet/connect"
                      className="inline-flex items-center gap-2 text-sm font-medium text-lime-text hover:underline"
                    >
                      Manage Payout Connection
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </SectionCard>

                <SectionCard>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-text-primary">Recent Payouts</h2>
                    <Link href="/account/wallet" className="flex items-center gap-1 text-xs font-medium text-lime-text hover:underline">
                      View Payout History <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                  {isLoadingPayouts ? (
                    <div className="space-y-2">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="h-14 animate-pulse rounded-lg bg-bg-overlay" />
                      ))}
                    </div>
                  ) : payouts.length === 0 ? (
                    <p className="py-6 text-center text-sm text-text-secondary">No payouts yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {payouts.slice(0, 5).map((p) => (
                        <div key={p.id} className="flex items-center justify-between rounded-lg border border-border-subtle bg-bg-overlay px-4 py-3">
                          <div>
                            <div className="text-sm font-medium text-text-primary">{usd(p.amount)}</div>
                            <div className="text-xs text-text-tertiary">
                              {new Date(p.completed_at ?? p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                          </div>
                          {p.status === 'completed' ? (
                            <div className="flex items-center gap-1.5 rounded-full border border-success/20 bg-success-bg px-3 py-1 text-xs font-medium text-success">
                              <Check className="h-3 w-3" /> Completed
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 rounded-full border border-border-subtle bg-bg-overlay px-3 py-1 text-xs font-medium text-text-secondary capitalize">
                              <Clock className="h-3 w-3" /> {p.status}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>
              </>
            )}

            {/* ── NOTIFICATIONS ── */}
            {activeTab === 'notifications' && (
              <SectionCard>
                <div className="flex items-center gap-2 mb-1">
                  <Bell className="h-4 w-4 text-lime-text" />
                  <h2 className="text-sm font-semibold text-text-primary">Email Notifications</h2>
                </div>
                <p className="text-xs text-text-tertiary mb-6">Choose which emails you want to receive</p>
                <div className="space-y-0.5">
                  {[
                    { key: 'newOrder',        label: 'New Orders',          desc: 'When a buyer purchases your listing',       icon: Zap },
                    { key: 'newMessage',      label: 'New Messages',        desc: 'When someone sends you a message',           icon: Mail },
                    { key: 'newReview',       label: 'New Reviews',         desc: 'When a buyer leaves a review',              icon: ShieldCheck },
                    { key: 'payoutProcessed', label: 'Payout Processed',    desc: 'When a withdrawal is completed',            icon: DollarSign },
                    { key: 'marketingEmails', label: 'Marketing & Tips',    desc: 'Promotions, tips and platform updates',     icon: Smartphone },
                  ].map((n) => {
                    const Icon = n.icon
                    const enabled = emailNotifications[n.key as keyof typeof emailNotifications]
                    return (
                      // Mobile-audit — the entire 56px row toggles (the
                      // Switch alone was a fiddly ~24px thumb target); the
                      // Switch stops propagation so its own tap doesn't
                      // double-toggle.
                      <div
                        key={n.key}
                        onClick={() => setEmailNotifications({ ...emailNotifications, [n.key]: !enabled })}
                        className={cn(
                          'flex cursor-pointer items-center justify-between gap-3 rounded-lg px-4 py-3.5 transition-all',
                          enabled ? 'bg-bg-overlay border border-border-subtle' : 'border border-transparent'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-lg border transition-all',
                            enabled ? 'bg-lime/15 border-lime-tint-border text-lime-text' : 'bg-bg-overlay border-border-subtle text-text-disabled'
                          )}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-text-primary">{n.label}</div>
                            <div className="text-xs text-text-tertiary">{n.desc}</div>
                          </div>
                        </div>
                        <Switch
                          checked={enabled}
                          onClick={(e) => e.stopPropagation()}
                          onCheckedChange={(v) => setEmailNotifications({ ...emailNotifications, [n.key]: v })}
                        />
                      </div>
                    )
                  })}
                </div>
              </SectionCard>
            )}

            {/* ── SECURITY ── */}
            {activeTab === 'security' && (
              <>
                <SectionCard>
                  <h2 className="text-sm font-semibold text-text-primary mb-4">Change Password</h2>
                  <div className="space-y-4">
                    <SettingInput label="Current Password">
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className={cn(inputCls, 'pl-10 pr-11')}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-text-tertiary hover:text-text-primary transition-colors"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </SettingInput>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <SettingInput label="New Password">
                        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputCls} />
                      </SettingInput>
                      <SettingInput label="Confirm New Password">
                        <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputCls} />
                      </SettingInput>
                    </div>

                    <button
                      type="button"
                      onClick={handleUpdatePassword}
                      disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
                      className="inline-flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-overlay px-5 py-3 text-sm font-medium text-text-primary transition-all hover:bg-bg-raised-hover active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {passwordSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                      {passwordSaving ? 'Updating…' : 'Update Password'}
                    </button>
                  </div>
                </SectionCard>

                <TwoFactorSection />

                <DataPrivacySection />
              </>
            )}

            {/* ── Save bar ── */}
            {activeTab !== 'security' && (
              <div className="flex items-center justify-end gap-3 border-t border-border-subtle pt-5">
                <button
                  onClick={handleSave}
                  disabled={isUpdating}
                  className="inline-flex items-center gap-2 rounded-lg bg-lime px-6 py-3 text-sm font-semibold text-text-inverse transition-all hover:bg-lime-hover active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUpdating ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                  ) : (
                    <><Save className="h-4 w-4" /> Save Changes</>
                  )}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* ── Change email dialog ──
          Mobile-audit — shared DialogContent: bottom sheet below sm,
          centered modal at sm+, dvh-capped with internal scroll. */}
      <Dialog open={showEmailChange} onOpenChange={setShowEmailChange}>
        <DialogContent className="max-w-md gap-0">
          {emailChangeSent ? (
            <>
              <div className="mb-5 flex items-start gap-4 pr-8">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success-bg border border-success/25">
                  <Check className="h-5 w-5 text-success" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-base leading-tight text-text-primary">Confirmation Sent</DialogTitle>
                  <DialogDescription className="mt-1">
                    Check <span className="text-text-primary font-medium">both</span> your current and new inbox
                    (<span className="text-text-primary font-medium break-all">{newEmail.trim().toLowerCase()}</span>) and click
                    the confirmation link to finish the change.
                  </DialogDescription>
                </div>
              </div>
              <button
                onClick={() => setShowEmailChange(false)}
                className="w-full rounded-lg bg-lime px-4 py-3 text-sm font-semibold text-text-inverse transition-all hover:bg-lime-hover active:scale-95"
              >
                Done
              </button>
            </>
          ) : (
            <>
              <div className="mb-5 flex items-start gap-4 pr-8">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-lime/15 border border-lime-tint-border">
                  <Mail className="h-5 w-5 text-lime-text" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-base leading-tight text-text-primary">Change Email</DialogTitle>
                  <DialogDescription className="mt-1">
                    Enter your new email. We&apos;ll send a confirmation link to both your current and new address —
                    the change lands once confirmed.
                  </DialogDescription>
                </div>
              </div>
              <div className="space-y-3">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="new@email.com"
                  className={inputCls}
                />
                {emailChangeError && (
                  <div className="flex items-center gap-1.5 text-xs text-error">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {emailChangeError}
                  </div>
                )}
              </div>
              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => setShowEmailChange(false)}
                  className="flex-1 rounded-lg border border-border-subtle bg-bg-raised px-4 py-3 text-sm font-medium text-text-primary transition-all hover:bg-bg-raised-hover"
                >
                  Cancel
                </button>
                <button
                  onClick={handleChangeEmail}
                  disabled={changingEmail || !newEmail.trim()}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-lime px-4 py-3 text-sm font-semibold text-text-inverse transition-all hover:bg-lime-hover active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {changingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {changingEmail ? 'Sending…' : 'Send Confirmation'}
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Shop name confirmation dialog ── */}
      <Dialog open={showShopNameConfirmation} onOpenChange={setShowShopNameConfirmation}>
        <DialogContent className="max-w-md gap-0">
          <div className="mb-5 flex items-start gap-4 pr-8">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning-bg border border-warning/25">
              <AlertCircle className="h-5 w-5 text-warning" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base leading-tight text-text-primary">Confirm shop name change</DialogTitle>
              <DialogDescription className="mt-1">
                You&apos;re changing your shop name to <span className="text-text-primary font-medium break-words">&ldquo;{shopName}&rdquo;</span>.
                You won&apos;t be able to change it again for 30 days.
              </DialogDescription>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowShopNameConfirmation(false)}
              className="flex-1 rounded-lg border border-border-subtle bg-bg-raised px-4 py-3 text-sm font-medium text-text-primary transition-all hover:bg-bg-raised-hover"
            >
              Cancel
            </button>
            <button
              onClick={saveSettings}
              disabled={isUpdating}
              className="flex-1 rounded-lg bg-lime px-4 py-3 text-sm font-semibold text-text-inverse transition-all hover:bg-lime-hover active:scale-95 disabled:opacity-50"
            >
              {isUpdating ? 'Saving…' : 'Confirm Change'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

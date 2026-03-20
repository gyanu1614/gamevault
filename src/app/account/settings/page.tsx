'use client'

import { useState, useEffect } from 'react'
import { useAuth, invalidateAuthCache } from '@/hooks/use-auth'
import { useSellerSettings } from '@/hooks/use-seller-settings'
import { uploadProfileAvatar } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/client'
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
  Trash2,
  Upload,
  Clock,
  DollarSign,
  Loader2,
  Smartphone,
  ChevronRight,
  Zap,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { getAvatarUrl } from '@/lib/utils/avatar'

type SettingsTab = 'profile' | 'seller' | 'payouts' | 'notifications' | 'security'

// ── Reusable input component ──────────────────────────────────────────────────
function SettingInput({
  label, hint, required, children,
}: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-300">
        {label}{required && <span className="ml-1 text-red-400">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-gray-500">{hint}</p>}
    </div>
  )
}

// ── Toggle switch ─────────────────────────────────────────────────────────────
function Toggle({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={cn(
        'relative h-6 w-11 rounded-full transition-all duration-200 focus:outline-none',
        enabled ? 'bg-violet-500' : 'bg-white/10'
      )}
    >
      <div className={cn(
        'absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200',
        enabled ? 'left-6' : 'left-1'
      )} />
    </button>
  )
}

// ── Section card ─────────────────────────────────────────────────────────────
function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6', className)}>
      {children}
    </div>
  )
}

// ── Input field style ─────────────────────────────────────────────────────────
const inputCls = 'w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all'

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth()
  const { profile, isLoading: profileLoading, updateProfile, isUpdating } = useSellerSettings()
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  // Profile
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [bio, setBio] = useState('')
  const [avatar, setAvatar] = useState('')

  // Seller
  const [businessName, setBusinessName] = useState('')
  const [businessType, setBusinessType] = useState('individual')
  const [vacationMode, setVacationMode] = useState(false)
  const [autoReply, setAutoReply] = useState('')
  const [shopName, setShopName] = useState('')
  const [shopNameUpdatedAt, setShopNameUpdatedAt] = useState<string | null>(null)
  const [showShopNameConfirmation, setShowShopNameConfirmation] = useState(false)

  // Payouts
  const [paypalEmail, setPaypalEmail] = useState('')
  const [minPayout, setMinPayout] = useState('50')
  const [autoWithdraw, setAutoWithdraw] = useState(false)

  // Notifications
  const [emailNotifications, setEmailNotifications] = useState({
    newOrder: true,
    newMessage: true,
    newReview: true,
    payoutProcessed: true,
    marketingEmails: false,
  })

  // Security
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

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
          .single()

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

  const handleSave = async () => {
    try {
      const isShopNameChanged = shopName && shopName !== profile?.shop_name
      if (isShopNameChanged) {
        if (shopName.length < 3 || shopName.length > 50) throw new Error('Shop name must be between 3 and 50 characters')
        setShowShopNameConfirmation(true)
        return
      }
      await saveSettings()
    } catch (error) {
      console.error('Failed to save settings:', error)
    }
  }

  const saveSettings = async () => {
    try {
      const updates: any = { username, full_name: fullName, bio, avatar_url: avatar, business_name: businessName }
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

      setSaveSuccess(true)
      setShowShopNameConfirmation(false)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (error) {
      console.error('Failed to save settings:', error)
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

      // Convert to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      // Upload to server
      const result = await uploadProfileAvatar(base64)

      if (result.error) {
        setAvatarError(result.error)
        return
      }

      // Update avatar preview with new URL
      if (result.avatarUrl) {
        setAvatar(result.avatarUrl)
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
      }
    } catch (error: any) {
      console.error('Avatar upload error:', error)
      setAvatarError(error.message || 'Failed to upload avatar')
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
          <Loader2 className="h-7 w-7 animate-spin text-violet-400" />
          <p className="text-sm text-gray-500">Loading settings…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black pb-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Success toast */}
        <AnimatePresence>
        {saveSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.96 }}
            className="fixed right-4 top-4 z-50 flex items-center gap-3 rounded-2xl border border-green-500/30 bg-green-500/10 px-5 py-3.5 backdrop-blur-xl shadow-2xl"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500">
              <Check className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Settings saved</div>
              <div className="text-xs text-green-400">Your changes are live</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-sm text-gray-400 mt-1">Manage your account preferences and configuration</p>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">

          {/* ── Sidebar nav ── */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 }}
            className="lg:sticky lg:top-8 h-fit"
          >
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-2 space-y-0.5">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const active = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'group flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-all duration-150',
                      active
                        ? 'bg-violet-500/15 border border-violet-500/25 text-white'
                        : 'text-gray-400 hover:bg-white/[0.04] hover:text-white border border-transparent'
                    )}
                  >
                    <div className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-all',
                      active
                        ? 'bg-violet-500/20 border-violet-500/30 text-violet-400'
                        : 'bg-white/[0.04] border-white/[0.06] text-gray-500 group-hover:text-gray-300'
                    )}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className={cn('text-sm font-medium leading-tight', active ? 'text-white' : '')}>{tab.label}</div>
                      <div className="text-[11px] text-gray-600 mt-0.5 truncate">{tab.desc}</div>
                    </div>
                    {active && <ChevronRight className="ml-auto h-3.5 w-3.5 text-violet-400 shrink-0" />}
                  </button>
                )
              })}
            </div>
          </motion.div>

          {/* ── Main content ── */}
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >

            {/* ── PROFILE ── */}
            {activeTab === 'profile' && (
              <>
                {/* Hero avatar card */}
                <SectionCard>
                  <div className="flex items-start gap-5">
                    <div className="relative shrink-0">
                      <img
                        src={avatar}
                        alt="Avatar"
                        className={cn(
                          "h-20 w-20 rounded-2xl object-cover ring-2 ring-white/10",
                          uploadingAvatar && "opacity-50"
                        )}
                      />
                      <label className={cn(
                        "absolute -bottom-1.5 -right-1.5 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-gray-900 text-white shadow-lg transition hover:bg-gray-800",
                        uploadingAvatar && "cursor-not-allowed opacity-50"
                      )}>
                        {uploadingAvatar ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5" />
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarUpload}
                          className="hidden"
                          disabled={uploadingAvatar}
                        />
                      </label>
                    </div>
                    <div>
                      <div className="text-base font-semibold text-white">{username || 'Your Name'}</div>
                      <div className="text-sm text-gray-500 mt-0.5">{email}</div>
                      <div className="mt-2 text-xs text-gray-600">JPG, PNG or GIF · Max 5 MB</div>
                      {avatarError && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
                          <AlertCircle className="h-3 w-3" />
                          {avatarError}
                        </div>
                      )}
                      {uploadingAvatar && (
                        <div className="mt-2 text-xs text-violet-400">
                          Uploading avatar...
                        </div>
                      )}
                    </div>
                  </div>
                </SectionCard>

                <SectionCard>
                  <h2 className="text-sm font-semibold text-white mb-5">Profile Information</h2>
                  <div className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <SettingInput label="Username" required hint="Your unique handle on GameVault">
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

                    <SettingInput label="Email" required>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className={cn(inputCls, 'pl-10')}
                        />
                      </div>
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
                <SectionCard>
                  <h2 className="text-sm font-semibold text-white mb-5">Shop Identity</h2>
                  <div className="space-y-5">
                    {/* Shop name */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-300">
                        Shop Name{!profile?.shop_name && <span className="ml-1 text-red-400">*</span>}
                      </label>

                      {!profile?.shop_name && (
                        <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2.5">
                          <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
                          <span className="text-sm text-amber-300">You must set a shop name before your store goes live</span>
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
                        <div className="mt-2 flex items-center gap-2 text-xs text-cyan-400">
                          <Clock className="h-3.5 w-3.5" />
                          <span>Next change in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}</span>
                        </div>
                      ) : shopName ? (
                        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                          <Globe className="h-3.5 w-3.5" />
                          <span>
                            gamevault.gg/shop/
                            <span className="text-cyan-400">
                              {shopName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}
                            </span>
                          </span>
                        </div>
                      ) : null}
                      <p className="mt-1.5 text-xs text-gray-600">You can change your shop name once every 30 days</p>
                    </div>

                    <SettingInput label="Business Name" hint="Shown on invoices and your seller profile">
                      <input
                        type="text"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        className={inputCls}
                      />
                    </SettingInput>

                    <SettingInput label="Business Type">
                      <select
                        value={businessType}
                        onChange={(e) => setBusinessType(e.target.value)}
                        className={cn(inputCls, 'bg-white/[0.04]')}
                      >
                        <option value="individual" className="bg-gray-900">Individual</option>
                        <option value="company" className="bg-gray-900">Company / Business</option>
                      </select>
                    </SettingInput>
                  </div>
                </SectionCard>

                <SectionCard>
                  <h2 className="text-sm font-semibold text-white mb-4">Store Controls</h2>
                  <div className="space-y-4">
                    {/* Vacation mode */}
                    <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5">
                      <div>
                        <div className="text-sm font-medium text-white">Vacation Mode</div>
                        <div className="text-xs text-gray-500 mt-0.5">Temporarily hide all your listings</div>
                      </div>
                      <Toggle enabled={vacationMode} onChange={() => setVacationMode(!vacationMode)} />
                    </div>
                    {vacationMode && (
                      <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2.5">
                        <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
                        <span className="text-sm text-amber-300">Listings are hidden from buyers</span>
                      </div>
                    )}
                  </div>
                </SectionCard>

                <SectionCard>
                  <h2 className="text-sm font-semibold text-white mb-4">Auto-Reply</h2>
                  <SettingInput label="Message" hint="Automatically sent when a buyer starts a conversation">
                    <textarea
                      value={autoReply}
                      onChange={(e) => setAutoReply(e.target.value)}
                      rows={3}
                      placeholder="Thanks for reaching out! I'll get back to you shortly…"
                      className={cn(inputCls, 'resize-none')}
                    />
                  </SettingInput>
                </SectionCard>
              </>
            )}

            {/* ── PAYOUTS ── */}
            {activeTab === 'payouts' && (
              <>
                {/* Balance hero */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-green-500/30 bg-gradient-to-br from-green-500/10 via-emerald-500/5 to-transparent p-6"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="h-4 w-4 text-green-400" />
                    <span className="text-sm font-medium text-green-400">Available Balance</span>
                  </div>
                  <div className="text-4xl font-bold text-white tracking-tight mb-4">$1,234.56</div>
                  <button className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition-all hover:bg-white/90 active:scale-95">
                    <DollarSign className="h-4 w-4" />
                    Request Payout
                  </button>
                </motion.div>

                <SectionCard>
                  <h2 className="text-sm font-semibold text-white mb-5">Payout Method</h2>
                  <div className="space-y-4">
                    <SettingInput label="PayPal Email" required hint="Earnings will be sent to this PayPal account">
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                        <input
                          type="email"
                          value={paypalEmail}
                          onChange={(e) => setPaypalEmail(e.target.value)}
                          className={cn(inputCls, 'pl-10')}
                        />
                      </div>
                    </SettingInput>

                    <SettingInput label="Minimum Payout Amount" hint="We'll hold your balance until it reaches this threshold">
                      <select
                        value={minPayout}
                        onChange={(e) => setMinPayout(e.target.value)}
                        className={cn(inputCls, 'bg-white/[0.04]')}
                      >
                        {['10','25','50','100','500'].map(v => (
                          <option key={v} value={v} className="bg-gray-900">${v}</option>
                        ))}
                      </select>
                    </SettingInput>

                    <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5">
                      <div>
                        <div className="text-sm font-medium text-white">Auto-Withdraw</div>
                        <div className="text-xs text-gray-500 mt-0.5">Automatically request payout when balance hits minimum</div>
                      </div>
                      <Toggle enabled={autoWithdraw} onChange={() => setAutoWithdraw(!autoWithdraw)} />
                    </div>
                  </div>
                </SectionCard>

                <SectionCard>
                  <h2 className="text-sm font-semibold text-white mb-4">Recent Payouts</h2>
                  <div className="space-y-2">
                    {[
                      { date: 'Jan 15, 2024', amount: 456.78 },
                      { date: 'Jan 1, 2024', amount: 892.34 },
                      { date: 'Dec 15, 2023', amount: 234.56 },
                    ].map((p, i) => (
                      <div key={i} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                        <div>
                          <div className="text-sm font-medium text-white">${p.amount.toFixed(2)}</div>
                          <div className="text-xs text-gray-500">{p.date}</div>
                        </div>
                        <div className="flex items-center gap-1.5 rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-400">
                          <Check className="h-3 w-3" /> Completed
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </>
            )}

            {/* ── NOTIFICATIONS ── */}
            {activeTab === 'notifications' && (
              <SectionCard>
                <div className="flex items-center gap-2 mb-1">
                  <Bell className="h-4 w-4 text-violet-400" />
                  <h2 className="text-sm font-semibold text-white">Email Notifications</h2>
                </div>
                <p className="text-xs text-gray-500 mb-6">Choose which emails you want to receive</p>
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
                      <div
                        key={n.key}
                        className={cn(
                          'flex items-center justify-between rounded-xl px-4 py-3.5 transition-all',
                          enabled ? 'bg-white/[0.03] border border-white/[0.06]' : 'border border-transparent'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-lg border transition-all',
                            enabled ? 'bg-violet-500/15 border-violet-500/20 text-violet-400' : 'bg-white/[0.03] border-white/[0.06] text-gray-600'
                          )}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-white">{n.label}</div>
                            <div className="text-xs text-gray-500">{n.desc}</div>
                          </div>
                        </div>
                        <Toggle
                          enabled={enabled}
                          onChange={() => setEmailNotifications({ ...emailNotifications, [n.key]: !enabled })}
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-xl border',
                        twoFactorEnabled ? 'bg-green-500/15 border-green-500/25 text-green-400' : 'bg-white/[0.04] border-white/[0.08] text-gray-500'
                      )}>
                        <Smartphone className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">Two-Factor Authentication</div>
                        <div className="text-xs text-gray-500 mt-0.5">Protect your account with an authenticator app</div>
                      </div>
                    </div>
                    <Toggle enabled={twoFactorEnabled} onChange={() => setTwoFactorEnabled(!twoFactorEnabled)} />
                  </div>
                  {twoFactorEnabled && (
                    <div className="mt-4 flex items-center gap-2 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-2.5">
                      <ShieldCheck className="h-4 w-4 text-green-400" />
                      <span className="text-sm text-green-300">2FA is active — your account is protected</span>
                    </div>
                  )}
                </SectionCard>

                <SectionCard>
                  <h2 className="text-sm font-semibold text-white mb-5">Change Password</h2>
                  <div className="space-y-4">
                    <SettingInput label="Current Password">
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className={cn(inputCls, 'pl-10 pr-11')}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
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

                    <button className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-white/10 active:scale-95">
                      <Lock className="h-4 w-4" />
                      Update Password
                    </button>
                  </div>
                </SectionCard>

                <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-6">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                    <span className="text-sm font-semibold text-red-400">Danger Zone</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">Permanently delete your account and all associated data. This cannot be undone.</p>
                  <button className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-2.5 text-sm font-semibold text-red-400 transition-all hover:bg-red-500/20 active:scale-95">
                    <Trash2 className="h-4 w-4" />
                    Delete Account
                  </button>
                </div>
              </>
            )}

            {/* ── Save bar ── */}
            {activeTab !== 'security' && (
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={isUpdating}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-violet-600 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* ── Shop name confirmation dialog ── */}
      <AnimatePresence>
        {showShopNameConfirmation && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowShopNameConfirmation(false)}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/[0.08] bg-gray-950 p-6 shadow-2xl"
            >
              <div className="flex items-start gap-4 mb-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/25">
                  <AlertCircle className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Confirm shop name change</h3>
                  <p className="mt-1 text-sm text-gray-400">
                    You're changing your shop name to <span className="text-white font-medium">"{shopName}"</span>.
                    You won't be able to change it again for 30 days.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowShopNameConfirmation(false)}
                  className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={saveSettings}
                  disabled={isUpdating}
                  className="flex-1 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-violet-600 active:scale-95 disabled:opacity-50"
                >
                  {isUpdating ? 'Saving…' : 'Confirm Change'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

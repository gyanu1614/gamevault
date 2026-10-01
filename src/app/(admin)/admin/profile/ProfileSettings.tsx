'use client'

/**
 * Admin profile — the signed-in admin's own account: an identity card
 * (avatar, name, role, email) and the editable name/username form.
 * Saves through PUT /api/admin/profile, unchanged.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CircleNotch, EnvelopeSimple, FloppyDisk, ShieldCheck } from '@phosphor-icons/react'
import { accountInputCls } from '@/components/account/AccountSurface'
import { cn } from '@/lib/utils'
import { adminBtn } from '../components/kit'

interface ProfileSettingsProps {
  admin: {
    userId: string
    email: string
    username: string | null
    full_name: string | null
    avatar_url: string | null
    role: string
    badges?: string[] // Optional
  }
}

const LABEL = 'mb-1.5 block text-[13px] font-medium text-text-secondary'
const HINT = 'mt-1.5 text-[12px] text-text-tertiary'

const roleLabel = (role: string) =>
  role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export default function ProfileSettings({ admin }: ProfileSettingsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState({
    full_name: admin.full_name || '',
    username: admin.username || '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/admin/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile')
      }

      toast.success('Profile updated')
      setTimeout(() => {
        router.refresh()
      }, 1000)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const displayName = admin.full_name || admin.username || 'Admin User'
  const initial = (admin.full_name?.[0] || admin.username?.[0] || admin.email[0] || 'A').toUpperCase()

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Identity */}
      <section className="rounded-lg bg-bg-raised p-5 lg:col-span-1">
        <div className="flex items-center gap-4 lg:flex-col lg:text-center">
          {admin.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={admin.avatar_url} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover lg:h-24 lg:w-24" />
          ) : (
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-white/[0.06] text-[24px] font-bold text-text-primary lg:h-24 lg:w-24 lg:text-[32px]">
              {initial}
            </span>
          )}
          <div className="min-w-0">
            <h2 className="truncate text-[17px] font-semibold text-text-primary">{displayName}</h2>
            {admin.username && <p className="truncate text-[13px] text-text-tertiary">@{admin.username}</p>}
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-lime-tint-bg px-2.5 py-0.5 text-[12px] font-semibold text-lime-text">
              <ShieldCheck aria-hidden weight="bold" className="h-3.5 w-3.5" />
              {roleLabel(admin.role)}
            </span>
          </div>
        </div>

        <div className="mt-5 border-t border-white/[0.06] pt-4">
          <p className="flex items-center gap-2 text-[13px] text-text-secondary lg:justify-center">
            <EnvelopeSimple aria-hidden weight="bold" className="h-4 w-4 shrink-0 text-text-tertiary" />
            <span className="truncate">{admin.email}</span>
          </p>
        </div>

        {admin.badges && admin.badges.length > 0 && (
          <div className="mt-4 border-t border-white/[0.06] pt-4">
            <p className="mb-2 text-[12px] font-medium text-text-tertiary lg:text-center">Badges</p>
            <div className="flex flex-wrap gap-1.5 lg:justify-center">
              {admin.badges.map((badge) => (
                <span key={badge} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[12px] capitalize text-text-secondary">
                  {badge}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Account information */}
      <section className="rounded-lg bg-bg-raised p-5 lg:col-span-2">
        <h2 className="text-[15px] font-semibold text-text-primary">Account Information</h2>
        <p className="mt-1 text-[12.5px] text-text-tertiary">How your name shows to other admins and in audit logs.</p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="profile-full-name" className={LABEL}>Full Name</label>
              <input
                id="profile-full-name"
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className={accountInputCls}
                placeholder="Enter your full name"
                autoComplete="name"
              />
            </div>
            <div>
              <label htmlFor="profile-username" className={LABEL}>Username</label>
              <input
                id="profile-username"
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className={accountInputCls}
                placeholder="Enter your username"
                autoComplete="username"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="profile-email" className={LABEL}>Email</label>
              <input id="profile-email" type="email" value={admin.email} disabled className={accountInputCls} />
              <p className={HINT}>Email cannot be changed</p>
            </div>
            <div>
              <label htmlFor="profile-role" className={LABEL}>Role</label>
              <input id="profile-role" type="text" value={roleLabel(admin.role)} disabled className={accountInputCls} />
              <p className={HINT}>Contact a super admin to change your role</p>
            </div>
          </div>

          <div className="flex justify-end border-t border-white/[0.06] pt-4">
            <button type="submit" disabled={loading} className={cn(adminBtn.primary, 'w-full sm:w-auto')}>
              {loading ? (
                <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
              ) : (
                <FloppyDisk aria-hidden weight="bold" className="h-4 w-4" />
              )}
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

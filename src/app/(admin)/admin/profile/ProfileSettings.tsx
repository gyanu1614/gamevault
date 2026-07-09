'use client'

/**
 * Admin profile settings — V53 restyle on the admin kit.
 * Neutral raised panels, lime accent, kit-style inputs. Entrance
 * animations removed so the server HTML is visible without JS.
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import { IconUser, IconMail, IconShieldCheck, IconDeviceFloppy } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'

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

const INPUT =
  'w-full pl-10 pr-4 py-3 bg-bg-base border border-border-default rounded-lg text-text-primary placeholder:text-text-disabled focus:border-lime focus:outline-none transition-colors'
const INPUT_DISABLED =
  'w-full pl-10 pr-4 py-3 bg-bg-base border border-border-subtle rounded-lg text-text-disabled cursor-not-allowed'

export default function ProfileSettings({ admin }: ProfileSettingsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [formData, setFormData] = useState({
    full_name: admin.full_name || '',
    username: admin.username || '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

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

      setMessage({ type: 'success', text: 'Profile updated successfully!' })
      setTimeout(() => {
        router.refresh()
      }, 1000)
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Profile Card */}
        <div className="rounded-xl border border-border-default bg-bg-raised p-6 lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-lime-pressed">
              <span className="text-3xl font-bold text-text-inverse">
                {admin.full_name?.[0] || admin.username?.[0] || admin.email[0].toUpperCase()}
              </span>
            </div>

            <h3 className="text-lg font-semibold text-text-primary">
              {admin.full_name || admin.username || 'Admin User'}
            </h3>

            <div className="mt-2 rounded-full border border-lime-tint-border bg-lime-tint-bg px-3 py-1">
              <p className="flex items-center gap-1 text-xs font-semibold capitalize text-lime-text">
                <IconShieldCheck className="h-3 w-3" />
                {admin.role.replace('_', ' ')}
              </p>
            </div>

            <div className="mt-4 w-full border-t border-border-subtle pt-4">
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <IconMail className="h-4 w-4" />
                <span className="truncate">{admin.email}</span>
              </div>
            </div>

            {admin.badges && admin.badges.length > 0 && (
              <div className="mt-4 w-full border-t border-border-subtle pt-4">
                <p className="mb-2 text-xs text-text-tertiary">Badges</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {admin.badges.map((badge) => (
                    <span
                      key={badge}
                      className="rounded-full border border-border-default bg-bg-overlay px-2 py-1 text-xs capitalize text-text-secondary"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Settings Form */}
        <div className="rounded-xl border border-border-default bg-bg-raised p-6 lg:col-span-2">
          <h2 className="mb-6 text-lg font-semibold text-text-primary">Account Information</h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Full Name */}
            <div>
              <label className="mb-2 block text-sm font-medium text-text-secondary">
                Full Name
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <IconUser className="h-5 w-5 text-text-tertiary" />
                </div>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className={INPUT}
                  placeholder="Enter your full name"
                />
              </div>
            </div>

            {/* Username */}
            <div>
              <label className="mb-2 block text-sm font-medium text-text-secondary">
                Username
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <IconUser className="h-5 w-5 text-text-tertiary" />
                </div>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className={INPUT}
                  placeholder="Enter your username"
                />
              </div>
            </div>

            {/* Email (Read-only) */}
            <div>
              <label className="mb-2 block text-sm font-medium text-text-secondary">
                Email
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <IconMail className="h-5 w-5 text-text-tertiary" />
                </div>
                <input
                  type="email"
                  value={admin.email}
                  disabled
                  className={INPUT_DISABLED}
                />
              </div>
              <p className="mt-1 text-xs text-text-tertiary">Email cannot be changed</p>
            </div>

            {/* Role (Read-only) */}
            <div>
              <label className="mb-2 block text-sm font-medium text-text-secondary">
                Role
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <IconShieldCheck className="h-5 w-5 text-text-tertiary" />
                </div>
                <input
                  type="text"
                  value={admin.role.replace('_', ' ').toUpperCase()}
                  disabled
                  className={`${INPUT_DISABLED} capitalize`}
                />
              </div>
              <p className="mt-1 text-xs text-text-tertiary">Contact a super admin to change your role</p>
            </div>

            {/* Message */}
            {message && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-lg border p-4 ${
                  message.type === 'success'
                    ? 'border-[rgba(63,217,134,0.25)] bg-success-bg text-success'
                    : 'border-[rgba(255,92,92,0.25)] bg-error-bg text-error'
                }`}
              >
                {message.text}
              </motion.div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-lime-pressed px-6 py-3 font-bold text-text-inverse transition-colors hover:bg-lime disabled:cursor-not-allowed disabled:opacity-50"
            >
              <IconDeviceFloppy className="h-5 w-5" />
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

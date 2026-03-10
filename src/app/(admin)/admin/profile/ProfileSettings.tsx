'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { IconUser, IconMail, IconShieldCheck, IconDeviceFloppy, IconArrowLeft } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-1 bg-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/[0.1] p-6"
        >
          <div className="flex flex-col items-center text-center">
            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center mb-4">
              <span className="text-white text-3xl font-bold">
                {admin.full_name?.[0] || admin.username?.[0] || admin.email[0].toUpperCase()}
              </span>
            </div>

            <h3 className="text-lg font-semibold text-white">
              {admin.full_name || admin.username || 'Admin User'}
            </h3>

            <div className="mt-2 px-3 py-1 rounded-full bg-violet-500/20 border border-violet-500/30">
              <p className="text-xs font-medium text-violet-400 capitalize flex items-center gap-1">
                <IconShieldCheck className="h-3 w-3" />
                {admin.role.replace('_', ' ')}
              </p>
            </div>

            <div className="mt-4 w-full pt-4 border-t border-white/[0.1]">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <IconMail className="h-4 w-4" />
                <span className="truncate">{admin.email}</span>
              </div>
            </div>

            {admin.badges && admin.badges.length > 0 && (
              <div className="mt-4 w-full pt-4 border-t border-white/[0.1]">
                <p className="text-xs text-gray-500 mb-2">Badges</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {admin.badges.map((badge) => (
                    <span
                      key={badge}
                      className="px-2 py-1 text-xs rounded-full bg-white/[0.05] text-gray-300 capitalize"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Settings Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 bg-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/[0.1] p-6"
        >
          <h2 className="text-lg font-semibold text-white mb-6">Account Information</h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <IconUser className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-white/[0.05] border border-white/[0.1] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
                  placeholder="Enter your full name"
                />
              </div>
            </div>

            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <IconUser className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-white/[0.05] border border-white/[0.1] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
                  placeholder="Enter your username"
                />
              </div>
            </div>

            {/* Email (Read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <IconMail className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  type="email"
                  value={admin.email}
                  disabled
                  className="w-full pl-10 pr-4 py-3 bg-white/[0.02] border border-white/[0.05] rounded-lg text-gray-500 cursor-not-allowed"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
            </div>

            {/* Role (Read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Role
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <IconShieldCheck className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  type="text"
                  value={admin.role.replace('_', ' ').toUpperCase()}
                  disabled
                  className="w-full pl-10 pr-4 py-3 bg-white/[0.02] border border-white/[0.05] rounded-lg text-gray-500 cursor-not-allowed capitalize"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">Contact a super admin to change your role</p>
            </div>

            {/* Message */}
            {message && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-lg ${
                  message.type === 'success'
                    ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                    : 'bg-red-500/10 border border-red-500/20 text-red-400'
                }`}
              >
                {message.text}
              </motion.div>
            )}

            {/* Submit Button */}
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <IconDeviceFloppy className="h-5 w-5" />
              {loading ? 'Saving...' : 'Save Changes'}
            </motion.button>
          </form>
        </motion.div>
      </div>
    </div>
  )
}

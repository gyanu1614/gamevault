'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { IconSettings, IconUser } from '@tabler/icons-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import ProfileSettings from '../profile/ProfileSettings'

export default function SettingsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'admin' | 'profile'>('profile')
  const [admin, setAdmin] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAdmin = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login?redirect=/admin/settings')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single() as any

      const { data: adminRole } = await supabase
        .from('admin_roles')
        .select('role')
        .eq('user_id', user.id)
        .single() as any

      setAdmin({
        userId: user.id,
        email: user.email,
        username: profile?.username,
        full_name: profile?.full_name,
        avatar_url: profile?.avatar_url,
        role: adminRole?.role || 'admin',
      })

      setLoading(false)
    }

    fetchAdmin()
  }, [router])

  if (loading || !admin) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-violet-500 border-r-transparent"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-1">Manage your admin account and preferences</p>
      </div>

      {/* Tabs */}
      <div className="bg-black/50 backdrop-blur-xl border border-white/[0.1] rounded-xl p-1.5 inline-flex">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'profile'
              ? 'bg-violet-500 text-white'
              : 'text-gray-400 hover:text-white hover:bg-white/[0.05]'
          }`}
        >
          <div className="flex items-center gap-2">
            <IconUser className="h-4 w-4" />
            Profile
          </div>
        </button>
        <button
          onClick={() => setActiveTab('admin')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'admin'
              ? 'bg-violet-500 text-white'
              : 'text-gray-400 hover:text-white hover:bg-white/[0.05]'
          }`}
        >
          <div className="flex items-center gap-2">
            <IconSettings className="h-4 w-4" />
            Admin Settings
          </div>
        </button>
      </div>

      {/* Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === 'profile' ? (
          <ProfileSettings admin={admin} />
        ) : (
          <div className="bg-black/40 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-12 text-center">
            <IconSettings className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Admin Settings</h3>
            <p className="text-gray-400">
              Admin-level settings and configurations will be available here.
            </p>
          </div>
        )}
      </motion.div>
    </div>
  )
}

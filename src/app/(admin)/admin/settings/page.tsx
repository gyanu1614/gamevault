'use client'

/**
 * /admin/settings — V53 restyle on the admin kit.
 * Neutral surfaces, lime primary for the active tab.
 */

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { IconSettings, IconUser } from '@tabler/icons-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import ProfileSettings from '../profile/ProfileSettings'
import { PageHeader } from '../components/kit'

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
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-lime border-r-transparent"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        className="mb-0"
        title="Settings"
        description="Manage your admin account and preferences"
      />

      {/* Tabs */}
      <div className="inline-flex rounded-xl border border-border-default bg-bg-raised p-1.5">
        <button
          onClick={() => setActiveTab('profile')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'profile'
              ? 'bg-lime-pressed text-text-inverse'
              : 'text-text-tertiary hover:bg-state-hover hover:text-text-primary'
          }`}
        >
          <div className="flex items-center gap-2">
            <IconUser className="h-4 w-4" />
            Profile
          </div>
        </button>
        <button
          onClick={() => setActiveTab('admin')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'admin'
              ? 'bg-lime-pressed text-text-inverse'
              : 'text-text-tertiary hover:bg-state-hover hover:text-text-primary'
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
          <div className="rounded-xl border border-border-default bg-bg-raised p-12 text-center">
            <IconSettings className="mx-auto mb-4 h-16 w-16 text-text-disabled" />
            <h3 className="mb-2 text-xl font-semibold text-text-primary">Admin Settings</h3>
            <p className="text-text-secondary">
              Admin-level settings and configurations will be available here.
            </p>
          </div>
        )}
      </motion.div>
    </div>
  )
}

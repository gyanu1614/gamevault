'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import RestrictionStatus from './RestrictionStatus'
import AccountPageHeader from '@/components/account/AccountPageHeader'
import { AccountCard, AccountPage } from '@/components/account/AccountSurface'
import { RestrictionsSkeleton } from './_RestrictionsSkeleton'

export default function RestrictionsPage() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [restrictions, setRestrictions] = useState<any[]>([])

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      // Get seller profile with restriction info
      const { data: profileData } = await supabase
        .from('profiles')
        // Only what the page shows (no admin identity).
        .select('seller_status, seller_restriction_reason, seller_restricted_at')
        .eq('id', user.id)
        .single()

      // Get restriction history
      const { data: restrictionsData } = await supabase
        .from('seller_restrictions')
        .select('id, restriction_type, reason, created_at')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)

      setProfile(profileData)
      setRestrictions(restrictionsData || [])
      setLoading(false)
    }

    fetchData()
  }, [])

  if (loading) return <RestrictionsSkeleton />

  if (!profile) {
    return (
      <AccountPage>
        <AccountPageHeader title="Account Status" />
        <AccountCard className="mt-6 px-6 py-12 text-center">
          <p className="text-[15px] font-semibold text-text-primary">Couldn’t Load Your Account Status</p>
          <p className="mt-1 text-[13px] text-text-secondary">Refresh the page in a moment.</p>
        </AccountCard>
      </AccountPage>
    )
  }

  return <RestrictionStatus profile={profile} restrictions={restrictions} />
}

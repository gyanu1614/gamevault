'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import RestrictionStatus from './RestrictionStatus'
import { Loader2 } from 'lucide-react'

export default function RestrictionsPage() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [restrictions, setRestrictions] = useState<any[]>([])

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        return
      }

      // Get seller profile with restriction info
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*, restricted_by:seller_restricted_by(username, email)')
        .eq('id', user.id)
        .single()

      // Get restriction history
      const { data: restrictionsData } = await supabase
        .from('seller_restrictions')
        .select('*, admin:restricted_by(username, email)')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)

      setProfile(profileData)
      setRestrictions(restrictionsData || [])
      setLoading(false)
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-lime-text" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="p-6">
        <p className="text-text-secondary">Unable to load restriction information.</p>
      </div>
    )
  }

  return <RestrictionStatus profile={profile} restrictions={restrictions} />
}

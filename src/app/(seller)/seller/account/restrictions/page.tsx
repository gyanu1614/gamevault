import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RestrictionStatus from './RestrictionStatus'

export default async function SellerRestrictionsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/seller/account/restrictions')
  }

  // Get seller profile with restriction info
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, restricted_by:seller_restricted_by(username, email)')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  // Get restriction history
  const { data: restrictions } = await supabase
    .from('seller_restrictions')
    .select('*, admin:restricted_by(username, email)')
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  return <RestrictionStatus profile={profile} restrictions={restrictions || []} />
}

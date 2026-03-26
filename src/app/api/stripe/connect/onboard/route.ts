import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createConnectAccount } from '@/lib/stripe/connect'

export async function POST() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify the user is a seller
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, seller_tier')
    .eq('id', user.id)
    .single() as any

  if (!profile || profile.role !== 'seller') {
    return NextResponse.json(
      { error: 'Only verified sellers can connect a payout account' },
      { status: 403 }
    )
  }

  try {
    const { accountId, onboardingUrl } = await createConnectAccount(user.id)
    return NextResponse.json({ accountId, onboardingUrl })
  } catch (err) {
    console.error('[Connect/onboard]', err)
    return NextResponse.json(
      { error: 'Failed to create Connect account' },
      { status: 500 }
    )
  }
}

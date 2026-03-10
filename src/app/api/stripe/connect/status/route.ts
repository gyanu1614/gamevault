import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getConnectAccountStatus } from '@/lib/stripe/connect'

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const status = await getConnectAccountStatus(user.id)
    return NextResponse.json(status)
  } catch (err) {
    console.error('[Connect/status]', err)
    return NextResponse.json(
      { error: 'Failed to fetch account status' },
      { status: 500 }
    )
  }
}

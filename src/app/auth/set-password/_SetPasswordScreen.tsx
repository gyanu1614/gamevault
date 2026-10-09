'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { needsPassword, sanitizeNext } from '@/lib/auth/oauth'
import { SetPasswordDialog } from '@/components/auth/SetPasswordDialog'

export default function SetPasswordScreen() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = sanitizeNext(searchParams?.get('next'))
  const { user, loading } = useAuth()

  // Signed out → log in first (the middleware brings them back if needed).
  // Already has a password → nothing to do here.
  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace(`/login?redirect=${encodeURIComponent(next)}`)
      return
    }
    if (!needsPassword(user)) router.replace(next)
  }, [loading, user, next, router])

  const open = !loading && !!user && needsPassword(user)
  return (
    <SetPasswordDialog
      open={open}
      email={user?.email}
      provider={user?.app_metadata?.provider}
      onSaved={() => router.replace(next)}
    />
  )
}

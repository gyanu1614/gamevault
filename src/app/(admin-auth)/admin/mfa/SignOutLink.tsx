'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/** "Not you?" exit from the 2FA gate, which otherwise has no way out. */
export function SignOutLink() {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  const signOut = async () => {
    setPending(true)
    await createClient().auth.signOut()
    router.replace('/')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      className="font-semibold text-text-secondary underline-offset-4 transition-colors hover:text-text-primary hover:underline disabled:opacity-60"
    >
      {pending ? 'Signing Out…' : 'Sign Out'}
    </button>
  )
}

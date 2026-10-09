import type { Metadata } from 'next'
import { Suspense } from 'react'
import SetPasswordForm from './_SetPasswordForm'
import { SetPasswordShell, SetPasswordSkeleton } from './_shell'

export const metadata: Metadata = {
  title: 'Set Your Password',
  robots: { index: false, follow: false },
}

/**
 * Required password after a Google / Discord sign-in. The form reads the
 * session in the browser (useAuth) and `next` from the URL; the server
 * action refuses any account that already has a password.
 */
export default function SetPasswordPage() {
  return (
    <SetPasswordShell>
      <Suspense fallback={<SetPasswordSkeleton />}>
        <SetPasswordForm />
      </Suspense>
    </SetPasswordShell>
  )
}

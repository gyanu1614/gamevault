import type { Metadata } from 'next'
import { Suspense } from 'react'
import { HeroBackdrop, HeroBackdropPreload } from '@/components/hero-backdrop'
import SetPasswordScreen from './_SetPasswordScreen'

export const metadata: Metadata = {
  title: 'Set Your Password',
  robots: { index: false, follow: false },
}

/**
 * Server-side fallback for the required password: the middleware sends a
 * password-less Google/Discord account here from any protected route
 * (?next= carries the destination). The homepage hero sits behind the same
 * modal every other page shows in place; saving continues to `next`.
 */
export default function SetPasswordPage() {
  return (
    <>
      <HeroBackdropPreload name="home" />
      <HeroBackdrop name="home" className="hero-dim">
        <div className="min-h-[calc(100dvh-4rem)]" aria-hidden />
      </HeroBackdrop>
      <Suspense fallback={null}>
        <SetPasswordScreen />
      </Suspense>
    </>
  )
}

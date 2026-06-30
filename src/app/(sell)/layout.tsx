/**
 * /sell route group — own minimal layout. No global navbar/footer
 * (excluded in layout-wrapper.tsx via the /sell path prefix), no
 * sidebar, no account shell. Just the wizard, full bleed.
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HeroBackdrop, HeroBackdropPreload } from '@/components/hero-backdrop'

export default async function SellLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    // Preserve return path so login can bounce back to the wizard
    redirect('/login?redirect=/sell/new')
  }

  // V21/P7.c — Sell wizard gets its own hero (`sell.avif`). Distinct
  // amber/lime accent vs. marketplace so creator-mode feels different
  // from buyer-mode. The wizard card sits as the only opaque surface
  // on top; the hero frames it the same way as marketplace pages.
  return (
    <>
      <HeroBackdropPreload name="sell" />
      <HeroBackdrop name="sell" className="text-text-primary">
        {children}
      </HeroBackdrop>
    </>
  )
}

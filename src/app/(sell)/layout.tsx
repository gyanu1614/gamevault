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
      {/* `hero-dim` pushes the sell hero back behind the form. With the
          navbar gone the artwork sits directly behind the inputs, and
          at full strength it competed with them for attention — the
          backdrop should frame the task, not fight it. */}
      {/* `overflow-hidden` clips the decorative backdrop, which is taller
          than the viewport by design (fixed --hero-height). On a page
          that is meant to fit exactly one screen it was the only thing
          producing a scrollbar — the art can crop, the layout cannot. */}
      <HeroBackdrop
        name="sell"
        className="hero-dim overflow-hidden text-text-primary"
      >
        {children}
      </HeroBackdrop>
    </>
  )
}

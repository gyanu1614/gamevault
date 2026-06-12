/**
 * /sell route group — own minimal layout. No global navbar/footer
 * (excluded in layout-wrapper.tsx via the /sell path prefix), no
 * sidebar, no account shell. Just the wizard, full bleed.
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function SellLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    // Preserve return path so login can bounce back to the wizard
    redirect('/login?redirect=/sell/new')
  }

  return (
    <div className="relative min-h-screen bg-bg-base text-text-primary">
      {/* Subtle lime glow on the page surface — matches the homepage idiom */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-bg-base" />
        <div className="absolute top-0 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-lime-tint-bg blur-[110px] opacity-60" />
      </div>
      {children}
    </div>
  )
}

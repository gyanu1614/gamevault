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
    <div className="relative min-h-screen bg-[#0a0a0f] text-white">
      {/* Soft gradient backdrop, matches Apple-feel */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-[#0a0a0f] to-black" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/10 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-lime-500/[0.06] via-transparent to-transparent" />
      </div>
      {children}
    </div>
  )
}

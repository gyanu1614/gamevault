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
    <div className="relative min-h-screen bg-black text-white">
      {/* Homepage-matching backdrop: violet -> purple -> cyan glow on black */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-[#0a0a0f] to-black" />
        <div className="absolute top-0 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-violet-500/[0.10] blur-[110px]" />
        <div className="absolute bottom-0 right-0 h-[420px] w-[420px] rounded-full bg-cyan-500/[0.06] blur-[110px]" />
      </div>
      {children}
    </div>
  )
}

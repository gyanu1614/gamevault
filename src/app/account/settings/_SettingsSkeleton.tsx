/**
 * Settings skeleton: the Profile tab exactly as page.tsx draws it (header,
 * tab row, identity card, Public Profile card, Email card). Used by
 * loading.tsx and by the account layout while sign-in resolves, so the route
 * never swaps one skeleton for another. Keep it in lockstep with page.tsx.
 */

import { cn } from '@/lib/utils'

/** Tab label widths (13px semibold + px-3), seller set in order. */
const TAB_WIDTHS = [57, 55, 66, 99, 70, 108, 135]
const BUYER_TAB_WIDTHS = [57, 99, 70, 108]

function Bar({ className }: { className: string }) {
  return <div className={cn('skeleton rounded', className)} />
}

function FieldSkeleton({ tall = false, hint = false }: { tall?: boolean; hint?: boolean }) {
  return (
    <div className="space-y-2">
      <Bar className="h-4 w-20" />
      <Bar className={cn('w-full rounded-md', tall ? 'h-[112px]' : 'h-11')} />
      {hint && <Bar className="h-3.5 w-52 max-w-full" />}
    </div>
  )
}

function CardSkeleton({ children, footer = true }: { children: React.ReactNode; footer?: boolean }) {
  return (
    <div className="overflow-hidden rounded-lg bg-bg-raised">
      <div className="p-5 sm:p-6">
        <Bar className="h-4 w-32" />
        <Bar className="mt-2 h-3.5 w-64 max-w-full" />
        <div className="mt-5">{children}</div>
      </div>
      {footer && (
        <div className="flex items-center justify-between gap-3 border-t border-white/[0.07] bg-black/[0.14] px-5 py-3 sm:px-6">
          <Bar className="h-3.5 w-44 max-w-[50%]" />
          <Bar className="h-10 w-24 rounded-md" />
        </div>
      )}
    </div>
  )
}

export function SettingsSkeleton({ isSeller = true }: { isSeller?: boolean }) {
  const tabs = isSeller ? TAB_WIDTHS : BUYER_TAB_WIDTHS
  return (
    <div className="pb-12" aria-busy aria-label="Loading settings">
      <div className="mx-auto w-full max-w-full px-4 sm:px-6 md:max-w-7xl lg:px-8">
        {/* AccountPageHeader: 24px title + 13px subtitle */}
        <Bar className="h-8 w-32 rounded-md" />
        <Bar className="mt-1.5 h-4 w-80 max-w-full" />

        <div className="mt-5 w-full max-w-4xl">
          <div className="flex w-fit max-w-full gap-1 overflow-hidden rounded-md border border-white/[0.08] bg-[rgba(20,20,27,0.56)] p-1">
            {tabs.map((w, i) => (
              <div key={i} className={cn('h-8 shrink-0 rounded-[5px]', i === 0 ? 'bg-white/[0.09]' : 'skeleton opacity-40')} style={{ width: w }} />
            ))}
          </div>

          <div className="mt-5 space-y-4">
            {/* Identity */}
            <div className="flex items-center gap-4 rounded-lg bg-bg-raised p-5 sm:gap-5 sm:p-6">
              <div className="skeleton h-[72px] w-[72px] shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <Bar className="h-5 w-40" />
                <Bar className="mt-2 h-4 w-56 max-w-full" />
                <Bar className="mt-2.5 h-3 w-64 max-w-full" />
              </div>
              {isSeller && <Bar className="hidden h-10 w-28 rounded-md sm:block" />}
            </div>

            {/* Public Profile */}
            <CardSkeleton>
              <div className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <FieldSkeleton hint />
                  <FieldSkeleton />
                </div>
                <FieldSkeleton tall />
              </div>
            </CardSkeleton>

            {/* Email */}
            <CardSkeleton>
              <Bar className="h-11 w-full rounded-md" />
            </CardSkeleton>
          </div>
        </div>
      </div>
    </div>
  )
}

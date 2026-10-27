import { cn } from '@/lib/utils'
import { SUBNAV_BG, SUBNAV_LOGO, SUBNAV_ROW, SUBNAV_SLOT, SUBNAV_STRIP } from './subnav-tab'

function Bone({ className }: { className: string }) {
  return <div className={cn('animate-pulse rounded-md bg-white/[0.07]', className)} />
}

/** One tab's footprint: icon + label at the real tab's padding and height. */
function TabBone({ label = 'w-14' }: { label?: string }) {
  return (
    <div className="flex shrink-0 items-center gap-2 max-md:px-3 max-md:py-2.5 md:h-[60px] md:px-4">
      <Bone className="h-[17px] w-[17px] md:h-[18px] md:w-[18px]" />
      <Bone className={cn('h-3.5', label)} />
    </div>
  )
}

/**
 * The GameSubNav strip while a game page loads: same slot, strip and row
 * classes (subnav-tab.tsx), so nothing moves when the real bar swaps in.
 * `tabs` is the category count the page usually shows.
 */
export default function GameSubNavSkeleton({ tabs = 2 }: { tabs?: number }) {
  return (
    <div aria-hidden className={SUBNAV_SLOT}>
      <div className={SUBNAV_STRIP} style={{ backgroundColor: SUBNAV_BG }}>
        <div className={SUBNAV_ROW}>
          <div className="flex shrink-0 items-center gap-2.5 justify-self-start px-2.5 py-2 md:gap-3 md:px-0 max-md:gap-1.5 max-md:px-1.5 max-md:py-1">
            <Bone className={SUBNAV_LOGO} />
            <Bone className="h-3.5 w-20 md:h-5 md:w-28" />
          </div>
          <div className="mx-1 h-4 w-px shrink-0 bg-white/[0.12] md:hidden" />
          <div className="flex min-w-0 items-center overflow-hidden max-md:flex-1 max-md:gap-1 md:justify-self-center">
            {Array.from({ length: tabs }).map((_, i) => (
              <TabBone key={i} />
            ))}
          </div>
          <div className="hidden justify-self-end md:flex">
            <TabBone label="w-28" />
          </div>
        </div>
      </div>
    </div>
  )
}

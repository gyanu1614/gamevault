import { cn } from '@/lib/utils'
import { SUBNAV_BG, SUBNAV_LOGO, SUBNAV_ROW, SUBNAV_SLOT, SUBNAV_STRIP } from './subnav-tab'

function Bone({ className }: { className: string }) {
  return <div className={cn('animate-pulse rounded-md bg-white/[0.07]', className)} />
}

/** One tab's footprint: icon + label at the real tab's padding and height. */
function TabBone({ label = 'w-14' }: { label?: string }) {
  return (
    <div className="flex shrink-0 items-center gap-2 max-md:h-10 max-md:px-3 md:h-[52px] md:px-4">
      <Bone className="h-[17px] w-[17px] md:h-[18px] md:w-[18px]" />
      <Bone className={cn('h-3.5', label)} />
    </div>
  )
}

/**
 * The GameSubNav strip while a game page loads: same slot, strip and row
 * classes (subnav-tab.tsx), so nothing moves when the real bar swaps in.
 * `tabs` is the category count the page usually shows; `phoneBack` draws the
 * back row phones get inside a listing.
 */
export default function GameSubNavSkeleton({ tabs = 2, phoneBack = false }: { tabs?: number; phoneBack?: boolean }) {
  return (
    <div aria-hidden className={SUBNAV_SLOT}>
      <div className={cn(SUBNAV_STRIP, phoneBack && 'max-md:shadow-none')} style={{ backgroundColor: SUBNAV_BG }}>
        {phoneBack ? (
          <div className="flex w-full items-center md:hidden">
            <Bone className="h-11 w-11 shrink-0" />
            <Bone className="mx-auto h-4 w-24" />
            <span className="flex w-11 shrink-0 justify-end">
              <Bone className="h-9 w-9" />
            </span>
          </div>
        ) : null}
        <div className={cn(SUBNAV_ROW, phoneBack && 'max-md:hidden')}>
          <div className="flex shrink-0 items-center gap-2.5 justify-self-start px-2.5 py-2 md:gap-3 md:px-0 max-md:gap-1.5 max-md:px-1.5 max-md:py-1">
            <Bone className={SUBNAV_LOGO} />
            <Bone className="h-3.5 w-20 md:h-4 md:w-20" />
          </div>
          <div className="mx-1 h-4 w-px shrink-0 bg-white/[0.12] md:hidden" />
          <div className="flex min-w-0 items-center overflow-hidden max-md:flex-1 max-md:gap-1 md:justify-self-center">
            {Array.from({ length: tabs }).map((_, i) => (
              <TabBone key={i} />
            ))}
          </div>
          <Bone className="ml-1 h-9 w-9 shrink-0 md:hidden" />
          <div className="hidden items-center gap-3 justify-self-end md:flex">
            <TabBone label="w-28" />
            <Bone className="h-9 w-[132px] max-lg:hidden" />
            <Bone className="h-9 w-9 xl:w-[126px]" />
          </div>
        </div>
      </div>
    </div>
  )
}

import { Block } from '../../[categorySlug]/_ItemsSkeleton'
import { VALUE_SURFACE } from '@/components/values/styles'

/**
 * Item-page skeleton — the fallback of ValueListItemPage's in-page Suspense
 * (the route has already 404'd anything without a page, so this never fronts
 * a soft 404). Mirrors ItemBody with the same wrappers: hero card (176px art ·
 * identity + 5 stat rows · 260px price column, footer band) → optional form
 * switch → Available Now → About heading, callout and 4 stat cells.
 */
export function ValueListItemSkeleton({ withForms }: { withForms: boolean }) {
  return (
    <div aria-busy aria-label="Loading item value">
      <div className="mx-auto w-full max-w-7xl px-4 pb-6 pt-6 sm:px-6 lg:px-8">
        <div className="space-y-4">
          <div className={`overflow-hidden ${VALUE_SURFACE}`}>
            <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[176px_minmax(0,1fr)_260px] lg:items-center">
              <div className="mx-auto flex h-[168px] w-[168px] items-center justify-center lg:mx-0">
                <Block className="h-[140px] w-[140px] rounded-lg" />
              </div>
              <div className="min-w-0">
                <Block className="h-3.5 w-28" />
                <Block className="mt-2.5 h-7 w-56" />
                <div className="mt-4">
                  {Array.from({ length: 5 }, (_, i) => (
                    <div key={i} className="flex items-center justify-between py-2.5 [&+&]:border-t [&+&]:border-white/[0.07]">
                      <Block className="h-3.5 w-20" />
                      <Block className="h-3.5 w-24" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col lg:items-end">
                <Block className="h-3 w-24" />
                <Block className="mt-2 h-9 w-36" />
                <Block className="mt-3 h-7 w-40" />
                <Block className="mt-4 h-11 w-full lg:w-48" />
                <Block className="mt-2 h-11 w-full lg:w-56" />
              </div>
            </div>
            <div className="flex justify-center border-t border-white/[0.07] px-5 py-3.5">
              <Block className="h-3.5 w-44" />
            </div>
          </div>
          {withForms && (
            <div className={`${VALUE_SURFACE} p-4 sm:p-5`}>
              <Block className="h-3 w-10" />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Block className="h-11" />
                <Block className="h-11" />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 pt-7 sm:px-6 lg:px-8">
        <Block className="mb-4 h-6 w-36" />
        <Block className="h-[132px] w-full rounded-lg" />
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Block className="mb-5 h-8 w-72" />
        <Block className="h-[104px] w-full rounded-lg" />
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Block key={i} className="h-[76px] rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}

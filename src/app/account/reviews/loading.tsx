/**
 * Feedback skeleton: header, stat panel, rating tabs + search, review cards
 * (avatar + name, stars, comment, reply button), as reviews/page.tsx draws them.
 */

import { Sk, SkPage, SkStatStrip, SkTabs } from '@/components/account/AccountSkeletons'

export default function ReviewsLoading() {
  return (
    <SkPage titleWidth="w-36">
      <div className="mt-6 space-y-4">
        <SkStatStrip count={4} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SkTabs widths={[52, 78, 78, 78, 78, 72]} />
          <Sk className="h-10 w-full rounded-md sm:w-72" />
        </div>
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-lg bg-bg-raised p-5 sm:p-6" aria-hidden>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Sk className="h-10 w-10 rounded-full" />
                  <div className="space-y-1.5">
                    <Sk className="h-4 w-28" />
                    <Sk className="h-3 w-40" />
                  </div>
                </div>
                <Sk className="h-4 w-24" />
              </div>
              <Sk className="mt-4 h-3.5 w-full max-w-[560px]" />
              <Sk className="mt-2 h-3.5 w-2/3 max-w-[380px]" />
              <Sk className="mt-4 h-9 w-16 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </SkPage>
  )
}

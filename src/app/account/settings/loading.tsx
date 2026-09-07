/**
 * Settings skeleton — mirrors the real page's Profile tab 1:1.
 *
 * Keep this in lockstep with page.tsx: same max-w-7xl page container, same
 * centred max-w-4xl column, same segmented tab bar, and NO panels (settings
 * content floats on the account hero). A skeleton that draws a different
 * layout makes the page visibly jump when data lands.
 */

/** Label + field + hint, matching <SettingInput> + inputCls. */
function FieldSkeleton({ hint = false }: { hint?: boolean }) {
  return (
    <div className="space-y-2">
      <div className="skeleton h-4 w-24 rounded" />
      <div className="skeleton h-[42px] w-full rounded-lg" />
      {hint && <div className="skeleton h-3 w-44 rounded" />}
    </div>
  )
}

export default function SettingsLoading() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] pb-12">
      <div className="mx-auto w-full max-w-full px-4 sm:px-6 md:max-w-7xl lg:px-8">
        {/* AccountPageHeader — 24px title + 13px subtitle */}
        <div className="pt-2">
          <div className="skeleton h-7 w-28 rounded-lg" />
          <div className="skeleton mt-2 h-4 w-72 rounded" />
        </div>

        <div className="mt-5 w-full max-w-4xl">
          {/* Segmented tab bar — 5 tabs sharing the width evenly */}
          <div className="flex w-full gap-1 rounded-lg border border-border-subtle card-frost p-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex h-[38px] flex-1 items-center justify-center">
                <div className="skeleton h-4 w-20 rounded" />
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-6">
            {/* Avatar hero row */}
            <div className="flex items-start gap-5">
              <div className="skeleton h-20 w-20 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="skeleton h-5 w-40 rounded" />
                <div className="skeleton h-4 w-56 rounded" />
                <div className="skeleton h-3 w-48 rounded" />
              </div>
            </div>

            {/* Profile Information */}
            <div>
              <div className="skeleton mb-4 h-4 w-36 rounded" />
              <div className="space-y-4">
                {/* Username + Full Name */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldSkeleton hint />
                  <FieldSkeleton />
                </div>
                {/* Email + Change Email */}
                <div className="space-y-2">
                  <div className="skeleton h-4 w-16 rounded" />
                  <div className="flex gap-3">
                    <div className="skeleton h-[42px] flex-1 rounded-lg" />
                    <div className="skeleton h-[42px] w-32 shrink-0 rounded-lg" />
                  </div>
                  <div className="skeleton h-3 w-80 rounded" />
                </div>
                {/* Bio */}
                <div className="space-y-2">
                  <div className="skeleton h-4 w-10 rounded" />
                  <div className="skeleton h-24 w-full rounded-lg" />
                </div>
              </div>
            </div>

            {/* Save bar */}
            <div className="flex justify-end border-t border-border-subtle pt-5">
              <div className="skeleton h-11 w-36 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

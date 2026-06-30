export default function SettingsLoading() {
  return (
    <div className="max-w-2xl space-y-8">
      <div className="space-y-1">
        <div className="skeleton h-7 w-24 rounded-lg" />
        <div className="skeleton h-4 w-40 rounded" />
      </div>
      {/* Profile section */}
      <div className="rounded-lg card-frost border border-border-subtle p-6 space-y-5">
        <div className="skeleton h-4 w-28 rounded" />
        <div className="flex items-center gap-4">
          <div className="skeleton h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <div className="skeleton h-8 w-28 rounded-lg" />
            <div className="skeleton h-3 w-40 rounded" />
          </div>
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="skeleton h-3 w-20 rounded" />
            <div className="skeleton h-10 w-full rounded-xl" />
          </div>
        ))}
      </div>
      {/* Security section */}
      <div className="rounded-lg card-frost border border-border-subtle p-6 space-y-5">
        <div className="skeleton h-4 w-24 rounded" />
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="skeleton h-3 w-20 rounded" />
            <div className="skeleton h-10 w-full rounded-xl" />
          </div>
        ))}
        <div className="skeleton h-10 w-36 rounded-xl" />
      </div>
    </div>
  )
}

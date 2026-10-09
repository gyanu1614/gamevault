/** Layout + skeleton for /auth/set-password (shared by page and loading). */

export function SetPasswordShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-[calc(100dvh-4rem)] items-start justify-center bg-bg-base px-4 pb-16 pt-10 sm:items-center sm:pt-0">
      <div className="w-full max-w-[420px]">{children}</div>
    </main>
  )
}

export function SetPasswordSkeleton() {
  return (
    <div className="animate-pulse space-y-5" aria-hidden>
      <div className="h-7 w-56 rounded bg-white/[0.08]" />
      <div className="h-4 w-full rounded bg-white/[0.06]" />
      <div className="h-4 w-3/4 rounded bg-white/[0.06]" />
      <div className="mt-2 h-4 w-20 rounded bg-white/[0.06]" />
      <div className="h-11 w-full rounded-md bg-white/[0.06]" />
      <div className="h-11 w-full rounded-md bg-white/[0.10]" />
    </div>
  )
}

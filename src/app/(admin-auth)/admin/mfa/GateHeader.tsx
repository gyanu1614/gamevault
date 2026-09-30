import type { ReactNode } from 'react'

/** Icon tile + title + one line of help, shared by the verify and set-up steps. */
export function GateHeader({
  icon,
  title,
  children,
}: {
  icon: ReactNode
  title: string
  children: ReactNode
}) {
  return (
    <div className="mb-6">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-white/[0.05] text-text-primary">
        {icon}
      </div>
      <h1 className="text-[20px] font-bold leading-tight tracking-tight text-text-primary">{title}</h1>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-text-secondary">{children}</p>
    </div>
  )
}

/** Supabase's "Invalid TOTP code entered" in plain words; other errors as-is. */
export function codeErrorMessage(error?: string | null): string {
  if (!error || /invalid/i.test(error)) return 'That code didn’t match. Use the newest code in your app.'
  return error
}

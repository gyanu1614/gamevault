import { ArrowRightIcon } from '@phosphor-icons/react'
import Link from '@/components/navigation/AppLink'

/** Floating rectangular "Show All" on a row's header (owner, 2026-10-06): a raised fill + soft drop shadow, no outline. */
export function ShowAllLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="group inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-[#1D1E23] px-3.5 text-[13px] font-semibold text-text-primary shadow-[0_12px_26px_-14px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:bg-[#24252B]"
    >
      Show All
      <ArrowRightIcon size={14} weight="bold" aria-hidden className="transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}

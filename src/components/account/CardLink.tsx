import Link from '@/components/navigation/AppLink'
import { ChevronRight } from 'lucide-react'

/** "View All ›" in a card's title row. */
export function CardLink({ href, label = 'View All' }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-0.5 whitespace-nowrap text-[13px] font-semibold text-text-secondary transition-colors hover:text-text-primary"
    >
      {label}
      <ChevronRight className="h-3.5 w-3.5" aria-hidden />
    </Link>
  )
}

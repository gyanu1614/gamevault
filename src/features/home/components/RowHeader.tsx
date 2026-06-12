import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export interface RowHeaderProps {
  title: string
  viewAllHref: string
}

export function RowHeader({ title, viewAllHref }: RowHeaderProps) {
  return (
    <div className="flex justify-between items-end mb-6 gap-4">
      <div>
        <h2 className="font-display text-heading mt-2">{title}</h2>
      </div>
      <Link
        href={viewAllHref}
        className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-lime-text flex-none group"
      >
        View all
        <ArrowRight
          aria-hidden="true"
          className="w-4 h-4 transition-transform duration-fast group-hover:translate-x-[3px]"
        />
      </Link>
    </div>
  )
}

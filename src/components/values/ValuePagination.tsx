'use client'

/** Compact page list with ellipses, e.g. [1, '…', 4, 5, 6, '…', 9]. */
export function pageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '…')[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) pages.push('…')
  for (let i = start; i <= end; i += 1) pages.push(i)
  if (end < total - 1) pages.push('…')
  pages.push(total)
  return pages
}

const BTN =
  'h-9 rounded-md text-[13px] font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring'

/** Prev / numbers / Next for value lists. Renders nothing for one page. */
export function ValuePagination({
  page,
  totalPages,
  onPage,
  className = 'mt-8',
}: {
  page: number
  totalPages: number
  onPage: (n: number) => void
  className?: string
}) {
  if (totalPages <= 1) return null
  const step = `${BTN} bg-bg-raised px-4 text-text-secondary hover:bg-bg-raised-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-bg-raised`
  return (
    <nav aria-label="Pagination" className={`flex flex-wrap items-center justify-center gap-1.5 ${className}`}>
      <button type="button" className={step} disabled={page === 1} onClick={() => onPage(page - 1)}>
        Prev
      </button>
      {pageNumbers(page, totalPages).map((n, i) =>
        n === '…' ? (
          <span key={`gap-${i}`} className="px-1.5 text-[13px] text-text-tertiary">
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            onClick={() => onPage(n)}
            aria-current={n === page ? 'page' : undefined}
            className={`${BTN} min-w-[36px] px-3 ${
              n === page
                ? 'bg-white/[0.12] text-text-primary'
                : 'bg-bg-raised text-text-secondary hover:bg-bg-raised-hover hover:text-text-primary'
            }`}
          >
            {n}
          </button>
        ),
      )}
      <button type="button" className={step} disabled={page === totalPages} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </nav>
  )
}

/**
 * "Live / updated" freshness signal for SAB pricing — an SEO + trust cue.
 * A pulsing forest-green indicator dot + "Updated <time> UTC". Renders nothing
 * without a timestamp.
 */
export function FreshnessBadge({
  updatedAt,
  className = '',
}: {
  updatedAt: string | null | undefined
  className?: string
}) {
  if (!updatedAt) return null
  const date = new Date(updatedAt)
  if (Number.isNaN(date.getTime())) return null

  const label = date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  })

  return (
    <span
      className={`inline-flex items-center gap-2 text-[13px] font-medium text-[#B7C0BA] ${className}`}
    >
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4FB477] opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#3FA96A]" />
      </span>
      Updated {label} UTC
    </span>
  )
}

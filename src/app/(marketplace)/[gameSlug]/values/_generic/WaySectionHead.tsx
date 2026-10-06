/**
 * The head of a How To Get section ("1 How To Get It For Free",
 * "2 Buy It for Cheap"): a number tile and the heading, each section in its
 * own tone so the two read as two sections, not one list.
 * Presentational and hook-free, so the server row and the client row share it.
 */
const TONES = {
  neutral: { tile: 'rgba(255,255,255,0.08)', tileText: '#F2F3F5' },
  green: { tile: 'rgba(63,217,134,0.16)', tileText: '#3FD986' },
} as const

export function WaySectionHead({
  n,
  title,
  tone,
  muted = false,
  as: Heading = 'h3',
}: {
  n: number
  title: string
  tone: keyof typeof TONES
  /** The free way has ended / is unconfirmed: quieter heading. */
  muted?: boolean
  /** h2 when the section is a top-level block of its page (the guides); h3 inside an item page's section. */
  as?: 'h2' | 'h3'
}) {
  const t = TONES[tone]
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-[15px] font-bold tabular-nums"
        style={{ background: t.tile, color: t.tileText }}
      >
        {n}
      </span>
      <Heading className={`text-[20px] font-semibold tracking-tight ${muted ? 'text-text-secondary' : 'text-text-primary'}`}>
        <span className="sr-only">{n}. </span>
        {title}
      </Heading>
    </div>
  )
}

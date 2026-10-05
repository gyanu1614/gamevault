/**
 * The head of a How To Get section ("1 How To Get It For Free",
 * "2 Buy It for Cheap"): a number tile, the heading and a short tag, each
 * section in its own tone so the two read as two sections, not one list.
 * Presentational and hook-free, so the server row and the client row share it.
 */
const TONES = {
  neutral: { tile: 'rgba(255,255,255,0.08)', tileText: '#F2F3F5', tag: 'rgba(255,255,255,0.06)', tagText: '#B8BAC2' },
  green: { tile: 'rgba(63,217,134,0.16)', tileText: '#3FD986', tag: 'rgba(63,217,134,0.12)', tagText: '#3FD986' },
} as const

export function WaySectionHead({
  n,
  title,
  tag,
  tone,
  muted = false,
}: {
  n: number
  title: string
  tag: string
  tone: keyof typeof TONES
  /** The free way has ended / is unconfirmed: quieter heading. */
  muted?: boolean
}) {
  const t = TONES[tone]
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span
        aria-hidden
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-[15px] font-bold tabular-nums"
        style={{ background: t.tile, color: t.tileText }}
      >
        {n}
      </span>
      <h3 className={`text-[20px] font-semibold tracking-tight ${muted ? 'text-text-secondary' : 'text-text-primary'}`}>
        <span className="sr-only">{n}. </span>
        {title}
      </h3>
      <span className="rounded-md px-2 py-0.5 text-[12px] font-semibold" style={{ background: t.tag, color: t.tagText }}>
        {tag}
      </span>
    </div>
  )
}

/**
 * "New" tag: released or added in the last 14 days (src/lib/values/new-item.ts).
 * One style on cards (`sm`) and item heroes (`md`). No directive: a plain span,
 * so server-rendered heroes and lists use it without a client reference.
 */
export function NewTag({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  return (
    <span
      className={`shrink-0 rounded bg-lime-tint-bg font-semibold text-lime-text ${
        size === 'md' ? 'px-2 py-0.5 text-[12px]' : 'px-1.5 py-0.5 text-[10px]'
      }`}
    >
      New
    </span>
  )
}

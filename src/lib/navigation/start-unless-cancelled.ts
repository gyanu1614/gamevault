/**
 * Run `start` after the click event finishes dispatching, unless a handler
 * cancelled it (preventDefault). For capture-phase listeners, which run
 * before the target's own onClick: a button inside a link (a notification's
 * dismiss X) cancels the link's navigation only after they ran.
 */
export function startUnlessCancelled(
  event: { defaultPrevented: boolean },
  start: () => void,
  defer: (fn: () => void) => void = (fn) => setTimeout(fn, 0),
): void {
  defer(() => {
    if (!event.defaultPrevented) start()
  })
}

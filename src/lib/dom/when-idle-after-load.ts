interface IdleWindow {
  document: { readyState: string }
  addEventListener(name: 'load', fn: () => void): void
  removeEventListener(name: 'load', fn: () => void): void
  requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number
  cancelIdleCallback?: (id: number) => void
}

/** Longest the idle wait may take on a busy page. */
const IDLE_TIMEOUT_MS = 1000
/** Where requestIdleCallback is missing (Safari): a short timer after load. */
const FALLBACK_DELAY_MS = 200

/**
 * Run `cb` once the page has loaded AND the browser is idle: for widgets that
 * are not part of the first view (social-proof toasts, background fetches).
 * Keeps their code, requests and sockets out of the first-load window that
 * crawlers and slow phones are measured on, while a visitor still gets them
 * well under a second later. Returns a cleanup that cancels everything.
 */
export function whenIdleAfterLoad(cb: () => void, win: IdleWindow = window): () => void {
  let done = false
  let cancelled = false
  let idleId: number | undefined
  let timer: ReturnType<typeof setTimeout> | undefined

  const run = () => {
    if (cancelled || done) return
    done = true
    cb()
  }
  const afterLoad = () => {
    if (cancelled) return
    if (win.requestIdleCallback) idleId = win.requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS })
    else timer = setTimeout(run, FALLBACK_DELAY_MS)
  }

  if (win.document.readyState === 'complete') afterLoad()
  else win.addEventListener('load', afterLoad)

  return () => {
    cancelled = true
    win.removeEventListener('load', afterLoad)
    if (idleId !== undefined) win.cancelIdleCallback?.(idleId)
    if (timer !== undefined) clearTimeout(timer)
  }
}

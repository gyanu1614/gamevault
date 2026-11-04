/**
 * Slow-read log for the admin. Vercel's per-function timings need a paid add-on,
 * so the reads that matter write a line when they run long:
 *
 *   [admin-slow] getSellerDetail 1430ms
 *
 * Search the runtime logs for "admin-slow". Quiet below the threshold, so a healthy
 * day logs nothing.
 */
export const ADMIN_SLOW_MS = 1000

export async function timed<T>(label: string, work: () => Promise<T>): Promise<T> {
  const started = performance.now()
  try {
    return await work()
  } finally {
    const ms = Math.round(performance.now() - started)
    if (ms >= ADMIN_SLOW_MS) console.warn(`[admin-slow] ${label} ${ms}ms`)
  }
}

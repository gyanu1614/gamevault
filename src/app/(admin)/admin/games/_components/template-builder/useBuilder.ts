'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { loadBuilderState, type BuilderState } from '@/lib/actions/admin-template-builder'
import { buildColumns, openChoice, showField, startPath, type PathStep } from './builder-model'

type Result = { success: true } | { success: false; error: string }

/**
 * The builder's state: the server's template plus the column path, which
 * survives reloads so the admin stays where they were. `run` wraps a write
 * with busy + toast, then re-reads the template ITSELF, in order (2026-10-12:
 * router.refresh() calls raced — a paste right after "Create Field" saved
 * but the column kept showing the older read).
 */
export function useBuilder(initial: BuilderState) {
  const [state, setState] = useState(initial)
  const [busy, setBusy] = useState(false)
  useEffect(() => setState(initial), [initial])
  // Only the newest reload may land, so an older read can never win.
  const reloadSeq = useRef(0)
  const { game_id, global_category_slug } = initial.header

  const [path, setPath] = useState<PathStep[]>(() => startPath(initial.attributes))
  const columns = useMemo(() => buildColumns(state.attributes, path), [state.attributes, path])

  const refresh = useCallback(async () => {
    const seq = ++reloadSeq.current
    const res = await loadBuilderState(game_id, global_category_slug)
    if (seq !== reloadSeq.current) return
    if (res.success) setState(res.data)
    else toast.error(res.error)
  }, [game_id, global_category_slug])

  const run = useCallback(
    async (write: () => Promise<Result>, done?: string): Promise<boolean> => {
      setBusy(true)
      try {
        const res = await write()
        if (!res.success) {
          toast.error(res.error)
          return false
        }
        await refresh()
        if (done) toast.success(done)
        return true
      } finally {
        setBusy(false)
      }
    },
    [refresh],
  )

  return {
    state,
    columns,
    busy,
    run,
    refresh,
    pick: (col: number, value: string) => setPath((p) => openChoice(state.attributes, p, col, value)),
    show: (col: number, fieldId: string) => setPath((p) => showField(state.attributes, p, col, fieldId)),
    /** Phone back arrow: close the deepest open choice. */
    back: () =>
      setPath((p) => {
        const cols = buildColumns(state.attributes, p)
        const lastOpen = cols.length - 2
        if (lastOpen < 0) return p
        return cols.slice(0, lastOpen + 1).map((c, i) => ({ fieldId: c.field!.id, value: i === lastOpen ? null : c.value }))
      }),
    setPath,
  }
}

export type Builder = ReturnType<typeof useBuilder>

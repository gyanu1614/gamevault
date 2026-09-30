'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { isDirty } from './_settings-model'

/**
 * Form values plus the saved baseline they are compared against.
 *
 * While the form is untouched, fresher server values replace both, so a
 * background refresh shows the latest data. Once the person edits, their
 * edits are never overwritten (the old page refetched on every auth refresh
 * and could wipe a half-typed bio).
 */
export function useFormState<T extends Record<string, string>>(source: T) {
  const [saved, setSaved] = useState(source)
  const [values, setValues] = useState(source)
  const dirty = isDirty(saved, values)

  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty
  const sourceKey = JSON.stringify(source)
  useEffect(() => {
    if (dirtyRef.current) return
    const next = JSON.parse(sourceKey) as T
    setSaved(next)
    setValues(next)
  }, [sourceKey])

  // Unsaved edits: the browser asks before a reload or closing the tab.
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }, [])

  /** After a successful save: the current values become the baseline. */
  const commit = useCallback(() => setSaved(values), [values])
  const discard = useCallback(() => setValues(saved), [saved])

  return { values, saved, set, dirty, commit, discard }
}

/** `true` for a moment after `flash()`, for the Save button's "Saved" state. */
export function useSavedFlash(ms = 1800) {
  const [on, setOn] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const flash = useCallback(() => {
    setOn(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOn(false), ms)
  }, [ms])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return [on, flash] as const
}

'use client'

import { useRef } from 'react'

/**
 * A hidden file input driven by a real <button>: `open()` opens the picker,
 * `input` is rendered next to the button (never inside it — an input inside a
 * button is invalid, and a <label> wrapping a display:none input can't take
 * keyboard focus). The input is cleared after every pick so choosing the same
 * file again still fires.
 */
export function useFilePicker(onFile: (file: File) => void, accept: string) {
  const ref = useRef<HTMLInputElement>(null)
  const input = (
    <input
      ref={ref}
      type="file"
      accept={accept}
      tabIndex={-1}
      aria-hidden
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0]
        e.currentTarget.value = ''
        if (file) onFile(file)
      }}
    />
  )
  return { open: () => ref.current?.click(), input }
}

'use client'

/**
 * Pieces shared by the seller detail dialogs: the dialog kind the page tracks,
 * the Radix dialog shell, its button row and the in-button spinner.
 */

import React from 'react'
import { CircleNotch } from '@phosphor-icons/react/dist/csr/CircleNotch'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

export type DialogKind =
  | { kind: 'tier' }
  | { kind: 'restrict'; type: 'restricted' | 'banned' }
  | { kind: 'unrestrict' }
  | { kind: 'history' }
  | { kind: 'message' }
  | { kind: 'email' }
  | { kind: 'withdrawal-approve'; requestId: string; amount: number }
  | { kind: 'withdrawal-reject'; requestId: string; amount: number }
  | null

/** The shared Radix dialog; closing is blocked while a mutation runs. */
export function ActionDialog({
  open,
  onClose,
  busy,
  title,
  description,
  children,
}: {
  open: boolean
  onClose: () => void
  busy?: boolean
  title: string
  description?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-[480px] border-0 p-5 sm:p-6">
        <div className="pr-8">
          <DialogTitle className="text-[18px] font-bold leading-tight">{title}</DialogTitle>
          {description && <DialogDescription className="mt-1.5 leading-relaxed">{description}</DialogDescription>}
        </div>
        {children}
      </DialogContent>
    </Dialog>
  )
}

export function DialogActions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col-reverse gap-2 sm:flex-row [&>*]:sm:flex-1">{children}</div>
}

export function Spinner() {
  return <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
}

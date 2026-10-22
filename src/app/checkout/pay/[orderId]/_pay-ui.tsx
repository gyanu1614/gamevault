'use client'

/**
 * The crypto payment page's building blocks, on a white surface (owner
 * 2026-10-21: "make it white, as a real crypto payment page", the hosted-
 * invoice look of CoinGate / Cryptomus, built our own way). Pure UI: the
 * state machine and every server call stay in _PayClient.
 */

import { useEffect, useRef, useState } from 'react'
import { Drawer } from 'vaul'
import { motion, useReducedMotion } from 'framer-motion'
import { toast } from 'sonner'
import { CheckIcon } from '@phosphor-icons/react/dist/csr/Check'
import { ClockIcon } from '@phosphor-icons/react/dist/csr/Clock'
import { CopyIcon } from '@phosphor-icons/react/dist/csr/Copy'
import { cn } from '@/lib/utils'

/** Light palette for the payment page only. */
export const L = {
  page: '#F4F5F7',
  card: '#FFFFFF',
  line: '#E6E8EC',
  soft: '#F6F7F9',
  ink: '#0E1116',
  ink2: '#4B5563',
  ink3: '#8A94A3',
  green: '#1F7A4D',
  greenHover: '#18663F',
  greenSoft: '#E8F5EE',
  amber: '#B45309',
  amberSoft: '#FFF7E6',
} as const

export const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/50 focus-visible:ring-offset-2'

/** Buttons on the white surface. */
export const btn = {
  primary: cn(
    'inline-flex items-center justify-center gap-2 rounded-lg bg-[#1F7A4D] px-5 text-[14.5px] font-semibold text-white transition-colors hover:bg-[#18663F] disabled:opacity-60',
    FOCUS
  ),
  secondary: cn(
    'inline-flex items-center justify-center gap-2 rounded-lg border border-[#E6E8EC] bg-white px-4 text-[14px] font-semibold text-[#0E1116] transition-colors hover:bg-[#F6F7F9] disabled:opacity-60',
    FOCUS
  ),
  danger: cn(
    'inline-flex items-center justify-center gap-2 rounded-lg bg-[#B42318] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#912018] disabled:opacity-60',
    FOCUS
  ),
  link: cn('rounded-sm text-[13px] text-[#4B5563] underline-offset-4 hover:text-[#0E1116] hover:underline', FOCUS),
}

export function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

/** Trim a crypto decimal string for display (drop trailing zeros, keep ≤8 dp). */
export function fmtCrypto(v: string | undefined): string {
  if (!v) return ''
  const n = Number(v)
  if (!Number.isFinite(n)) return v
  return n.toFixed(8).replace(/\.?0+$/, '')
}

export function shortTx(tx?: string | null): string {
  if (!tx) return ''
  return `${tx.slice(0, 6)}…${tx.slice(-4)}`
}

/** execCommand fallback for insecure contexts (http over LAN IP, older
 *  webviews) where navigator.clipboard is unavailable. */
function legacyCopy(value: string): boolean {
  try {
    const ta = document.createElement('textarea')
    ta.value = value
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    ta.setSelectionRange(0, value.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

/** Copy to the clipboard. Inline buttons show their own "Copied"; a toast
 *  only when asked (or on failure). */
export async function copyText(value: string, label: string, opts: { toast?: boolean } = {}) {
  let done = false
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value)
      done = true
    } else {
      done = legacyCopy(value)
    }
  } catch {
    done = legacyCopy(value)
  }
  if (done) {
    if (opts.toast) toast.success(`${label} Copied`)
    return true
  }
  toast.error('Copy Failed. Select The Text Manually')
  return false
}

/** Icon-and-word copy button; "compact" is the square icon-only version
 *  that sits inside the address box. */
export function CopyButton({ value, label, compact = false, className }: { value: string; label: string; compact?: boolean; className?: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(timer.current), [])
  const onClick = async () => {
    if (await copyText(value, label)) {
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 1600)
    }
  }
  const icon = copied ? (
    <CheckIcon className="h-4 w-4 text-[#1F7A4D]" weight="bold" aria-hidden />
  ) : (
    <CopyIcon className="h-4 w-4 text-[#4B5563]" aria-hidden />
  )
  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={copied ? `${label} Copied` : `Copy ${label}`}
        className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[#E6E8EC] bg-white transition-colors hover:bg-[#F6F7F9]', FOCUS, className)}
      >
        {icon}
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={copied ? `${label} Copied` : `Copy ${label}`}
      className={cn(btn.secondary, 'h-9 px-3 text-[13px]', className)}
    >
      {icon}
      <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
    </button>
  )
}

export function ExpiryChip({ remainingMs }: { remainingMs: number }) {
  const low = remainingMs < 60_000
  return (
    <span
      role="timer"
      className={cn(
        'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-semibold tabular-nums',
        low ? 'bg-[#FFF7E6] text-[#B45309]' : 'bg-[#F6F7F9] text-[#4B5563]'
      )}
    >
      <ClockIcon className="h-3.5 w-3.5" aria-hidden />
      <span suppressHydrationWarning>{fmtCountdown(remainingMs)}</span>
    </span>
  )
}

/** One calm inline note (seen / partial / network warning). */
export function Note({ tone, icon, children }: { tone: 'live' | 'warn' | 'info'; icon: React.ReactNode; children: React.ReactNode }) {
  const c =
    tone === 'live'
      ? 'bg-[#E8F5EE] text-[#14532D]'
      : tone === 'warn'
        ? 'bg-[#FFF7E6] text-[#7C2D12]'
        : 'bg-[#F6F7F9] text-[#4B5563]'
  return (
    <div className={cn('flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-[13px] leading-relaxed', c)}>
      <span className="mt-[2px] shrink-0">{icon}</span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/** Confirming / paid / expired / unreachable: the card's state screen. */
export function StatePanel({ icon, tone = 'neutral', title, children, action }: {
  icon: React.ReactNode
  tone?: 'neutral' | 'good' | 'live'
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  const ring = tone === 'good' ? 'bg-[#E8F5EE]' : tone === 'live' ? 'bg-[#EEF4FF]' : 'bg-[#F6F7F9]'
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className={cn('grid h-14 w-14 place-items-center rounded-full', ring)}>{icon}</span>
      <h2 className="mt-4 text-[20px] font-bold leading-tight tracking-[-0.01em] text-[#0E1116]">{title}</h2>
      <div className="mt-2 max-w-[40ch] text-[14px] leading-relaxed text-[#4B5563]">{children}</div>
      {action && <div className="mt-6 flex w-full flex-col items-center gap-3">{action}</div>}
    </div>
  )
}

export function SummaryRow({ label, children, strong }: { label: React.ReactNode; children: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className={cn('text-[13.5px]', strong ? 'font-semibold text-[#0E1116]' : 'text-[#4B5563]')}>{label}</span>
      <span className={cn('tabular-nums text-[#0E1116]', strong ? 'text-[15px] font-bold' : 'text-[13.5px] font-medium')}>{children}</span>
    </div>
  )
}

export type PayStep = { label: string; warn?: boolean }

/** Horizontal progress: done steps tick green, the current one pulses. */
export function PayStepper({ steps, current }: { steps: PayStep[]; current: number }) {
  const reduce = useReducedMotion() ?? false
  return (
    <ol aria-label="Payment Status" className="grid gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {steps.map((s, i) => {
        const done = i < current
        const now = i === current
        const color = s.warn ? '#B45309' : '#1F7A4D'
        return (
          <li key={s.label} className="min-w-0" aria-current={now ? 'step' : undefined}>
            <span className="relative block h-1 overflow-hidden rounded-full bg-[#E6E8EC]">
              {(done || now) && (
                <motion.span
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ background: color }}
                  initial={reduce ? false : { width: '0%' }}
                  animate={{ width: done ? '100%' : '55%' }}
                  transition={{ duration: reduce ? 0 : 0.5, ease: 'easeOut' }}
                />
              )}
            </span>
            <span
              className={cn(
                'mt-2 flex items-center gap-1 truncate text-[11.5px]',
                done ? 'text-[#4B5563]' : now ? 'font-semibold text-[#0E1116]' : 'text-[#8A94A3]'
              )}
            >
              {done && <CheckIcon className="h-3 w-3 shrink-0 text-[#1F7A4D]" weight="bold" aria-hidden />}
              {s.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export function HelpDrawer({ trigger }: { trigger: React.ReactNode }) {
  return (
    <Drawer.Root>
      <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[520px] rounded-t-xl bg-white p-6 pb-9 text-[#0E1116]"
        >
          <div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-[#E6E8EC]" />
          <Drawer.Title className="text-[16px] font-semibold">Payment Help</Drawer.Title>
          <div className="mt-4 space-y-4 text-[14px] leading-relaxed text-[#4B5563]">
            <p>
              <span className="font-semibold text-[#0E1116]">How long does it take?</span> Crypto payments are usually
              detected within seconds of sending and confirmed within a few minutes.
            </p>
            <p>
              <span className="font-semibold text-[#0E1116]">Sent slightly too little?</span> Exchange withdrawal fees can
              shave the amount. This page shows the small remainder to send.
            </p>
            <p>
              <span className="font-semibold text-[#0E1116]">Invoice expired after you paid?</span> Payments are never lost.
              Contact us and we’ll sort it right away.
            </p>
            <a href="mailto:support@dropmarket.gg" className={cn(btn.primary, 'h-11')}>
              Contact Support
            </a>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

'use client'

import { cn } from '@/lib/utils'

const STEPS = [
  { id: 1, label: 'Payout Method' },
  { id: 2, label: 'Amount' },
  { id: 3, label: 'Review' },
] as const

/** Where the seller is, the same rails as the sell form. A finished step opens again with its answers kept. */
export function StepBar({ step, onJump }: { step: number; onJump: (step: number) => void }) {
  return (
    <nav aria-label="Progress">
      <ol className="grid grid-cols-3 gap-1.5">
        {STEPS.map((s) => {
          const done = step > s.id
          const active = step === s.id
          return (
            <li key={s.id} className="min-w-0">
              <button
                type="button"
                disabled={!done}
                onClick={() => onJump(s.id)}
                aria-current={active ? 'step' : undefined}
                className={cn('group block w-full text-left', done ? 'cursor-pointer' : 'cursor-default')}
              >
                <span className={cn('block h-[3px] rounded-full transition-colors duration-300', active ? 'bg-lime' : done ? 'bg-lime opacity-50' : 'bg-white/[0.1]')} />
                <span
                  className={cn(
                    'mt-2 block truncate text-[12px] font-semibold transition-colors',
                    active && 'text-text-primary',
                    done && 'text-text-secondary group-hover:text-text-primary',
                    !done && !active && 'text-text-disabled',
                  )}
                >
                  {s.label}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

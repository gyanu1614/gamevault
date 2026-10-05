'use client'

/**
 * Help search for /support — filters the FAQ and help topics client-side as
 * you type (searchHelp in src/lib/support/help-content.ts; no network).
 *
 * Accessible combobox: arrow keys move through results, Enter opens one,
 * Escape clears. An FAQ result opens that question in the FAQ section below
 * (via the `support:open-faq` event SupportFaq listens for); a topic result
 * jumps to its topic card. Quick-search chips seed common queries.
 */

import { useId, useMemo, useState } from 'react'
import { MagnifyingGlassIcon } from '@phosphor-icons/react/dist/csr/MagnifyingGlass'
import { XIcon } from '@phosphor-icons/react/dist/csr/X'
import { QuestionIcon } from '@phosphor-icons/react/dist/csr/Question'
import { SquaresFourIcon } from '@phosphor-icons/react/dist/csr/SquaresFour'
import { ArrowRightIcon } from '@phosphor-icons/react/dist/csr/ArrowRight'
import { cn } from '@/lib/utils'
import { searchHelp, type HelpResult } from '@/lib/support/help-content'

export const OPEN_FAQ_EVENT = 'support:open-faq'

const QUICK_SEARCHES = ['Refund', 'Late Order', 'Dispute', 'Chargeback', 'Seller Fees'] as const

function resultKey(r: HelpResult) {
  return r.kind === 'faq' ? `faq-${r.faq.id}` : `topic-${r.topic.id}`
}

export function SupportSearch() {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const results = useMemo(() => searchHelp(query), [query])
  const listId = useId()
  const hasQuery = query.trim().length > 0

  function open(r: HelpResult) {
    if (r.kind === 'faq') {
      window.dispatchEvent(new CustomEvent(OPEN_FAQ_EVENT, { detail: r.faq.id }))
    } else {
      const el = document.getElementById(`topic-${r.topic.id}`)
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      el?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
      el?.focus({ preventScroll: true })
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setQuery('')
      return
    }
    if (results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i - 1 + results.length) % results.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      open(results[Math.min(active, results.length - 1)])
    }
  }

  return (
    <div className="mx-auto mt-7 w-full max-w-2xl text-left">
      <div className="relative">
        <MagnifyingGlassIcon
          size={20}
          weight="bold"
          aria-hidden
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary"
        />
        <input
          type="search"
          role="combobox"
          aria-expanded={hasQuery}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={hasQuery && results.length > 0 ? `${listId}-${active}` : undefined}
          aria-label="Search help articles"
          placeholder="Search refunds, delivery, disputes…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onKeyDown={onKeyDown}
          autoComplete="off"
          enterKeyHint="search"
          className="h-14 w-full rounded-lg border border-transparent bg-bg-overlay pl-12 pr-12 text-base text-text-primary shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)] transition-colors placeholder:text-text-disabled hover:border-white/[0.08] focus:border-focus-border focus:outline-none focus:ring-2 focus:ring-focus-soft sm:text-[15px] [&::-webkit-search-cancel-button]:hidden"
        />
        {hasQuery && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-white/[0.06] hover:text-text-primary"
          >
            <XIcon size={16} weight="bold" aria-hidden />
          </button>
        )}
      </div>

      {!hasQuery && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <span className="text-[13px] text-text-tertiary">Popular:</span>
          {QUICK_SEARCHES.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setQuery(q)}
              className="inline-flex h-8 items-center rounded-md bg-white/[0.06] px-3 text-[13px] font-medium text-text-secondary transition-colors hover:bg-white/[0.10] hover:text-text-primary"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <div id={listId} role="listbox" aria-label="Search results" hidden={!hasQuery}>
        {hasQuery && (
          <div className="mt-3 overflow-hidden rounded-lg bg-bg-raised">
            {results.length === 0 ? (
              <div className="px-5 py-6 text-center">
                <p className="text-[14px] font-medium text-text-primary">
                  No answers match &ldquo;{query.trim()}&rdquo;.
                </p>
                <p className="mt-1 text-[13.5px] text-text-secondary">
                  Try another word, or email{' '}
                  <a
                    href="mailto:support@dropmarket.gg"
                    className="font-medium text-text-primary underline decoration-white/30 underline-offset-4 hover:decoration-white/70"
                  >
                    support@dropmarket.gg
                  </a>
                  .
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-white/[0.07]">
                {results.map((r, i) => {
                  const title = r.kind === 'faq' ? r.faq.q : r.topic.title
                  const body = r.kind === 'faq' ? r.faq.a : r.topic.summary
                  return (
                    <li key={resultKey(r)} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                      <button
                        type="button"
                        tabIndex={-1}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => open(r)}
                        className={cn(
                          'flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors',
                          i === active ? 'bg-white/[0.05]' : 'hover:bg-white/[0.04]',
                        )}
                      >
                        <span
                          aria-hidden
                          className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white/[0.06] text-text-secondary"
                        >
                          {r.kind === 'faq' ? (
                            <QuestionIcon size={16} weight="bold" />
                          ) : (
                            <SquaresFourIcon size={16} weight="bold" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14.5px] font-medium leading-snug text-text-primary">
                            {title}
                          </span>
                          <span className="mt-0.5 line-clamp-2 block text-[13px] leading-relaxed text-text-tertiary">
                            {body}
                          </span>
                        </span>
                        <ArrowRightIcon size={14} weight="bold" aria-hidden className="mt-2 shrink-0 text-text-tertiary" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {hasQuery ? `${results.length} ${results.length === 1 ? 'result' : 'results'}` : ''}
      </p>
    </div>
  )
}

'use client'

/**
 * FAQ accordion for the article page — first item open by default, +/- toggles
 * in green, matching the content design. Answers stay in the DOM (just
 * collapsed) so they remain crawlable for FAQPage schema.
 */

import { useState } from 'react'

export interface FaqItem {
  q: string
  a: string
}

export function ArticleFaq({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<Record<number, boolean>>({ 0: true })

  if (items.length === 0) return null

  return (
    <section id="faq" className="mt-12 scroll-mt-28">
      <h2 className="mb-2 border-t border-[#1A211A] pt-8 text-[22px] font-bold tracking-tight text-[#F2F6F0] sm:text-[26px]">
        Questions
      </h2>
      <div>
        {items.map((item, i) => {
          const isOpen = open[i] ?? false
          return (
            <div key={i} className="border-b border-[#1A211A]">
              <button
                type="button"
                onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}
                className="flex w-full items-center justify-between gap-4 py-4 text-left"
                aria-expanded={isOpen}
              >
                <span className="text-[15px] font-semibold text-[#E4EAE2] sm:text-[16px]">
                  {item.q}
                </span>
                <span
                  aria-hidden
                  className="shrink-0 font-mono text-[18px] leading-none text-[#8FBF9C]"
                >
                  {isOpen ? '−' : '+'}
                </span>
              </button>
              <div className={isOpen ? 'block' : 'hidden'}>
                <p className="pb-5 text-[14px] leading-[1.7] text-[#98A398] sm:text-[15px]">
                  {item.a}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/**
 * Compact hub stat strip — replaces the old full-width trust box.
 *
 * A slim, professional row of real, data-backed stats (most popular pet,
 * highest value, pets tracked, and a genuine price mover when history supports
 * one). No big empty panel: it's a light divided row that sizes to its content,
 * with a small pet thumbnail on the lead stat and a real up/down colour on the
 * mover (green rise, muted red fall — not everything green).
 *
 * Each stat is a link into the values hub, so the strip is useful navigation as
 * well as proof. Renders nothing when there are no stats.
 */

import Link from 'next/link'
import type { HubStat } from './_hubData'

export function HubStatStrip({ stats }: { stats: HubStat[] }) {
  if (stats.length === 0) return null

  return (
    <div className="mt-6 sm:mt-8">
      <div className="flex flex-wrap items-stretch gap-x-8 gap-y-4 border-y border-[#1E2723] py-4 sm:gap-x-12">
        {stats.map((stat) => {
          const inner = (
            <span className="flex items-center gap-3">
              {stat.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- remote pet art
                <img
                  src={stat.imageUrl}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-md border border-[#22302A] bg-[#0E140F] object-contain"
                />
              )}
              <span className="flex flex-col gap-0.5">
                <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-[#6D7A72]">
                  {stat.label}
                </span>
                <span className="flex items-baseline gap-1.5">
                  <span className="text-[16px] font-bold leading-none tracking-tight text-[#F2F6F0] sm:text-[17px]">
                    {stat.value}
                  </span>
                  {stat.sub && (
                    <span
                      className={`font-mono text-[13px] font-semibold leading-none ${
                        stat.trend === 'down' ? 'text-[#E0736B]' : 'text-[#5BC77E]'
                      }`}
                    >
                      {stat.trend === 'down' ? '▼' : '▲'} {stat.sub.replace(/^[+-]/, '')}
                    </span>
                  )}
                </span>
              </span>
            </span>
          )

          return stat.href ? (
            <Link
              key={stat.label}
              href={stat.href}
              className="group rounded-sm transition-opacity hover:opacity-80"
            >
              {inner}
            </Link>
          ) : (
            <div key={stat.label}>{inner}</div>
          )
        })}
      </div>
    </div>
  )
}

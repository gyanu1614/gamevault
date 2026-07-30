/**
 * Trust panel between the hub title and the featured guide.
 *
 * Shape borrowed from the old hero stat block — a hairline grid of cells — but
 * dressed like the checkout SafeDrop panel: a radial accent glow over a
 * near-black glass surface, hairline border, inset top highlight, and a small
 * lift on hover.
 *
 * Every cell states something we can actually stand behind. Counts come from
 * real data and any cell without a value is dropped rather than shown as zero,
 * so a game we haven't priced yet still renders a sensible panel.
 */

import ShieldCheckIcon from '@mui/icons-material/ShieldOutlined'
import InsightsIcon from '@mui/icons-material/InsightsOutlined'
import PaidIcon from '@mui/icons-material/PaidOutlined'
import BoltIcon from '@mui/icons-material/BoltOutlined'

export interface HubTrustStat {
  label: string
  value: string
  hint: string
}

const ICONS = [InsightsIcon, PaidIcon, BoltIcon, ShieldCheckIcon]

export function HubTrustBox({ stats }: { stats: HubTrustStat[] }) {
  if (stats.length === 0) return null

  return (
    <div
      className="group relative overflow-hidden border border-[rgba(79,180,119,0.14)] shadow-[0_18px_44px_-20px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.05)] transition-all duration-300 hover:border-[rgba(79,180,119,0.26)] hover:shadow-[0_26px_56px_-22px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.07)]"
      style={{
        background:
          'radial-gradient(140% 160% at 88% 8%, rgba(79,180,119,0.10), rgba(79,180,119,0.03) 45%, rgba(11,15,12,0.94) 82%)',
      }}
    >
      {/* Hairline cell grid — the stat-box shape, over the glass background. */}
      <div className="grid grid-cols-2 gap-px bg-[rgba(79,180,119,0.10)] lg:grid-cols-4">
        {stats.map((stat, i) => {
          const Icon = ICONS[i % ICONS.length]
          return (
            <div
              key={stat.label}
              className="flex flex-col gap-2 bg-[#0B0F0C]/70 p-5 backdrop-blur-md sm:p-6"
            >
              <span className="flex items-center gap-2">
                <Icon sx={{ fontSize: 15 }} className="text-[#8FBF9C]" />
                <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[#6D7A72]">
                  {stat.label}
                </span>
              </span>
              <span className="text-[22px] font-bold leading-none tracking-tight text-[#F2F6F0] tabular-nums sm:text-[26px]">
                {stat.value}
              </span>
              <span className="text-[12.5px] leading-snug text-[#8B978F]">
                {stat.hint}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

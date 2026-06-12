import type { LucideIcon } from 'lucide-react'

export interface WhyCardProps {
  icon: LucideIcon
  title: string
  body: string
  badge: string
}

/**
 * "Why Choose GameVault" trust/safety card.
 * Not in component-callouts.md explicitly, but repeated 4x — extracted for reuse.
 */
export function WhyCard({ icon: Icon, title, body, badge }: WhyCardProps) {
  return (
    <div className="flex gap-5 p-6 border border-border-subtle rounded-lg bg-bg-raised transition-all duration-default hover:border-border-strong hover:bg-bg-raised-hover">
      <div className="w-[52px] h-[52px] flex-none rounded-md grid place-items-center bg-bg-overlay-2 border border-border-default">
        <Icon aria-hidden="true" className="w-[26px] h-[26px] text-text-primary" />
      </div>
      <div>
        <h3 className="font-display font-bold text-[18px] mb-2">{title}</h3>
        <p className="text-[14.5px] text-text-secondary leading-relaxed">{body}</p>
        <span className="inline-block whitespace-nowrap mt-3 font-mono text-caption text-lime-text bg-lime-tint-bg border border-lime-tint-border px-[9px] py-[3px] rounded-sm">
          {badge}
        </span>
      </div>
    </div>
  )
}

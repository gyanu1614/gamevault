import type { LucideIcon } from 'lucide-react'

export interface HowStepProps {
  num: string
  icon: LucideIcon
  title: string
  body: string
  showConnector?: boolean
}

/**
 * How-It-Works step. showConnector renders the horizontal connector line
 * to the next step (hidden on the last step and on mobile).
 */
export function HowStep({ num, icon: Icon, title, body, showConnector = false }: HowStepProps) {
  return (
    <div className="relative p-6 border border-border-subtle rounded-lg bg-bg-raised">
      {showConnector && (
        <span
          aria-hidden="true"
          className="hidden lg:block absolute top-[52px] -right-4 w-4 h-px bg-border-default z-10"
        />
      )}
      <span className="font-mono text-caption text-lime-text">{num}</span>
      <div className="w-[46px] h-[46px] rounded-md grid place-items-center bg-lime-tint-bg border border-lime-tint-border my-[14px]">
        <Icon aria-hidden="true" className="w-[23px] h-[23px] text-lime-text" />
      </div>
      <h3 className="font-display font-bold text-[18px] mb-2">{title}</h3>
      <p className="text-body-sm text-text-secondary leading-relaxed">{body}</p>
    </div>
  )
}

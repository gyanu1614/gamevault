import type { ComponentType } from 'react'
import type { IconProps } from '@phosphor-icons/react'
import { CameraIcon } from '@phosphor-icons/react/dist/ssr/Camera'
import { ChatsCircleIcon } from '@phosphor-icons/react/dist/ssr/ChatsCircle'
import { ClockCountdownIcon } from '@phosphor-icons/react/dist/ssr/ClockCountdown'
import { LightbulbIcon } from '@phosphor-icons/react/dist/ssr/Lightbulb'
import { IconTile, INFO_TONE } from '@/components/info'
import { ValueCallout } from '@/components/values/ValueCallout'
import { DISPUTE_DECISION_DAYS, DISPUTE_EVIDENCE_HOURS, SELLER_RESPONSE_HOURS } from '@/lib/legal/protection-windows'
import { MARKET_CARD } from '@/lib/ui/surfaces'
import { cn } from '@/lib/utils'

const TONE = INFO_TONE.lime

/** The dispute process as a timeline: what happens, and how long each part takes. */
const STAGES: { title: string; body: string; value?: string; unit?: string }[] = [
  { title: 'Message the Seller', body: 'Most issues get sorted in the order chat.' },
  { title: 'Seller Response', body: 'The seller gets time to fix it before you escalate.', value: `${SELLER_RESPONSE_HOURS} Hours`, unit: 'to respond' },
  { title: 'Open a Dispute', body: 'Both sides send their evidence in the order chat.', value: `${DISPUTE_EVIDENCE_HOURS} Hours`, unit: 'for evidence' },
  { title: 'Our Decision', body: 'If your claim stands, you get a full refund.', value: `${DISPUTE_DECISION_DAYS} Days`, unit: 'usually' },
]

const EVIDENCE: { icon: ComponentType<IconProps>; text: string }[] = [
  { icon: CameraIcon, text: 'Screenshots or a video of the problem' },
  { icon: ChatsCircleIcon, text: 'Your messages in the order chat' },
  { icon: ClockCountdownIcon, text: 'Delivery times from the order page' },
]

export function DisputeTimeline() {
  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <ol className={cn('min-w-0 rounded-lg p-2 sm:p-3 lg:col-span-7', MARKET_CARD)}>
        {STAGES.map((s, i) => (
          <li key={s.title} className="relative flex items-start gap-4 rounded-md p-3 sm:p-4">
            {i < STAGES.length - 1 && (
              <span
                aria-hidden
                className="absolute bottom-[-0.75rem] left-[calc(0.75rem+1rem-0.5px)] top-[calc(0.75rem+2rem+0.5rem)] w-px sm:left-[calc(1rem+1rem-0.5px)] sm:top-[calc(1rem+2rem+0.5rem)]"
                style={{ background: TONE.edge }}
              />
            )}
            <span
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-body-sm font-bold tabular-nums"
              style={{ background: TONE.tint, color: TONE.hue, boxShadow: `inset 0 0 0 1px ${TONE.edge}` }}
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <h3 className="text-body font-semibold text-text-primary">{s.title}</h3>
              <p className="mt-1 text-body-sm text-text-secondary">{s.body}</p>
            </div>
            {s.value && (
              <div className="shrink-0 pt-0.5 text-right">
                <p className="text-body-lg font-bold tabular-nums" style={{ color: TONE.hue }}>
                  {s.value}
                </p>
                <p className="text-caption text-text-tertiary">{s.unit}</p>
              </div>
            )}
          </li>
        ))}
      </ol>
      <aside aria-labelledby="safedrop-evidence" className={cn('flex min-w-0 flex-col rounded-lg p-5 sm:p-6 lg:col-span-5', MARKET_CARD)}>
        <h3 id="safedrop-evidence" className="text-body-lg font-semibold text-text-primary">
          What Helps Your Claim
        </h3>
        <ul className="mt-4 space-y-3">
          {EVIDENCE.map((e) => (
            <li key={e.text} className="flex items-center gap-3 text-body-sm text-text-primary">
              <IconTile icon={e.icon} tone="lime" size="sm" />
              {e.text}
            </li>
          ))}
        </ul>
        <div className="mt-5 lg:mt-auto lg:pt-5">
          <ValueCallout tone="yellow" icon={LightbulbIcon} title="Keep it in the order chat">
            Evidence shared anywhere else may not count.
          </ValueCallout>
        </div>
      </aside>
    </div>
  )
}

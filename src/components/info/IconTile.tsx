import type { ComponentType } from 'react'
import type { IconProps } from '@phosphor-icons/react'
import { INFO_TONE, type InfoTone } from './tones'

const SIZE = {
  sm: { box: 'h-8 w-8 rounded-md', icon: 16 },
  md: { box: 'h-10 w-10 rounded-md', icon: 20 },
  lg: { box: 'h-14 w-14 rounded-lg', icon: 28 },
} as const

/** A duotone Phosphor icon in a tinted square (owner: icons in tinted tiles). Hook-free. */
export function IconTile({
  icon: Icon,
  tone = 'neutral',
  size = 'md',
}: {
  icon: ComponentType<IconProps>
  tone?: InfoTone
  size?: keyof typeof SIZE
}) {
  const t = INFO_TONE[tone]
  const s = SIZE[size]
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center ${s.box}`}
      style={{ background: t.tint, color: t.hue, boxShadow: `inset 0 0 0 1px ${t.edge}` }}
    >
      <Icon size={s.icon} weight="duotone" />
    </span>
  )
}

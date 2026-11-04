import { cn } from '@/lib/utils'
import { traitTone, type TraitTone } from './model/traits'

const TONE: Record<Exclude<TraitTone, null>, string> = {
  neon: 'text-[#4ADE80]',
  mega: 'bg-[linear-gradient(90deg,#FF8AD8,#B69CFF_35%,#7CC4FF_65%,#7DF0C2)] bg-clip-text text-transparent',
  gold: 'text-[#F5C542]',
  diamond: 'text-[#7FE3F0]',
}

/** A trait's name, coloured when it is a special form (Neon, Mega, Gold…). */
export function TraitName({ traitKey, label, className }: { traitKey: string | null; label: string; className?: string }) {
  const tone = traitTone(traitKey)
  return <span className={cn(tone && TONE[tone], className)}>{label}</span>
}

import { ChromaWord } from '@/components/values/ChromaWord'
import { cn } from '@/lib/utils'
import { traitMutation, traitTone, type TraitTone } from './model/traits'

const TONE: Record<Exclude<TraitTone, null | 'chroma'>, string> = {
  neon: 'text-[#4ADE80]',
  mega: 'bg-[linear-gradient(90deg,#FF8AD8,#B69CFF_35%,#7CC4FF_65%,#7DF0C2)] bg-clip-text text-transparent',
}

/**
 * A trait's name in its colour, the same as on the Values pages: Neon, Mega, Chroma,
 * and each Steal a Brainrot mutation. Just the word, no dot (owner, 2026-11-06).
 */
export function TraitName({ traitKey, label, className }: { traitKey: string | null; label: string; className?: string }) {
  const tone = traitTone(traitKey)
  if (tone === 'chroma') {
    return (
      <span className={className}>
        <ChromaWord>{label}</ChromaWord>
      </span>
    )
  }
  const mutation = traitMutation(traitKey)
  if (mutation) {
    return (
      <span className={cn('inline-flex min-w-0', className)}>
        <span
          className={cn('truncate', mutation.gradient && 'bg-clip-text text-transparent')}
          style={mutation.gradient ? { backgroundImage: mutation.gradient } : { color: mutation.color }}
        >
          {label}
        </span>
      </span>
    )
  }
  return <span className={cn(tone && TONE[tone], className)}>{label}</span>
}

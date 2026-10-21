import { ArrowRightIcon } from '@phosphor-icons/react/dist/ssr/ArrowRight'
import Link from '@/components/navigation/AppLink'
import { GameMark } from '@/components/content/GameMark'
import { GuideRow, toGuideCard } from '@/components/blog/GuideCard'
import type { GuideGroup } from './_guides'

/** Cards per game row (one row: 4 across on desktop). */
const PER_ROW = 4

/** One game's newest guides: the game, how many, a link to all of them, one row of cards. */
export function GameSection({ group }: { group: GuideGroup }) {
  const id = `guides-${group.key}`
  return (
    <section aria-labelledby={`${id}-title`} id={id} className="mt-14 scroll-mt-[calc(var(--navbar-bottom)+24px)] sm:mt-16">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="flex items-center gap-3">
          <GameMark name={group.name} imageUrl={group.imageUrl} size="trigger" />
          <h2 id={`${id}-title`} className="text-subheading font-bold text-text-primary sm:text-heading">
            {group.key === 'general' ? 'Trading & Safety Guides' : `${group.name} Guides`}
          </h2>
          <span className="text-caption font-medium tabular-nums text-text-tertiary">
            {group.total} {group.total === 1 ? 'guide' : 'guides'}
          </span>
        </div>
        {group.hubHref && (
          <Link href={group.hubHref} className="group inline-flex items-center gap-1.5 text-body-sm font-semibold text-text-secondary transition-colors hover:text-text-primary">
            {`All ${group.name} Guides`}
            <ArrowRightIcon size={14} weight="bold" aria-hidden className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
          </Link>
        )}
      </div>
      <GuideRow posts={group.posts.slice(0, PER_ROW).map(toGuideCard)} />
    </section>
  )
}

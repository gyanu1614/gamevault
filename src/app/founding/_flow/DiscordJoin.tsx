/**
 * "Join our Discord" beside the Discord username (owner, 2026-10-14): one slim
 * row tinted in Discord's blurple — never a card inside the step's card — with
 * what sellers get there and a button to our invite (new tab, so the form
 * stays filled in).
 */
import { DiscordLogo } from '@phosphor-icons/react/dist/ssr/DiscordLogo'
import { ArrowSquareOut } from '@phosphor-icons/react/dist/ssr/ArrowSquareOut'
import { DISCORD_INVITE_URL } from '@/lib/config/social'

const BLURPLE = '#5865F2'

export function DiscordJoin() {
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-2.5 rounded-md border px-3.5 py-3"
      style={{ background: 'rgba(88,101,242,0.08)', borderColor: 'rgba(88,101,242,0.3)' }}
    >
      <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px]" style={{ background: BLURPLE }}>
        <DiscordLogo weight="fill" className="h-5 w-5 text-white" />
      </span>
      <p className="min-w-0 flex-1 text-body-sm leading-snug text-text-secondary">
        <span className="font-semibold text-text-primary">New here? Join our Discord.</span> Tips from other sellers, quick help from our team, new games first.
      </p>
      <a
        href={DISCORD_INVITE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3.5 text-[13px] font-semibold text-white transition-[filter,transform] hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring max-sm:w-full max-sm:justify-center"
        style={{ background: BLURPLE }}
      >
        Join Our Discord
        <ArrowSquareOut weight="bold" aria-hidden className="h-3.5 w-3.5" />
      </a>
    </div>
  )
}

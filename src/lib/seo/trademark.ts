/**
 * The per-game "not affiliated" line, shown under the payments strip just
 * above the footer on every game page (owner, 2026-10-06: worded per game,
 * one line on desktop, never above the strip). The footer carries the
 * site-wide version.
 *
 *   owner known (the researched currency guide's trademark_owner):
 *     "Roblox and Robux are trademarks of Roblox Corporation. DropMarket is
 *      independent and isn't affiliated with, sponsored or endorsed by Roblox
 *      Corporation."
 *   owner unknown:
 *     "Adopt Me and related names are trademarks of their owners. DropMarket …
 *      by them."
 */
export function gameTrademarkLine(
  gameName: string,
  opts: { currency?: string | null; owner?: string | null } = {},
): string {
  const tail = (who: string) => `DropMarket is independent and isn't affiliated with, sponsored or endorsed by ${who}.`
  const owner = opts.owner?.trim()
  if (owner && /\btrademark\b/i.test(owner)) {
    // Sentence-form owner ("Blade Ball is a Roblox experience; Roblox is a trademark of …").
    return `${/[.!?]$/.test(owner) ? owner : `${owner}.`} ${tail('them')}`
  }
  if (owner) {
    const who = owner.replace(/[.\s]+$/, '')
    const cur = opts.currency?.trim()
    const marks = !cur ? gameName : cur.toLowerCase().includes(gameName.toLowerCase()) ? cur : `${gameName} and ${cur}`
    const verb = marks === gameName ? 'is a trademark' : 'are trademarks'
    return `${marks} ${verb} of ${who}. ${tail(who)}`
  }
  return `${gameName} and related names are trademarks of their owners. ${tail('them')}`
}

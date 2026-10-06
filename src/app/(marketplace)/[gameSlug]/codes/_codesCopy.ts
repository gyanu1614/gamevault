/**
 * Every string on /[game]/codes, from the researched guide
 * (lib/values/free-guide). Search first ("mm2 codes", "murder mystery 2
 * codes", "mm2 codes october 2026"): the month in the H1 and title is the
 * research's own check date, never hardcoded, so a stale month can't ship.
 * True to the data: the verdict follows `working` (empty → "no code works"),
 * and the FAQ + FAQPage schema reuse the visible sentences.
 */

import { checkedMonthYear, codeMonthYear, formatCheckedDate, newestExpiredCode, type FreeGuide } from '@/lib/values/free-guide'

export interface CopyCtx {
  gameName: string
  shortName: string
}

/** "Combat II (Common knife)" → "Combat II knife"; "Pumpkin (Common pet)" → "Pumpkin pet". */
export function rewardLabel(reward: string): string {
  const m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(reward)
  if (!m) return reward
  const kind = m[2].trim().split(/[\s,]+/)[1]
  return kind ? `${m[1]} ${kind}` : m[1]
}

export function codesFacts(g: FreeGuide) {
  const last = newestExpiredCode(g)
  return {
    working: g.codes.working.length,
    expired: g.codes.expired.length,
    last,
    lastWhen: last ? codeMonthYear(last.when) : null,
    lastReward: last ? rewardLabel(last.reward) : null,
    month: checkedMonthYear(g.checkedAt),
    checked: formatCheckedDate(g.checkedAt),
  }
}
export type CodesFacts = ReturnType<typeof codesFacts>

export const pageTitle = (c: CopyCtx, f: CodesFacts) => `${c.shortName} Codes (${f.month}): Every Code and If Any Work`

export const metaTitle = (c: CopyCtx, f: CodesFacts) => `${c.shortName} Codes ${f.month}: Every Code and If Any Work`

/** The big answer. Only says "none" when the research found none. */
export function verdict(c: CopyCtx, f: CodesFacts): string {
  return f.working === 0
    ? `No ${c.shortName} Code Works Right Now`
    : `${f.working} ${c.shortName} ${f.working === 1 ? 'Code Works' : 'Codes Work'} Right Now`
}

export function lead(c: CopyCtx, f: CodesFacts): { strong: string; rest: string } {
  const strong =
    f.working === 0 ? `No ${c.gameName} code works right now.` : `${f.working} ${c.gameName} codes work right now.`
  const expired = `all ${f.expired} ${c.shortName} codes have expired`
  const history =
    f.last && f.lastWhen
      ? `The last free code, ${f.last.code}, came out in ${f.lastWhen}, and ${expired}.`
      : `${expired[0].toUpperCase()}${expired.slice(1)}.`
  return { strong, rest: `${history} Here is every code, when it ran, and the code scams to avoid.` }
}

export function metaDescription(c: CopyCtx, f: CodesFacts): string {
  const state = f.working === 0 ? `no ${c.shortName} code works` : `${f.working} ${c.shortName} codes work`
  const last = f.last && f.lastWhen ? ` (the last was ${f.last.code}, ${f.lastWhen})` : ''
  return `${c.gameName} codes, checked ${f.checked}: ${state}. All ${f.expired} expired codes${last}, where new codes would be posted, and the scams to avoid.`
}

/** One line under the verdict. */
export function verdictLine(c: CopyCtx, f: CodesFacts): string {
  return f.last && f.lastWhen
    ? `All ${f.expired} ${c.gameName} codes have expired. The last free one, ${f.last.code} (${f.lastReward}), ran in ${f.lastWhen}.`
    : `All ${f.expired} ${c.gameName} codes have expired.`
}

export const announcedHeading = (c: CopyCtx) => `Where New ${c.shortName} Codes Would Be Posted`
export const expiredHeading = (c: CopyCtx, n: number) => `Every Expired ${c.shortName} Code (${n})`
export const promoHeading = (c: CopyCtx) => `${c.shortName} Merch and Toy Codes (Not Free)`
export const scamsHeading = (c: CopyCtx) => `${c.shortName} Code Scams to Avoid`

/** The official channels, from the research's `where_announced` (only the ones we can describe truthfully). */
export interface Channel {
  key: 'x' | 'discord' | 'group'
  name: string
  line: string
  href: string
  cta: string
}

export function channels(c: CopyCtx, g: FreeGuide): Channel[] {
  const find = (re: RegExp) => g.codes.whereAnnounced.find((u) => re.test(u)) ?? null
  const out: Channel[] = []
  const x = find(/^https:\/\/x\.com\//)
  if (x) out.push({ key: 'x', name: `Nikilis on X (@${x.split('/').pop()})`, line: `The ${c.shortName} creator's account, where every past code was announced.`, href: x, cta: 'Open X' })
  const d = find(/discord\.com\/invite\//)
  if (d) out.push({ key: 'discord', name: `Official ${c.shortName} Discord`, line: `Run by Nikilis, about 606,000 members. Codes and events are posted in its announcement channels.`, href: d, cta: 'Open Discord' })
  const grp = find(/roblox\.com\/communities\//)
  if (grp) out.push({ key: 'group', name: 'Murder Mystery Roblox Group', line: `Nikilis's official group on Roblox, about 4.76 million members.`, href: grp, cta: 'Open Group' })
  return out
}

export function redeemCallout(c: CopyCtx): { title: string; body: string } {
  return {
    title: 'Where to Enter a Code',
    body: `guides say the Enter Code box sits at the bottom right of the ${c.shortName} Inventory. With no live codes, there is nothing to redeem.`,
  }
}

/**
 * Title Case display titles for the researched scams (UI headings), keyed by
 * the seed's title; an unknown (new) scam shows its seed title as written.
 */
const SCAM_TITLES: Record<string, (c: CopyCtx) => string> = {
  "Fake 'MM2 codes' and code generator sites": (c) => `Fake ${c.shortName} Codes and Code Generator Sites`,
  "Free Robux or 'free godly' giveaways": () => 'Free Robux and “Free Godly” Giveaways',
  "Trust trades and 'you go first'": () => 'Trust Trades and “You Go First”',
  "Duplication ('dupe') offers and duped items": () => 'Dupe Offers and Duped Items',
  'Untradeable-item and swap tricks in the trade window': () => 'Untradeable Items and Swap Tricks in the Trade Window',
  "Account sharing and 'middleman' requests": () => 'Account Sharing and Fake Middlemen',
}

export const scamTitle = (c: CopyCtx, seedTitle: string) => SCAM_TITLES[seedTitle]?.(c) ?? seedTitle

export function scamsCallout(c: CopyCtx): { title: string; body: string } {
  return {
    title: 'Rule of Thumb',
    body: `real ${c.shortName} codes only ever came from Nikilis's own accounts. Anything that asks for your password, a survey or a download is a scam.`,
  }
}

export function faq(c: CopyCtx, f: CodesFacts) {
  const l = lead(c, f)
  return [
    {
      q: `Are there any working ${c.shortName} codes right now?`,
      a: `${l.strong} ${l.rest.replace(/ Here is every code.*$/, '')}`,
    },
    {
      q: `What was the last ${c.gameName} code?`,
      a: f.last && f.lastWhen
        ? `${f.last.code}, for the ${f.lastReward}, in ${f.lastWhen}. Many code sites say there have been no codes since 2017, but ${f.last.code} came later.`
        : `Every ${c.shortName} code has expired.`,
    },
    {
      q: `Where do you enter codes in ${c.shortName}?`,
      a: `Guides say the Enter Code box sits at the bottom right of the ${c.shortName} Inventory. With no live codes, there is nothing to redeem.`,
    },
    {
      q: `Where are new ${c.shortName} codes announced?`,
      a: `Every past ${c.shortName} code was posted by the creator, Nikilis, on X (@NikilisRBX) and in the official ${c.shortName} Discord. A code that only appears on a random site or video is not real.`,
    },
    {
      q: `Do the NERF ${c.shortName} codes still work?`,
      a: `They were never free: the SharkSeeker and Dartbringer codes came inside paid NERF blasters (2021 and 2022) and give untradeable guns. Whether an unused code still redeems is not confirmed.`,
    },
    {
      q: `Are ${c.shortName} code generators or free Godly generators real?`,
      a: `No. No generator exists, and any site that asks for your username, password, a survey or an app install is phishing. The real free ways are in our free ${c.shortName} items guide.`,
    },
  ]
}

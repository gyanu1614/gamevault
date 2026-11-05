/**
 * Names that read as staff or as DropMarket itself. The database has the same
 * rule (`name_is_reserved`, migration 20261104231717), and that is the real
 * block: this copy only gives a friendly answer before saving. Change both
 * together; profile-name-rules.guard.integration.test.ts compares them.
 *
 * Separators and lookalike digits are ignored, so `Dr0p_Market` and `Adm1n` are
 * caught. Short common words match only as the whole name, or `ModShop` and
 * `helpful` would be refused.
 */
export const RESERVED_NAME_ERROR = 'That name is reserved'

const ANYWHERE = /(dropmarket|safedrop|gamevault|moderat|administrator)/
const AT_THE_EDGE = /^(admin|staff|support|official|verified)|(admin|staff|support|official|verified)$/
const WHOLE_NAME = new Set(['mod', 'mods', 'help', 'helpdesk', 'security', 'system', 'root', 'owner', 'founder'])
const LOOKALIKE: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's' }

function reads(name: string): boolean {
  return ANYWHERE.test(name) || AT_THE_EDGE.test(name) || WHOLE_NAME.has(name)
}

export function isReservedName(name: string): boolean {
  const base = name.toLowerCase().replace(/[^a-z0-9@$]/g, '')
  return reads(base.replace(/[013457@$]/g, (c) => LOOKALIKE[c])) || reads(base.replace(/[^a-z]/g, ''))
}

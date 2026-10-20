/**
 * Per-game settings for the shared item facts (released, origin, How To Get):
 * the names the copy uses and the few game-specific words of the How To Get
 * section. Adding a game to the facts system is one entry here plus its data
 * (the item table's release/origin/how_to_get columns) — no page code.
 */
import { getGameContentTheme } from '@/lib/content/theme'
import { valueListHub } from './hub-config'
import { MM2_VOCAB, type HowToGetVocab } from './how-to-get-copy'

export interface ItemFactsGame {
  /** "Murder Mystery 2": titles use the full name (what people type). */
  gameName: string
  /** "MM2": the other half of the searches. Same as gameName when players don't shorten it. */
  shortName: string
  /** Currency earned per round of play, for the "rounds of play" total (MM2 only). */
  earnRate: { unit: string; perRound: number } | null
  vocab: HowToGetVocab
}

/** A game with no words of its own: nothing that names a place or currency it may not have. */
const GENERIC_VOCAB: HowToGetVocab = {
  shop: 'the in-game shop',
  gone: 'It can’t be obtained in-game any more',
  earn: null,
  craft: null,
}

const VOCAB: Record<string, HowToGetVocab> = {
  'murder-mystery-2': MM2_VOCAB,
  // Eggs are bought in the Nursery with Bucks; retired pets leave the Nursery and Robux sales.
  'adopt-me': {
    shop: 'the Nursery',
    gone: 'It isn’t sold in the Nursery or for Robux any more',
    earn: { unit: 'Bucks', hint: 'Earned by caring for pets and from paychecks' },
    craft: null,
  },
  // Brainrots are bought off the conveyor with in-game cash; an unobtainable one no longer spawns.
  'steal-a-brainrot': {
    shop: 'the conveyor',
    gone: 'It no longer spawns in the game',
    earn: null,
    craft: null,
  },
}

/** Players say the full name for these; no short form in titles or answers. */
const SHORT_NAME: Record<string, string> = {
  'adopt-me': 'Adopt Me',
  'steal-a-brainrot': 'Steal a Brainrot',
}

export function itemFactsGame(gameSlug: string): ItemFactsGame {
  const theme = getGameContentTheme(gameSlug)
  const hub = valueListHub(gameSlug)
  return {
    gameName: theme.name,
    shortName: hub?.shortName ?? SHORT_NAME[gameSlug] ?? theme.name,
    earnRate: hub?.earnRate ? { unit: hub.earnRate.unit, perRound: hub.earnRate.perRound } : null,
    vocab: VOCAB[gameSlug] ?? GENERIC_VOCAB,
  }
}

/**
 * The researched fact sheets, imported at build time. One entry per game slug;
 * a game without an entry renders no guide. Add a file to
 * scripts/content-seeds/currency-guides/ AND a line here (the validator test
 * fails when the two drift).
 */
import g99NightsInTheForest from '../../../scripts/content-seeds/currency-guides/99-nights-in-the-forest.json'
import animeDice from '../../../scripts/content-seeds/currency-guides/anime-dice.json'
import bladeBall from '../../../scripts/content-seeds/currency-guides/blade-ball.json'
import callOfDuty from '../../../scripts/content-seeds/currency-guides/call-of-duty.json'
import escapeFromTarkov from '../../../scripts/content-seeds/currency-guides/escape-from-tarkov.json'
import fc25 from '../../../scripts/content-seeds/currency-guides/fc25.json'
import fortnite from '../../../scripts/content-seeds/currency-guides/fortnite.json'
import growAGarden2 from '../../../scripts/content-seeds/currency-guides/grow-a-garden-2.json'
import growAGarden from '../../../scripts/content-seeds/currency-guides/grow-a-garden.json'
import gtaV from '../../../scripts/content-seeds/currency-guides/gta-v.json'
import minecraft from '../../../scripts/content-seeds/currency-guides/minecraft.json'
import r6Siege from '../../../scripts/content-seeds/currency-guides/r6-siege.json'
import roblox from '../../../scripts/content-seeds/currency-guides/roblox.json'
import tapSimulator from '../../../scripts/content-seeds/currency-guides/tap-simulator.json'
import valorant from '../../../scripts/content-seeds/currency-guides/valorant.json'

export const RAW_CURRENCY_GUIDES: Record<string, unknown> = {
  '99-nights-in-the-forest': g99NightsInTheForest,
  'anime-dice': animeDice,
  'blade-ball': bladeBall,
  'call-of-duty': callOfDuty,
  'escape-from-tarkov': escapeFromTarkov,
  'fc25': fc25,
  'fortnite': fortnite,
  'grow-a-garden-2': growAGarden2,
  'grow-a-garden': growAGarden,
  'gta-v': gtaV,
  'minecraft': minecraft,
  'r6-siege': r6Siege,
  'roblox': roblox,
  'tap-simulator': tapSimulator,
  'valorant': valorant,
}

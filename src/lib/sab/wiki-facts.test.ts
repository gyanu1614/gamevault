import { describe, expect, it } from 'vitest'
import { buildSabFacts, parseObtainment, parseSource, parseUpdateLog, plainText, statusOf, templateBody, templateParams } from './wiki-facts'

// Trimmed from the live wiki pages (stealabrainrot.fandom.com, CC BY-SA), 2026-10-19.
const LA_GRANDE = `{{Tabs}}{{Brainrot Infobox|status=Obtainable|income=10M|cost=1B|image1=<gallery>
La Grande Combinasion.png|Brainrot
La Grande Combinasion Egg.png|Egg
</gallery>|sounds=[[File:La.mp3]]|rarity=Secret|release=Update 04|ritual=No|creator=La T|signifiers=MB, LBB, AA}}
== Overview ==
'''{{PAGENAME}}''' is a {{Secret|Secret}} brainrot that produces {{$/s|10M}} and costs {{$|1B}}.
{{Obtainment|Obtainment=# From the [[Red Carpet]].
# From the [[Admin Lucky Block]] with a 0.5% (1 in 200) chance.
# From [[Sammy's Base]].
# From the [[Backrooms Event]].
# From the [[Cyber Craft Machine]].
#* Crafting Recipe
#** 1x '''La Grande Combinasion'''
# From the [[Escape Tsunami LTM|LTM]]}}`

const CHIHUANINIS = `{{Tabs}}{{SpecialContent|Reason=Exclusive to the [[Los Taco Blocks]].}}{{Brainrot Infobox|income=160K|cost=35M|rarity=Brainrot God|status=Obtainable ([[Los Taco Blocks]])}}
{{Obtainment|Obtainment=# Getting from the [[Los Taco Blocks]].}}`

const PLAIN = `{{Brainrot Infobox|status=Obtainable|cost=50K|rarity=Legendary}}
{{Obtainment}}`

const LOG = `{{UpdateLogEntry
| Update = [[Update Log/Update 04|Update 4]]
| SortDate = 2025-06-21
| Date = June 21, 2025
}}
{{UpdateLogEntry
|Update = [[Update Log/Update 69|Update 69]]
|SortDate = 10-3-2026|Date = October 3rd, 2026
}}`

const updates = parseUpdateLog(LOG)
const build = (text: string, categories: string[] = []) =>
  buildSabFacts({ slug: 'x', pageUrl: 'https://stealabrainrot.fandom.com/wiki/X', text, categories, updates, checkedAt: '2026-10-19' })

describe('wiki markup', () => {
  it('reads the infobox past galleries and nested links', () => {
    const p = templateParams(templateBody(LA_GRANDE, 'Brainrot Infobox'))
    expect([p.status, p.cost, p.rarity, p.release]).toEqual(['Obtainable', '1B', 'Secret', 'Update 04'])
  })
  it('turns templates and links into text', () => {
    expect(plainText("'''X''' costs {{$|1B}} and makes {{$/s|10M}} from the [[Red Carpet#Mechanics|Red Carpet]]")).toBe('X costs $1B and makes $10M/s from the Red Carpet')
  })
})

describe('sources', () => {
  it('names the place and keeps stated odds as written', () => {
    expect(parseSource(' From the [[Admin Lucky Block]] with a 0.5% (1 in 200) chance.')).toEqual([{ name: 'Admin Lucky Block', odds: '0.5%' }])
    expect(parseSource('Fusing it in the [[Witch Fuse]].')).toEqual([{ name: 'Witch Fuse', odds: null }])
  })
  it('splits "X and Y", drops how/when clauses and non-places', () => {
    expect(parseSource('From the Craft Machine and the Brainrot Trader.').map((s) => s.name)).toEqual(['Craft Machine', 'Brainrot Trader'])
    expect(parseSource('From the Brainrot Dealer for $17.5M or 299 Robux.').map((s) => s.name)).toEqual(['Brainrot Dealer'])
    expect(parseSource('Doing a ritual.')).toEqual([])
  })
  it('a bare {{Obtainment}} is the template default: the Red Carpet; sub-bullets are ignored', () => {
    expect(parseObtainment(PLAIN)?.sources).toEqual([{ name: 'Red Carpet', odds: null }])
    expect(parseObtainment(LA_GRANDE)?.sources.map((s) => s.name)).toEqual(['Red Carpet', 'Admin Lucky Block', "Sammy's Base", 'Backrooms Event', 'Cyber Craft Machine', 'LTM'])
  })
})

describe('update log + status', () => {
  it('dates both SortDate formats', () => {
    expect([updates.get(4), updates.get(69)]).toEqual(['2025-06-21', '2026-10-03'])
  })
  it('an unreadable status is unknown, never obtainable', () => {
    expect([statusOf('Obtainable ([[Red Carpet]])'), statusOf('Unobtainable ([[Taco Truck]])'), statusOf('Limited'), statusOf('???'), statusOf(undefined)]).toEqual([
      'obtainable', 'unobtainable', 'seasonal', 'unknown', 'unknown',
    ])
  })
})

describe('buildSabFacts', () => {
  it('La Grande Combinasion: release date from its update, Admin Abuse origin, Red Carpet cost', () => {
    const f = build(LA_GRANDE, ['Category:Admin Abuse Exclusive Brainrots'])
    expect(f.released_at).toBe('2025-06-21')
    expect(f.origin).toBe('Admin Abuse events')
    expect(f.how_to_get).toMatchObject({
      status: 'obtainable',
      method: "Spawns on the Red Carpet or comes from the Admin Lucky Block (0.5% chance) and Sammy's Base, plus 3 more.",
      costs: '$1B in-game cash on the Red Carpet',
      released: '21 June 2025 (Update 4)',
      confidence: 'medium',
    })
  })
  it('an exclusive brainrot: origin is what it is exclusive to, no Red Carpet cost', () => {
    const f = build(CHIHUANINIS)
    expect(f.origin).toBe('Los Taco Blocks')
    expect(f.how_to_get?.method).toBe('Comes from the Los Taco Blocks.')
    expect(f.how_to_get?.costs).toBeUndefined()
    expect(f.released_at).toBeNull()
  })
  it('an unobtainable one reads in the past tense', () => {
    const f = build(`{{Brainrot Infobox|status=Unobtainable}}{{Obtainment|Obtainment=# From the [[Craft Machine]].
# From the [[Brainrot Trader]].}}`)
    expect(f.how_to_get?.method).toBe('Came from the Craft Machine or the Brainrot Trader.')
  })
  it('no Obtainment template: no How To Get section at all', () => {
    expect(build('{{Brainrot Infobox|status=Obtainable}}').how_to_get).toBeNull()
  })
})

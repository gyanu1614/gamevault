/**
 * Valorant Account Template
 *
 * Template definition for Valorant account listings
 */

import type { TemplateField } from './types'

export const valorantAccountTemplate: TemplateField[] = [
  {
    name: 'current_rank',
    type: 'select',
    label: 'Current Rank',
    required: true,
    options: [
      { value: 'unranked', label: 'Unranked', description: 'No competitive rank' },
      { value: 'iron1', label: 'Iron 1' },
      { value: 'iron2', label: 'Iron 2' },
      { value: 'iron3', label: 'Iron 3' },
      { value: 'bronze1', label: 'Bronze 1' },
      { value: 'bronze2', label: 'Bronze 2' },
      { value: 'bronze3', label: 'Bronze 3' },
      { value: 'silver1', label: 'Silver 1' },
      { value: 'silver2', label: 'Silver 2' },
      { value: 'silver3', label: 'Silver 3' },
      { value: 'gold1', label: 'Gold 1' },
      { value: 'gold2', label: 'Gold 2' },
      { value: 'gold3', label: 'Gold 3' },
      { value: 'platinum1', label: 'Platinum 1' },
      { value: 'platinum2', label: 'Platinum 2' },
      { value: 'platinum3', label: 'Platinum 3' },
      { value: 'diamond1', label: 'Diamond 1' },
      { value: 'diamond2', label: 'Diamond 2' },
      { value: 'diamond3', label: 'Diamond 3' },
      { value: 'ascendant1', label: 'Ascendant 1' },
      { value: 'ascendant2', label: 'Ascendant 2' },
      { value: 'ascendant3', label: 'Ascendant 3' },
      { value: 'immortal1', label: 'Immortal 1' },
      { value: 'immortal2', label: 'Immortal 2' },
      { value: 'immortal3', label: 'Immortal 3' },
      { value: 'radiant', label: 'Radiant' }
    ],
    helpText: 'Current competitive rank'
  },
  {
    name: 'peak_rank',
    type: 'select',
    label: 'Peak Rank',
    required: false,
    options: [
      { value: 'iron', label: 'Iron' },
      { value: 'bronze', label: 'Bronze' },
      { value: 'silver', label: 'Silver' },
      { value: 'gold', label: 'Gold' },
      { value: 'platinum', label: 'Platinum' },
      { value: 'diamond', label: 'Diamond' },
      { value: 'ascendant', label: 'Ascendant' },
      { value: 'immortal', label: 'Immortal' },
      { value: 'radiant', label: 'Radiant' }
    ],
    helpText: 'Highest rank ever achieved'
  },
  {
    name: 'region',
    type: 'select',
    label: 'Account Region',
    required: true,
    options: [
      { value: 'na', label: 'North America' },
      { value: 'eu', label: 'Europe' },
      { value: 'ap', label: 'Asia Pacific' },
      { value: 'kr', label: 'Korea' },
      { value: 'latam', label: 'Latin America' },
      { value: 'br', label: 'Brazil' }
    ],
    helpText: 'Server region of the account'
  },
  {
    name: 'account_level',
    type: 'number',
    label: 'Account Level',
    required: false,
    min: 1,
    max: 500,
    placeholder: 'e.g. 120',
    helpText: 'Current account level'
  },
  {
    name: 'agents_unlocked',
    type: 'number',
    label: 'Agents Unlocked',
    required: false,
    min: 0,
    max: 30,
    placeholder: 'e.g. 25',
    helpText: 'Number of agents unlocked (out of total available)'
  },
  {
    name: 'skins_count',
    type: 'number',
    label: 'Number of Skins',
    required: false,
    min: 0,
    placeholder: 'e.g. 50',
    helpText: 'Total number of weapon skins owned'
  },
  {
    name: 'valorant_points',
    type: 'number',
    label: 'Valorant Points (VP)',
    required: false,
    min: 0,
    placeholder: 'e.g. 2000',
    helpText: 'Current VP balance'
  },
  {
    name: 'radianite_points',
    type: 'number',
    label: 'Radianite Points',
    required: false,
    min: 0,
    placeholder: 'e.g. 100',
    helpText: 'Current Radianite balance for upgrading skins'
  },
  {
    name: 'kingdom_credits',
    type: 'number',
    label: 'Kingdom Credits',
    required: false,
    min: 0,
    placeholder: 'e.g. 50000',
    helpText: 'In-game currency for unlocking agents and items'
  },
  {
    name: 'notable_skins',
    type: 'textarea',
    label: 'Notable Skins (Premium/Exclusive)',
    required: false,
    maxLength: 500,
    rows: 4,
    placeholder: 'e.g. Prime Vandal, Elderflame Operator, Reaver Sheriff...',
    helpText: 'List premium skin collections like Prime, Elderflame, Reaver, etc.'
  },
  {
    name: 'battle_pass_tiers',
    type: 'number',
    label: 'Current Battle Pass Tier',
    required: false,
    min: 0,
    max: 55,
    placeholder: 'e.g. 50',
    helpText: 'Current tier in active battle pass (if any)'
  },
  {
    name: 'email_verified',
    type: 'boolean',
    label: 'Email Verified',
    required: false,
    defaultValue: false,
    helpText: 'Is the account email verified?'
  },
  {
    name: 'full_access',
    type: 'boolean',
    label: 'Full Access (Email Included)',
    required: false,
    defaultValue: false,
    helpText: 'Does purchase include full account access with email?'
  },
  {
    name: 'banned_history',
    type: 'select',
    label: 'Ban History',
    required: false,
    options: [
      { value: 'never', label: 'Never Banned', description: 'Clean record' },
      { value: 'chat', label: 'Chat Ban Only', description: 'Temporary chat restriction' },
      { value: 'competitive', label: 'Competitive Ban', description: 'Temporary comp ban' },
      { value: 'hardware', label: 'Hardware Ban (Unbanned)', description: 'Previously hardware banned but now unbanned' }
    ],
    helpText: 'Any history of bans or restrictions?'
  }
]

export const valorantBoostingTemplate: TemplateField[] = [
  {
    name: 'starting_rank',
    type: 'select',
    label: 'Starting Rank',
    required: true,
    options: [
      { value: 'iron', label: 'Iron' },
      { value: 'bronze', label: 'Bronze' },
      { value: 'silver', label: 'Silver' },
      { value: 'gold', label: 'Gold' },
      { value: 'platinum', label: 'Platinum' },
      { value: 'diamond', label: 'Diamond' },
      { value: 'ascendant', label: 'Ascendant' },
      { value: 'immortal', label: 'Immortal' }
    ]
  },
  {
    name: 'target_rank',
    type: 'select',
    label: 'Target Rank',
    required: true,
    options: [
      { value: 'bronze', label: 'Bronze' },
      { value: 'silver', label: 'Silver' },
      { value: 'gold', label: 'Gold' },
      { value: 'platinum', label: 'Platinum' },
      { value: 'diamond', label: 'Diamond' },
      { value: 'ascendant', label: 'Ascendant' },
      { value: 'immortal', label: 'Immortal' },
      { value: 'radiant', label: 'Radiant' }
    ]
  },
  {
    name: 'boost_type',
    type: 'select',
    label: 'Boost Type',
    required: true,
    options: [
      { value: 'solo', label: 'Solo Boost', description: 'We play on your account' },
      { value: 'duo', label: 'Duo Boost', description: 'We play with you' }
    ]
  },
  {
    name: 'queue_type',
    type: 'select',
    label: 'Queue Type',
    required: false,
    options: [
      { value: 'any', label: 'Any Queue' },
      { value: 'solo_duo', label: 'Solo/Duo Only' },
      { value: 'five_stack', label: '5 Stack Only' }
    ]
  },
  {
    name: 'estimated_completion',
    type: 'select',
    label: 'Estimated Completion Time',
    required: false,
    options: [
      { value: '1-3days', label: '1-3 days' },
      { value: '3-7days', label: '3-7 days' },
      { value: '1-2weeks', label: '1-2 weeks' },
      { value: '2-4weeks', label: '2-4 weeks' }
    ]
  }
]

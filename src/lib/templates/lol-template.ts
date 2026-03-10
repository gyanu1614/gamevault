/**
 * League of Legends Account Template
 *
 * Template definition for LoL account listings
 */

import type { TemplateField } from './types'

export const lolAccountTemplate: TemplateField[] = [
  {
    name: 'summoner_level',
    type: 'number',
    label: 'Summoner Level',
    required: true,
    min: 1,
    max: 1000,
    placeholder: 'e.g. 300',
    helpText: 'Current summoner level'
  },
  {
    name: 'current_rank',
    type: 'select',
    label: 'Current Rank (Solo/Duo)',
    required: false,
    options: [
      { value: 'unranked', label: 'Unranked' },
      { value: 'iron', label: 'Iron' },
      { value: 'bronze', label: 'Bronze' },
      { value: 'silver', label: 'Silver' },
      { value: 'gold', label: 'Gold' },
      { value: 'platinum', label: 'Platinum' },
      { value: 'emerald', label: 'Emerald' },
      { value: 'diamond', label: 'Diamond' },
      { value: 'master', label: 'Master' },
      { value: 'grandmaster', label: 'Grandmaster' },
      { value: 'challenger', label: 'Challenger' }
    ],
    helpText: 'Current competitive rank in Solo/Duo queue'
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
      { value: 'emerald', label: 'Emerald' },
      { value: 'diamond', label: 'Diamond' },
      { value: 'master', label: 'Master' },
      { value: 'grandmaster', label: 'Grandmaster' },
      { value: 'challenger', label: 'Challenger' }
    ],
    helpText: 'Highest rank ever achieved'
  },
  {
    name: 'region',
    type: 'select',
    label: 'Server Region',
    required: true,
    options: [
      { value: 'na', label: 'North America (NA)' },
      { value: 'euw', label: 'Europe West (EUW)' },
      { value: 'eune', label: 'Europe Nordic & East (EUNE)' },
      { value: 'kr', label: 'Korea (KR)' },
      { value: 'br', label: 'Brazil (BR)' },
      { value: 'lan', label: 'Latin America North (LAN)' },
      { value: 'las', label: 'Latin America South (LAS)' },
      { value: 'oce', label: 'Oceania (OCE)' },
      { value: 'tr', label: 'Turkey (TR)' },
      { value: 'ru', label: 'Russia (RU)' },
      { value: 'jp', label: 'Japan (JP)' },
      { value: 'pbe', label: 'PBE (Public Beta Environment)' }
    ]
  },
  {
    name: 'champions_owned',
    type: 'number',
    label: 'Champions Owned',
    required: false,
    min: 0,
    max: 170,
    placeholder: 'e.g. 150',
    helpText: 'Number of champions unlocked (out of ~170 total)'
  },
  {
    name: 'skins_count',
    type: 'number',
    label: 'Number of Skins',
    required: false,
    min: 0,
    placeholder: 'e.g. 200',
    helpText: 'Total number of champion skins owned'
  },
  {
    name: 'blue_essence',
    type: 'number',
    label: 'Blue Essence Amount',
    required: false,
    min: 0,
    placeholder: 'e.g. 50000',
    helpText: 'Current Blue Essence (BE) balance'
  },
  {
    name: 'rp_amount',
    type: 'number',
    label: 'Riot Points (RP)',
    required: false,
    min: 0,
    placeholder: 'e.g. 5000',
    helpText: 'Current Riot Points balance'
  },
  {
    name: 'rare_skins',
    type: 'textarea',
    label: 'Rare/Prestige/Legacy Skins',
    required: false,
    maxLength: 500,
    rows: 4,
    placeholder: 'e.g. Championship Riven, PAX TF, Prestige K/DA Ahri, Black Alistar...',
    helpText: 'List rare, limited, prestige, or legacy skins'
  },
  {
    name: 'honor_level',
    type: 'select',
    label: 'Honor Level',
    required: false,
    options: [
      { value: 'locked', label: 'Honor Locked', description: 'Restricted' },
      { value: 'level0', label: 'Level 0' },
      { value: 'level1', label: 'Level 1' },
      { value: 'level2', label: 'Level 2' },
      { value: 'level3', label: 'Level 3' },
      { value: 'level4', label: 'Level 4' },
      { value: 'level5', label: 'Level 5', description: 'Max honor' }
    ],
    helpText: 'Current honor level (behavior rating)'
  },
  {
    name: 'ranked_wins',
    type: 'number',
    label: 'Ranked Wins (This Season)',
    required: false,
    min: 0,
    placeholder: 'e.g. 150',
    helpText: 'Number of ranked wins in current season'
  },
  {
    name: 'account_creation_year',
    type: 'select',
    label: 'Account Creation Year',
    required: false,
    options: [
      { value: '2009', label: '2009', description: 'Beta/Season 1' },
      { value: '2010', label: '2010', description: 'Season 1' },
      { value: '2011', label: '2011', description: 'Season 1-2' },
      { value: '2012', label: '2012', description: 'Season 2' },
      { value: '2013', label: '2013', description: 'Season 3' },
      { value: '2014', label: '2014', description: 'Season 4' },
      { value: '2015', label: '2015', description: 'Season 5' },
      { value: '2016', label: '2016', description: 'Season 6' },
      { value: '2017', label: '2017', description: 'Season 7' },
      { value: '2018', label: '2018', description: 'Season 8' },
      { value: '2019', label: '2019', description: 'Season 9' },
      { value: '2020', label: '2020', description: 'Season 10' },
      { value: '2021', label: '2021+', description: 'Recent' }
    ],
    helpText: 'When was the account created?'
  },
  {
    name: 'original_owner',
    type: 'boolean',
    label: 'Original Owner',
    required: false,
    defaultValue: false,
    helpText: 'Are you the original account creator?'
  },
  {
    name: 'email_verified',
    type: 'boolean',
    label: 'Email Verified',
    required: false,
    defaultValue: false
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
    name: 'ban_history',
    type: 'select',
    label: 'Ban History',
    required: false,
    options: [
      { value: 'never', label: 'Never Banned', description: 'Clean record' },
      { value: 'chat', label: 'Chat Restriction Only' },
      { value: 'temp_suspension', label: 'Temporary Suspension (Resolved)' },
      { value: 'ranked_restriction', label: 'Ranked Restriction (Resolved)' }
    ]
  }
]

export const lolBoostingTemplate: TemplateField[] = [
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
      { value: 'emerald', label: 'Emerald' },
      { value: 'diamond', label: 'Diamond' }
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
      { value: 'emerald', label: 'Emerald' },
      { value: 'diamond', label: 'Diamond' },
      { value: 'master', label: 'Master' },
      { value: 'grandmaster', label: 'Grandmaster' },
      { value: 'challenger', label: 'Challenger' }
    ]
  },
  {
    name: 'queue_type',
    type: 'select',
    label: 'Queue Type',
    required: true,
    options: [
      { value: 'solo_duo', label: 'Solo/Duo Queue' },
      { value: 'flex', label: 'Flex Queue' }
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
  }
]

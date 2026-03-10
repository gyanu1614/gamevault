/**
 * Fortnite Account Template
 *
 * Template definition for Fortnite account listings
 */

import type { TemplateField } from './types'

export const fortniteAccountTemplate: TemplateField[] = [
  {
    name: 'account_level',
    type: 'number',
    label: 'Account Level',
    required: false,
    min: 1,
    max: 1000,
    placeholder: 'e.g. 350',
    helpText: 'Current account level'
  },
  {
    name: 'skins_count',
    type: 'number',
    label: 'Number of Skins',
    required: true,
    min: 0,
    placeholder: 'e.g. 150',
    helpText: 'Total number of outfit skins owned'
  },
  {
    name: 'vbucks_amount',
    type: 'number',
    label: 'V-Bucks Amount',
    required: false,
    min: 0,
    placeholder: 'e.g. 5000',
    helpText: 'Current V-Bucks balance'
  },
  {
    name: 'rare_skins',
    type: 'textarea',
    label: 'Rare/OG Skins',
    required: false,
    maxLength: 500,
    rows: 4,
    placeholder: 'e.g. Renegade Raider, Skull Trooper, Ghoul Trooper, Black Knight...',
    helpText: 'List rare, OG, or exclusive skins (especially Chapter 1 skins)'
  },
  {
    name: 'emotes_count',
    type: 'number',
    label: 'Number of Emotes',
    required: false,
    min: 0,
    placeholder: 'e.g. 100',
    helpText: 'Total number of emotes owned'
  },
  {
    name: 'pickaxes_count',
    type: 'number',
    label: 'Number of Pickaxes',
    required: false,
    min: 0,
    placeholder: 'e.g. 80',
    helpText: 'Total number of harvesting tools owned'
  },
  {
    name: 'backblings_count',
    type: 'number',
    label: 'Number of Back Blings',
    required: false,
    min: 0,
    placeholder: 'e.g. 120',
    helpText: 'Total number of back bling cosmetics'
  },
  {
    name: 'gliders_count',
    type: 'number',
    label: 'Number of Gliders',
    required: false,
    min: 0,
    placeholder: 'e.g. 90',
    helpText: 'Total number of gliders owned'
  },
  {
    name: 'stw_access',
    type: 'boolean',
    label: 'Save the World Access',
    required: false,
    defaultValue: false,
    helpText: 'Does the account have access to Save the World mode?'
  },
  {
    name: 'stw_founders',
    type: 'boolean',
    label: 'STW Founder Status',
    required: false,
    defaultValue: false,
    helpText: 'Is this a Founder account for Save the World?'
  },
  {
    name: 'battle_pass_skins',
    type: 'textarea',
    label: 'Notable Battle Pass Skins',
    required: false,
    maxLength: 300,
    rows: 3,
    placeholder: 'e.g. Omega, Ragnarok, Ice King, The Reaper (John Wick)...',
    helpText: 'List notable/maxed battle pass skins from previous seasons'
  },
  {
    name: 'platforms',
    type: 'multiselect',
    label: 'Linked Platforms',
    required: false,
    options: [
      { value: 'pc', label: 'PC' },
      { value: 'ps4', label: 'PlayStation 4' },
      { value: 'ps5', label: 'PlayStation 5' },
      { value: 'xbox', label: 'Xbox' },
      { value: 'switch', label: 'Nintendo Switch' },
      { value: 'mobile', label: 'Mobile' }
    ],
    helpText: 'Which platforms is the account linked to?'
  },
  {
    name: 'wins_total',
    type: 'number',
    label: 'Total Wins',
    required: false,
    min: 0,
    placeholder: 'e.g. 500',
    helpText: 'Total number of Victory Royales across all modes'
  },
  {
    name: 'season_joined',
    type: 'select',
    label: 'Season Joined',
    required: false,
    options: [
      { value: 'ch1s1', label: 'Chapter 1 Season 1', description: 'OG Season' },
      { value: 'ch1s2', label: 'Chapter 1 Season 2' },
      { value: 'ch1s3', label: 'Chapter 1 Season 3' },
      { value: 'ch1s4', label: 'Chapter 1 Season 4' },
      { value: 'ch1s5', label: 'Chapter 1 Season 5' },
      { value: 'ch1s6', label: 'Chapter 1 Season 6' },
      { value: 'ch1s7', label: 'Chapter 1 Season 7' },
      { value: 'ch1s8', label: 'Chapter 1 Season 8' },
      { value: 'ch1s9', label: 'Chapter 1 Season 9' },
      { value: 'ch1s10', label: 'Chapter 1 Season X' },
      { value: 'ch2', label: 'Chapter 2' },
      { value: 'ch3', label: 'Chapter 3' },
      { value: 'ch4', label: 'Chapter 4' },
      { value: 'ch5', label: 'Chapter 5' }
    ],
    helpText: 'Which season did the account start playing?'
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
  }
]

export const fortniteCurrencyTemplate: TemplateField[] = [
  {
    name: 'vbucks_amount',
    type: 'number',
    label: 'V-Bucks Amount',
    required: true,
    min: 1000,
    max: 100000,
    placeholder: 'e.g. 13500',
    helpText: 'Amount of V-Bucks to be delivered'
  },
  {
    name: 'delivery_method',
    type: 'select',
    label: 'Delivery Method',
    required: true,
    options: [
      { value: 'gift_card', label: 'Gift Card Code', description: 'PSN/Xbox/eShop card code' },
      { value: 'direct_purchase', label: 'Direct Purchase', description: 'We buy V-Bucks directly' }
    ]
  },
  {
    name: 'platform',
    type: 'select',
    label: 'Platform',
    required: true,
    options: [
      { value: 'all', label: 'All Platforms' },
      { value: 'pc', label: 'PC' },
      { value: 'ps', label: 'PlayStation' },
      { value: 'xbox', label: 'Xbox' },
      { value: 'switch', label: 'Nintendo Switch' }
    ],
    helpText: 'Which platform is this for?'
  }
]

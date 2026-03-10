/**
 * Roblox Account Template
 *
 * Template definition for Roblox account listings
 */

import type { TemplateField } from './types'

export const robloxAccountTemplate: TemplateField[] = [
  {
    name: 'account_level',
    type: 'number',
    label: 'Account Level',
    required: true,
    min: 1,
    max: 500,
    placeholder: 'e.g. 150',
    helpText: 'Current account level in Roblox'
  },
  {
    name: 'robux_amount',
    type: 'number',
    label: 'Robux Amount',
    required: false,
    min: 0,
    placeholder: 'e.g. 5000',
    helpText: 'Current Robux balance on the account'
  },
  {
    name: 'premium_active',
    type: 'boolean',
    label: 'Premium Membership Active',
    required: false,
    defaultValue: false,
    helpText: 'Does the account have active Roblox Premium?'
  },
  {
    name: 'limiteds_count',
    type: 'number',
    label: 'Number of Limited Items',
    required: false,
    min: 0,
    placeholder: 'e.g. 10',
    helpText: 'How many limited/limited unique items does the account own?'
  },
  {
    name: 'rap_value',
    type: 'number',
    label: 'RAP Value (Recent Average Price)',
    required: false,
    min: 0,
    placeholder: 'e.g. 50000',
    helpText: 'Total RAP value of all limited items'
  },
  {
    name: 'account_age',
    type: 'select',
    label: 'Account Age',
    required: false,
    options: [
      { value: '0-6months', label: '0-6 months', description: 'New account' },
      { value: '6-12months', label: '6-12 months', description: 'Less than a year' },
      { value: '1-2years', label: '1-2 years', description: 'Moderately aged' },
      { value: '2-5years', label: '2-5 years', description: 'Well established' },
      { value: '5+years', label: '5+ years', description: 'OG account' }
    ],
    helpText: 'How old is the account?'
  },
  {
    name: 'friends_count',
    type: 'number',
    label: 'Friends Count',
    required: false,
    min: 0,
    placeholder: 'e.g. 200',
    helpText: 'Number of friends on the account'
  },
  {
    name: 'groups_owned',
    type: 'number',
    label: 'Groups Owned',
    required: false,
    min: 0,
    placeholder: 'e.g. 3',
    helpText: 'Number of Roblox groups owned by this account'
  },
  {
    name: 'notable_items',
    type: 'textarea',
    label: 'Notable Items/Badges',
    required: false,
    maxLength: 500,
    rows: 4,
    placeholder: 'List rare items, badges, or achievements...',
    helpText: 'Describe any rare items, event badges, or special achievements'
  },
  {
    name: 'has_email',
    type: 'boolean',
    label: 'Email Included',
    required: false,
    defaultValue: false,
    helpText: 'Will the account email be included with purchase?'
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
    name: 'phone_verified',
    type: 'boolean',
    label: 'Phone Verified',
    required: false,
    defaultValue: false,
    helpText: 'Is the account phone verified?'
  }
]

export const robloxCurrencyTemplate: TemplateField[] = [
  {
    name: 'robux_amount',
    type: 'number',
    label: 'Robux Amount',
    required: true,
    min: 100,
    max: 1000000,
    placeholder: 'e.g. 10000',
    helpText: 'Amount of Robux to be delivered'
  },
  {
    name: 'delivery_method',
    type: 'select',
    label: 'Delivery Method',
    required: true,
    options: [
      { value: 'gamepass', label: 'Game Pass', description: 'Via purchasing a game pass' },
      { value: 'group_payout', label: 'Group Payout', description: 'Via group funds payout' },
      { value: 'trading', label: 'Trading', description: 'Via limited item trading' }
    ],
    helpText: 'How will the Robux be delivered?'
  },
  {
    name: 'estimated_wait_time',
    type: 'select',
    label: 'Estimated Wait Time',
    required: false,
    options: [
      { value: 'instant', label: 'Instant', description: 'Within 5 minutes' },
      { value: '1-6hours', label: '1-6 hours' },
      { value: '6-24hours', label: '6-24 hours' },
      { value: '1-3days', label: '1-3 days', description: 'Pending period for group payouts' },
      { value: '3-7days', label: '3-7 days' }
    ],
    helpText: 'How long until buyer receives Robux?'
  }
]

export const robloxItemsTemplate: TemplateField[] = [
  {
    name: 'item_name',
    type: 'text',
    label: 'Item Name',
    required: true,
    maxLength: 100,
    placeholder: 'e.g. Dominus Empyreus',
    helpText: 'Name of the Roblox item'
  },
  {
    name: 'item_type',
    type: 'select',
    label: 'Item Type',
    required: true,
    options: [
      { value: 'limited', label: 'Limited', description: 'Limited item' },
      { value: 'limited_u', label: 'Limited U', description: 'Limited Unique item' },
      { value: 'ugc', label: 'UGC Limited', description: 'User-generated limited' },
      { value: 'hat', label: 'Hat/Accessory' },
      { value: 'gear', label: 'Gear' },
      { value: 'face', label: 'Face' },
      { value: 'bundle', label: 'Bundle' }
    ]
  },
  {
    name: 'rap_value',
    type: 'number',
    label: 'RAP Value',
    required: false,
    min: 0,
    placeholder: 'e.g. 25000',
    helpText: 'Recent Average Price of the item'
  },
  {
    name: 'quantity',
    type: 'number',
    label: 'Quantity Available',
    required: true,
    min: 1,
    defaultValue: 1,
    helpText: 'How many of this item do you have?'
  },
  {
    name: 'serial_number',
    type: 'text',
    label: 'Serial Number(s)',
    required: false,
    maxLength: 200,
    placeholder: 'e.g. #123, #456',
    helpText: 'Serial number for Limited U items (if applicable)'
  }
]

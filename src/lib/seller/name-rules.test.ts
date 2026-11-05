import { describe, expect, it } from 'vitest'
import { storeNameSchema } from '@/lib/founding/onboarding'
import { isReservedName, RESERVED_NAME_ERROR } from './name-rules'

describe('the store name form uses the rule', () => {
  const message = (name: string) => {
    const result = storeNameSchema.safeParse(name)
    return result.success ? null : result.error.issues[0]?.message
  }

  it.each(['DropMarketSupport', 'admin1', 'Official_Store'])('refuses %s with the reserved message', (name) => {
    expect(message(name)).toBe(RESERVED_NAME_ERROR)
  })

  it('refuses two words and long names with their own message', () => {
    expect(message('Two Words')).toMatch(/One word/)
    expect(message('a'.repeat(21))).toMatch(/At most 20/)
  })

  it('takes an ordinary name', () => {
    expect(message('GGTrading')).toBeNull()
  })
})

describe('isReservedName', () => {
  it.each([
    'dropmarket', 'DropMarket', 'drop_market', 'Drop-Market', 'Dr0pMarket', 'DropMarketSupport', 'TheDropMarket', 'DROPMARKET1',
    'safedrop', 'SafeDrop_Help', 'gamevault',
    'admin', 'Admin', 'admin1', 'Adm1n', '1admin', 'AdminStore', 'store_admin', 'administrator',
    'moderator', 'M0derator', 'moderation', 'mod', 'mods', 'Mod_1',
    'staff', 'StaffTeam', 'store_staff',
    'support', 'Supp0rt', '5upport', 'support24', 'LiveSupport',
    'official', 'Official_Store', '0fficial', 'TheOfficial',
    'verified', 'VerifiedSeller', 'SellerVerified',
    'help', 'Help1', 'helpdesk', 'security', 'system', 'root', 'owner', 'founder',
  ])('blocks %s', (name) => {
    expect(isReservedName(name)).toBe(true)
  })

  it.each([
    'GGTrading', 'Trader1', 'BloxShop', 'badminton', 'Modern', 'ModShop', 'helpful', 'supreme_items',
    'pet_market', 'Marketplace', 'dropshop', 'staple', 'rootbeer', 'Ownership', 'gyanu1615', 'blox_market-2',
  ])('allows %s', (name) => {
    expect(isReservedName(name)).toBe(false)
  })
})

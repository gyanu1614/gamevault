import { describe, expect, it } from 'vitest'
import { defaultDeliveryNote, deliveryMethodLabel, itemTypeLabel } from './item-kind'

describe('item-kind', () => {
  it('names the item type per game, "Item" for the rest', () => {
    expect(itemTypeLabel('adopt-me')).toBe('Pet')
    expect(itemTypeLabel('steal-a-brainrot')).toBe('Brainrot')
    expect(itemTypeLabel('blox-fruits')).toBe('Item')
  })

  it('says In-Game Trade only where items move by trade', () => {
    expect(deliveryMethodLabel('adopt-me')).toBe('In-Game Trade')
    expect(deliveryMethodLabel('murder-mystery-2')).toBe('In-Game Trade')
    expect(deliveryMethodLabel('steal-a-brainrot')).toBe('In-Game Delivery')
  })

  it('falls back to the order-chat hand-over when the seller wrote nothing', () => {
    expect(defaultDeliveryNote('adopt-me', 'Adopt Me')).toBe('After you pay, the seller messages you in the order chat and hands the pet over to you in Adopt Me.')
  })
})

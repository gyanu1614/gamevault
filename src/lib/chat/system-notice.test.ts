import { describe, expect, it } from 'vitest'
import { isSystemMessage, parseSystemNotice, systemNoticePreview, LEGACY_SYSTEM_SENDER } from './system-notice'

describe('system notices', () => {
  it('a missing or legacy sender is a system message; a user id is not', () => {
    expect(isSystemMessage(null)).toBe(true)
    expect(isSystemMessage(undefined)).toBe(true)
    expect(isSystemMessage(LEGACY_SYSTEM_SENDER)).toBe(true)
    expect(isSystemMessage('4a0e7c1e-1111-4222-8333-944445555666')).toBe(false)
  })

  it('parses only known notice types', () => {
    expect(parseSystemNotice('{"type":"dispute_opened","reason":"x"}')).toMatchObject({ type: 'dispute_opened' })
    expect(parseSystemNotice('{"type":"something_else"}')).toBeNull()
    expect(parseSystemNotice('hello')).toBeNull()
  })

  it('previews read as plain words, never raw JSON', () => {
    expect(systemNoticePreview('{"type":"dispute_opened"}')).toBe('Dispute opened')
    expect(systemNoticePreview('{"type":"dispute_resolved","resolution":"seller_favor","resolvedBy":"buyer"}')).toBe(
      'Dispute closed by the buyer',
    )
    expect(systemNoticePreview('{"type":"dispute_resolved","resolution":"buyer_favor"}')).toBe('Dispute resolved')
    expect(systemNoticePreview('not json')).toBe('DropMarket update')
  })
})

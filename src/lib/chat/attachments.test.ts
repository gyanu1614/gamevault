import { describe, expect, it } from 'vitest'
import {
  randomAttachmentId,
  chatAttachmentPath,
  isImageAttachment,
  isStoragePath,
  validateChatAttachment,
} from './attachments'

describe('chat attachments', () => {
  it('accepts images and PDFs up to 10 MB', () => {
    expect(validateChatAttachment({ type: 'image/png', size: 1024 })).toBeNull()
    expect(validateChatAttachment({ type: 'application/pdf', size: 10 * 1024 * 1024 })).toBeNull()
  })

  it('rejects other types, oversized and empty files', () => {
    expect(validateChatAttachment({ type: 'text/html', size: 10 })).toMatch(/Only images/)
    expect(validateChatAttachment({ type: 'image/svg+xml', size: 10 })).toMatch(/Only images/)
    expect(validateChatAttachment({ type: 'image/png', size: 10 * 1024 * 1024 + 1 })).toMatch(/10 MB/)
    expect(validateChatAttachment({ type: 'image/png', size: 0 })).toMatch(/empty/)
  })

  it('keeps chat files inside the order folder, extension from the MIME type', () => {
    expect(chatAttachmentPath('order-1', 'image/jpeg', 'abc')).toBe('order-1/chat/abc.jpg')
    expect(chatAttachmentPath('order-1', 'application/pdf', 'abc')).toBe('order-1/chat/abc.pdf')
  })

  it('tells stored paths from URLs, and images from other files', () => {
    expect(isStoragePath('order-1/chat/abc.jpg')).toBe(true)
    expect(isStoragePath('https://x.supabase.co/a.png')).toBe(false)
    expect(isStoragePath('blob:http://localhost/1')).toBe(false)
    expect(isImageAttachment('order-1/chat/abc.webp')).toBe(true)
    expect(isImageAttachment('order-1/chat/abc.pdf')).toBe(false)
  })

  it('makes a 32-char hex id without crypto.randomUUID', () => {
    const id = randomAttachmentId()
    expect(id).toMatch(/^[0-9a-f]{32}$/)
    expect(randomAttachmentId()).not.toBe(id)
  })
})

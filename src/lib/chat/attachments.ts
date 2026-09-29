/**
 * Order-chat attachments.
 *
 * Files live in the PRIVATE `delivery-evidence` bucket under the order's
 * own folder, `{orderId}/chat/…`. That bucket's storage policies already
 * limit read + upload to the order's buyer and seller (and admins), so no
 * new bucket or policy is needed. `messages.attachments` stores the object
 * PATH (never a public URL); the bubble swaps it for a short-lived signed
 * URL when it renders. Nothing lists the `{orderId}/` folder as delivery
 * proof (delivery evidence is recorded on the order row), so a chat file
 * can never stand in for it.
 */

import { compressImageForUpload } from '@/lib/images/compress-client'

export const CHAT_ATTACHMENT_BUCKET = 'delivery-evidence'
export const CHAT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024 // 10 MB

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
}

export const CHAT_ATTACHMENT_ACCEPT = Object.keys(EXT_BY_TYPE).join(',')

export function validateChatAttachment(file: { type: string; size: number }): string | null {
  if (!EXT_BY_TYPE[file.type]) return 'Only images (JPG, PNG, WEBP, GIF) and PDFs can be sent.'
  if (file.size > CHAT_ATTACHMENT_MAX_BYTES) return 'Files must be 10 MB or smaller.'
  if (file.size === 0) return 'That file is empty.'
  return null
}

/** `{orderId}/chat/{random}.{ext}`, the extension taken from the MIME type. */
export function chatAttachmentPath(orderId: string, mimeType: string, random: string): string {
  const ext = EXT_BY_TYPE[mimeType] ?? 'bin'
  return `${orderId}/chat/${random}.${ext}`
}

/**
 * Random object name. crypto.getRandomValues, not crypto.randomUUID:
 * randomUUID only exists in secure contexts (https / localhost), so on a
 * plain-http origin (a phone testing a LAN dev server) it is undefined and
 * the send died before the upload.
 */
export function randomAttachmentId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** A stored value is a storage path unless it is already a URL. */
export function isStoragePath(value: string): boolean {
  return !/^(https?:|blob:|data:)/i.test(value)
}

export function isImageAttachment(value: string): boolean {
  const clean = value.split('?')[0].toLowerCase()
  return /\.(jpe?g|png|webp|gif)$/.test(clean) || value.startsWith('blob:')
}

/** Label for a message that is only a file (messages.content can't be empty). */
export function attachmentOnlyLabel(mimeType: string): string {
  return mimeType === 'application/pdf' ? 'Sent a PDF' : 'Sent a photo'
}

/**
 * Upload one chat file to the order's private folder and return its storage
 * path (what messages.attachments stores). Throws with a user-facing message;
 * the caller shows it. `storage` is the browser Supabase client's storage.
 */
export async function uploadChatAttachment(
  storage: { from: (bucket: string) => { upload: (path: string, file: File, opts: Record<string, unknown>) => Promise<{ error: unknown }> } },
  orderId: string,
  file: File,
): Promise<string> {
  // Photos are shrunk in the browser first (<=1600 px WebP/JPEG), so a
  // phone photo uploads fast and is stored small; the 10 MB cap then
  // applies to what is actually stored. PDFs / GIFs pass through.
  const toSend = await compressImageForUpload(file)
  const problem = validateChatAttachment(toSend)
  if (problem) throw new Error(problem)
  const path = chatAttachmentPath(orderId, toSend.type, randomAttachmentId())
  let failure: unknown = null
  try {
    const res = await storage.from(CHAT_ATTACHMENT_BUCKET).upload(path, toSend, {
      upsert: false,
      // Unique path per file: never changes, so browsers may keep it.
      cacheControl: '31536000',
      contentType: toSend.type,
    })
    failure = res.error
  } catch (e) {
    failure = e
  }
  if (failure) {
    console.error('Chat attachment upload failed:', failure)
    throw new Error('Could not upload the file. Please try again.')
  }
  return path
}

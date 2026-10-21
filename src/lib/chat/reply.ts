/**
 * Replies: the one-line quote of the message being answered, shown above
 * the reply bubble and in the composer's "Replying to" bar. Unit-tested:
 * reply.test.ts.
 */

const MAX = 90

/** The label a file-only message stores (attachmentOnlyLabel). */
const FILE_LABELS: Record<string, string> = { 'Sent a photo': 'Photo', 'Sent a PDF': 'PDF' }

export function replySnippet(message: { content: string; attachments?: string[] | null }): string {
  const hasFiles = (message.attachments?.length ?? 0) > 0
  if (hasFiles && FILE_LABELS[message.content]) return FILE_LABELS[message.content]
  const text = message.content.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
  if (text.length <= MAX) return text
  const cut = text.slice(0, MAX)
  const atWord = cut.lastIndexOf(' ')
  return `${(atWord > MAX * 0.6 ? cut.slice(0, atWord) : cut).trimEnd()}…`
}

/** Who wrote a message, as the quote shows it. NULL sender = DropMarket notice. */
export function senderLabel(senderId: string | null, viewerId: string, names: Record<string, string | undefined>): string {
  if (senderId === null) return 'DropMarket'
  if (senderId === viewerId) return 'You'
  return names[senderId] || 'User'
}

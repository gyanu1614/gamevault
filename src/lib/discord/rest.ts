/**
 * Discord REST calls the bot makes AFTER acknowledging an interaction.
 *
 * Deliberately uses the interaction token, not the bot token: the token in the
 * payload authorises editing that specific response for 15 minutes, so the bot
 * token never has to be present on this path at all. Fewer places to leak it.
 */

import type { MessagePayload } from './types'

const API_BASE = 'https://discord.com/api/v10'

/**
 * Replace the deferred "thinking" message with the real content.
 *
 * Never throws: this runs after the HTTP response has already gone back to
 * Discord, so there is nobody left to return an error to. A failure here means
 * the user sees the thinking state expire, and we want that in the logs rather
 * than as an unhandled rejection.
 */
export async function editOriginalResponse(
  applicationId: string,
  interactionToken: string,
  payload: MessagePayload,
): Promise<void> {
  try {
    const response = await fetch(
      `${API_BASE}/webhooks/${applicationId}/${interactionToken}/messages/@original`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      },
    )

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      console.error(
        `Discord followup failed (${response.status}): ${detail.slice(0, 500)}`,
      )
    }
  } catch (error) {
    console.error('Discord followup threw:', error)
  }
}

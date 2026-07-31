/**
 * Discord interactions endpoint — the whole bot's front door.
 *
 * HTTP interactions rather than a gateway process: the bot is slash-only and
 * user-installable, so it never needs to read message content, which means it
 * never needs the privileged Message Content intent, a websocket, or a
 * long-running host. Discord POSTs here, we verify and answer.
 *
 * TIMING is the design constraint. Discord drops any interaction not
 * acknowledged within 3 seconds, and a cold serverless start plus a database
 * round trip can approach that. So commands ACK immediately with a deferred
 * response and the real work continues in the background via waitUntil, which
 * keeps the function alive after the response is flushed.
 *
 * Autocomplete is the exception: it CANNOT be deferred, so it answers inline
 * from an in-memory catalog index and degrades to an empty list rather than
 * blowing the deadline.
 */

import { waitUntil } from '@vercel/functions'

import { editOriginalResponse } from '@/lib/discord/rest'
import {
  buildAutocomplete,
  executeCommand,
  executeComponent,
} from '@/lib/discord/router'
import { ephemeral } from '@/lib/discord/embeds'
import { InteractionResponseType, InteractionType, type Interaction } from '@/lib/discord/types'
import { verifyDiscordSignature } from '@/lib/discord/verify'

// Node runtime: signature verification uses node:crypto's Ed25519 support.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY

export async function POST(request: Request): Promise<Response> {
  if (!PUBLIC_KEY) {
    console.error('DISCORD_PUBLIC_KEY is not configured')
    return new Response('Server is not configured', { status: 500 })
  }

  // Must be the RAW body: the signature covers the exact bytes sent, so
  // re-serializing parsed JSON would change them and fail verification.
  const rawBody = await request.text()

  const valid = verifyDiscordSignature({
    rawBody,
    signature: request.headers.get('x-signature-ed25519'),
    timestamp: request.headers.get('x-signature-timestamp'),
    publicKeyHex: PUBLIC_KEY,
  })

  // Discord sends deliberately-invalid requests when you save the endpoint URL
  // and refuses to accept it unless they are rejected with a 401.
  if (!valid) {
    return new Response('Invalid request signature', { status: 401 })
  }

  let interaction: Interaction

  try {
    interaction = JSON.parse(rawBody) as Interaction
  } catch {
    return new Response('Malformed payload', { status: 400 })
  }

  if (interaction.type === InteractionType.Ping) {
    return Response.json({ type: InteractionResponseType.Pong })
  }

  if (interaction.type === InteractionType.Autocomplete) {
    const choices = await buildAutocomplete(interaction)
    return Response.json({
      type: InteractionResponseType.AutocompleteResult,
      data: { choices },
    })
  }

  if (interaction.type === InteractionType.ApplicationCommand) {
    waitUntil(respondLater(interaction, () => executeCommand(interaction)))

    return Response.json({
      type: InteractionResponseType.DeferredChannelMessage,
    })
  }

  if (interaction.type === InteractionType.MessageComponent) {
    waitUntil(respondLater(interaction, () => executeComponent(interaction)))

    // Deferred UPDATE, so the existing message stays visible while the new
    // mutation price is fetched, rather than flashing an empty reply.
    return Response.json({
      type: InteractionResponseType.DeferredMessageUpdate,
    })
  }

  return Response.json({ type: InteractionResponseType.Pong })
}

/**
 * Run a handler and edit the deferred response with whatever it produced.
 *
 * Errors are converted into a visible ephemeral message rather than left to
 * time out — a handler that throws would otherwise leave the user staring at
 * "thinking..." until Discord gives up, with no clue anything went wrong.
 */
async function respondLater(
  interaction: Interaction,
  handler: () => Promise<Parameters<typeof editOriginalResponse>[2]>,
): Promise<void> {
  let payload: Parameters<typeof editOriginalResponse>[2]

  try {
    payload = await handler()
  } catch (error) {
    console.error('Discord command handler threw:', error)
    payload = ephemeral(
      'Something went wrong looking that up. Try again in a moment.',
    )
  }

  await editOriginalResponse(
    interaction.application_id,
    interaction.token,
    payload,
  )
}

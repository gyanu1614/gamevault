/**
 * Interaction routing.
 *
 * Kept transport-agnostic on purpose: nothing here knows about Vercel, HTTP,
 * or signature verification. If the bot ever outgrows HTTP interactions and
 * needs a gateway process, these handlers move across untouched.
 */

import { ephemeral } from './embeds'
import {
  autocompleteBrainrot,
  autocompleteMutation,
  runValue,
  runValueSelect,
  type AutocompleteChoice,
} from './commands/value'
import { runTop } from './commands/top'
import { runWfl } from './commands/wfl'
import {
  focusedOption,
  optionMap,
  type Interaction,
  type MessagePayload,
} from './types'

export async function buildAutocomplete(
  interaction: Interaction,
): Promise<AutocompleteChoice[]> {
  const focused = focusedOption(interaction.data?.options)
  if (!focused) return []

  try {
    if (focused.name === 'mutation') {
      return await autocompleteMutation(focused.value)
    }
    // Every other autocompleting option in the command set names a Brainrot.
    return await autocompleteBrainrot(focused.value)
  } catch (error) {
    // Never fail an autocomplete: an empty list still lets the user type on,
    // whereas an error surfaces as "interaction failed" mid-keystroke.
    console.error('Discord autocomplete failed:', error)
    return []
  }
}

export async function executeCommand(
  interaction: Interaction,
): Promise<MessagePayload> {
  const name = interaction.data?.name
  const options = optionMap(interaction.data?.options)

  switch (name) {
    case 'value':
      return runValue(options.brainrot ?? '', options.mutation)

    case 'wfl':
      return runWfl(options.you ?? '', options.them ?? '')

    case 'top':
      return runTop(options.rarity, options.limit)

    default:
      console.error(`Discord interaction for unknown command: ${name}`)
      return ephemeral('That command is no longer available.')
  }
}

export async function executeComponent(
  interaction: Interaction,
): Promise<MessagePayload> {
  const customId = interaction.data?.custom_id ?? ''
  const [kind, reference] = customId.split(':')
  const selected = interaction.data?.values?.[0]

  if (kind === 'value' && reference && selected) {
    return runValueSelect(reference, selected)
  }

  console.error(`Discord component with unhandled custom_id: ${customId}`)
  return ephemeral('That control is no longer active.')
}

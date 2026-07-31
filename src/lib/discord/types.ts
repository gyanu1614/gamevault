/**
 * Minimal Discord Interactions typings.
 *
 * The bot is HTTP-interactions only — no gateway, no Message Content intent —
 * so discord.js would be megabytes of websocket machinery we never touch.
 * These are the handful of payload shapes the endpoint actually receives.
 *
 * Spec: https://discord.com/developers/docs/interactions/receiving-and-responding
 */

export const InteractionType = {
  Ping: 1,
  ApplicationCommand: 2,
  MessageComponent: 3,
  Autocomplete: 4,
} as const

export const InteractionResponseType = {
  Pong: 1,
  ChannelMessage: 4,
  DeferredChannelMessage: 5,
  DeferredMessageUpdate: 6,
  MessageUpdate: 7,
  AutocompleteResult: 8,
} as const

export const MessageFlags = {
  /** Only the invoking user sees it. Used for errors and "no data" replies. */
  Ephemeral: 1 << 6,
} as const

export const ComponentType = {
  ActionRow: 1,
  Button: 2,
  StringSelect: 3,
} as const

export const ButtonStyle = {
  Link: 5,
} as const

/**
 * Discord's hard payload limits. Exceeding any of these makes the API reject
 * the whole message with a 400, so builders clamp against these rather than
 * hoping the content is short enough.
 */
export const Limits = {
  embedTitle: 256,
  embedDescription: 4096,
  fieldName: 256,
  fieldValue: 1024,
  footerText: 2048,
  fieldsPerEmbed: 25,
  autocompleteChoices: 25,
  choiceName: 100,
  selectOptions: 25,
  customId: 100,
} as const

export type InteractionOption = {
  name: string
  type: number
  value?: string | number | boolean
  focused?: boolean
  options?: InteractionOption[]
}

export type Interaction = {
  id: string
  type: number
  token: string
  application_id: string
  guild_id?: string
  channel_id?: string
  data?: {
    id?: string
    name?: string
    custom_id?: string
    component_type?: number
    values?: string[]
    options?: InteractionOption[]
  }
  member?: { user?: { id: string; username?: string } }
  user?: { id: string; username?: string }
  message?: { id: string }
}

export type EmbedField = {
  name: string
  value: string
  inline?: boolean
}

export type Embed = {
  title?: string
  description?: string
  url?: string
  color?: number
  fields?: EmbedField[]
  thumbnail?: { url: string }
  image?: { url: string }
  footer?: { text: string; icon_url?: string }
  timestamp?: string
  author?: { name: string; url?: string; icon_url?: string }
}

export type Component =
  | {
      type: typeof ComponentType.ActionRow
      components: Component[]
    }
  | {
      type: typeof ComponentType.Button
      style: typeof ButtonStyle.Link
      label: string
      url: string
      emoji?: { name: string }
    }
  | {
      type: typeof ComponentType.StringSelect
      custom_id: string
      placeholder?: string
      options: {
        label: string
        value: string
        description?: string
        default?: boolean
        emoji?: { name: string }
      }[]
    }

export type MessagePayload = {
  content?: string
  embeds?: Embed[]
  components?: Component[]
  flags?: number
  allowed_mentions?: { parse: string[] }
}

/** The user whose interaction this is — differs between guild and DM context. */
export function interactionUserId(interaction: Interaction): string | null {
  return interaction.member?.user?.id ?? interaction.user?.id ?? null
}

/** Flatten command options into a plain lookup, ignoring subcommand nesting. */
export function optionMap(
  options: InteractionOption[] | undefined,
): Record<string, string> {
  const result: Record<string, string> = {}

  for (const option of options ?? []) {
    if (option.value != null) {
      result[option.name] = String(option.value)
    }
  }

  return result
}

/** The option the user is currently typing, for autocomplete requests. */
export function focusedOption(
  options: InteractionOption[] | undefined,
): { name: string; value: string } | null {
  for (const option of options ?? []) {
    if (option.focused) {
      return { name: option.name, value: String(option.value ?? '') }
    }
  }

  return null
}

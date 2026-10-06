/**
 * The hub tool tabs (HubNav, HubFooter). A tiny module of its own so the
 * client nav can import the paths without pulling every game theme into the
 * browser bundle. Each tool is also a HubPageSet page (lib/content/theme).
 */
export type HubTool = 'values' | 'calculator' | 'events' | 'freeItems' | 'codes'

/** The URL segment of each tool tab (/[game]/<segment>). */
export const HUB_TOOL_PATH: Record<HubTool, string> = {
  values: 'values',
  calculator: 'calculator',
  events: 'events',
  freeItems: 'free-items',
  codes: 'codes',
}

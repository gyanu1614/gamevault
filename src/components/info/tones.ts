/**
 * The colour of each section on the site's info pages (SafeDrop, fees,
 * browse, guides). One hue per section so neighbouring sections read as
 * separate (owner rule, ui-section-design-lessons). Values match the values
 * hubs' callouts and number tiles; inline because the theme colours are CSS
 * variables, which Tailwind cannot tint with an opacity modifier.
 */
export type InfoTone = 'blue' | 'green' | 'red' | 'amber' | 'lime' | 'neutral'

/** `wash`: the stronger hero/band glow of the page's tone. */
export const INFO_TONE: Record<InfoTone, { hue: string; tint: string; edge: string; wash: string }> = {
  blue: { hue: '#8BBDFB', tint: 'rgba(96,165,250,0.12)', edge: 'rgba(96,165,250,0.26)', wash: 'rgba(96,165,250,0.22)' },
  green: { hue: '#3FD986', tint: 'rgba(63,217,134,0.12)', edge: 'rgba(63,217,134,0.26)', wash: 'rgba(63,217,134,0.18)' },
  red: { hue: '#FF8A8A', tint: 'rgba(255,92,92,0.12)', edge: 'rgba(255,92,92,0.26)', wash: 'rgba(255,92,92,0.18)' },
  amber: { hue: '#FACC15', tint: 'rgba(250,204,21,0.10)', edge: 'rgba(250,204,21,0.24)', wash: 'rgba(250,204,21,0.16)' },
  lime: { hue: '#56B87F', tint: 'rgba(86,184,127,0.12)', edge: 'rgba(86,184,127,0.30)', wash: 'rgba(86,184,127,0.20)' },
  neutral: { hue: '#E9EDF2', tint: 'rgba(255,255,255,0.07)', edge: 'rgba(255,255,255,0.12)', wash: 'rgba(255,255,255,0.08)' },
}

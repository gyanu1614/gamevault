import { linkifySegments } from '@/lib/chat/linkify'

/** Clock time under a bubble ("10:42 AM"); the day is on the divider. */
export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/** Plain text with http(s) URLs rendered as tappable links (new tab). */
function renderLinks(text: string, keyPrefix: string) {
  return linkifySegments(text).map((seg, i) =>
    seg.type === 'link' ? (
      <a
        key={`${keyPrefix}-${i}`}
        href={seg.href}
        target="_blank"
        rel="noopener noreferrer nofollow ugc"
        className="break-all font-medium text-lime-text underline underline-offset-2 hover:opacity-90"
      >
        {seg.value}
      </a>
    ) : (
      <span key={`${keyPrefix}-${i}`}>{seg.value}</span>
    ),
  )
}

/** Message text: **bold** spans plus links. */
export function renderMarkdown(text: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g)
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const content = part.slice(2, -2)
      return <strong key={index} className="font-semibold">{renderLinks(content, `b${index}`)}</strong>
    }
    return <span key={index}>{renderLinks(part, `t${index}`)}</span>
  })
}

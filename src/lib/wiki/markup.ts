/**
 * MediaWiki markup helpers for the fan-wiki fact collectors (Steal a
 * Brainrot, Adopt Me): find a template, read its named params, turn markup
 * into plain text. Pure and dependency-free — the collectors load it through
 * tsx, so no `@/` imports and no TS-only runtime syntax.
 */

/** The body of the first `{{Name …}}` template, braces balanced, or null. */
export function templateBody(text: string, name: string): string | null {
  const re = new RegExp(`\\{\\{\\s*${name.replace(/ /g, '[ _]')}\\s*(?=[|}])`, 'i')
  const m = re.exec(text)
  if (!m) return null
  let depth = 0
  for (let i = m.index; i < text.length - 1; i++) {
    if (text[i] === '{' && text[i + 1] === '{') {
      depth++
      i++
    } else if (text[i] === '}' && text[i + 1] === '}') {
      depth--
      i++
      if (depth === 0) return text.slice(m.index + m[0].length, i - 1)
    }
  }
  return null
}

/** Split a template body on its top-level pipes (not inside {{ }}, [[ ]] or <tag>…</tag>). */
function topLevelParts(body: string): string[] {
  const parts: string[] = []
  let cur = ''
  let braces = 0
  let brackets = 0
  let tag = 0
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2)
    if (two === '{{') { braces++; cur += two; i++; continue }
    if (two === '}}') { braces--; cur += two; i++; continue }
    if (two === '[[') { brackets++; cur += two; i++; continue }
    if (two === ']]') { brackets--; cur += two; i++; continue }
    if (/^<(gallery|tabber)\b/i.test(body.slice(i, i + 8))) tag++
    if (/^<\/(gallery|tabber)>/i.test(body.slice(i, i + 10))) tag = Math.max(0, tag - 1)
    if (body[i] === '|' && braces === 0 && brackets === 0 && tag === 0) {
      parts.push(cur)
      cur = ''
      continue
    }
    cur += body[i]
  }
  parts.push(cur)
  return parts
}

/** Named params of a template body: `status=Obtainable` → { status: 'Obtainable' }. */
export function templateParams(body: string | null): Record<string, string> {
  const out: Record<string, string> = {}
  if (!body) return out
  for (const part of topLevelParts(body)) {
    const eq = part.indexOf('=')
    if (eq <= 0) continue
    const key = part.slice(0, eq).trim().toLowerCase()
    if (/^[a-z0-9 _-]+$/.test(key)) out[key] = part.slice(eq + 1).trim()
  }
  return out
}

/** One inline template → its text: {{$|1B}} → "$1B", {{RarityText|Secret|Secret}} → "Secret". */
function inlineTemplate(inner: string): string {
  const parts = topLevelParts(inner)
  const name = parts[0].trim()
  const args = parts.slice(1)
  const positional = args.filter((a) => !/^\s*[A-Za-z0-9 _-]+\s*=/.test(a)).map((a) => a.trim())
  const named = Object.fromEntries(
    args.filter((a) => /^\s*[A-Za-z0-9 _-]+\s*=/.test(a)).map((a) => [a.slice(0, a.indexOf('=')).trim().toLowerCase(), a.slice(a.indexOf('=') + 1).trim()]),
  )
  if (name === '$') return `$${positional[0] ?? ''}`
  if (name === '$/s') return `$${positional[0] ?? ''}/s`
  if (/^pagename$/i.test(name)) return ''
  return named.name ?? positional[positional.length - 1] ?? Object.values(named)[0] ?? name
}

/** Wiki markup → plain text: links, inline templates, bold/italics, tags. */
export function plainText(wiki: string): string {
  let s = wiki
  s = s.replace(/<nowiki\s*\/>/gi, '').replace(/<br\s*\/?>/gi, ' ').replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
  s = s.replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, '')
  // Innermost templates first, until none are left.
  for (let n = 0; n < 6 && /\{\{/.test(s); n++) s = s.replace(/\{\{([^{}]*)\}\}/g, (_, inner: string) => inlineTemplate(inner))
  s = s.replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
  s = s.replace(/\[https?:\/\/\S+\s([^\]]+)\]/g, '$1')
  s = s.replace(/'''?/g, '').replace(/<[^>]+>/g, '')
  return s.replace(/\s+/g, ' ').trim()
}

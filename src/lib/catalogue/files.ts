/**
 * Wiki file fields → one file name, shared by the game adapters (they never
 * import each other).
 */
import { plainText } from '../wiki/markup'

/**
 * The infobox picture → one wiki file name. A plain "Slushi Huski.png", or a
 * <gallery> with one "file|caption" per line (normal + egg art): the first file.
 * Also cleans a value stored before this existed ("A.png|Brainrot B.png|Egg").
 */
export function firstImageFile(raw: string | null | undefined): string | null {
  const lines = (raw ?? '')
    .replace(/<\/?gallery[^>]*>/gi, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const name = plainText(lines[0]?.split('|')[0] ?? '')
    .replace(/^(?:file|image):/i, '')
    .trim()
  return name || null
}

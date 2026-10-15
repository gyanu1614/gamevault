/**
 * The credit line under an Adopt Me pet image that is our copy from the Adopt
 * Me Wiki (CC BY-SA 3.0 asks for it). Copies live at adopt-me-pets/wiki/ in
 * our bucket (scripts/lib/adoptme-wiki-images.mjs). Plain module.
 */
const WIKI_COPY = '/adopt-me-pets/wiki/'

export function petImageCredit(imageUrl: string | null | undefined, petName: string): { text: string; href: string } | null {
  if (!imageUrl?.includes(WIKI_COPY)) return null
  return {
    text: 'Image: Adopt Me Wiki (Fandom), CC BY-SA 3.0',
    href: `https://adoptme.fandom.com/wiki/${encodeURIComponent(petName.replace(/ /g, '_'))}`,
  }
}

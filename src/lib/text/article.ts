/**
 * "a" or "an" before a word, by sound: "an Arctic Reindeer", "a Unicorn",
 * "an OG", "a Secret". The 2026-10-06 audit found "a Arctic Reindeer" on
 * Adopt Me pet pages and "a Epic Brainrot" on Steal a Brainrot pages.
 */
const AN_BEFORE_CONSONANT = /^(hour|honest|honou?r|heir)/i
const A_BEFORE_VOWEL = /^(uni|use|usu|ura|ure|uti|eu|ewe|one|once|ubi)/i

export function article(word: string): 'a' | 'an' {
  const w = word.trim()
  if (!w) return 'a'
  if (AN_BEFORE_CONSONANT.test(w)) return 'an'
  if (A_BEFORE_VOWEL.test(w)) return 'a'
  // All-caps initialisms read letter by letter: "an OG", "an MVP", "a UFO".
  if (/^[A-Z]{2,}\b/.test(w)) return /^[AEFHILMNORSX]/.test(w) ? 'an' : 'a'
  return /^[aeiou]/i.test(w) ? 'an' : 'a'
}

/** "an Arctic Reindeer". */
export function withArticle(word: string): string {
  return `${article(word)} ${word}`
}

export type FuzzyMatch = { score: number; ranges: [number, number][] }

const SEPARATORS = " -_./:\\>()"

function startsWord(text: string, index: number) {
  if (index === 0) return true
  const previous = text[index - 1]!
  const current = text[index]!
  return (
    SEPARATORS.includes(previous) ||
    (current !== current.toLowerCase() && previous === previous.toLowerCase())
  )
}

/**
 * Scores `text` against `query` as an in-order subsequence; null when some character is missing.
 * A contiguous substring scores highest, then matches at word starts and in runs.
 */
export function fuzzyMatch(query: string, text: string): FuzzyMatch | null {
  const needle = query.trim().toLowerCase()
  if (!needle) return { score: 0, ranges: [] }
  const haystack = text.toLowerCase()

  const exact = haystack.indexOf(needle)
  if (exact !== -1) {
    return {
      score: 1000 + (startsWord(text, exact) ? 100 : 0) - exact,
      ranges: [[exact, exact + needle.length]],
    }
  }

  let score = 0
  let from = 0
  let previous = -2
  const ranges: [number, number][] = []
  for (const char of needle) {
    if (char === " ") continue
    const index = haystack.indexOf(char, from)
    if (index === -1) return null
    score += 1
    if (startsWord(text, index)) score += 8
    if (index === previous + 1) {
      score += 5
      ranges[ranges.length - 1]![1] = index + 1
    } else {
      ranges.push([index, index + 1])
    }
    previous = index
    from = index + 1
  }
  return { score: score - text.length * 0.01, ranges }
}

/**
 * Normalizes a spoken phrase for comparison: lowercases, strips punctuation,
 * collapses whitespace.
 */
export function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[.,!?]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Checks whether `text` contains the wake word, and if so, returns whatever
 * was said *after* it (the actual command). Returns null if the wake word
 * wasn't heard.
 *
 * Primary wake word is "hy jarvis", with common phonetic/spoken variants.
 */
const WAKE_WORD_VARIANTS = ["hy jarvis", "hi jarvis", "hey jarvis", "ok jarvis", "jarvis"];

export function extractCommandAfterWakeWord(text) {
  const normalized = normalize(text);
  for (const variant of WAKE_WORD_VARIANTS) {
    const index = normalized.indexOf(variant);
    if (index !== -1) {
      return normalized.slice(index + variant.length).trim();
    }
  }
  return null;
}

/**
 * Given a command phrase and a list of { patterns, handler } entries,
 * runs the handler for the first pattern that matches (substring match).
 * Patterns are checked longest-first so more specific phrases win over
 * short generic ones (e.g. "go to admin dashboard" over "dashboard").
 */
export function matchCommand(phrase, commands) {
  const sorted = [...commands].sort((a, b) => {
    const longestA = Math.max(...a.patterns.map((p) => p.length));
    const longestB = Math.max(...b.patterns.map((p) => p.length));
    return longestB - longestA;
  });

  for (const command of sorted) {
    for (const pattern of command.patterns) {
      if (phrase.includes(pattern)) {
        return command;
      }
    }
  }
  return null;
}

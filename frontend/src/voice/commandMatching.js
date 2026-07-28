/**
 * commandMatching.js — Job Easy voice control
 * -------------------------------------------------------------------------
 * Pure (DOM-optional) helpers that turn a spoken phrase into a command.
 *
 * Design goals
 *  1. Commands are written using the *exact text that is visible on screen*
 *     ("User Management", "Approval Requests", "Review Pending Requests"…).
 *     The matcher is responsible for absorbing the natural language around
 *     that label: "open …", "go to …", "click …", "show me the … page".
 *  2. Never hang and never throw. Every tier degrades into a cheaper one and
 *     the worst case is simply "no match", which the caller reports back to
 *     the user.
 *  3. Fast. Everything is O(patterns) with small strings, pattern metadata is
 *     compiled once and cached, and no work depends on React state.
 *
 * Matching tiers (best score wins):
 *   exact  → normalized phrase equals the pattern
 *   phrase → pattern appears as a contiguous run of words in the phrase
 *   fuzzy  → per-word similarity (Dice bigrams + Levenshtein) so mis-heard
 *            words such as "aproval request" still resolve
 */

/* -------------------------------------------------------------------------
 * Tunables
 * ---------------------------------------------------------------------- */

/**
 * Default confidence required before a spoken phrase runs a command.
 * The microphone is always on while voice control is enabled, so this is tuned
 * to reject conversational speech rather than to be maximally permissive —
 * a wrong navigation is far more annoying than a repeated command.
 */
export const DEFAULT_MIN_SCORE = 0.78;

/** Confidence required before clicking an arbitrary element found in the DOM. */
export const DEFAULT_UI_MIN_SCORE = 0.8;

/** Confidence required for destructive/irreversible commands (e.g. log out). */
export const STRICT_MIN_SCORE = 0.9;

/**
 * Relaxed floor for the fallback pass. Only ever applied when the utterance
 * begins with an explicit command verb ("open …", "go to …", "click …"),
 * which is what tells us the user was addressing the app rather than talking.
 * Without that signal a threshold this low matches ordinary conversation.
 */
export const FALLBACK_MIN_SCORE = 0.62;

/** Anything at/above this is treated as "the user said it verbatim". */
export const EXACT_SCORE = 0.98;

/**
 * Hard bounds on how much text is ever scored. Voice commands are short; these
 * caps stop a runaway transcript from turning matching into a UI freeze.
 */
const MAX_PHRASE_CHARS = 240;
const MAX_PHRASE_WORDS = 16;

/* -------------------------------------------------------------------------
 * Normalization
 * ---------------------------------------------------------------------- */

const PUNCTUATION_RE = /[.,!?;:"“”()[\]{}<>/\\|@#$%^&*_+=~`]/g;

/**
 * Lowercases, strips punctuation and collapses whitespace.
 * Safe for any input (null/undefined → "").
 */
export function normalize(text) {
  if (text === null || text === undefined) return "";
  return String(text)
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/'s\b/g, "s") // user's → users
    .replace(/[-–—]+/g, " ")
    .replace(PUNCTUATION_RE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Speech-to-text spells the same intent in many ways ("log out" / "sign out",
 * "e mail" / "email"). Collapse those to one canonical spelling so the exact
 * tier can do its job. Applied identically to patterns and to utterances.
 */
const PHRASE_ALIASES = [
  [/\bsign(?:ed)? out\b/g, "logout"],
  [/\blog(?:ged)? out\b/g, "logout"],
  [/\bsign off\b/g, "logout"],
  [/\bsign in\b/g, "login"],
  [/\blog in\b/g, "login"],
  [/\bsigned in\b/g, "login"],
  [/\bsign up\b/g, "register"],
  [/\bsignup\b/g, "register"],
  [/\bcreate (?:an )?account\b/g, "register"],
  [/\be mail\b/g, "email"],
  [/\bemail's\b/g, "email"],
  [/\bdash board\b/g, "dashboard"],
  [/\bhome page\b/g, "home"],
  [/\blanding page\b/g, "home"],
  [/\bfront page\b/g, "home"],
  [/\bc\.? ?v\.?\b/g, "cv"],
  [/\bresume\b/g, "cv"],
  [/\bweb app\b/g, "app"],
  [/\bjob easy\b/g, "jobeasy"],
  [/\bset up\b/g, "setup"],
  [/\bre fresh\b/g, "refresh"],
  [/\bre load\b/g, "reload"],
];

function applyAliases(text) {
  let out = text;
  for (const [pattern, replacement] of PHRASE_ALIASES) out = out.replace(pattern, replacement);
  return out.replace(/\s+/g, " ").trim();
}

/** Words that carry no meaning for command matching. */
const FILLER_WORDS = new Set([
  "please", "pls", "um", "umm", "uh", "er", "ah", "okay", "ok", "hey", "hi", "hello",
  "yo", "just", "kindly", "now", "can", "could", "would", "will", "you", "u", "i",
  "we", "lets", "let", "us", "the", "a", "an", "my", "mine", "our", "this", "that",
  "these", "those", "some", "and", "then", "also", "to", "for", "of", "on", "at",
  "in", "into", "it", "its", "am", "is", "are", "be", "wanna", "want", "need", "gonna",
]);

/** Trailing words users tack onto a label: "user management page". */
const TRAILING_NOISE = new Set([
  "page", "pages", "screen", "section", "panel", "tab", "menu", "link", "button",
  "option", "area", "view", "list", "now", "thanks", "thank",
]);

/**
 * Very small stemmer: only plural "s" is removed, and only where it cannot
 * change the meaning of a short word. Applied to both sides so it is always
 * symmetric ("requests" ↔ "request", "templates" ↔ "template").
 */
function stem(token) {
  if (token.length <= 3) return token;
  if (token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.endsWith("ses") || token.endsWith("xes") || token.endsWith("zes")) return token.slice(0, -2);
  if (token.endsWith("ss")) return token;
  if (token.endsWith("s")) return token.slice(0, -1);
  return token;
}

/**
 * Normalize → alias → drop filler/trailing noise → stem.
 * Returns "" only when the input has no usable words at all.
 */
export function canonicalize(text) {
  const base = applyAliases(normalize(text));
  if (!base) return "";

  const raw = base.split(" ");
  const kept = raw.filter((token) => token && !FILLER_WORDS.has(token));
  const words = kept.length ? kept : raw;

  // Drop trailing filler nouns, but never empty the phrase out.
  while (words.length > 1 && TRAILING_NOISE.has(words[words.length - 1])) words.pop();

  const stemmed = words.map(stem).filter(Boolean);
  return (stemmed.length ? stemmed : words).join(" ");
}

/* -------------------------------------------------------------------------
 * Leading verb handling
 * ---------------------------------------------------------------------- */

/**
 * Navigational verbs. Removing them can never destroy meaning because no UI
 * label in the app starts with them.
 * Longest first so "go to" wins over "go".
 */
const PRIMARY_VERBS = [
  "navigate to", "take me to", "bring me to", "send me to", "head over to", "head to",
  "jump to", "switch to", "move to", "go over to", "go back to", "go to", "goto",
  "go into", "go", "open up", "open", "launch", "load up", "pull up", "bring up",
  "show me", "show", "display", "visit", "browse to", "browse", "check out", "check",
  "click on", "click the", "click", "press", "tap on", "tap", "hit", "select",
  "choose", "activate", "trigger", "execute", "start",
];

/**
 * Verbs that *may* also be part of a real label ("Create template",
 * "Manage Users", "Review Pending Requests"). They are only stripped for the
 * lowest-weight fallback form.
 */
const SECONDARY_VERBS = [
  "manage", "review", "create", "make", "add", "new", "edit", "update", "modify",
  "view", "see", "read", "get", "find", "give me", "run",
];

/** Verbs that mean "press the thing on screen" rather than "navigate". */
const CLICK_VERBS = new Set([
  "click", "click on", "click the", "press", "tap", "tap on", "hit", "select", "choose",
  "activate", "trigger", "run", "execute",
]);

function stripLeading(text, verbs) {
  let phrase = text;
  let verb = "";
  let guard = 0;

  while (guard < 6) {
    guard += 1;
    let changed = false;

    // leading fillers ("can you please …")
    const tokens = phrase.split(" ").filter(Boolean);
    while (tokens.length > 1 && FILLER_WORDS.has(tokens[0])) {
      tokens.shift();
      changed = true;
    }
    phrase = tokens.join(" ");

    for (const candidate of verbs) {
      if (phrase === candidate) break; // the verb IS the command ("open")
      if (phrase.startsWith(`${candidate} `)) {
        phrase = phrase.slice(candidate.length + 1).trim();
        if (!verb) verb = candidate;
        changed = true;
        break;
      }
    }

    if (!changed) break;
  }

  return { verb, phrase };
}

/* -------------------------------------------------------------------------
 * Similarity primitives
 * ---------------------------------------------------------------------- */

const MAX_COMPARE_LENGTH = 48; // keeps Levenshtein bounded no matter what

/**
 * Memo for token-pair similarity. Speech reuses the same handful of words
 * across every pattern in the registry, so this turns the O(tokens × patterns)
 * fuzzy pass into mostly cache hits.
 */
const similarityCache = new Map();
const SIMILARITY_CACHE_LIMIT = 4000;

function levenshtein(a, b) {
  const s = a.length > MAX_COMPARE_LENGTH ? a.slice(0, MAX_COMPARE_LENGTH) : a;
  const t = b.length > MAX_COMPARE_LENGTH ? b.slice(0, MAX_COMPARE_LENGTH) : b;
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;

  let previous = new Array(t.length + 1);
  let current = new Array(t.length + 1);
  for (let j = 0; j <= t.length; j += 1) previous[j] = j;

  for (let i = 1; i <= s.length; i += 1) {
    current[0] = i;
    const sc = s.charCodeAt(i - 1);
    for (let j = 1; j <= t.length; j += 1) {
      const cost = sc === t.charCodeAt(j - 1) ? 0 : 1;
      const del = previous[j] + 1;
      const ins = current[j - 1] + 1;
      const sub = previous[j - 1] + cost;
      current[j] = del < ins ? (del < sub ? del : sub) : ins < sub ? ins : sub;
    }
    const swap = previous;
    previous = current;
    current = swap;
  }

  return previous[t.length];
}

function bigrams(value) {
  const set = new Map();
  for (let i = 0; i < value.length - 1; i += 1) {
    const gram = value.slice(i, i + 2);
    set.set(gram, (set.get(gram) || 0) + 1);
  }
  return set;
}

function diceCoefficient(a, b) {
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const left = bigrams(a);
  const right = bigrams(b);
  let overlap = 0;
  let total = 0;
  for (const count of left.values()) total += count;
  for (const [gram, count] of right) {
    total += count;
    const available = left.get(gram);
    if (available) overlap += Math.min(available, count);
  }
  return total === 0 ? 0 : (2 * overlap) / total;
}

/**
 * Jaro-Winkler: the best of the three at the mistakes speech-to-text actually
 * makes — transposed letters and a wrong vowel in the middle of an otherwise
 * correct word ("defualt"/"default", "managment"/"management").
 */
function jaroWinkler(a, b) {
  const s = a.length > MAX_COMPARE_LENGTH ? a.slice(0, MAX_COMPARE_LENGTH) : a;
  const t = b.length > MAX_COMPARE_LENGTH ? b.slice(0, MAX_COMPARE_LENGTH) : b;
  if (!s.length || !t.length) return 0;
  if (s === t) return 1;

  const window = Math.max(0, Math.floor(Math.max(s.length, t.length) / 2) - 1);
  const sFlags = new Uint8Array(s.length);
  const tFlags = new Uint8Array(t.length);
  let matches = 0;

  for (let i = 0; i < s.length; i += 1) {
    const from = window > i ? 0 : i - window;
    const to = Math.min(i + window + 1, t.length);
    for (let j = from; j < to; j += 1) {
      if (!tFlags[j] && s[i] === t[j]) {
        sFlags[i] = 1;
        tFlags[j] = 1;
        matches += 1;
        break;
      }
    }
  }
  if (!matches) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < s.length; i += 1) {
    if (!sFlags[i]) continue;
    while (!tFlags[k]) k += 1;
    if (s[i] !== t[k]) transpositions += 1;
    k += 1;
  }
  transpositions /= 2;

  const jaro = (matches / s.length + matches / t.length + (matches - transpositions) / matches) / 3;

  // Winkler bonus for a shared prefix (up to 4 chars).
  let prefix = 0;
  const limit = Math.min(4, s.length, t.length);
  while (prefix < limit && s[prefix] === t[prefix]) prefix += 1;

  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * Fuzzy similarity between two short strings, 0..1.
 * Blends three complementary measures and keeps the most forgiving:
 *   Dice bigrams  — robust to insertions and reordering
 *   edit distance — robust to a single wrong character
 *   Jaro-Winkler  — robust to transpositions and shared prefixes
 */
export function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;

  // Length gate: strings this far apart can never clear any useful threshold,
  // and skipping them avoids the expensive measures entirely.
  const shorter = a.length < b.length ? a.length : b.length;
  const longer = a.length < b.length ? b.length : a.length;
  if (longer - shorter > 6 || shorter / longer < 0.45) return 0;

  const key = a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
  const cached = similarityCache.get(key);
  if (cached !== undefined) return cached;

  const dice = diceCoefficient(a, b);
  const distance = levenshtein(a, b);
  const edit = 1 - distance / longer;
  // Jaro-Winkler is generous on very short strings ("send"/"spend"), so it is
  // damped there to avoid false positives on one-syllable commands.
  const jw = jaroWinkler(a, b) * (shorter < 5 ? 0.9 : 1);

  const score = dice > edit ? (dice > jw ? dice : jw) : edit > jw ? edit : jw;

  if (similarityCache.size >= SIMILARITY_CACHE_LIMIT) similarityCache.clear();
  similarityCache.set(key, score);
  return score;
}

/* -------------------------------------------------------------------------
 * Compiled patterns (cached)
 * ---------------------------------------------------------------------- */

const patternCache = new Map();
const PATTERN_CACHE_LIMIT = 800;

/** @returns {{ text: string, tokens: string[], collapsed: string, source: string }} */
export function compilePattern(source) {
  const key = String(source ?? "");
  const cached = patternCache.get(key);
  if (cached) return cached;

  const text = canonicalize(key);
  const tokens = text ? text.split(" ") : [];
  const compiled = { text, tokens, collapsed: text.replace(/\s+/g, ""), source: key };

  if (patternCache.size > PATTERN_CACHE_LIMIT) patternCache.clear();
  patternCache.set(key, compiled);
  return compiled;
}

const commandCache = new WeakMap();

function compileCommand(command) {
  const cached = commandCache.get(command);
  if (cached && cached.patterns === command.patterns) return cached;

  const sources = [];
  if (command.label) sources.push(command.label);
  if (Array.isArray(command.patterns)) sources.push(...command.patterns);

  const compiled = {
    patterns: command.patterns,
    compiled: sources.map(compilePattern).filter((entry) => entry.tokens.length > 0),
  };
  commandCache.set(command, compiled);
  return compiled;
}

/* -------------------------------------------------------------------------
 * Phrase parsing
 * ---------------------------------------------------------------------- */

function makeForm(text, weight) {
  const tokens = text.split(" ").filter(Boolean);
  return { text, tokens, collapsed: text.replace(/\s+/g, ""), weight };
}

/**
 * Turns a raw transcript into everything the scorer needs. Cheap enough to run
 * on every interim result, but callers can parse once and reuse the object.
 *
 * @param {string} phrase
 * @returns {{ raw: string, normalized: string, verb: string, isClickIntent: boolean, forms: Array }}
 */
export function parsePhrase(phrase) {
  const input = typeof phrase === "string" ? phrase : String(phrase ?? "");
  // Commands are short. Anything longer is dictation or a runaway transcript,
  // and truncating keeps every downstream cost bounded.
  const raw = input.length > MAX_PHRASE_CHARS ? input.slice(0, MAX_PHRASE_CHARS) : input;
  let normalized = applyAliases(normalize(raw));

  if (normalized.length) {
    const words = normalized.split(" ");
    if (words.length > MAX_PHRASE_WORDS) {
      // Keep the tail: "um so anyway ... open user management" ends with the
      // actual instruction far more often than it starts with it.
      normalized = words.slice(-MAX_PHRASE_WORDS).join(" ");
    }
  }

  if (!normalized) {
    return { raw, normalized: "", verb: "", isClickIntent: false, forms: [] };
  }

  const forms = [];
  const seen = new Set();
  const push = (value, weight) => {
    const text = canonicalize(value);
    if (!text || seen.has(text)) return;
    seen.add(text);
    forms.push(makeForm(text, weight));
  };

  push(normalized, 1);
  const primary = stripLeading(normalized, PRIMARY_VERBS);
  push(primary.phrase, 0.995);
  const secondary = stripLeading(primary.phrase, SECONDARY_VERBS);
  push(secondary.phrase, 0.9);

  return {
    raw,
    normalized,
    verb: primary.verb,
    isClickIntent: CLICK_VERBS.has(primary.verb),
    /**
     * True when the utterance opens with an explicit command verb. This is the
     * signal that the user is addressing the app, which is what makes it safe
     * to lower the matching threshold on the fallback pass.
     */
    hasCommandIntent: Boolean(primary.verb),
    forms,
  };
}

function asParsed(phrase) {
  return phrase && typeof phrase === "object" && Array.isArray(phrase.forms)
    ? phrase
    : parsePhrase(phrase);
}

/* -------------------------------------------------------------------------
 * Scoring
 * ---------------------------------------------------------------------- */

/** Is `needle` a contiguous run of words inside `haystack`? */
function containsSequence(haystack, needle) {
  if (!needle.length || needle.length > haystack.length) return false;
  outer: for (let i = 0; i <= haystack.length - needle.length; i += 1) {
    for (let j = 0; j < needle.length; j += 1) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

const TOKEN_MATCH_FLOOR = 0.78;

/**
 * Similarity at which two words are considered "the same word, mis-heard".
 * Used to require a real lexical anchor on the relaxed fallback pass.
 */
const ANCHOR_FLOOR = 0.84;

/**
 * Does the phrase contain a recognisable instance of at least one meaningful
 * word from the pattern? "open the window" shares nothing with "pending
 * requests", so it is rejected even though loose string similarity is non-zero.
 */
function hasTokenAnchor(phraseTokens, patternTokens) {
  for (const patternToken of patternTokens) {
    if (patternToken.length < 4) continue; // short words are weak evidence
    for (const phraseToken of phraseTokens) {
      if (phraseToken === patternToken) return true;
      if (
        Math.abs(phraseToken.length - patternToken.length) <= 3 &&
        similarity(phraseToken, patternToken) >= ANCHOR_FLOOR
      ) {
        return true;
      }
    }
  }
  // Patterns made entirely of short words ("back", "home", "mute") must be
  // matched exactly by one of the spoken words.
  if (patternTokens.every((token) => token.length < 4)) {
    return patternTokens.some((token) => phraseTokens.includes(token));
  }
  return false;
}

/** Fraction (0..1) of the pattern's words that appear in the phrase. */
function tokenCoverage(phraseTokens, patternTokens) {
  if (!patternTokens.length || !phraseTokens.length) return 0;
  const pool = phraseTokens.slice();
  let matched = 0;

  for (const token of patternTokens) {
    let bestScore = 0;
    let bestIndex = -1;
    for (let i = 0; i < pool.length; i += 1) {
      const score = pool[i] === token ? 1 : similarity(pool[i], token);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
      if (bestScore === 1) break;
    }
    if (bestScore >= TOKEN_MATCH_FLOOR && bestIndex >= 0) {
      matched += bestScore;
      pool.splice(bestIndex, 1);
    }
  }

  return matched / patternTokens.length;
}

/**
 * How much of what the user said is explained by the pattern, 0..1.
 *
 * This is the main defence against false positives: the mic is always live, so
 * "hold on a second" must not fire the "Send" command just because the word
 * "second" is near "send". A command only wins when the pattern accounts for
 * most of the utterance — a short pattern buried in a long sentence is scored
 * down sharply.
 */
function explanatoryRatio(form, pattern) {
  const ratio = pattern.tokens.length / form.tokens.length;
  if (ratio >= 1) return 1;
  // 1 extra word is fine ("open user management" → 3/4 with the verb kept),
  // beyond that the confidence falls away quickly.
  return ratio ** 1.35;
}

function scoreForm(form, pattern) {
  if (!form.tokens.length || !pattern.tokens.length) return 0;

  // 1. verbatim
  if (form.text === pattern.text) return 1;
  // 2. same words, different spacing ("log out" vs "logout")
  if (form.collapsed === pattern.collapsed) return 0.985;
  // 3. the label appears inside the sentence — scaled by how much of the
  //    sentence it actually is, so stray keywords in conversation score low.
  if (containsSequence(form.tokens, pattern.tokens)) {
    return 0.55 + 0.43 * explanatoryRatio(form, pattern);
  }
  // 4. the user said a fragment of a longer label
  if (containsSequence(pattern.tokens, form.tokens)) {
    return 0.5 + 0.34 * (form.tokens.length / pattern.tokens.length);
  }

  // 5. fuzzy: per-word coverage, damped by the same explanatory ratio, plus a
  //    whole-string similarity safety net for single mis-heard words.
  //
  //    Early exit: even perfect coverage is capped by the explanatory ratio, so
  //    when that ceiling is already hopeless the token loop is skipped. This is
  //    what keeps long utterances cheap against a large registry.
  const ratio = explanatoryRatio(form, pattern);
  const stringScore = 0.94 * similarity(form.collapsed, pattern.collapsed);
  if (0.98 * ratio <= stringScore) return stringScore;

  const coverage = tokenCoverage(form.tokens, pattern.tokens);
  const coverageScore = coverage <= 0 ? 0 : (0.45 + 0.53 * coverage) * ratio;

  return coverageScore > stringScore ? coverageScore : stringScore;
}

/**
 * Best score (0..1) for a phrase against a single pattern string.
 * Exported for tests and for callers that score ad-hoc labels (e.g. DOM text).
 */
export function scorePhrase(phrase, patternSource) {
  const parsed = asParsed(phrase);
  const pattern = compilePattern(patternSource);
  let best = 0;
  for (const form of parsed.forms) {
    const score = scoreForm(form, pattern) * form.weight;
    if (score > best) best = score;
    if (best >= 1) break;
  }
  return best;
}

function classify(score) {
  if (score >= EXACT_SCORE) return "exact";
  if (score >= 0.84) return "phrase";
  return "fuzzy";
}

/* -------------------------------------------------------------------------
 * Public matching API
 * ---------------------------------------------------------------------- */

/**
 * Finds the best command for a spoken phrase.
 *
 * @param {string|object} phrase - transcript, or a `parsePhrase()` result
 * @param {Array<{patterns: string[], label?: string, minScore?: number}>} commands
 * @param {{ minScore?: number }} [options]
 * @returns {{ command: object, score: number, pattern: string, matchType: string } | null}
 */
export function matchCommand(phrase, commands, options = {}) {
  const parsed = asParsed(phrase);
  if (!parsed.forms.length || !Array.isArray(commands) || !commands.length) return null;

  const floor = typeof options.minScore === "number" ? options.minScore : DEFAULT_MIN_SCORE;
  // Below the default threshold we are guessing, so demand a shared word
  // before accepting the guess.
  const requireAnchor = options.requireAnchor ?? floor < DEFAULT_MIN_SCORE;
  let best = null;

  for (const command of commands) {
    if (!command) continue;
    const { compiled } = compileCommand(command);
    const required = typeof command.minScore === "number" ? command.minScore : floor;

    for (const pattern of compiled) {
      let score = 0;
      for (const form of parsed.forms) {
        const value = scoreForm(form, pattern) * form.weight;
        if (value > score) score = value;
        if (score >= 1) break;
      }

      if (score < required) continue;
      if (
        requireAnchor &&
        score < DEFAULT_MIN_SCORE &&
        !parsed.forms.some((form) => hasTokenAnchor(form.tokens, pattern.tokens))
      ) {
        continue;
      }
      if (
        !best ||
        score > best.score + 1e-9 ||
        (Math.abs(score - best.score) < 1e-9 && pattern.tokens.length > best.patternTokens)
      ) {
        best = { command, score, pattern: pattern.source, patternTokens: pattern.tokens.length };
      }
    }
  }

  if (!best) return null;
  return {
    command: best.command,
    score: best.score,
    pattern: best.pattern,
    matchType: classify(best.score),
  };
}

/**
 * Generic "closest label wins" helper: `candidates` is a list of
 * `{ value, patterns }`. Used for DOM targets and for suggestions.
 */
export function findBestMatch(phrase, candidates, options = {}) {
  const parsed = asParsed(phrase);
  if (!parsed.forms.length || !candidates?.length) return null;
  const floor = typeof options.minScore === "number" ? options.minScore : DEFAULT_MIN_SCORE;

  let best = null;
  for (const candidate of candidates) {
    const patterns = candidate.patterns?.length ? candidate.patterns : [candidate.label];
    for (const source of patterns) {
      const pattern = compilePattern(source);
      if (!pattern.tokens.length) continue;
      let score = 0;
      for (const form of parsed.forms) {
        const value = scoreForm(form, pattern) * form.weight;
        if (value > score) score = value;
      }
      if (score < floor) continue;
      if (!best || score > best.score) {
        best = { ...candidate, score, pattern: pattern.source, matchType: classify(score) };
      }
    }
  }
  return best;
}

/**
 * Ranked suggestions for "I didn't catch that" feedback.
 * Never throws, always returns an array (possibly empty).
 */
export function suggestCommands(phrase, commands, limit = 3) {
  const parsed = asParsed(phrase);
  if (!parsed.forms.length || !Array.isArray(commands)) return [];

  const scored = [];
  for (const command of commands) {
    if (!command) continue;
    const { compiled } = compileCommand(command);
    let best = 0;
    let label = command.label || command.patterns?.[0] || "";
    for (const pattern of compiled) {
      let score = 0;
      for (const form of parsed.forms) score = Math.max(score, scoreForm(form, pattern) * form.weight);
      if (score > best) {
        best = score;
        label = command.label || pattern.source;
      }
    }
    if (best > 0.35 && label) scored.push({ label, score: best });
  }

  scored.sort((a, b) => b.score - a.score);
  const seen = new Set();
  const out = [];
  for (const entry of scored) {
    const key = entry.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry.label);
    if (out.length >= limit) break;
  }
  return out;
}

/* -------------------------------------------------------------------------
 * DOM label matching ("click <whatever is on screen>")
 * ---------------------------------------------------------------------- */

const CLICKABLE_SELECTOR = [
  "button",
  "a[href]",
  '[role="button"]',
  '[role="link"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="option"]',
  'input[type="submit"]',
  'input[type="button"]',
  "summary",
  "[data-voice-target]",
  ".quick-card",
  ".admin-stat-card",
  ".admin-action-card",
  ".sidebar-link",
  ".admin-nav-link",
  ".template-action-btn",
].join(",");

const MAX_UI_TARGETS = 220;
const MAX_LABEL_LENGTH = 90;

function isVisible(element) {
  if (!element || element.hidden) return false;
  if (element.getAttribute("aria-hidden") === "true") return false;
  if (element.disabled) return false;
  const rects = typeof element.getClientRects === "function" ? element.getClientRects() : null;
  if (rects && rects.length === 0) return false;
  if (typeof element.getBoundingClientRect === "function") {
    const rect = element.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return false;
  }
  return true;
}

function accessibleLabel(element) {
  const attr = (name) => element.getAttribute?.(name)?.trim();
  const candidates = [
    attr("aria-label"),
    attr("title"),
    element.textContent?.replace(/\s+/g, " ").trim(),
    attr("value"),
    attr("alt"),
    attr("data-voice-target"),
  ];
  for (const candidate of candidates) {
    if (candidate && candidate.length > 1) {
      return candidate.length > MAX_LABEL_LENGTH ? candidate.slice(0, MAX_LABEL_LENGTH) : candidate;
    }
  }
  return "";
}

/**
 * Every clickable, visible, labelled element currently on screen.
 * @param {Document|Element} [root]
 * @returns {Array<{ element: Element, label: string }>}
 */
export function collectUiTargets(root) {
  const scope = root || (typeof document !== "undefined" ? document : null);
  if (!scope || typeof scope.querySelectorAll !== "function") return [];

  let nodes;
  try {
    nodes = scope.querySelectorAll(CLICKABLE_SELECTOR);
  } catch {
    return [];
  }

  const targets = [];
  for (const element of nodes) {
    if (targets.length >= MAX_UI_TARGETS) break;
    if (element.closest?.("[data-voice-ignore]")) continue;
    if (element.getAttribute?.("aria-disabled") === "true") continue;
    if (!isVisible(element)) continue;
    const label = accessibleLabel(element);
    if (!label) continue;
    targets.push({ element, label });
  }
  return targets;
}

/**
 * Finds the on-screen control whose visible label best matches the phrase.
 *
 * @param {string|object} phrase
 * @param {{ root?: Document|Element, minScore?: number }} [options]
 * @returns {{ element: Element, label: string, score: number, matchType: string } | null}
 */
export function matchUiTarget(phrase, options = {}) {
  const parsed = asParsed(phrase);
  if (!parsed.forms.length) return null;

  const targets = collectUiTargets(options.root);
  if (!targets.length) return null;

  const floor = typeof options.minScore === "number" ? options.minScore : DEFAULT_UI_MIN_SCORE;
  let best = null;

  for (const target of targets) {
    const pattern = compilePattern(target.label);
    if (!pattern.tokens.length) continue;
    let score = 0;
    let anchored = false;
    for (const form of parsed.forms) {
      const value = scoreForm(form, pattern) * form.weight;
      if (value > score) score = value;
      if (!anchored && hasTokenAnchor(form.tokens, pattern.tokens)) anchored = true;
    }
    if (score < floor) continue;
    // Clicking is a real action against an arbitrary control, so a shared word
    // is always required — pure string resemblance ("remove it" vs "Review
    // Now") must never press a button.
    if (!anchored) continue;
    // Prefer the tighter label when two elements score the same
    // (e.g. a nav link inside a card wrapper).
    if (
      !best ||
      score > best.score + 1e-9 ||
      (Math.abs(score - best.score) < 1e-9 && target.label.length < best.label.length)
    ) {
      best = { element: target.element, label: target.label, score };
    }
  }

  return best ? { ...best, matchType: classify(best.score) } : null;
}

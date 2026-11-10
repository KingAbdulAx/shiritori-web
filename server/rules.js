// Pure game rules. No I/O, no timers. Used by the server and by local play in the browser.

export const MIN_WORD_LENGTH = 3;
export const HAND_SIZE = 5;

// Hand letters, grouped by how hard they are to play. Difficulty is the smaller of
// "how many words end with it" and "how many words start with it", because a letter
// you finish on becomes the next player's starting letter. j, v, q, x and z are never dealt.
export const EASY = ['s', 'd', 'e', 'g', 'r', 't', 'l', 'n'];
export const MID = ['m', 'c', 'h', 'a', 'k', 'p', 'o'];
export const HARD = ['y', 'w', 'f', 'i', 'b', 'u'];

// Letters a round can open on: plenty of words start with each.
export const START_LETTERS = ['s', 'c', 'p', 'd', 'r', 'b', 'a', 'm', 't', 'f', 'i', 'e', 'h', 'g', 'l', 'u', 'w', 'o', 'n'];

const pick = (list, rng) => list[Math.floor(rng() * list.length)];

function takeUnique(list, count, rng, taken) {
  const pool = list.filter((l) => !taken.includes(l));
  const out = [];
  while (out.length < count && pool.length) {
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return out;
}

/** A balanced hand: 3 easy letters, 1 mid, and 1 wildcard that is mid (60%) or hard (40%). At most one hard letter. */
export function dealHand(rng = Math.random) {
  const hand = takeUnique(EASY, 3, rng, []);
  hand.push(...takeUnique(MID, 1, rng, hand));
  const wildcard = rng() < 0.4 ? HARD : MID;
  hand.push(...takeUnique(wildcard, 1, rng, hand));
  // Shuffle so the hard letter is not always last.
  for (let i = hand.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [hand[i], hand[j]] = [hand[j], hand[i]];
  }
  return hand;
}

/** A penalty letter is never hard, and easy letters are twice as likely. */
export function penaltyLetter(rng = Math.random) {
  return pick([...EASY, ...EASY, ...MID], rng);
}

export function startLetter(rng = Math.random, not = '') {
  const options = START_LETTERS.filter((l) => l !== not);
  return pick(options, rng);
}

export const normalizeWord = (raw) => (typeof raw === 'string' ? raw.trim().toLowerCase() : '');

/**
 * Checks a word against the rules. Returns { ok: true, word, lastChar } or { ok: false, reason }.
 * Reasons: empty, format, short, start, end, used, near (a typo of a playable word), unknown.
 */
export function checkWord({ word, currentLetter, hand, usedWords, dictionary }) {
  const w = normalizeWord(word);
  if (!w) return { ok: false, reason: 'empty' };
  if (w.length > 40 || !/^[a-z]+$/.test(w)) return { ok: false, reason: 'format' };
  if (w.length < MIN_WORD_LENGTH) return { ok: false, reason: 'short' };
  if (w[0] !== currentLetter) return { ok: false, reason: 'start' };
  const lastChar = w[w.length - 1];
  if (!hand.includes(lastChar)) return { ok: false, reason: 'end' };
  if (usedWords.has(w)) return { ok: false, reason: 'used' };
  if (!dictionary.has(w)) {
    const playable = (candidate) =>
      candidate[0] === currentLetter && hand.includes(candidate[candidate.length - 1]) && !usedWords.has(candidate);
    return { ok: false, reason: dictionary.nearMiss(w, playable) ? 'near' : 'unknown' };
  }
  return { ok: true, word: w, lastChar };
}

/** The hand after playing a word that ends in `lastChar`. */
export function removeLetter(hand, lastChar) {
  const i = hand.indexOf(lastChar);
  if (i === -1) return [...hand];
  return [...hand.slice(0, i), ...hand.slice(i + 1)];
}

/** Text shown to the player for a rejected word. */
export function explain(reason, { currentLetter = '' } = {}) {
  const L = currentLetter.toUpperCase();
  switch (reason) {
    case 'empty': return 'Type a word first.';
    case 'format': return 'Use letters only, with no spaces.';
    case 'short': return 'Words need at least 3 letters.';
    case 'start': return `The word has to start with ${L}.`;
    case 'end': return 'The word has to end with one of your letters.';
    case 'used': return 'That word has already been played.';
    case 'near': return 'Close. Check your spelling.';
    case 'unknown': return "That word isn't in the word list.";
    default: return 'That word did not work.';
  }
}

/** Rush mode: how long a player is locked out after a rejected word. */
export const LOCKOUT_MS = {
  empty: 0,
  format: 500,
  short: 500,
  start: 1000,
  end: 1000,
  used: 500,
  near: 500,
  unknown: 2000,
};

/**
 * Rush mode photo finish. Among near-simultaneous valid answers, the player with the most letters
 * left (the one furthest behind) wins; if still tied, whoever arrived first.
 * `candidates` are { pid, at, ... }.
 */
export function pickRaceWinner(candidates, lettersLeft) {
  return [...candidates].sort((a, b) => lettersLeft(b.pid) - lettersLeft(a.pid) || a.at - b.at)[0];
}

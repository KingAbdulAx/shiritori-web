// Word list lookup. Pure: give it the text of words.txt (one word per line).

// True when a and b differ by one insertion, deletion, substitution, or a swap of two neighbouring letters.
export function withinOneEdit(a, b) {
  if (a === b) return false;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;

  if (la === lb) {
    const diffs = [];
    for (let i = 0; i < la; i++) {
      if (a[i] !== b[i]) {
        diffs.push(i);
        if (diffs.length > 2) return false;
      }
    }
    if (diffs.length === 1) return true;
    return diffs.length === 2 && diffs[1] === diffs[0] + 1 && a[diffs[0]] === b[diffs[1]] && a[diffs[1]] === b[diffs[0]];
  }

  const [short, long] = la < lb ? [a, b] : [b, a];
  let i = 0;
  while (i < short.length && short[i] === long[i]) i++;
  return short.slice(i) === long.slice(i + 1);
}

export function createDictionary(text) {
  const words = new Set();
  const buckets = new Map(); // "first letter + length" -> words

  for (const line of text.split('\n')) {
    const w = line.trim();
    if (!w) continue;
    words.add(w);
    const key = w[0] + w.length;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(w);
  }

  return {
    size: words.size,
    has: (word) => words.has(word),

    /** Is there a word one typo away from `word` that `accept` allows? The first letter is assumed correct. */
    nearMiss(word, accept = () => true) {
      for (const len of [word.length - 1, word.length, word.length + 1]) {
        for (const candidate of buckets.get(word[0] + len) || []) {
          if (withinOneEdit(word, candidate) && accept(candidate)) return true;
        }
      }
      return false;
    },
  };
}

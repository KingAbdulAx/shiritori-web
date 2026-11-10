// Builds server/words.txt from SCOWL (via the wordlist-english package).
// American + British spellings, frequency tiers up to 60, plain a-z words of 3+ letters.
// Run with: npm run build:words
import { createRequire } from 'node:module';
import { writeFileSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const lists = require('wordlist-english');
const TIERS = [10, 20, 35, 40, 50, 55, 60];
const DIALECTS = ['english', 'english/american', 'english/british'];

const words = new Set();
for (const dialect of DIALECTS) {
  for (const tier of TIERS) {
    for (const w of lists[`${dialect}/${tier}`] || []) {
      if (/^[a-z]{3,}$/.test(w)) words.add(w);
    }
  }
}

const out = fileURLToPath(new URL('../server/words.txt', import.meta.url));
writeFileSync(out, [...words].sort().join('\n') + '\n');
copyFileSync(
  fileURLToPath(new URL('../node_modules/wordlist-english/Copyright', import.meta.url)),
  fileURLToPath(new URL('../server/WORDS-LICENSE.txt', import.meta.url)),
);
console.log(`Wrote ${words.size} words to server/words.txt`);

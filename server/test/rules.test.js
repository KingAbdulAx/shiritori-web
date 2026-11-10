import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { dealHand, penaltyLetter, startLetter, checkWord, removeLetter, pickRaceWinner, EASY, HARD, START_LETTERS } from '../rules.js';
import { createDictionary, withinOneEdit } from '../dictionary.js';

const real = createDictionary(readFileSync(new URL('../words.txt', import.meta.url), 'utf8'));
const check = (word, extra = {}) =>
  checkWord({ word, currentLetter: 't', hand: ['e', 'd', 's'], usedWords: new Set(), dictionary: real, ...extra });

test('word list has both spellings and no junk', () => {
  for (const w of ['colour', 'color', 'grey', 'gray', 'tyre', 'tire', 'house']) assert.ok(real.has(w), w);
  assert.ok(!real.has('blorptz'));
  assert.ok(real.size > 60000);
  const text = readFileSync(new URL('../words.txt', import.meta.url), 'utf8').trim().split('\n');
  assert.ok(text.every((w) => /^[a-z]{3,}$/.test(w)));
});

test('dealt hands are balanced', () => {
  for (let i = 0; i < 3000; i++) {
    const hand = dealHand();
    assert.equal(hand.length, 5);
    assert.equal(new Set(hand).size, 5, 'letters are distinct');
    assert.ok(!hand.includes('j') && !hand.includes('v'));
    assert.ok(hand.filter((l) => HARD.includes(l)).length <= 1, 'at most one hard letter');
    assert.ok(hand.filter((l) => EASY.includes(l)).length >= 3, 'at least three easy letters');
  }
});

test('penalty letters are never hard', () => {
  for (let i = 0; i < 2000; i++) assert.ok(!HARD.includes(penaltyLetter()));
});

test('start letters come from the safe pool and avoid the excluded letter', () => {
  for (let i = 0; i < 500; i++) {
    const l = startLetter(Math.random, 's');
    assert.ok(START_LETTERS.includes(l) && l !== 's');
  }
});

test('checkWord reports each rule in order', () => {
  assert.equal(check('').reason, 'empty');
  assert.equal(check('ti de').reason, 'format');
  assert.equal(check('te').reason, 'short');
  assert.equal(check('slide').reason, 'start');
  assert.equal(check('tile').ok, true);
  assert.equal(check('tiger').reason, 'end');
  assert.equal(check('tide', { usedWords: new Set(['tide']) }).reason, 'used');
  assert.equal(check('tixxxs').reason, 'unknown');
  const ok = check('  TIDE ');
  assert.deepEqual([ok.ok, ok.word, ok.lastChar], [true, 'tide', 'e']);
});

test('typos of a playable word are near misses; nonsense is not', () => {
  assert.equal(check('tidde').reason, 'near'); // extra letter
  assert.equal(check('tide'.replace('i', 'o')).reason, 'near'); // tode -> tide/tone? substitution
  assert.equal(checkWord({ word: 'freind', currentLetter: 'f', hand: ['d'], usedWords: new Set(), dictionary: real }).reason, 'near'); // swap
  assert.equal(check('tqzxqs').reason, 'unknown');
});

test('withinOneEdit', () => {
  assert.ok(withinOneEdit('friend', 'freind'));
  assert.ok(withinOneEdit('cat', 'cart'));
  assert.ok(withinOneEdit('cart', 'cat'));
  assert.ok(withinOneEdit('cat', 'cut'));
  assert.ok(!withinOneEdit('cat', 'cat'));
  assert.ok(!withinOneEdit('cat', 'dog'));
  assert.ok(!withinOneEdit('cat', 'carts'));
});

test('removeLetter removes a single copy', () => {
  assert.deepEqual(removeLetter(['a', 'b', 'a'], 'a'), ['b', 'a']);
  assert.deepEqual(removeLetter(['a'], 'z'), ['a']);
});

test('photo finish: most letters left wins, then earliest', () => {
  const left = { a: 5, b: 3, c: 5 };
  const lettersLeft = (pid) => left[pid];
  assert.equal(pickRaceWinner([{ pid: 'b', at: 1 }, { pid: 'a', at: 100 }], lettersLeft).pid, 'a');
  assert.equal(pickRaceWinner([{ pid: 'c', at: 50 }, { pid: 'a', at: 20 }], lettersLeft).pid, 'a');
});

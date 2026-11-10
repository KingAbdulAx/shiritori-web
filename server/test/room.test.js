import test from 'node:test';
import assert from 'node:assert/strict';

import { Room } from '../room.js';
import { createDictionary } from '../dictionary.js';

const dictionary = createDictionary(
  ['tide', 'tread', 'tags', 'tent', 'date', 'dart', 'rate', 'sand', 'dust', 'ends', 'late', 'tease', 'dread', 'seed'].join('\n'),
);

class FakeClock {
  constructor() { this.t = 1_000_000; this.timers = []; this.n = 0; }
  now() { return this.t; }
  setTimeout(fn, ms) { const id = ++this.n; this.timers.push({ id, at: this.t + ms, fn, every: 0 }); return id; }
  setInterval(fn, ms) { const id = ++this.n; this.timers.push({ id, at: this.t + ms, fn, every: ms }); return id; }
  clearTimeout(id) { this.timers = this.timers.filter((x) => x.id !== id); }
  clearInterval(id) { this.clearTimeout(id); }
  advance(ms) {
    const end = this.t + ms;
    for (;;) {
      const due = this.timers.filter((x) => x.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      this.t = due.at;
      if (due.every) due.at += due.every; else this.clearTimeout(due.id);
      due.fn();
    }
    this.t = end;
  }
}

function setup({ mode = 'chill', players = ['Ada', 'Ben'], ...opts } = {}) {
  const clock = new FakeClock();
  const notices = [];
  const room = new Room({ code: 'TEST', dictionary, clock, onNotify: (pid, n) => notices.push({ pid, ...n }), ...opts });
  const ids = players.map((n) => room.addPlayer(n).player.id);
  room.setMode(ids[0], mode);
  assert.ok(room.start(ids[0]).ok);
  return { room, clock, ids, notices, [players[0].toLowerCase()]: ids[0] };
}

// White-box helpers: pin the letter and the hands so tests do not depend on dealing.
const pin = (room, letter, hands) => {
  room.currentLetter = letter;
  hands.forEach((h, i) => { room.players[i].letters = [...h]; });
};

// ── Chill ──────────────────────────────────────────────────

test('chill: start deals 5 letters, host goes first', () => {
  const { room, ids } = setup();
  assert.equal(room.phase, 'turn');
  assert.equal(room.activePid, ids[0]);
  assert.ok(room.players.every((p) => p.letters.length === 5));
  assert.equal(room.state().activePlayerIdx, 0);
});

test('chill: a valid word removes the letter, sets the next letter and passes the turn', () => {
  const { room, ids } = setup();
  pin(room, 't', [['e', 'd', 's', 'r', 'n'], ['a', 'b', 'c', 'd', 'e']]);
  const seq = room.seq;
  assert.ok(room.submit(ids[0], 'tide').ok);
  assert.deepEqual(room.players[0].letters, ['d', 's', 'r', 'n']);
  assert.equal(room.currentLetter, 'e');
  assert.equal(room.seq, seq + 1);
  assert.equal(room.activePid, ids[1]);
  assert.ok(room.usedWords.has('tide'));
});

test('chill: only the active player can submit', () => {
  const { room, ids } = setup();
  pin(room, 't', [['e'], ['d']]);
  assert.equal(room.submit(ids[1], 'tread').ok, false);
});

test('chill: rule slips and near misses cost nothing and keep the clock running', () => {
  const { room, ids, clock } = setup();
  pin(room, 't', [['e', 'd', 's', 'r', 'n'], ['a']]);
  clock.advance(10_000);
  const wrongEnd = room.submit(ids[0], 'tent');
  assert.deepEqual([wrongEnd.ok, wrongEnd.reason], [false, 'end']);
  const near = room.submit(ids[0], 'tidd');
  assert.deepEqual([near.ok, near.reason], [false, 'near']);
  assert.equal(room.players[0].letters.length, 5);
  assert.equal(room.activePid, ids[0]);
  assert.equal(room.state().timeLeft, 20, 'the clock was not reset');
});

test('chill: an unknown word costs a penalty letter and the turn', () => {
  const { room, ids } = setup();
  pin(room, 't', [['e', 'd', 's', 'r', 'n'], ['a']]);
  const res = room.submit(ids[0], 'txxe');
  assert.deepEqual([res.ok, res.reason, res.penalty], [false, 'unknown', true]);
  assert.equal(room.players[0].letters.length, 6);
  assert.equal(room.activePid, ids[1]);
});

test('chill: running out of time costs a penalty letter and passes the turn', () => {
  const { room, ids, clock } = setup();
  clock.advance(29_000);
  assert.equal(room.activePid, ids[0]);
  clock.advance(1_000);
  assert.equal(room.players[0].letters.length, 6);
  assert.equal(room.activePid, ids[1]);
  assert.equal(room.state().timeLeft, 30);
});

test('chill: clearing a hand wins the round; first player rotates; last round ends the game', () => {
  const { room, ids } = setup();
  pin(room, 't', [['e'], ['a', 'b', 'c', 'd', 'e']]);
  assert.ok(room.submit(ids[0], 'tide').ok);
  assert.equal(room.phase, 'roundEnd');
  assert.equal(room.players[0].score, 1);

  assert.equal(room.nextRound(ids[1]).ok, false, 'host only');
  assert.ok(room.nextRound(ids[0]).ok);
  assert.equal(room.round, 2);
  assert.equal(room.activePid, ids[1], 'round 2 starts with the second player');

  room.round = 3;
  pin(room, 't', [['a', 'b', 'c', 'd', 'e'], ['e']]);
  assert.ok(room.submit(ids[1], 'tide').ok);
  assert.equal(room.phase, 'gameOver');
});

test('host-only actions', () => {
  const { room, ids } = setup();
  assert.equal(room.endGame(ids[1]).ok, false);
  assert.equal(room.reset(ids[1]).ok, false);
  assert.ok(room.endGame(ids[0]).ok);
  assert.equal(room.phase, 'gameOver');
  assert.ok(room.reset(ids[0]).ok);
  assert.equal(room.phase, 'lobby');
});

test('mode can only be set by the host in the lobby', () => {
  const clock = new FakeClock();
  const room = new Room({ dictionary, clock });
  const a = room.addPlayer('Ada').player.id;
  const b = room.addPlayer('Ben').player.id;
  assert.equal(room.setMode(b, 'rush').ok, false);
  assert.equal(room.setMode(a, 'bogus').ok, false);
  assert.ok(room.setMode(a, 'rush').ok);
  room.start(a);
  assert.equal(room.setMode(a, 'chill').ok, false);
});

test('lobby rules: unique names, max players, no joining mid-game', () => {
  const room = new Room({ dictionary, clock: new FakeClock() });
  assert.ok(room.addPlayer('Ada').ok);
  assert.equal(room.addPlayer('ada').ok, false);
  assert.equal(room.addPlayer('   ').ok, false);
  for (let i = 0; i < 7; i++) assert.ok(room.addPlayer(`P${i}`).ok);
  assert.equal(room.addPlayer('Nine').ok, false);
  room.start(room.hostId);
  assert.equal(room.addPlayer('Late').ok, false);
});

// ── Connection drops ───────────────────────────────────────

test('a dropped player keeps their seat, is skipped, and can rejoin with their token', () => {
  const { room, ids, clock } = setup({ players: ['Ada', 'Ben', 'Cy'] });
  pin(room, 't', [['e', 'd', 's', 'r', 'n'], ['a'], ['b']]);
  const ben = room.players[1];
  room.markDisconnected(ben.id);
  assert.ok(room.submit(ids[0], 'tide').ok);
  assert.equal(room.activePid, room.players[2].id, 'Ben is skipped while away');

  clock.advance(30_000);
  assert.equal(room.players.length, 3, 'still seated inside the grace period');
  assert.ok(room.reconnect(ben.token).ok);
  assert.equal(ben.connected, true);

  room.markDisconnected(ben.id);
  clock.advance(60_000);
  assert.equal(room.players.length, 2, 'removed after the grace period');
  assert.equal(room.reconnect(ben.token).ok, false);
});

test('host passes to another player when the host is removed; empty room reports empty', () => {
  let emptied = false;
  const room = new Room({ dictionary, clock: new FakeClock(), onEmpty: () => { emptied = true; } });
  const a = room.addPlayer('Ada').player.id;
  const b = room.addPlayer('Ben').player.id;
  room.removePlayer(a);
  assert.equal(room.hostId, b);
  room.removePlayer(b);
  assert.ok(emptied);
});

test('game ends when too few players remain', () => {
  const { room, ids } = setup();
  room.removePlayer(ids[1]);
  assert.equal(room.phase, 'gameOver');
});

// ── Rush ───────────────────────────────────────────────────

test('rush: a valid word is accepted after the photo-finish window', () => {
  const { room, ids, clock } = setup({ mode: 'rush' });
  assert.equal(room.phase, 'race');
  pin(room, 't', [['e', 'd', 's', 'r', 'n'], ['a', 'b', 'c', 'd', 'e']]);
  const res = room.submit(ids[0], 'tide', room.seq);
  assert.deepEqual([res.ok, res.pending], [true, true]);
  assert.equal(room.currentLetter, 't', 'not applied yet');
  clock.advance(250);
  assert.equal(room.currentLetter, 'e');
  assert.equal(room.players[0].letters.length, 4);
});

test('rush: photo finish goes to the player furthest behind, and the loser is told without penalty', () => {
  const { room, ids, clock, notices } = setup({ mode: 'rush' });
  pin(room, 't', [['e', 'd', 's'], ['e', 'd', 's', 'r', 'n']]);
  room.submit(ids[0], 'tide', room.seq); // first, but only 3 letters left
  clock.advance(100);
  room.submit(ids[1], 'tide', room.seq); // 100ms later, 5 letters left
  clock.advance(150);
  assert.equal(room.players[1].letters.length, 4, 'Ben (5 letters) takes it');
  assert.equal(room.players[0].letters.length, 3, 'Ada keeps her hand: no penalty');
  assert.equal(notices.length, 1);
  assert.equal(notices[0].pid, ids[0]);
  assert.equal(notices[0].type, 'slow');
  assert.equal(room.players[0].lockedUntil, 0);
});

test('rush: equal letters, the earlier answer wins', () => {
  const { room, ids, clock } = setup({ mode: 'rush' });
  pin(room, 't', [['e', 'd', 's'], ['e', 'd', 's']]);
  room.submit(ids[1], 'tide', room.seq);
  clock.advance(50);
  room.submit(ids[0], 'tide', room.seq);
  clock.advance(250);
  assert.equal(room.players[1].letters.length, 2);
  assert.equal(room.players[0].letters.length, 3);
});

test('rush: a rejected word locks the player out, longer for words not in the list', () => {
  const { room, ids, clock } = setup({ mode: 'rush' });
  pin(room, 't', [['e', 'd', 's', 'r', 'n'], ['e']]);
  const bad = room.submit(ids[0], 'txxe', room.seq);
  assert.deepEqual([bad.ok, bad.reason, bad.lockMs], [false, 'unknown', 2000]);
  const locked = room.submit(ids[0], 'tide', room.seq);
  assert.equal(locked.reason, 'locked');
  assert.ok(locked.lockMs > 0);
  clock.advance(2001);
  assert.ok(room.submit(ids[0], 'tide', room.seq).ok);

  const near = room.submit(ids[1], 'tidee', room.seq);
  assert.deepEqual([near.reason, near.lockMs], ['near', 500]);
});

test('rush: an answer for an old letter is ignored without a lockout', () => {
  const { room, ids, clock } = setup({ mode: 'rush' });
  pin(room, 't', [['e', 'd', 's', 'r', 'n'], ['d', 'a']]);
  const staleSeq = room.seq;
  room.submit(ids[0], 'tide', staleSeq);
  clock.advance(250);
  const late = room.submit(ids[1], 'tread', staleSeq);
  assert.deepEqual([late.ok, late.reason], [false, 'stale']);
  assert.equal(room.players[1].lockedUntil, 0);
});

test('rush: with no word for 20 seconds the starting letter changes', () => {
  const { room, clock } = setup({ mode: 'rush' });
  const letter = room.currentLetter;
  const seq = room.seq;
  clock.advance(19_000);
  assert.equal(room.currentLetter, letter);
  clock.advance(1_000);
  assert.notEqual(room.currentLetter, letter);
  assert.equal(room.seq, seq + 1);
});

test('rush: emptying your hand wins the round', () => {
  const { room, ids, clock } = setup({ mode: 'rush' });
  pin(room, 't', [['e'], ['a', 'b', 'c', 'd', 'e']]);
  room.submit(ids[0], 'tide', room.seq);
  clock.advance(250);
  assert.equal(room.phase, 'roundEnd');
  assert.equal(room.players[0].score, 1);
});

test('rush: answers are dropped if the player left during the window', () => {
  const { room, ids, clock } = setup({ mode: 'rush', players: ['Ada', 'Ben', 'Cy'] });
  pin(room, 't', [['e'], ['a'], ['b']]);
  room.submit(ids[1], 'tide', room.seq);
  room.removePlayer(ids[1]);
  clock.advance(250);
  assert.equal(room.currentLetter, 't');
});

// ── Local pass-and-play ────────────────────────────────────

test('handoff: each turn waits for the next player to start', () => {
  const { room, ids } = setup({ handoff: true, minPlayers: 1 });
  assert.equal(room.phase, 'handoff');
  assert.equal(room.activePid, ids[0]);
  assert.ok(room.beginTurn().ok);
  assert.equal(room.phase, 'turn');
  pin(room, 't', [['e', 'd', 's', 'r', 'n'], ['a']]);
  room.submit(ids[0], 'tide');
  assert.equal(room.phase, 'handoff');
  assert.equal(room.activePid, ids[1]);
});

test('solo local play skips the handoff', () => {
  const { room } = setup({ handoff: true, minPlayers: 1, players: ['Ada'] });
  assert.equal(room.phase, 'turn');
});

// One game room: players, rounds, turns (Chill) or the race (Rush). No sockets in here.
// The server wires it to Socket.IO; the browser runs the same class for pass-and-play.

import {
  dealHand,
  penaltyLetter,
  startLetter,
  checkWord,
  removeLetter,
  explain,
  LOCKOUT_MS,
  pickRaceWinner,
} from './rules.js';

export const MODES = ['chill', 'rush'];
export const MAX_PLAYERS = 8;
export const MAX_ROUNDS = 3;

const DEFAULT_TIMING = {
  turn: 30000, // Chill: time for one turn
  stall: 20000, // Rush: with no word for this long, the starting letter changes
  photoFinish: 250, // Rush: answers this close together count as simultaneous
  grace: 60000, // how long a dropped player keeps their seat
};

const noop = () => {};

const realClock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (id) => clearInterval(id),
};

const makeId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

export function cleanName(name) {
  if (typeof name !== 'string') return '';
  return name.replace(/\s+/g, ' ').trim().slice(0, 20);
}

export class Room {
  constructor(opts = {}) {
    this.code = opts.code || 'LOCAL';
    this.dictionary = opts.dictionary;
    this.rng = opts.rng || Math.random;
    this.clock = opts.clock || realClock;
    this.timing = { ...DEFAULT_TIMING, ...opts.timing };
    this.handoff = !!opts.handoff; // pass-and-play: wait for "start turn" between players
    this.minPlayers = opts.minPlayers ?? 2;
    this.maxRounds = opts.maxRounds ?? MAX_ROUNDS;
    this.fetchDefinition = opts.fetchDefinition || (async () => null);
    this.hooks = {
      change: opts.onChange || noop,
      tick: opts.onTick || noop,
      notify: opts.onNotify || noop,
      empty: opts.onEmpty || noop,
    };

    this.players = [];
    this.hostId = null;
    this.mode = 'chill';
    this.phase = 'lobby'; // lobby | handoff | turn | race | roundEnd | gameOver
    this.round = 1;
    this.seq = 0; // bumps every time the starting letter changes
    this.currentLetter = '';
    this.activePid = null;
    this.usedWords = new Set();
    this.wordDefinition = null;
    this.messages = [];
    this.turnDeadline = 0;
    this.stallDeadline = 0;
    this.pending = []; // Rush: valid answers inside the photo-finish window
    this.pendingTimer = null;
    this.ticker = null;
    this.destroyed = false;
    this._msgId = 1;
  }

  // ── Players ────────────────────────────────────────────────

  addPlayer(name) {
    if (this.phase !== 'lobby') return { ok: false, error: 'Game already in progress' };
    if (this.players.length >= MAX_PLAYERS) return { ok: false, error: `Room is full (max ${MAX_PLAYERS} players)` };
    const clean = cleanName(name);
    if (!clean) return { ok: false, error: 'Name is required' };
    if (this.players.some((p) => p.name.toLowerCase() === clean.toLowerCase())) {
      return { ok: false, error: 'Name already taken in this room' };
    }

    const player = {
      id: makeId(),
      token: makeId(),
      name: clean,
      letters: [],
      score: 0,
      connected: true,
      lockedUntil: 0,
      graceTimer: null,
      socketId: null,
    };
    this.players.push(player);
    const first = !this.hostId;
    if (first) this.hostId = player.id;
    this._log(first ? `${clean} created the room.` : `${clean} joined the room.`, 'success');
    this._changed();
    return { ok: true, player };
  }

  removePlayer(pid) {
    const idx = this.players.findIndex((p) => p.id === pid);
    if (idx === -1) return { ok: false, error: 'Player not found' };
    const [gone] = this.players.splice(idx, 1);
    this.clock.clearTimeout(gone.graceTimer);
    this._log(`${gone.name} left the game.`, 'warning');

    if (this.players.length === 0) {
      this.destroy();
      this.hooks.empty(this);
      return { ok: true };
    }

    if (this.hostId === pid) {
      const next = this.players.find((p) => p.connected) || this.players[0];
      this.hostId = next.id;
      this._log(`${next.name} is now the host.`, 'system');
    }

    const inGame = this.phase !== 'lobby' && this.phase !== 'gameOver';
    if (inGame && this.players.length < this.minPlayers) {
      this._finish('Not enough players left. Game over.');
    } else if ((this.phase === 'turn' || this.phase === 'handoff') && this.activePid === pid) {
      this._enterTurn(idx % this.players.length);
    } else {
      this._changed();
    }
    return { ok: true };
  }

  /** The player's connection dropped. They keep their seat for the grace period. */
  markDisconnected(pid) {
    const p = this._player(pid);
    if (!p || !p.connected) return;
    p.connected = false;
    this._log(`${p.name} lost connection.`, 'warning');
    this.clock.clearTimeout(p.graceTimer);
    p.graceTimer = this.clock.setTimeout(() => this.removePlayer(pid), this.timing.grace);
    this._changed();
  }

  /** A returning player presents their token. */
  reconnect(token) {
    const p = this.players.find((x) => x.token === token);
    if (!p) return { ok: false, error: 'Session expired' };
    this.clock.clearTimeout(p.graceTimer);
    p.graceTimer = null;
    if (!p.connected) {
      p.connected = true;
      this._log(`${p.name} is back.`, 'success');
    }
    this._changed();
    return { ok: true, player: p };
  }

  // ── Host actions ───────────────────────────────────────────

  setMode(pid, mode) {
    if (pid !== this.hostId) return { ok: false, error: 'Only the host can change the mode' };
    if (this.phase !== 'lobby') return { ok: false, error: 'The mode can only change in the lobby' };
    if (!MODES.includes(mode)) return { ok: false, error: 'Unknown mode' };
    this.mode = mode;
    this._changed();
    return { ok: true };
  }

  start(pid) {
    if (pid !== this.hostId) return { ok: false, error: 'Only the host can start' };
    if (this.phase !== 'lobby') return { ok: false, error: 'Game already started' };
    if (this.players.length < this.minPlayers) {
      return { ok: false, error: `Need at least ${this.minPlayers} player${this.minPlayers > 1 ? 's' : ''} to start.` };
    }
    this.round = 1;
    for (const p of this.players) p.score = 0;
    this._log('Game started.', 'system');
    this._dealRound();
    return { ok: true };
  }

  nextRound(pid) {
    if (pid !== this.hostId) return { ok: false, error: 'Only the host can advance rounds' };
    if (this.phase !== 'roundEnd') return { ok: false, error: 'Not in round end phase' };
    this.round += 1;
    this._dealRound();
    return { ok: true };
  }

  endGame(pid) {
    if (pid !== this.hostId) return { ok: false, error: 'Only the host can end the game' };
    if (this.phase === 'lobby' || this.phase === 'gameOver') return { ok: false, error: 'No game in progress' };
    this._finish('Game ended. Check the final scores.');
    return { ok: true };
  }

  reset(pid) {
    if (pid !== this.hostId) return { ok: false, error: 'Only the host can reset' };
    this._stopClocks();
    this.phase = 'lobby';
    this.round = 1;
    this.seq = 0;
    this.currentLetter = '';
    this.activePid = null;
    this.usedWords = new Set();
    this.wordDefinition = null;
    this.messages = [];
    for (const p of this.players) {
      p.letters = [];
      p.score = 0;
      p.lockedUntil = 0;
    }
    this._log('Back in the lobby. Waiting for the host to start.', 'system');
    this._changed();
    return { ok: true };
  }

  /** Pass-and-play: the next player is ready, start their clock. */
  beginTurn() {
    if (this.phase !== 'handoff') return { ok: false, error: 'Not waiting for a turn' };
    this._beginTurn();
    return { ok: true };
  }

  // ── Words ──────────────────────────────────────────────────

  /**
   * Returns { ok: true } or { ok: false, reason, message, lockMs?, penalty? }.
   * `seq` is the starting-letter version the player saw (Rush only); a stale one is ignored without penalty.
   */
  submit(pid, rawWord, seq) {
    const player = this._player(pid);
    if (!player) return { ok: false, reason: 'state', message: 'Player not found.' };
    if (this.phase === 'turn') return this._submitChill(player, rawWord);
    if (this.phase === 'race') return this._submitRush(player, rawWord, seq);
    return { ok: false, reason: 'state', message: 'No round is being played.' };
  }

  _check(player, rawWord) {
    return checkWord({
      word: rawWord,
      currentLetter: this.currentLetter,
      hand: player.letters,
      usedWords: this.usedWords,
      dictionary: this.dictionary,
    });
  }

  _submitChill(player, rawWord) {
    if (player.id !== this.activePid) return { ok: false, reason: 'state', message: "It isn't your turn." };
    const res = this._check(player, rawWord);

    if (res.ok) {
      this._accept(player, res);
      return { ok: true };
    }

    if (res.reason === 'unknown') {
      const letter = penaltyLetter(this.rng);
      player.letters.push(letter);
      const message = `${explain('unknown')} Penalty letter: ${letter.toUpperCase()}.`;
      this._log(`${player.name} played a word that isn't in the list. Penalty letter: ${letter.toUpperCase()}.`, 'error');
      this._enterTurn(this._nextIdx(this._indexOf(player.id)));
      return { ok: false, reason: 'unknown', penalty: true, message };
    }

    // Rule slips and near misses cost nothing; the clock keeps running.
    return { ok: false, reason: res.reason, message: explain(res.reason, this) };
  }

  _submitRush(player, rawWord, seq) {
    const now = this.clock.now();
    if (player.lockedUntil > now) {
      return { ok: false, reason: 'locked', lockMs: player.lockedUntil - now, message: 'Locked out for a moment.' };
    }
    if (seq !== undefined && seq !== this.seq) {
      return { ok: false, reason: 'stale', message: 'The letter changed. Try the new one.' };
    }

    const res = this._check(player, rawWord);
    if (!res.ok) {
      const lockMs = LOCKOUT_MS[res.reason] ?? 1000;
      if (lockMs) player.lockedUntil = now + lockMs;
      return { ok: false, reason: res.reason, lockMs, message: explain(res.reason, this) };
    }

    if (!this.pending.some((c) => c.pid === player.id)) {
      this.pending.push({ pid: player.id, word: res.word, last: res.lastChar, at: now });
    }
    if (!this.pendingTimer) {
      this.pendingTimer = this.clock.setTimeout(() => this._resolveRace(), this.timing.photoFinish);
    }
    return { ok: true, pending: true };
  }

  _resolveRace() {
    this.pendingTimer = null;
    const candidates = this.pending;
    this.pending = [];
    if (this.phase !== 'race' || candidates.length === 0) return;

    // Drop anyone who left, and answers for a letter that has since changed.
    const live = candidates.filter((c) => this._player(c.pid) && c.word[0] === this.currentLetter);
    if (live.length === 0) return;
    const winner = pickRaceWinner(live, (pid) => this._player(pid).letters.length);
    const winnerPlayer = this._player(winner.pid);

    for (const c of live) {
      if (c.pid !== winner.pid) {
        this.hooks.notify(c.pid, { type: 'slow', message: `${winnerPlayer.name} got there first.` });
      }
    }
    if (live.length > 1) this._log(`Photo finish. ${winnerPlayer.name} takes it.`, 'warning');
    this._accept(winnerPlayer, { word: winner.word, lastChar: winner.last });
  }

  _accept(player, res) {
    player.letters = removeLetter(player.letters, res.lastChar);
    this.usedWords.add(res.word);
    this.currentLetter = res.lastChar;
    this.seq += 1;
    this.wordDefinition = { word: res.word, definition: null, partOfSpeech: null };
    this._log(`${player.name} played ${res.word.toUpperCase()}. Next letter: ${res.lastChar.toUpperCase()}.`, 'success');
    this._lookupDefinition(res.word);

    if (player.letters.length === 0) {
      this._roundWon(player);
      return;
    }
    if (this.mode === 'rush') {
      this.stallDeadline = this.clock.now() + this.timing.stall;
      this._changed();
    } else {
      this._enterTurn(this._nextIdx(this._indexOf(player.id)));
    }
  }

  _roundWon(player) {
    player.score += 1;
    this._log(`${player.name} cleared their hand and wins round ${this.round}.`, 'system');
    if (this.round >= this.maxRounds) {
      this._finish('Game over. Check the final scores.');
    } else {
      this._stopClocks();
      this.phase = 'roundEnd';
      this.activePid = null;
      this._changed();
    }
  }

  _lookupDefinition(word) {
    Promise.resolve(this.fetchDefinition(word))
      .then((def) => {
        if (!this.destroyed && def && this.wordDefinition?.word === word) {
          this.wordDefinition = def;
          this._changed();
        }
      })
      .catch(noop);
  }

  // ── Flow ───────────────────────────────────────────────────

  _dealRound() {
    this._stopClocks();
    this.usedWords = new Set();
    this.wordDefinition = null;
    this.currentLetter = startLetter(this.rng);
    this.seq += 1;
    for (const p of this.players) {
      p.letters = dealHand(this.rng);
      p.lockedUntil = 0;
    }
    this._log(`Round ${this.round} of ${this.maxRounds}. Starting letter: ${this.currentLetter.toUpperCase()}.`, 'system');

    if (this.mode === 'rush') {
      this.phase = 'race';
      this.activePid = null;
      this.stallDeadline = this.clock.now() + this.timing.stall;
      this._startTicker();
      this._changed();
    } else {
      // The player who goes first rotates each round.
      const first = (this.round - 1) % this.players.length;
      this._enterTurn(this.players[first].connected ? first : this._nextIdx(first));
    }
  }

  _enterTurn(idx) {
    const player = this.players[idx];
    this._stopTicker();
    this.activePid = player.id;
    if (this.handoff && this.players.length > 1) {
      this.phase = 'handoff';
      this._changed();
    } else {
      this._beginTurn();
    }
  }

  _beginTurn() {
    const player = this._player(this.activePid);
    this.phase = 'turn';
    this.turnDeadline = this.clock.now() + this.timing.turn;
    this._log(`${player.name}'s turn.`, 'turn');
    this._startTicker();
    this._changed();
  }

  _nextIdx(fromIdx) {
    const n = this.players.length;
    for (let i = 1; i <= n; i++) {
      const idx = (fromIdx + i) % n;
      if (this.players[idx].connected) return idx;
    }
    return (fromIdx + 1) % n;
  }

  _finish(text) {
    this._stopClocks();
    this.phase = 'gameOver';
    this.activePid = null;
    this._log(text, 'system');
    this._changed();
  }

  // ── Clocks ─────────────────────────────────────────────────

  _startTicker() {
    this._stopTicker();
    this.ticker = this.clock.setInterval(() => this._tick(), 1000);
  }

  _stopTicker() {
    if (this.ticker) this.clock.clearInterval(this.ticker);
    this.ticker = null;
  }

  _stopClocks() {
    this._stopTicker();
    if (this.pendingTimer) this.clock.clearTimeout(this.pendingTimer);
    this.pendingTimer = null;
    this.pending = [];
  }

  _tick() {
    const left = this._timeLeft();
    if (left > 0) {
      this.hooks.tick(left);
      return;
    }
    if (this.phase === 'turn') {
      const player = this._player(this.activePid);
      if (!player) return;
      const letter = penaltyLetter(this.rng);
      player.letters.push(letter);
      this._log(`Time's up. ${player.name} gets a penalty letter: ${letter.toUpperCase()}.`, 'warning');
      this._enterTurn(this._nextIdx(this._indexOf(player.id)));
    } else if (this.phase === 'race') {
      this.currentLetter = startLetter(this.rng, this.currentLetter);
      this.seq += 1;
      this.stallDeadline = this.clock.now() + this.timing.stall;
      this._log(`Nobody found a word. New starting letter: ${this.currentLetter.toUpperCase()}.`, 'warning');
      this._changed();
    }
  }

  _timeLeft() {
    const now = this.clock.now();
    if (this.phase === 'turn') return Math.max(0, Math.ceil((this.turnDeadline - now) / 1000));
    if (this.phase === 'race') return Math.max(0, Math.ceil((this.stallDeadline - now) / 1000));
    return Math.round(this.timing[this.mode === 'rush' ? 'stall' : 'turn'] / 1000);
  }

  // ── Plumbing ───────────────────────────────────────────────

  _player(pid) {
    return this.players.find((p) => p.id === pid);
  }

  _indexOf(pid) {
    return this.players.findIndex((p) => p.id === pid);
  }

  _log(text, type = 'info') {
    this.messages.push({ id: this._msgId++, text, type, time: new Date(this.clock.now()).toISOString() });
    if (this.messages.length > 100) this.messages.splice(0, this.messages.length - 100);
  }

  _changed() {
    if (!this.destroyed) this.hooks.change(this);
  }

  /** What every client is allowed to see. Tokens and socket ids stay on the server. */
  state() {
    const active = this.activePid ? this._indexOf(this.activePid) : -1;
    return {
      code: this.code,
      hostId: this.hostId,
      mode: this.mode,
      phase: this.phase,
      seq: this.seq,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        letters: [...p.letters],
        score: p.score,
        connected: p.connected,
      })),
      currentLetter: this.currentLetter,
      activePlayerIdx: active >= 0 ? active : null,
      round: this.round,
      maxRounds: this.maxRounds,
      messages: this.messages.slice(-50),
      usedWords: [...this.usedWords],
      wordDefinition: this.wordDefinition,
      turnTimeLimit: Math.round(this.timing[this.mode === 'rush' ? 'stall' : 'turn'] / 1000),
      timeLeft: this._timeLeft(),
    };
  }

  destroy() {
    this.destroyed = true;
    this._stopClocks();
    for (const p of this.players) this.clock.clearTimeout(p.graceTimer);
  }
}

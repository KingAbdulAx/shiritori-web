import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

// ── Constants ────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
const ALPHABET = 'abcdefghijklmnoprstuvwy';
const INITIAL_LETTERS_COUNT = 5;
const TURN_TIME_LIMIT = 30; // seconds
const MAX_ROUNDS = 3;

// ── Helpers ──────────────────────────────────────────────────
function randomLetters(count = INITIAL_LETTERS_COUNT) {
  const pool = ALPHABET.split('');
  const result = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool.splice(idx, 1)[0]);
  }
  return result;
}

function randomLetter() {
  return ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function validateWord(word) {
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0) {
        const meaning = data[0]?.meanings?.[0];
        const def = meaning?.definitions?.[0]?.definition || null;
        const partOfSpeech = meaning?.partOfSpeech || null;
        return { valid: true, definition: def, partOfSpeech };
      }
    }
    return { valid: false };
  } catch {
    return { valid: false };
  }
}

// ── Room Storage ─────────────────────────────────────────────
const rooms = new Map();

function createRoom(hostId, hostName) {
  let code;
  do {
    code = generateRoomCode();
  } while (rooms.has(code));

  const room = {
    code,
    hostId,
    players: [{ id: hostId, name: hostName, letters: [], score: 0 }],
    phase: 'lobby', // lobby | playing | turn | roundEnd | gameOver
    currentLetter: '',
    activePlayerIdx: null,
    round: 1,
    maxRounds: MAX_ROUNDS,
    usedWords: new Set(),
    messages: [],
    turnTimer: null,
    turnStartTime: null,
    wordDefinition: null,
  };
  rooms.set(code, room);
  return room;
}

function log(room, text, type = 'info') {
  const msg = { id: Date.now() + Math.random(), text, type, time: new Date().toISOString() };
  room.messages.push(msg);
  return msg;
}

function getPublicState(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      letterCount: p.letters.length,
      // Only show letters to the player themselves, or to everyone if local-style viewing
      letters: p.letters,
      score: p.score,
    })),
    currentLetter: room.currentLetter,
    activePlayerIdx: room.activePlayerIdx,
    round: room.round,
    maxRounds: room.maxRounds,
    messages: room.messages.slice(-50), // Last 50 messages
    usedWords: [...room.usedWords],
    wordDefinition: room.wordDefinition,
    turnTimeLimit: TURN_TIME_LIMIT,
  };
}

function clearRoomTimer(room) {
  if (room.turnTimer) {
    clearInterval(room.turnTimer);
    room.turnTimer = null;
  }
}

// ── Express + Socket.IO Setup ────────────────────────────────
const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', rooms: rooms.size });
});

// ── Socket.IO Event Handlers ─────────────────────────────────
io.on('connection', (socket) => {
  let currentRoomCode = null;
  let playerName = null;

  // ─── Create Room ───────────────────────────────────────
  socket.on('createRoom', (data, callback) => {
    const { name } = data;
    if (!name?.trim()) {
      return callback?.({ error: 'Name is required' });
    }

    playerName = name.trim();
    const room = createRoom(socket.id, playerName);
    currentRoomCode = room.code;
    socket.join(room.code);

    log(room, `${playerName} created the room.`, 'success');
    callback?.({ success: true, roomCode: room.code });
    io.to(room.code).emit('gameState', getPublicState(room));
  });

  // ─── Join Room ─────────────────────────────────────────
  socket.on('joinRoom', (data, callback) => {
    const { code, name } = data;
    if (!code || !name?.trim()) {
      return callback?.({ error: 'Room code and name are required' });
    }

    const room = rooms.get(code.toUpperCase());
    if (!room) {
      return callback?.({ error: 'Room not found' });
    }
    if (room.phase !== 'lobby') {
      return callback?.({ error: 'Game already in progress' });
    }
    if (room.players.length >= 8) {
      return callback?.({ error: 'Room is full (max 8 players)' });
    }

    const trimmedName = name.trim();
    if (room.players.find(p => p.name.toLowerCase() === trimmedName.toLowerCase())) {
      return callback?.({ error: 'Name already taken in this room' });
    }

    playerName = trimmedName;
    currentRoomCode = room.code;
    room.players.push({ id: socket.id, name: playerName, letters: [], score: 0 });
    socket.join(room.code);

    log(room, `${playerName} joined the room!`, 'success');
    callback?.({ success: true, roomCode: room.code });
    io.to(room.code).emit('gameState', getPublicState(room));
  });

  // ─── Start Game ────────────────────────────────────────
  socket.on('startGame', (data, callback) => {
    const room = rooms.get(currentRoomCode);
    if (!room) return callback?.({ error: 'Room not found' });
    if (room.hostId !== socket.id) return callback?.({ error: 'Only the host can start' });
    if (room.players.length < 2) {
      return callback?.({ error: 'Need at least 2 players to start online!' });
    }

    // Initialize game
    room.phase = 'playing';
    room.round = 1;
    room.usedWords = new Set();
    room.wordDefinition = null;
    const letter = randomLetter();
    room.currentLetter = letter;

    // Assign random letters to all players
    room.players = room.players.map(p => ({
      ...p,
      letters: randomLetters(),
      score: 0,
    }));

    log(room, `🎮 Game started! The starting letter is: ${letter.toUpperCase()}`, 'system');
    log(room, `Round 1 of ${MAX_ROUNDS}`, 'system');

    callback?.({ success: true });
    io.to(room.code).emit('gameState', getPublicState(room));
  });

  // ─── Take Turn ─────────────────────────────────────────
  socket.on('takeTurn', (data, callback) => {
    const room = rooms.get(currentRoomCode);
    if (!room) return callback?.({ error: 'Room not found' });
    if (room.phase !== 'playing') return callback?.({ error: 'Not in playing phase' });

    // Find this player's index
    const playerIdx = room.players.findIndex(p => p.id === socket.id);
    if (playerIdx === -1) return callback?.({ error: 'Player not found' });

    room.activePlayerIdx = playerIdx;
    room.phase = 'turn';
    room.wordDefinition = null;
    const player = room.players[playerIdx];

    log(room, `${player.name}'s turn! Letters: ${player.letters.join(', ').toUpperCase()}`, 'turn');

    // Start server-side timer
    room.turnStartTime = Date.now();
    clearRoomTimer(room);

    room.turnTimer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - room.turnStartTime) / 1000);
      const remaining = TURN_TIME_LIMIT - elapsed;

      if (remaining <= 0) {
        clearRoomTimer(room);

        // Timeout penalty
        const newLetter = randomLetter();
        room.players[playerIdx].letters.push(newLetter);
        log(room, `⏰ Time's up! ${player.name} receives a penalty letter: ${newLetter.toUpperCase()}`, 'warning');

        room.phase = 'playing';
        room.activePlayerIdx = null;
        io.to(room.code).emit('gameState', getPublicState(room));
      } else {
        // Emit timer tick every second
        io.to(room.code).emit('timerTick', { timeLeft: remaining });
      }
    }, 1000);

    callback?.({ success: true });
    io.to(room.code).emit('gameState', getPublicState(room));
  });

  // ─── Submit Word ───────────────────────────────────────
  socket.on('submitWord', async (data, callback) => {
    const room = rooms.get(currentRoomCode);
    if (!room) return callback?.({ error: 'Room not found' });
    if (room.phase !== 'turn') return callback?.({ error: 'Not in turn phase' });

    const playerIdx = room.activePlayerIdx;
    if (room.players[playerIdx]?.id !== socket.id) {
      return callback?.({ error: 'Not your turn' });
    }

    clearRoomTimer(room);
    const w = (data.word || '').toLowerCase().trim();
    const player = room.players[playerIdx];

    // Rule checks
    if (!w) {
      log(room, 'Please enter a word!', 'warning');
      restartTimer(room, playerIdx, player);
      callback?.({ error: 'Empty word' });
      io.to(room.code).emit('gameState', getPublicState(room));
      return;
    }

    if (w[0] !== room.currentLetter) {
      log(room, `❌ Word must start with "${room.currentLetter.toUpperCase()}"!`, 'error');
      restartTimer(room, playerIdx, player);
      callback?.({ error: 'Wrong starting letter' });
      io.to(room.code).emit('gameState', getPublicState(room));
      return;
    }

    const lastChar = w[w.length - 1];
    if (!player.letters.includes(lastChar)) {
      log(room, `❌ Word must end with one of your letters: ${player.letters.join(', ').toUpperCase()}`, 'error');
      restartTimer(room, playerIdx, player);
      callback?.({ error: 'Wrong ending letter' });
      io.to(room.code).emit('gameState', getPublicState(room));
      return;
    }

    if (room.usedWords.has(w)) {
      log(room, `❌ "${w}" has already been used!`, 'error');
      restartTimer(room, playerIdx, player);
      callback?.({ error: 'Word already used' });
      io.to(room.code).emit('gameState', getPublicState(room));
      return;
    }

    // Validate via Dictionary API
    io.to(room.code).emit('validating', true);
    const result = await validateWord(w);
    io.to(room.code).emit('validating', false);

    if (!result.valid) {
      const nl = randomLetter();
      player.letters.push(nl);
      log(room, `❌ "${w}" is not a valid English word! ${player.name} receives a penalty letter: ${nl.toUpperCase()}`, 'error');
      room.phase = 'playing';
      room.activePlayerIdx = null;
      callback?.({ error: 'Invalid word' });
      io.to(room.code).emit('gameState', getPublicState(room));
      return;
    }

    // Valid word!
    room.usedWords.add(w);
    room.wordDefinition = {
      word: w,
      definition: result.definition,
      partOfSpeech: result.partOfSpeech,
    };

    // Remove the last letter from hand, update current letter
    const idx = player.letters.indexOf(lastChar);
    player.letters.splice(idx, 1);
    room.currentLetter = lastChar;

    log(room, `✅ "${w.toUpperCase()}" is valid! Next letter: ${lastChar.toUpperCase()}`, 'success');

    // Check if player used all letters → round win
    if (player.letters.length === 0) {
      player.score += 1;
      log(room, `🏆 ${player.name} cleared all letters and wins Round ${room.round}!`, 'system');

      if (room.round >= MAX_ROUNDS) {
        room.phase = 'gameOver';
        log(room, '🎉 Game over! Check the final scores.', 'system');
      } else {
        room.phase = 'roundEnd';
      }
      room.activePlayerIdx = null;
      callback?.({ success: true });
      io.to(room.code).emit('gameState', getPublicState(room));
      return;
    }

    room.phase = 'playing';
    room.activePlayerIdx = null;
    callback?.({ success: true });
    io.to(room.code).emit('gameState', getPublicState(room));
  });

  // ─── Next Round ────────────────────────────────────────
  socket.on('nextRound', (data, callback) => {
    const room = rooms.get(currentRoomCode);
    if (!room) return callback?.({ error: 'Room not found' });
    if (room.hostId !== socket.id) return callback?.({ error: 'Only the host can advance rounds' });
    if (room.phase !== 'roundEnd') return callback?.({ error: 'Not in round end phase' });

    room.round += 1;
    room.usedWords = new Set();
    room.wordDefinition = null;
    room.players = room.players.map(p => ({ ...p, letters: randomLetters() }));
    const letter = randomLetter();
    room.currentLetter = letter;
    room.phase = 'playing';

    log(room, `🔄 Round ${room.round} of ${MAX_ROUNDS}! Starting letter: ${letter.toUpperCase()}`, 'system');

    callback?.({ success: true });
    io.to(room.code).emit('gameState', getPublicState(room));
  });

  // ─── End Game ──────────────────────────────────────────
  socket.on('endGame', (data, callback) => {
    const room = rooms.get(currentRoomCode);
    if (!room) return callback?.({ error: 'Room not found' });

    clearRoomTimer(room);
    room.phase = 'gameOver';
    room.activePlayerIdx = null;
    log(room, '🎉 Game ended! Check the final scores.', 'system');

    callback?.({ success: true });
    io.to(room.code).emit('gameState', getPublicState(room));
  });

  // ─── Reset / Play Again ────────────────────────────────
  socket.on('resetGame', (data, callback) => {
    const room = rooms.get(currentRoomCode);
    if (!room) return callback?.({ error: 'Room not found' });
    if (room.hostId !== socket.id) return callback?.({ error: 'Only the host can reset' });

    clearRoomTimer(room);
    room.phase = 'lobby';
    room.round = 1;
    room.currentLetter = '';
    room.activePlayerIdx = null;
    room.usedWords = new Set();
    room.messages = [];
    room.wordDefinition = null;
    room.players = room.players.map(p => ({ ...p, letters: [], score: 0 }));

    log(room, 'Game has been reset. Waiting for host to start.', 'system');

    callback?.({ success: true });
    io.to(room.code).emit('gameState', getPublicState(room));
  });

  // ─── Disconnect ────────────────────────────────────────
  socket.on('disconnect', () => {
    if (!currentRoomCode) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;

    const leavingPlayer = room.players.find(p => p.id === socket.id);
    room.players = room.players.filter(p => p.id !== socket.id);

    if (leavingPlayer) {
      log(room, `${leavingPlayer.name} left the game.`, 'warning');
    }

    // If room is empty, delete it
    if (room.players.length === 0) {
      clearRoomTimer(room);
      rooms.delete(currentRoomCode);
      return;
    }

    // If host left, transfer host
    if (room.hostId === socket.id) {
      room.hostId = room.players[0].id;
      log(room, `${room.players[0].name} is now the host.`, 'system');
    }

    // If the active player left during a turn, cancel the turn
    if (room.phase === 'turn' && leavingPlayer && room.players[room.activePlayerIdx]?.id === socket.id) {
      clearRoomTimer(room);
      room.phase = 'playing';
      room.activePlayerIdx = null;
    }

    // Fix activePlayerIdx if needed
    if (room.activePlayerIdx !== null && room.activePlayerIdx >= room.players.length) {
      room.activePlayerIdx = null;
      if (room.phase === 'turn') room.phase = 'playing';
    }

    io.to(room.code).emit('gameState', getPublicState(room));
  });

  // ─── Leave Room (voluntary) ────────────────────────────
  socket.on('leaveRoom', (data, callback) => {
    if (!currentRoomCode) return callback?.({ error: 'Not in a room' });
    socket.leave(currentRoomCode);
    // Trigger disconnect-like cleanup
    const room = rooms.get(currentRoomCode);
    if (room) {
      const leavingPlayer = room.players.find(p => p.id === socket.id);
      room.players = room.players.filter(p => p.id !== socket.id);

      if (leavingPlayer) {
        log(room, `${leavingPlayer.name} left the game.`, 'warning');
      }

      if (room.players.length === 0) {
        clearRoomTimer(room);
        rooms.delete(currentRoomCode);
      } else {
        if (room.hostId === socket.id) {
          room.hostId = room.players[0].id;
          log(room, `${room.players[0].name} is now the host.`, 'system');
        }
        io.to(room.code).emit('gameState', getPublicState(room));
      }
    }

    currentRoomCode = null;
    playerName = null;
    callback?.({ success: true });
  });
});

// ── Helper: Restart turn timer after invalid input ───────────
function restartTimer(room, playerIdx, player) {
  room.turnStartTime = Date.now();
  clearRoomTimer(room);

  room.turnTimer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - room.turnStartTime) / 1000);
    const remaining = TURN_TIME_LIMIT - elapsed;

    if (remaining <= 0) {
      clearRoomTimer(room);
      const nl = randomLetter();
      room.players[playerIdx].letters.push(nl);
      log(room, `⏰ Time's up! ${player.name} receives a penalty letter: ${nl.toUpperCase()}`, 'warning');
      room.phase = 'playing';
      room.activePlayerIdx = null;
      io.to(room.code).emit('gameState', getPublicState(room));
    } else {
      io.to(room.code).emit('timerTick', { timeLeft: remaining });
    }
  }, 1000);
}

// ── Start Server ─────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`🎮 Shiritori server running on http://localhost:${PORT}`);
});

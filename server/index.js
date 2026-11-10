import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { readFileSync } from 'node:fs';

import { Room } from './room.js';
import { createDictionary } from './dictionary.js';
import { fetchDefinition } from './definition.js';

// ── Config ───────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
// Comma-separated list of allowed browser origins, e.g. https://tailword.azedlabs.com.
// Unset means any origin may connect.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
const corsOrigin = ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : '*';
const ROOM_IDLE_MS = 3 * 60 * 60 * 1000;

const dictionary = createDictionary(readFileSync(new URL('./words.txt', import.meta.url), 'utf8'));

const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

// ── Express + Socket.IO ──────────────────────────────────────
const app = express();
app.use(cors({ origin: corsOrigin }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: corsOrigin, methods: ['GET', 'POST'] },
  maxHttpBufferSize: 1e4,
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', rooms: rooms.size, words: dictionary.size });
});

function makeRoom() {
  const code = generateRoomCode();
  const room = new Room({
    code,
    dictionary,
    fetchDefinition,
    minPlayers: 2,
    onChange: (r) => io.to(r.code).emit('gameState', r.state()),
    onTick: (timeLeft) => io.to(code).emit('timerTick', { timeLeft }),
    onNotify: (pid, payload) => {
      const socketId = room.players.find((p) => p.id === pid)?.socketId;
      if (socketId) io.to(socketId).emit('notice', payload);
    },
    onEmpty: () => rooms.delete(code),
  });
  room.lastActive = Date.now();
  rooms.set(code, room);
  return room;
}

// Rooms nobody has touched for hours are dropped.
setInterval(() => {
  for (const [code, room] of rooms) {
    if (Date.now() - room.lastActive > ROOM_IDLE_MS) {
      room.destroy();
      rooms.delete(code);
    }
  }
}, 15 * 60 * 1000).unref();

// ── Socket handlers ──────────────────────────────────────────
io.on('connection', (socket) => {
  let session = null; // { room, pid }

  const body = (data) => (data && typeof data === 'object' ? data : {});

  const attach = (room, player) => {
    player.socketId = socket.id;
    session = { room, pid: player.id };
    socket.join(room.code);
    room.lastActive = Date.now();
    socket.emit('gameState', room.state());
  };

  // Runs a host/player action on the current room and acks with the result.
  const act = (callback, fn) => {
    if (!session || !rooms.has(session.room.code)) return callback?.({ error: 'Room not found' });
    session.room.lastActive = Date.now();
    const result = fn(session.room, session.pid);
    callback?.(result.ok === false ? { error: result.error || result.message, ...result } : { success: true, ...result });
  };

  socket.on('createRoom', (data, callback) => {
    if (session) return callback?.({ error: 'Already in a room' });
    const room = makeRoom();
    const added = room.addPlayer(body(data).name);
    if (!added.ok) {
      room.destroy();
      rooms.delete(room.code);
      return callback?.({ error: added.error });
    }
    attach(room, added.player);
    callback?.({ success: true, roomCode: room.code, playerId: added.player.id, token: added.player.token });
  });

  socket.on('joinRoom', (data, callback) => {
    if (session) return callback?.({ error: 'Already in a room' });
    const { code, name } = body(data);
    if (typeof code !== 'string' || !code.trim() || typeof name !== 'string' || !name.trim()) {
      return callback?.({ error: 'Room code and name are required' });
    }
    const room = rooms.get(code.trim().toUpperCase());
    if (!room) return callback?.({ error: 'Room not found' });
    const added = room.addPlayer(name);
    if (!added.ok) return callback?.({ error: added.error });
    attach(room, added.player);
    callback?.({ success: true, roomCode: room.code, playerId: added.player.id, token: added.player.token });
  });

  // A returning player (page reload or dropped connection) takes their seat back.
  socket.on('rejoinRoom', (data, callback) => {
    const { code, token } = body(data);
    const room = typeof code === 'string' ? rooms.get(code.trim().toUpperCase()) : null;
    if (!room || typeof token !== 'string') return callback?.({ error: 'Room not found' });
    const back = room.reconnect(token);
    if (!back.ok) return callback?.({ error: back.error });
    attach(room, back.player);
    callback?.({ success: true, roomCode: room.code, playerId: back.player.id });
  });

  socket.on('setMode', (data, callback) => {
    act(callback, (room, pid) => room.setMode(pid, body(data).mode));
  });

  socket.on('startGame', (data, callback) => act(callback, (room, pid) => room.start(pid)));
  socket.on('nextRound', (data, callback) => act(callback, (room, pid) => room.nextRound(pid)));
  socket.on('endGame', (data, callback) => act(callback, (room, pid) => room.endGame(pid)));
  socket.on('resetGame', (data, callback) => act(callback, (room, pid) => room.reset(pid)));

  socket.on('submitWord', (data, callback) => {
    const { word, seq } = body(data);
    if (typeof word !== 'string') return callback?.({ ok: false, reason: 'format', message: 'Use letters only, with no spaces.' });
    act(callback, (room, pid) => room.submit(pid, word.slice(0, 60), typeof seq === 'number' ? seq : undefined));
  });

  socket.on('leaveRoom', (data, callback) => {
    if (!session) return callback?.({ error: 'Not in a room' });
    const { room, pid } = session;
    session = null;
    socket.leave(room.code);
    room.removePlayer(pid);
    callback?.({ success: true });
  });

  socket.on('disconnect', () => {
    if (!session) return;
    const { room, pid } = session;
    const player = room.players.find((p) => p.id === pid);
    // Ignore if the player has already come back on a newer socket.
    if (player && player.socketId === socket.id) room.markDisconnected(pid);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Tailword server listening on port ${PORT} (${dictionary.size} words, origins: ${ALLOWED_ORIGINS.join(', ') || 'any'})`);
});

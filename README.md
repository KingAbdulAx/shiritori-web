# Renga

A word-chain game for phones and browsers. Each word starts with the last letter of the one before it, and the first player to empty their hand of letters wins the round. Named after renga, the Japanese linked-verse tradition where each verse picks up from the last, and inspired by shiritori, the Japanese word-chain game. Built with React + Vite, with a Socket.IO server for online rooms.

> Started as a [Discord bot](https://github.com/KingAbdulAx/English-Shiritori-Discord-Bot).

---

## How to play

1. Each player gets **5 letters**.
2. A **starting letter** is shown. Type a word that starts with it, has **3 or more letters**, ends with **one of your letters**, and hasn't been played yet.
3. A valid word removes that letter from your hand, and the letter becomes the next starting letter.
4. First to empty their hand wins the round (+1 point). A game is **3 rounds**.

Two ways to play online (the host picks in the waiting room):

| Mode | How it works |
| ---- | ------------ |
| **Chill** (default) | Take turns, 30 seconds each. An unknown word or running out of time adds a penalty letter. Rule slips (wrong start or end letter, too short, already used) and near misses just let you try again. |
| **Rush** | Everyone types at once. The first valid word takes the letter (a 250 ms photo-finish window favours whoever has more letters left). A wrong word locks you out for a moment instead of adding a letter. If nobody finds a word for 20 seconds the starting letter changes. |

Pass-and-play on one device always uses Chill, with a "pass to next player" screen between turns.

**Fair hands.** Letters are dealt from tiers by how easy they are to end a word with. A hand is 3 easy letters, 1 medium and 1 wildcard, so it never holds more than one hard letter (`y w f i b u`). `j v q x z` are never dealt. Penalty letters come from the easy and medium tiers only.

**Words** are checked locally against a 79,000-word list (British and American spellings, from [SCOWL](http://wordlist.aspell.net/)), so validation is instant and works offline. Definitions come from the [Free Dictionary API](https://dictionaryapi.dev/) as a best-effort extra; if it is slow or down, the game carries on without them.

**Reconnecting.** Each player gets a private token. If you reload or lose signal, you take your seat back automatically within 60 seconds.

---

## Run it locally

Needs Node 18+ (the tests use 20+).

```bash
npm install && (cd server && npm install)
npm run dev:all        # game server on :3001 + Vite on :5173
```

Local play works with just `npm run dev`. In development the client talks to `http://localhost:3001` unless `VITE_SERVER_URL` is set.

```bash
npm test               # rules and room engine tests
npm run lint
npm run build && npm run preview
```

---

## Deployment

| Piece | Where | Notes |
| ----- | ----- | ----- |
| Frontend | Vercel | Build `npm run build`, output `dist`. Set `VITE_SERVER_URL` and redeploy |
| Game server | Any Node 18+ host (currently a Coolify VPS) | Base directory `server/`, start `npm start`, port `3001`, domain with TLS and WebSocket support. `server/Dockerfile` is there as a fallback build pack |

Frontend variables (see `.env.example`; Vite inlines them **at build time**, so changing one needs a redeploy):

| Variable | Required | Purpose |
| -------- | -------- | ------- |
| `VITE_SERVER_URL` | Production | Game server URL, no trailing slash, `https://` on an https site |
| `VITE_SOCKET_PATH` | No | Socket.IO path (default `/socket.io`) |
| `VITE_BASE` | No | Public base path when served under a sub-path, e.g. `/renga/` (default `/`) |

Server variable (set in Coolify):

| Variable | Required | Purpose |
| -------- | -------- | ------- |
| `ALLOWED_ORIGINS` | Recommended | Comma-separated sites allowed to connect, e.g. `https://renga.azedlabs.com`. Unset means any origin |
| `PORT` | No | Defaults to `3001` |

If `VITE_SERVER_URL` is missing in a production build, online play is disabled with a clear message instead of silently pointing players at their own machine.

Server notes: `GET /health` reports status, open rooms and word count. Rooms live in memory, so run a single instance; a restart ends active games and players see a "connection lost" message. Idle rooms are swept after 3 hours.

---

## Project structure

```
├── index.html
├── scripts/build-wordlist.mjs   # rebuilds server/words.txt from SCOWL (npm run build:words)
├── server/                      # Node + Express + Socket.IO
│   ├── index.js                 # sockets, rooms, CORS, health
│   ├── room.js                  # the game engine: phases, modes, clocks (no sockets)
│   ├── rules.js                 # dealing, word checks, lockouts, race winner
│   ├── dictionary.js            # word set + near-miss lookup
│   ├── definition.js            # optional definitions
│   ├── words.txt                # word list (see WORDS-LICENSE.txt)
│   ├── Dockerfile               # fallback build for Coolify
│   └── test/                    # node --test suites
└── src/
    ├── useGame.js               # pass-and-play: runs the same Room class in the browser
    ├── useOnlineGame.js         # online client: connect, rejoin, submit
    ├── session.js               # remembers your seat for reloads
    ├── words.js                 # loads the word list for local play
    └── components/              # Home, Lobby, OnlineLobby, GameBoard, RoundEnd, GameOver, ...
```

The game rules live in one place (`server/rules.js` and `server/room.js`). The online server and the browser's pass-and-play both use them, so the two can't drift apart.

---

## Tech

React 19, Vite 7, vanilla CSS with design tokens, Montserrat + Inter (self-hosted via Fontsource), Socket.IO.

## License

MIT. The word list is derived from SCOWL; see `server/WORDS-LICENSE.txt`.

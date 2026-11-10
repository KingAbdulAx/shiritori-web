# 🔗 Shiritori Web — English Word Chain Game

A modern, browser-based version of **English Shiritori**, the classic Japanese word-chaining game adapted for English. Built with React + Vite.

> Originally a [Discord bot](https://github.com/KingAbdulAx/English-Shiritori-Discord-Bot) — now playable right in your browser!

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

---

## 🎮 How It Works

1. **Play locally** (add players and pass the keyboard) or **online** (create a room, share the code or invite link, play on separate devices).
2. Each player starts with **5 random letters**.
3. A **starting letter** is revealed. On your turn, type a word that:
   - **Starts** with the current global letter.
   - **Ends** with one of *your* assigned letters.
   - Is a **valid English word** (verified via [Free Dictionary API](https://dictionaryapi.dev/)).
4. ✅ **Valid word** → that ending letter is removed from your hand and becomes the next starting letter.
5. ❌ **Invalid word or timeout** → you receive a penalty letter.
6. 🏆 First player to **clear all their letters** wins the round.
7. The game runs for **3 rounds** — highest score wins!

---

## ✨ Features

- **Local multiplayer** — add as many players as you like
- **Online multiplayer** — rooms of up to 8, join by code or invite link (native share sheet on phones)
- **30-second turn timer** with animated progress bar
- **Live word validation** via the Dictionary API (+ shows definitions!)
- **Multi-round scoring** with leaderboard
- **Draw extra letter** button for an added challenge
- **Used words tracker** — no repeats allowed
- **Responsive design** — plays great on desktop and mobile
- **Premium dark UI** with glassmorphism, gradient accents, and micro-animations

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ and npm

### Installation

```bash
# From the project root
cd shiritori-web

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The app will be available at **http://localhost:5173/**.

### Online play locally

Online play needs the Socket.IO game server (`server/`). Run both together:

```bash
npm install && (cd server && npm install)
npm run dev:all        # server on :3001 + Vite on :5173
```

In development the client talks to `http://localhost:3001` unless `VITE_SERVER_URL` is set.

### Production Build

```bash
npm run build
npm run preview
```

---

## 🌐 Deployment

The app is two pieces: a static frontend and a Node/Socket.IO game server.

| Piece | Where | Notes |
| ----- | ----- | ----- |
| Frontend | Vercel | Build `npm run build`, output `dist`. Set `VITE_SERVER_URL` (below) and redeploy |
| Game server | Any Node 18+ host (currently a Coolify VPS) | Base directory `server/`, start `npm start`, port `3001`, domain with TLS and WebSocket support |

Frontend environment variables (see `.env.example`; Vite inlines them **at build time**, so changing one needs a redeploy):

| Variable | Required | Purpose |
| -------- | -------- | ------- |
| `VITE_SERVER_URL` | Production | Game server URL, no trailing slash, `https://` on an https site |
| `VITE_SOCKET_PATH` | No | Socket.IO path (default `/socket.io`) |
| `VITE_BASE` | No | Public base path when served under a sub-path, e.g. `/eshiritori/` (default `/`) |

If `VITE_SERVER_URL` is missing in a production build, online play is disabled with a clear message instead of silently pointing players at their own machine.

Server notes: `GET /health` reports status and open rooms. Rooms live in memory, so run a single instance; a restart ends active games.

---

## 🗂️ Project Structure

```
shiritori-web/
├── index.html                  # Root HTML with SEO meta & Google Fonts
├── package.json
├── vite.config.js
├── .env.example                # Frontend environment variables
├── server/                     # Node + Express + Socket.IO game server
│   └── index.js                # Rooms, turns, timers, word validation
└── src/
    ├── main.jsx                # React entry point
    ├── config.js               # Build-time config (server URL, socket path)
    ├── index.css               # Design system (tokens, animations, reset)
    ├── App.jsx                 # Root component — orchestrates game phases
    ├── App.css
    ├── useGame.js              # Local game logic hook (all Shiritori rules)
    ├── useOnlineGame.js        # Online client hook (Socket.IO connection & state)
    └── components/
        ├── Header.jsx / .css   # Sticky header with branding & round badge
        ├── Home.jsx / .css     # Local vs online mode picker
        ├── Lobby.jsx / .css    # Local player management form & animated hero
        ├── OnlineLobby.jsx / .css # Create/join room, invite link, waiting room
        ├── GameBoard.jsx / .css # Turn timer, word input, player cards
        ├── RoundEnd.jsx / .css # Round summary with scores
        ├── GameOver.jsx / .css # Final leaderboard & winner highlight
        └── MessageLog.jsx / .css # Floating game event log
```

---

## 🛠️ Tech Stack

| Layer       | Technology                                                    |
| ----------- | ------------------------------------------------------------- |
| Framework   | [React 19](https://react.dev/)                                |
| Bundler     | [Vite 7](https://vite.dev/)                                   |
| Styling     | Vanilla CSS with custom properties (design tokens)            |
| Typography  | [Outfit](https://fonts.google.com/specimen/Outfit) + [Inter](https://fonts.google.com/specimen/Inter) (Google Fonts) |
| Word API    | [Free Dictionary API](https://dictionaryapi.dev/)             |

---

## 📝 Game Rules Reference

| Rule | Detail |
| ---- | ------ |
| Starting hand | 5 random letters from `a–y` (excluding `q`, `x`, `z`) |
| Word start | Must begin with the current global letter |
| Word end | Must end with one of your own letters |
| Valid word | Checked against the Dictionary API |
| On success | Ending letter removed from hand; becomes next global letter |
| On failure / timeout | Player receives a random penalty letter |
| Round win | First player to empty their hand |
| Game length | 3 rounds (configurable in `useGame.js`) |

---

## 📄 License

MIT — feel free to fork, modify, and share.

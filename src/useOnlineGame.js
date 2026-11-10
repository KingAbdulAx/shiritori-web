import { useState, useCallback, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { SERVER_URL, SOCKET_PATH, CONFIG_PROBLEM } from './config';
import { loadSession, saveSession, clearSession } from './session';

const MSG_UNREACHABLE = "Can't reach the game server. Check your connection and try again.";
const MSG_UNAVAILABLE = "Online play isn't available right now.";
const MSG_SESSION_LOST = 'Connection lost, so you were removed from the room. Create or join a room to play again.';
const ACK_TIMEOUT_MS = 10000;
const FEEDBACK_MS = 4500;

// Resolves once the socket is connected, rejects if it isn't within `ms`.
function whenConnected(socket, ms = 12000) {
    return new Promise((resolve, reject) => {
        if (socket.connected) {
            resolve();
            return;
        }
        const onConnect = () => {
            clearTimeout(timer);
            resolve();
        };
        const timer = setTimeout(() => {
            socket.off('connect', onConnect);
            reject(new Error(MSG_UNREACHABLE));
        }, ms);
        socket.once('connect', onConnect);
    });
}

export default function useOnlineGame() {
    const [connectionStatus, setConnectionStatus] = useState('disconnected'); // disconnected | connecting | connected
    const [roomCode, setRoomCode] = useState(null);
    const [myPlayerId, setMyPlayerId] = useState(null);
    const [hostId, setHostId] = useState(null);
    // True while we are taking our seat back after a reload (a saved session exists).
    const [resuming, setResuming] = useState(() => !!loadSession());

    // Game state (same shape as useGame)
    const [mode, setMode] = useState('chill');
    const [phase, setPhase] = useState('lobby');
    const [players, setPlayers] = useState([]);
    const [currentLetter, setCurrentLetter] = useState('');
    const [activePlayerIdx, setActivePlayerIdx] = useState(null);
    const [round, setRound] = useState(1);
    const [maxRounds, setMaxRounds] = useState(3);
    const [messages, setMessages] = useState([]);
    const [timeLeft, setTimeLeft] = useState(30);
    const [turnTimeLimit, setTurnTimeLimit] = useState(30);
    const [usedWords, setUsedWords] = useState(new Set());
    const [wordDefinition, setWordDefinition] = useState(null);
    const [seq, setSeq] = useState(0);
    const [error, setError] = useState(null);
    const [feedback, setFeedback] = useState(null);
    const [lockedUntil, setLockedUntil] = useState(0);

    const socketRef = useRef(null);
    const seqRef = useRef(0);
    const inRoomRef = useRef(false); // the UI believes we are in a room
    const feedbackTimer = useRef(null);

    // Forget everything about the current room (keeps the socket itself).
    const resetRoomState = useCallback(() => {
        inRoomRef.current = false;
        setRoomCode(null);
        setHostId(null);
        setMode('chill');
        setPhase('lobby');
        setPlayers([]);
        setCurrentLetter('');
        setActivePlayerIdx(null);
        setRound(1);
        setMessages([]);
        setUsedWords(new Set());
        setWordDefinition(null);
        setFeedback(null);
        setLockedUntil(0);
    }, []);

    const showFeedback = useCallback((res) => {
        clearTimeout(feedbackTimer.current);
        if (!res || res.ok) {
            setFeedback(null);
            return;
        }
        const kind = res.type === 'slow' || res.reason === 'stale' ? 'slow' : res.reason === 'near' ? 'hint' : 'error';
        setFeedback({ id: Date.now(), kind, text: res.message || res.error });
        feedbackTimer.current = setTimeout(() => setFeedback(null), FEEDBACK_MS);
    }, []);

    // ── Connect to server ──────────────────────────────────
    const connect = useCallback(() => {
        // Reuse the socket even while it is reconnecting; creating a second one leaks.
        if (socketRef.current) return socketRef.current;

        if (CONFIG_PROBLEM) {
            console.error(`[renga] ${CONFIG_PROBLEM}`);
            setError(MSG_UNAVAILABLE);
            setResuming(false);
            return null;
        }

        setConnectionStatus('connecting');
        const s = io(SERVER_URL, {
            path: SOCKET_PATH,
            transports: ['websocket', 'polling'],
            timeout: 10000,
        });

        // Take our seat back, after a reload or after the connection dropped.
        const rejoin = () => {
            const saved = loadSession();
            if (!saved) {
                setResuming(false);
                return;
            }
            s.timeout(ACK_TIMEOUT_MS).emit('rejoinRoom', { code: saved.code, token: saved.token }, (err, res) => {
                if (err) {
                    // No answer: keep the saved seat and try again on the next connect.
                    setError(MSG_UNREACHABLE);
                } else if (res?.success) {
                    inRoomRef.current = true;
                    setMyPlayerId(res.playerId);
                    setRoomCode(res.roomCode);
                    setError(null);
                } else {
                    // The room is gone (server restarted, or we were away too long).
                    clearSession();
                    resetRoomState();
                    setError(MSG_SESSION_LOST);
                }
                setResuming(false);
            });
        };

        s.on('connect', () => {
            setConnectionStatus('connected');
            setError((prev) => (prev === MSG_UNREACHABLE ? null : prev));
            rejoin();
        });

        s.on('disconnect', () => {
            setConnectionStatus('disconnected');
        });

        s.on('connect_error', () => {
            // socket.io keeps retrying on its own
            setConnectionStatus('connecting');
            setError(MSG_UNREACHABLE);
            setResuming(false);
        });

        // Game state updates from server
        s.on('gameState', (state) => {
            inRoomRef.current = true;
            seqRef.current = state.seq;
            setMode(state.mode);
            setSeq(state.seq);
            setPhase(state.phase);
            setPlayers(state.players);
            setCurrentLetter(state.currentLetter);
            setActivePlayerIdx(state.activePlayerIdx);
            setRound(state.round);
            setMaxRounds(state.maxRounds);
            setMessages(state.messages.map((m) => ({ ...m, time: new Date(m.time) })));
            setUsedWords(new Set(state.usedWords));
            setTurnTimeLimit(state.turnTimeLimit);
            setTimeLeft(state.timeLeft);
            setWordDefinition(state.wordDefinition);
            setHostId(state.hostId);
            setRoomCode(state.code);
            setError(null);
        });

        s.on('timerTick', (data) => {
            setTimeLeft(data.timeLeft);
        });

        // Private messages, such as "someone else got there first".
        s.on('notice', (notice) => showFeedback(notice));

        socketRef.current = s;
        return s;
    }, [resetRoomState, showFeedback]);

    // ── Disconnect ─────────────────────────────────────────
    const disconnect = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
        }
        resetRoomState();
        setConnectionStatus('disconnected');
        setMyPlayerId(null);
        setError(null);
    }, [resetRoomState]);

    // Reloaded in the middle of a game: reconnect and take the seat back.
    useEffect(() => {
        // Deferred so the connect-time state updates do not run inside the effect body.
        const start = setTimeout(() => {
            if (loadSession()) connect();
        }, 0);
        return () => {
            clearTimeout(start);
            clearTimeout(feedbackTimer.current);
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [connect]);

    // ── Room Actions ───────────────────────────────────────
    const roomRequest = useCallback((event, payload) => {
        return new Promise((resolve, reject) => {
            const s = socketRef.current || connect();
            if (!s) {
                reject(MSG_UNAVAILABLE);
                return;
            }

            whenConnected(s)
                .then(() => {
                    s.timeout(ACK_TIMEOUT_MS).emit(event, payload, (err, response) => {
                        if (err) {
                            setError(MSG_UNREACHABLE);
                            reject(MSG_UNREACHABLE);
                        } else if (response?.error) {
                            setError(response.error);
                            reject(response.error);
                        } else {
                            inRoomRef.current = true;
                            saveSession({ code: response.roomCode, token: response.token, name: payload.name });
                            setMyPlayerId(response.playerId);
                            setRoomCode(response.roomCode);
                            setError(null);
                            resolve(response.roomCode);
                        }
                    });
                })
                .catch((e) => {
                    const message = e?.message || MSG_UNREACHABLE;
                    setError(message);
                    reject(message);
                });
        });
    }, [connect]);

    const createRoom = useCallback(
        (playerName) => roomRequest('createRoom', { name: playerName }),
        [roomRequest],
    );

    const joinRoom = useCallback(
        (code, playerName) => roomRequest('joinRoom', { code: code.toUpperCase(), name: playerName }),
        [roomRequest],
    );

    // ── Game Actions ───────────────────────────────────────
    const simple = useCallback((event, payload = {}) => {
        socketRef.current?.timeout(ACK_TIMEOUT_MS).emit(event, payload, (err, response) => {
            if (err) setError(MSG_UNREACHABLE);
            else if (response?.error) setError(response.error);
        });
    }, []);

    const setRoomMode = useCallback((m) => simple('setMode', { mode: m }), [simple]);
    const startGame = useCallback(() => simple('startGame'), [simple]);
    const nextRound = useCallback(() => simple('nextRound'), [simple]);
    const endGame = useCallback(() => simple('endGame'), [simple]);
    const resetGame = useCallback(() => simple('resetGame'), [simple]);

    // Resolves with the server's verdict so the board can keep or clear what was typed.
    const submitWord = useCallback((word) => new Promise((resolve) => {
        const s = socketRef.current;
        if (!s) {
            resolve({ ok: false });
            return;
        }
        s.timeout(ACK_TIMEOUT_MS).emit('submitWord', { word, seq: seqRef.current }, (err, res) => {
            if (err) {
                const failure = { ok: false, reason: 'network', message: MSG_UNREACHABLE };
                showFeedback(failure);
                resolve(failure);
                return;
            }
            showFeedback(res);
            if (res?.lockMs) setLockedUntil(Date.now() + res.lockMs);
            resolve(res);
        });
    }), [showFeedback]);

    const clearSessionAndLeave = useCallback(() => {
        socketRef.current?.emit('leaveRoom', {}, () => { });
        clearSession();
        disconnect();
    }, [disconnect]);

    const clearError = useCallback(() => setError(null), []);

    return {
        // Connection
        connectionStatus,
        roomCode,
        myPlayerId,
        hostId,
        isHost: !!myPlayerId && myPlayerId === hostId,
        resuming,
        error,
        clearError,

        // Game state (same shape as useGame)
        mode,
        phase,
        players,
        currentLetter,
        activePlayerIdx,
        round,
        maxRounds,
        messages,
        timeLeft,
        turnTimeLimit,
        usedWords,
        wordDefinition,
        seq,
        feedback,
        lockedUntil,

        // Actions
        connect,
        disconnect,
        createRoom,
        joinRoom,
        leaveRoom: clearSessionAndLeave,
        setMode: setRoomMode,
        startGame,
        submitWord,
        nextRound,
        endGame,
        resetGame,
    };
}

import { useState, useCallback, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { SERVER_URL, SOCKET_PATH, CONFIG_PROBLEM } from './config';

const MSG_UNREACHABLE = "Can't reach the game server. Check your connection and try again.";
const MSG_UNAVAILABLE = "Online play isn't available right now.";
const MSG_SESSION_LOST = 'Connection lost, so you were removed from the room. Create or join a room to play again.';
const ACK_TIMEOUT_MS = 10000;

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
    const [isHost, setIsHost] = useState(false);

    // Game state (mirrors useGame.js shape)
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
    const [isValidating, setIsValidating] = useState(false);
    const [wordDefinition, setWordDefinition] = useState(null);
    const [error, setError] = useState(null);

    const socketRef = useRef(null);
    const inRoomRef = useRef(false);   // we have joined/created a room on the server
    const droppedRef = useRef(false);  // the connection dropped since we last connected

    // Forget everything about the current room (keeps the socket itself).
    const resetRoomState = useCallback(() => {
        inRoomRef.current = false;
        setRoomCode(null);
        setIsHost(false);
        setPhase('lobby');
        setPlayers([]);
        setCurrentLetter('');
        setActivePlayerIdx(null);
        setRound(1);
        setMessages([]);
        setUsedWords(new Set());
        setIsValidating(false);
        setWordDefinition(null);
    }, []);

    // ── Connect to server ──────────────────────────────────
    const connect = useCallback(() => {
        // Reuse the socket even while it is reconnecting; creating a second one leaks.
        if (socketRef.current) return socketRef.current;

        if (CONFIG_PROBLEM) {
            console.error(`[shiritori] ${CONFIG_PROBLEM}`);
            setError(MSG_UNAVAILABLE);
            return null;
        }

        setConnectionStatus('connecting');
        const s = io(SERVER_URL, {
            path: SOCKET_PATH,
            transports: ['websocket', 'polling'],
            timeout: 10000,
        });

        s.on('connect', () => {
            setConnectionStatus('connected');
            setMyPlayerId(s.id);
            setError((prev) => (prev === MSG_UNREACHABLE ? null : prev));

            // The server drops a player the moment their socket disconnects, so if we were
            // in a room before the drop we are no longer in it, even though the UI still shows it.
            if (droppedRef.current && inRoomRef.current) {
                resetRoomState();
                setError(MSG_SESSION_LOST);
            }
            droppedRef.current = false;
        });

        s.on('disconnect', (reason) => {
            setConnectionStatus('disconnected');
            if (reason !== 'io client disconnect') droppedRef.current = true;
        });

        s.on('connect_error', () => {
            // socket.io keeps retrying on its own
            setConnectionStatus('connecting');
            setError(MSG_UNREACHABLE);
        });

        // Game state updates from server
        s.on('gameState', (state) => {
            inRoomRef.current = true;
            setPhase(state.phase);
            setPlayers(state.players);
            setCurrentLetter(state.currentLetter);
            setActivePlayerIdx(state.activePlayerIdx);
            setRound(state.round);
            setMaxRounds(state.maxRounds);
            setMessages(state.messages.map(m => ({
                ...m,
                time: new Date(m.time),
            })));
            setUsedWords(new Set(state.usedWords));
            setTurnTimeLimit(state.turnTimeLimit);
            setWordDefinition(state.wordDefinition);
            setIsHost(state.hostId === s.id);
            setRoomCode(state.code);
            setError(null);
        });

        s.on('timerTick', (data) => {
            setTimeLeft(data.timeLeft);
        });

        s.on('validating', (v) => {
            setIsValidating(v);
        });

        socketRef.current = s;
        return s;
    }, [resetRoomState]);

    // ── Disconnect ─────────────────────────────────────────
    const disconnect = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
        }
        droppedRef.current = false;
        resetRoomState();
        setConnectionStatus('disconnected');
        setMyPlayerId(null);
        setError(null);
    }, [resetRoomState]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, []);

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

    // ── Game Actions (same API shape as useGame) ───────────
    const startGame = useCallback(() => {
        socketRef.current?.emit('startGame', {}, (response) => {
            if (response?.error) setError(response.error);
        });
    }, []);

    const takeTurn = useCallback(() => {
        setTimeLeft(turnTimeLimit);
        socketRef.current?.emit('takeTurn', {}, (response) => {
            if (response?.error) setError(response.error);
        });
    }, [turnTimeLimit]);

    const submitWord = useCallback(async (word) => {
        // Rule violations are reported in the game log by the server; only surface unexpected errors.
        const expected = ['Empty word', 'Wrong starting letter', 'Wrong ending letter', 'Word already used', 'Invalid word'];
        socketRef.current?.emit('submitWord', { word }, (response) => {
            if (response?.error && !expected.includes(response.error)) {
                setError(response.error);
            }
        });
    }, []);

    const nextRound = useCallback(() => {
        socketRef.current?.emit('nextRound', {}, (response) => {
            if (response?.error) setError(response.error);
        });
    }, []);

    const endGame = useCallback(() => {
        socketRef.current?.emit('endGame', {}, (response) => {
            if (response?.error) setError(response.error);
        });
    }, []);

    const resetGame = useCallback(() => {
        socketRef.current?.emit('resetGame', {}, (response) => {
            if (response?.error) setError(response.error);
        });
    }, []);

    const leaveRoom = useCallback(() => {
        socketRef.current?.emit('leaveRoom', {}, () => { });
        disconnect();
    }, [disconnect]);

    const clearError = useCallback(() => setError(null), []);

    return {
        // Connection
        connectionStatus,
        roomCode,
        myPlayerId,
        isHost,
        error,
        clearError,

        // Game state (same shape as useGame)
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
        isValidating,
        wordDefinition,

        // Actions
        connect,
        disconnect,
        createRoom,
        joinRoom,
        leaveRoom,
        startGame,
        takeTurn,
        submitWord,
        nextRound,
        endGame,
        resetGame,
    };
}

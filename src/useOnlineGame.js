import { useState, useCallback, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export default function useOnlineGame() {
    const [socket, setSocket] = useState(null);
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

    // ── Connect to server ──────────────────────────────────
    const connect = useCallback(() => {
        if (socketRef.current?.connected) return socketRef.current;

        setConnectionStatus('connecting');
        const s = io(SERVER_URL, {
            transports: ['websocket', 'polling'],
            timeout: 10000,
        });

        s.on('connect', () => {
            setConnectionStatus('connected');
            setMyPlayerId(s.id);
        });

        s.on('disconnect', () => {
            setConnectionStatus('disconnected');
        });

        s.on('connect_error', () => {
            setConnectionStatus('disconnected');
            setError('Could not connect to server. Is it running?');
        });

        // Game state updates from server
        s.on('gameState', (state) => {
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
        setSocket(s);
        return s;
    }, []);

    // ── Disconnect ─────────────────────────────────────────
    const disconnect = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
            setSocket(null);
            setConnectionStatus('disconnected');
            setRoomCode(null);
            setMyPlayerId(null);
            setIsHost(false);
            setPhase('lobby');
            setPlayers([]);
            setMessages([]);
            setError(null);
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, []);

    // ── Room Actions ───────────────────────────────────────
    const createRoom = useCallback((playerName) => {
        return new Promise((resolve, reject) => {
            const s = socketRef.current || connect();
            // Wait for connection if needed
            const doCreate = () => {
                s.emit('createRoom', { name: playerName }, (response) => {
                    if (response.error) {
                        setError(response.error);
                        reject(response.error);
                    } else {
                        setRoomCode(response.roomCode);
                        setError(null);
                        resolve(response.roomCode);
                    }
                });
            };

            if (s.connected) {
                doCreate();
            } else {
                s.once('connect', doCreate);
            }
        });
    }, [connect]);

    const joinRoom = useCallback((code, playerName) => {
        return new Promise((resolve, reject) => {
            const s = socketRef.current || connect();
            const doJoin = () => {
                s.emit('joinRoom', { code: code.toUpperCase(), name: playerName }, (response) => {
                    if (response.error) {
                        setError(response.error);
                        reject(response.error);
                    } else {
                        setRoomCode(response.roomCode);
                        setError(null);
                        resolve(response.roomCode);
                    }
                });
            };

            if (s.connected) {
                doJoin();
            } else {
                s.once('connect', doJoin);
            }
        });
    }, [connect]);

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
        socketRef.current?.emit('submitWord', { word }, (response) => {
            if (response?.error && response.error !== 'Empty word' && response.error !== 'Wrong starting letter' && response.error !== 'Wrong ending letter' && response.error !== 'Word already used' && response.error !== 'Invalid word') {
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

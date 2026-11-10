// Pass-and-play. The same Room class the server uses runs here in the browser.
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Room } from '../server/room.js';
import { fetchDefinition } from '../server/definition.js';
import { loadDictionary } from './words';

const EMPTY = {
    phase: 'lobby',
    mode: 'chill',
    seq: 0,
    hostId: null,
    players: [],
    currentLetter: '',
    activePlayerIdx: null,
    round: 1,
    maxRounds: 3,
    messages: [],
    usedWords: [],
    wordDefinition: null,
    turnTimeLimit: 30,
    timeLeft: 30,
};

const FEEDBACK_MS = 4500;

export default function useGame() {
    const roomRef = useRef(null);
    const dictRef = useRef(null);
    const feedbackTimer = useRef(null);
    const [snap, setSnap] = useState(EMPTY);
    const [ready, setReady] = useState(false);
    const [loadError, setLoadError] = useState(null);
    const [lobbyError, setLobbyError] = useState(null);
    const [feedback, setFeedback] = useState(null);

    useEffect(() => {
        // Rooms look words up through this thin wrapper so the list can finish loading after the room exists.
        const dictionary = {
            has: (w) => dictRef.current?.has(w) ?? false,
            nearMiss: (w, accept) => dictRef.current?.nearMiss(w, accept) ?? false,
        };
        const room = new Room({
            code: 'LOCAL',
            dictionary,
            fetchDefinition,
            handoff: true,
            minPlayers: 1,
            onChange: (r) => setSnap(r.state()),
            onTick: () => setSnap(room.state()),
        });
        roomRef.current = room;
        setSnap(room.state());

        let cancelled = false;
        loadDictionary()
            .then((d) => {
                if (cancelled) return;
                dictRef.current = d;
                setReady(true);
            })
            .catch(() => !cancelled && setLoadError("The word list didn't load. Check your connection and reload the page."));

        return () => {
            cancelled = true;
            clearTimeout(feedbackTimer.current);
            room.destroy();
            roomRef.current = null;
        };
    }, []);

    const usedWords = useMemo(() => new Set(snap.usedWords), [snap.usedWords]);

    const showFeedback = useCallback((res) => {
        clearTimeout(feedbackTimer.current);
        if (!res || res.ok) {
            setFeedback(null);
            return;
        }
        setFeedback({ id: Date.now(), kind: res.reason === 'near' ? 'hint' : 'error', text: res.message });
        feedbackTimer.current = setTimeout(() => setFeedback(null), FEEDBACK_MS);
    }, []);

    const host = () => roomRef.current?.hostId;

    const addPlayer = useCallback((name) => {
        const res = roomRef.current?.addPlayer(name);
        setLobbyError(res && !res.ok ? res.error : null);
    }, []);

    const removePlayer = useCallback((pid) => {
        roomRef.current?.removePlayer(pid);
        setLobbyError(null);
    }, []);

    const startGame = useCallback(() => {
        const res = roomRef.current?.start(host());
        setLobbyError(res && !res.ok ? res.error : null);
    }, []);

    const beginTurn = useCallback(() => roomRef.current?.beginTurn(), []);

    const submitWord = useCallback((word) => {
        const room = roomRef.current;
        if (!room) return { ok: false };
        const res = room.submit(room.activePid, word);
        showFeedback(res);
        return res;
    }, [showFeedback]);

    const nextRound = useCallback(() => roomRef.current?.nextRound(host()), []);
    const endGame = useCallback(() => roomRef.current?.endGame(host()), []);
    const playAgain = useCallback(() => roomRef.current?.reset(host()), []);

    return {
        // State (same shape as useOnlineGame)
        mode: 'chill',
        phase: snap.phase,
        players: snap.players,
        currentLetter: snap.currentLetter,
        activePlayerIdx: snap.activePlayerIdx,
        round: snap.round,
        maxRounds: snap.maxRounds,
        messages: snap.messages,
        timeLeft: snap.timeLeft,
        turnTimeLimit: snap.turnTimeLimit,
        usedWords,
        wordDefinition: snap.wordDefinition,
        seq: snap.seq,
        feedback,
        lockedUntil: 0,

        // Local-only
        ready,
        loadError,
        lobbyError,

        // Actions
        addPlayer,
        removePlayer,
        startGame,
        beginTurn,
        submitWord,
        nextRound,
        endGame,
        playAgain,
    };
}

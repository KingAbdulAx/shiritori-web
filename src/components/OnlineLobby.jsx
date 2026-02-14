import { useState, useRef, useEffect } from 'react';
import './OnlineLobby.css';

export default function OnlineLobby({
    roomCode,
    players,
    isHost,
    connectionStatus,
    error,
    onCreateRoom,
    onJoinRoom,
    onStartGame,
    onLeaveRoom,
    onClearError,
}) {
    const [view, setView] = useState('choice'); // choice | create | join | waiting
    const [name, setName] = useState('');
    const [joinCode, setJoinCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const nameInputRef = useRef(null);
    const codeInputRef = useRef(null);

    useEffect(() => {
        if (view === 'create') nameInputRef.current?.focus();
        if (view === 'join') codeInputRef.current?.focus();
    }, [view]);

    // Once we have a roomCode, we're in the waiting room
    useEffect(() => {
        if (roomCode) setView('waiting');
    }, [roomCode]);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setIsLoading(true);
        try {
            await onCreateRoom(name.trim());
        } catch {
            // error is set in hook
        } finally {
            setIsLoading(false);
        }
    };

    const handleJoin = async (e) => {
        e.preventDefault();
        if (!name.trim() || !joinCode.trim()) return;
        setIsLoading(true);
        try {
            await onJoinRoom(joinCode.trim(), name.trim());
        } catch {
            // error is set in hook
        } finally {
            setIsLoading(false);
        }
    };

    const copyCode = () => {
        navigator.clipboard?.writeText(roomCode);
    };

    const connectionDot = connectionStatus === 'connected'
        ? 'online-lobby__dot--connected'
        : connectionStatus === 'connecting'
            ? 'online-lobby__dot--connecting'
            : 'online-lobby__dot--disconnected';

    // ── Choice View ──────────────────────────────────────
    if (view === 'choice') {
        return (
            <div className="online-lobby animate-in">
                <div className="online-lobby__hero">
                    <div className="online-lobby__hero-icon">🌐</div>
                    <h2 className="online-lobby__hero-title">Online Multiplayer</h2>
                    <p className="online-lobby__hero-desc">Play with friends on different devices</p>
                </div>

                <div className="online-lobby__choices">
                    <button className="online-lobby__choice online-lobby__choice--create" onClick={() => { onClearError?.(); setView('create'); }} id="choice-create-btn">
                        <span className="online-lobby__choice-icon">✨</span>
                        <span className="online-lobby__choice-label">Create Room</span>
                        <span className="online-lobby__choice-desc">Start a new game room</span>
                    </button>

                    <button className="online-lobby__choice online-lobby__choice--join" onClick={() => { onClearError?.(); setView('join'); }} id="choice-join-btn">
                        <span className="online-lobby__choice-icon">🔗</span>
                        <span className="online-lobby__choice-label">Join Room</span>
                        <span className="online-lobby__choice-desc">Enter a room code</span>
                    </button>
                </div>

                <button className="online-lobby__back-btn" onClick={onLeaveRoom} id="back-to-home-btn">
                    ← Back to Home
                </button>
            </div>
        );
    }

    // ── Create View ──────────────────────────────────────
    if (view === 'create') {
        return (
            <div className="online-lobby animate-in">
                <div className="online-lobby__card">
                    <h2 className="online-lobby__card-title">Create Room</h2>
                    <form className="online-lobby__form" onSubmit={handleCreate}>
                        <input
                            ref={nameInputRef}
                            id="create-name-input"
                            className="online-lobby__input"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Your name..."
                            maxLength={20}
                            disabled={isLoading}
                        />
                        <button
                            type="submit"
                            className="online-lobby__submit-btn"
                            disabled={!name.trim() || isLoading}
                            id="create-room-btn"
                        >
                            {isLoading ? <span className="online-lobby__spinner" /> : 'Create Room'}
                        </button>
                    </form>
                    {error && <p className="online-lobby__error">{error}</p>}
                    <button className="online-lobby__back-link" onClick={() => { onClearError?.(); setView('choice'); }}>
                        ← Back
                    </button>
                </div>
            </div>
        );
    }

    // ── Join View ────────────────────────────────────────
    if (view === 'join') {
        return (
            <div className="online-lobby animate-in">
                <div className="online-lobby__card">
                    <h2 className="online-lobby__card-title">Join Room</h2>
                    <form className="online-lobby__form" onSubmit={handleJoin}>
                        <input
                            ref={codeInputRef}
                            id="join-code-input"
                            className="online-lobby__input online-lobby__input--code"
                            type="text"
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                            placeholder="Room code..."
                            maxLength={6}
                            disabled={isLoading}
                        />
                        <input
                            id="join-name-input"
                            className="online-lobby__input"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Your name..."
                            maxLength={20}
                            disabled={isLoading}
                        />
                        <button
                            type="submit"
                            className="online-lobby__submit-btn"
                            disabled={!name.trim() || !joinCode.trim() || isLoading}
                            id="join-room-btn"
                        >
                            {isLoading ? <span className="online-lobby__spinner" /> : 'Join Room'}
                        </button>
                    </form>
                    {error && <p className="online-lobby__error">{error}</p>}
                    <button className="online-lobby__back-link" onClick={() => { onClearError?.(); setView('choice'); }}>
                        ← Back
                    </button>
                </div>
            </div>
        );
    }

    // ── Waiting Room (after create/join) ─────────────────
    return (
        <div className="online-lobby animate-in">
            <div className="online-lobby__card">
                <div className="online-lobby__status-bar">
                    <span className={`online-lobby__dot ${connectionDot}`} />
                    <span className="online-lobby__status-text">
                        {connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
                    </span>
                </div>

                <h2 className="online-lobby__card-title">Room Lobby</h2>

                <div className="online-lobby__room-code-section">
                    <span className="online-lobby__room-code-label">Room Code</span>
                    <div className="online-lobby__room-code-display">
                        <span className="online-lobby__room-code" id="room-code-display">{roomCode}</span>
                        <button className="online-lobby__copy-btn" onClick={copyCode} title="Copy code" id="copy-code-btn">
                            📋
                        </button>
                    </div>
                    <p className="online-lobby__room-code-hint">Share this code with friends to join</p>
                </div>

                <div className="online-lobby__players">
                    <h3 className="online-lobby__players-title">
                        Players ({players.length}/8)
                    </h3>
                    <ul className="online-lobby__player-list">
                        {players.map((p, i) => (
                            <li key={p.id} className="online-lobby__player" style={{ animationDelay: `${i * 0.1}s` }}>
                                <div className="online-lobby__player-avatar" style={{ background: `hsl(${(i * 72) % 360}, 65%, 55%)` }}>
                                    {p.name[0].toUpperCase()}
                                </div>
                                <span className="online-lobby__player-name">{p.name}</span>
                                {i === 0 && <span className="online-lobby__host-badge">Host</span>}
                            </li>
                        ))}
                    </ul>
                </div>

                {error && <p className="online-lobby__error">{error}</p>}

                {isHost && (
                    <button
                        className="online-lobby__start-btn"
                        onClick={onStartGame}
                        disabled={players.length < 2}
                        id="online-start-btn"
                    >
                        <span className="online-lobby__start-btn-text">
                            {players.length < 2 ? 'Waiting for players...' : 'Start Game'}
                        </span>
                        {players.length >= 2 && <span className="online-lobby__start-btn-icon">→</span>}
                    </button>
                )}

                {!isHost && (
                    <div className="online-lobby__waiting-msg">
                        <span className="online-lobby__waiting-spinner" />
                        Waiting for host to start...
                    </div>
                )}

                <button className="online-lobby__leave-btn" onClick={onLeaveRoom} id="leave-room-btn">
                    Leave Room
                </button>
            </div>
        </div>
    );
}

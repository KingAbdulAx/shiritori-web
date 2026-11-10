import { useState, useRef, useEffect } from 'react';
import './OnlineLobby.css';

const sanitizeCode = (value) => (value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

// Drop ?room=CODE from the address bar once it has been used.
function clearRoomParam() {
    const url = new URL(window.location.href);
    if (url.searchParams.has('room')) {
        url.searchParams.delete('room');
        window.history.replaceState({}, '', url);
    }
}

export default function OnlineLobby({
    roomCode,
    players,
    isHost,
    connectionStatus,
    error,
    initialCode = '',
    onCreateRoom,
    onJoinRoom,
    onStartGame,
    onLeaveRoom,
    onClearError,
}) {
    // choice | create | join. The waiting room is derived from roomCode below.
    const [view, setView] = useState(initialCode ? 'join' : 'choice');
    const [name, setName] = useState('');
    const [joinCode, setJoinCode] = useState(sanitizeCode(initialCode));
    const [isLoading, setIsLoading] = useState(false);
    const [copied, setCopied] = useState(''); // '' | 'code' | 'link'
    const nameInputRef = useRef(null);
    const codeInputRef = useRef(null);

    // Once we have a roomCode we are in the waiting room; if it goes away we fall back to the form.
    const activeView = roomCode ? 'waiting' : view;

    useEffect(() => {
        if (view === 'create') nameInputRef.current?.focus();
        if (view === 'join') codeInputRef.current?.focus();
    }, [view]);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setIsLoading(true);
        try {
            await onCreateRoom(name.trim());
            clearRoomParam();
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
            clearRoomParam();
        } catch {
            // error is set in hook
        } finally {
            setIsLoading(false);
        }
    };

    const flashCopied = (what) => {
        setCopied(what);
        setTimeout(() => setCopied(''), 1800);
    };

    const copyText = async (text, what) => {
        try {
            await navigator.clipboard.writeText(text);
            flashCopied(what);
        } catch {
            // clipboard unavailable (insecure context or permission denied)
        }
    };

    const copyCode = () => copyText(roomCode, 'code');

    // One tap on a phone opens the native share sheet (WhatsApp etc.); desktop copies the link.
    const shareLink = async () => {
        const url = `${window.location.origin}${import.meta.env.BASE_URL}?room=${roomCode}`;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'English Shiritori',
                    text: `Join my Shiritori room ${roomCode}`,
                    url,
                });
                return;
            } catch (e) {
                if (e?.name === 'AbortError') return; // user closed the share sheet
            }
        }
        copyText(url, 'link');
    };

    const statusLabel = connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'connecting' ? 'Connecting…' : 'Disconnected';
    const statusClass = connectionStatus === 'connected'
        ? 'online-lobby__dot--connected'
        : connectionStatus === 'connecting'
            ? 'online-lobby__dot--connecting'
            : 'online-lobby__dot--disconnected';

    const backToChoice = () => { onClearError?.(); setView('choice'); };

    // ── Choice View ──────────────────────────────────────
    if (activeView === 'choice') {
        return (
            <div className="online-lobby animate-in">
                <h2 className="online-lobby__title">Play online</h2>
                <p className="online-lobby__lead">Start a room and share its link, or join a friend’s room with their code.</p>

                <div className="online-lobby__choices">
                    <button className="btn btn--primary online-lobby__choice" onClick={() => { onClearError?.(); setView('create'); }} id="choice-create-btn">
                        <span className="online-lobby__choice-label">Create a room</span>
                        <span className="online-lobby__choice-desc">You host and start the game.</span>
                    </button>

                    <button className="btn online-lobby__choice" onClick={() => { onClearError?.(); setView('join'); }} id="choice-join-btn">
                        <span className="online-lobby__choice-label">Join a room</span>
                        <span className="online-lobby__choice-desc">Enter the 6-letter code.</span>
                    </button>
                </div>

                <button className="btn btn--quiet online-lobby__back" onClick={onLeaveRoom} id="back-to-home-btn">
                    Back to home
                </button>
            </div>
        );
    }

    // ── Create View ──────────────────────────────────────
    if (activeView === 'create') {
        return (
            <div className="online-lobby animate-in">
                <h2 className="online-lobby__title">Create a room</h2>
                <form className="online-lobby__form" onSubmit={handleCreate}>
                    <label className="visually-hidden" htmlFor="create-name-input">Your name</label>
                    <input
                        ref={nameInputRef}
                        id="create-name-input"
                        className="field"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name"
                        maxLength={20}
                        autoComplete="off"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        className="btn btn--primary"
                        disabled={!name.trim() || isLoading}
                        id="create-room-btn"
                    >
                        {isLoading ? <span className="spinner" aria-label="Creating room" /> : 'Create room'}
                    </button>
                </form>
                {error && <p className="notice notice--error" role="alert">{error}</p>}
                <button className="btn btn--quiet online-lobby__back" onClick={backToChoice}>
                    Back
                </button>
            </div>
        );
    }

    // ── Join View ────────────────────────────────────────
    if (activeView === 'join') {
        return (
            <div className="online-lobby animate-in">
                <h2 className="online-lobby__title">Join a room</h2>
                <form className="online-lobby__form" onSubmit={handleJoin}>
                    <label className="visually-hidden" htmlFor="join-code-input">Room code</label>
                    <input
                        ref={codeInputRef}
                        id="join-code-input"
                        className="field online-lobby__code-input"
                        type="text"
                        value={joinCode}
                        onChange={(e) => setJoinCode(sanitizeCode(e.target.value))}
                        placeholder="Room code"
                        maxLength={6}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="characters"
                        spellCheck={false}
                        disabled={isLoading}
                    />
                    <label className="visually-hidden" htmlFor="join-name-input">Your name</label>
                    <input
                        id="join-name-input"
                        className="field"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name"
                        maxLength={20}
                        autoComplete="off"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        className="btn btn--primary"
                        disabled={!name.trim() || !joinCode.trim() || isLoading}
                        id="join-room-btn"
                    >
                        {isLoading ? <span className="spinner" aria-label="Joining room" /> : 'Join room'}
                    </button>
                </form>
                {error && <p className="notice notice--error" role="alert">{error}</p>}
                <button className="btn btn--quiet online-lobby__back" onClick={backToChoice}>
                    Back
                </button>
            </div>
        );
    }

    // ── Waiting Room (after create/join) ─────────────────
    return (
        <div className="online-lobby online-lobby--room animate-in">
            <h2 className="online-lobby__title">Waiting room</h2>

            <p className="online-lobby__status" role="status">
                <span className={`online-lobby__dot ${statusClass}`} />
                {statusLabel}
            </p>

            <section className="online-lobby__invite" aria-label="Invite friends">
                <p className="online-lobby__invite-label">Room code</p>
                <div className="online-lobby__code" id="room-code-display" aria-label={`Room code ${roomCode}`}>
                    {roomCode.split('').map((ch, i) => (
                        <span key={i} className="tile tile--slate online-lobby__code-tile" aria-hidden="true">{ch}</span>
                    ))}
                </div>
                <div className="online-lobby__invite-actions">
                    <button className="btn btn--primary" onClick={shareLink} id="share-link-btn">
                        {copied === 'link' ? 'Link copied' : 'Share invite link'}
                    </button>
                    <button className="btn" onClick={copyCode} id="copy-code-btn">
                        {copied === 'code' ? 'Code copied' : 'Copy code'}
                    </button>
                </div>
            </section>

            <section aria-label="Players">
                <h3 className="online-lobby__players-title">Players ({players.length} of 8)</h3>
                <ul className="roster">
                    {players.map((p, i) => (
                        <li key={p.id} className="roster__row">
                            <span className="tile tile--sm roster__avatar" aria-hidden="true">{p.name[0]}</span>
                            <span className="roster__name">{p.name}</span>
                            {i === 0 && <span className="badge">Host</span>}
                        </li>
                    ))}
                </ul>
            </section>

            {error && <p className="notice notice--error" role="alert">{error}</p>}

            {isHost ? (
                <button
                    className="btn btn--primary online-lobby__start-btn"
                    onClick={onStartGame}
                    disabled={players.length < 2}
                    id="online-start-btn"
                >
                    {players.length < 2 ? 'Waiting for players…' : 'Start game'}
                </button>
            ) : (
                <p className="online-lobby__waiting-msg">
                    <span className="spinner" aria-hidden="true" />
                    Waiting for host to start...
                </p>
            )}

            <button className="btn btn--quiet online-lobby__back" onClick={onLeaveRoom} id="leave-room-btn">
                Leave room
            </button>
        </div>
    );
}

import { useState, useRef, useEffect } from 'react';
import './GameBoard.css';

export default function GameBoard({
    mode,
    players,
    currentLetter,
    activePlayerIdx,
    phase,
    timeLeft,
    turnTimeLimit,
    usedWords,
    wordDefinition,
    feedback,
    lockedUntil = 0,
    onBeginTurn,
    onSubmitWord,
    onEndGame,
    // Online-specific props (optional)
    isOnline = false,
    myPlayerId = null,
}) {
    const [wordInput, setWordInput] = useState('');
    const [sending, setSending] = useState(false);
    const [now, setNow] = useState(() => Date.now());
    const inputRef = useRef(null);

    const isRace = phase === 'race';
    const isTurn = phase === 'turn';
    const isHandoff = phase === 'handoff';

    const activePlayer = activePlayerIdx !== null ? players[activePlayerIdx] : null;
    const me = isOnline ? players.find((p) => p.id === myPlayerId) || null : activePlayer;
    const isMyTurn = isOnline ? !!me && !!activePlayer && activePlayer.id === me.id : true;

    // Who can type right now: everyone in a Rush race, the active player in Chill.
    const canType = isRace ? !!me : isTurn && isMyTurn;
    const lockMs = Math.max(0, lockedUntil - now);
    const locked = lockMs > 0;

    // Tick while a lockout is running so the button re-enables itself.
    useEffect(() => {
        if (lockedUntil <= Date.now()) return undefined;
        const tick = () => setNow(Date.now());
        const first = setTimeout(tick, 0); // sync the clock right away, then keep counting
        const id = setInterval(tick, 200);
        return () => {
            clearTimeout(first);
            clearInterval(id);
        };
    }, [lockedUntil]);

    useEffect(() => {
        if (canType) inputRef.current?.focus();
    }, [canType, currentLetter, phase, activePlayerIdx]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const word = wordInput.trim();
        if (!word || sending || locked) return;
        setSending(true);
        setNow(Date.now());
        try {
            const res = await onSubmitWord(word);
            if (res?.ok) setWordInput('');
        } finally {
            setSending(false);
            inputRef.current?.focus();
        }
    };

    const progressPercent = turnTimeLimit ? (timeLeft / turnTimeLimit) * 100 : 0;
    const timerClass =
        timeLeft <= 5 ? 'timer--danger' :
            timeLeft <= 15 && isTurn ? 'timer--warning' : '';

    const letter = currentLetter.toUpperCase();
    const handLetters = me ? me.letters : [];

    let hint = '';
    if (isHandoff) {
        hint = `The next word starts with ${letter}.`;
    } else if (isRace) {
        hint = 'Be first. Start with this letter and end on one of yours.';
    } else if (isTurn) {
        hint = isOnline && !isMyTurn
            ? `The next word starts with ${letter}.`
            : `Start your word with ${letter}.`;
    }

    const timerLabel = isRace ? `New letter in ${timeLeft}s` : `${timeLeft}s`;

    return (
        <div className="game animate-in">
            <div className="game__main">
                {/* ── Starting letter + clock ─────────────── */}
                <section className="game__letter-row" aria-label="Starting letter">
                    <span key={currentLetter} className="tile tile--slate game__current-letter">{letter}</span>

                    <div className="game__letter-side">
                        <p className="game__current-letter-hint">{hint}</p>

                        {(isTurn || isRace) && (
                            <div className={`game__timer ${isRace ? 'game__timer--race' : ''} ${timerClass}`} role="timer" aria-label={isRace ? `New starting letter in ${timeLeft} seconds` : `${timeLeft} seconds left`}>
                                <span className="game__timer-text">{timerLabel}</span>
                                <div className="game__timer-bar">
                                    <div
                                        className="game__timer-fill"
                                        style={{ width: `${progressPercent}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* ── Pass-and-play handoff ───────────────── */}
                {isHandoff && activePlayer && (
                    <section className="game__handoff" aria-label="Next player">
                        <p className="game__handoff-label">Pass to</p>
                        <p className="game__handoff-name">{activePlayer.name}</p>
                        <button className="btn btn--primary game__handoff-btn" onClick={onBeginTurn} id="start-turn-btn">
                            Start turn
                        </button>
                    </section>
                )}

                {/* ── Turn or race: whose go, and the input ── */}
                {(isTurn || isRace) && (activePlayer || isRace) && (
                    <section className="game__turn-area" aria-label={isRace ? 'Race' : 'Current turn'}>
                        <p className="game__turn-player">
                            {isRace ? (
                                <span className="game__turn-player-label">Everyone plays at once</span>
                            ) : (
                                <>
                                    <span className="game__turn-player-label">{isOnline && isMyTurn ? 'Your turn' : 'Playing'}</span>
                                    {!(isOnline && isMyTurn) && (
                                        <span className="game__turn-player-name">{activePlayer.name}</span>
                                    )}
                                </>
                            )}
                        </p>

                        {canType ? (
                            <form className="game__word-form" onSubmit={handleSubmit}>
                                <div className="game__input-wrap">
                                    <span className="game__input-prefix" aria-hidden="true">{letter}</span>
                                    <label className="visually-hidden" htmlFor="word-input">Your word, starting with {letter}</label>
                                    <input
                                        ref={inputRef}
                                        id="word-input"
                                        className="game__word-input"
                                        type="text"
                                        value={wordInput}
                                        onChange={(e) => setWordInput(e.target.value)}
                                        placeholder="Type your word"
                                        autoComplete="off"
                                        autoCorrect="off"
                                        autoCapitalize="none"
                                        spellCheck={false}
                                        enterKeyHint="send"
                                        autoFocus
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="btn btn--primary game__submit-btn"
                                    disabled={!wordInput.trim() || sending || locked}
                                    id="submit-word-btn"
                                >
                                    {sending ? <span className="spinner" aria-label="Checking word" /> :
                                        locked ? `Wait ${Math.ceil(lockMs / 1000)}s` : 'Submit'}
                                </button>
                            </form>
                        ) : (
                            <p className="game__waiting-turn">
                                <span className="spinner" aria-hidden="true" />
                                <span>{activePlayer ? `Waiting for ${activePlayer.name} to play...` : 'Waiting...'}</span>
                            </p>
                        )}

                        <p
                            className={`game__feedback ${feedback ? `game__feedback--${feedback.kind}` : ''}`}
                            role="status"
                            aria-live="polite"
                        >
                            {feedback?.text || ''}
                        </p>

                        {canType && me && (
                            <div className="game__your-letters">
                                <span className="game__your-letters-label">Your word must end with one of</span>
                                <div className="game__your-letters-chips">
                                    {handLetters.map((l, i) => (
                                        <span key={i} className="tile game__letter-chip">{l}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>
                )}

                {/* ── Word definition ─────────────────────── */}
                {wordDefinition && (
                    <section className="game__definition animate-in" aria-label="Definition">
                        <p className="game__definition-head">
                            <span className="game__definition-word">{wordDefinition.word}</span>
                            {wordDefinition.partOfSpeech && (
                                <span className="game__definition-pos">{wordDefinition.partOfSpeech}</span>
                            )}
                        </p>
                        {wordDefinition.definition && (
                            <p className="game__definition-text">{wordDefinition.definition}</p>
                        )}
                    </section>
                )}

                {/* ── The chain so far ────────────────────── */}
                {usedWords.size > 0 && (
                    <section className="game__used-words" aria-label="Words played">
                        <h3 className="game__used-words-label">The chain so far</h3>
                        <ol className="game__used-words-list">
                            {[...usedWords].map((w, i) => (
                                <li key={i} className="game__used-word">
                                    {w.slice(0, -1)}<span className="game__used-word-link">{w.slice(-1)}</span>
                                </li>
                            ))}
                        </ol>
                    </section>
                )}
            </div>

            {/* ── Players ─────────────────────────────── */}
            <aside className="game__aside" aria-label="Players">
                <h3 className="game__players-title">
                    Players{mode === 'rush' && <span className="game__mode-tag">Rush</span>}
                </h3>
                <ul className="game__players roster">
                    {players.map((p, i) => {
                        const isActive = activePlayerIdx === i && (isTurn || isHandoff);
                        const isMe = isOnline && p.id === myPlayerId;
                        const away = p.connected === false;

                        return (
                            <li
                                key={p.id}
                                className={`game__player-card ${isActive ? 'game__player-card--active' : ''} ${isMe ? 'game__player-card--me' : ''} ${away ? 'game__player-card--away' : ''}`}
                            >
                                <div className="game__player-card-header">
                                    <span className="tile tile--sm roster__avatar" aria-hidden="true">{p.name[0]}</span>
                                    <span className="game__player-card-name">
                                        <span className="roster__name">{p.name}</span>
                                        {isMe && <span className="badge">You</span>}
                                        {isActive && isTurn && <span className="badge badge--slate">Playing</span>}
                                        {away && <span className="badge">Away</span>}
                                    </span>
                                    <span className="game__player-card-score">{p.score} {p.score === 1 ? 'pt' : 'pts'}</span>
                                </div>

                                <div className="game__player-card-letters" aria-label={`${p.name}'s letters`}>
                                    {p.letters.map((l, li) => (
                                        <span key={li} className="tile tile--sm game__player-letter">{l}</span>
                                    ))}
                                    {p.letters.length === 0 && (
                                        <span className="game__player-cleared">Hand cleared</span>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>

                {onEndGame && (
                    <div className="game__footer">
                        <button className="btn btn--quiet game__end-btn" onClick={onEndGame} id="end-game-btn">
                            End game early
                        </button>
                    </div>
                )}
            </aside>
        </div>
    );
}

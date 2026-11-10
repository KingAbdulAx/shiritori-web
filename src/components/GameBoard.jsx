import { useState, useRef, useEffect } from 'react';
import './GameBoard.css';

export default function GameBoard({
    players,
    currentLetter,
    activePlayerIdx,
    phase,
    timeLeft,
    turnTimeLimit,
    usedWords,
    isValidating,
    wordDefinition,
    onTakeTurn,
    onSubmitWord,
    onAddExtraLetter,
    onEndGame,
    // Online-specific props (optional)
    isOnline = false,
    myPlayerId = null,
}) {
    const [wordInput, setWordInput] = useState('');
    const inputRef = useRef(null);
    const progressPercent = (timeLeft / turnTimeLimit) * 100;

    // In online mode, find my player index
    const myPlayerIdx = isOnline
        ? players.findIndex(p => p.id === myPlayerId)
        : null;

    // Am I the active player? (online mode)
    const isMyTurn = isOnline
        ? activePlayerIdx !== null && myPlayerIdx === activePlayerIdx
        : true; // In local mode, whoever clicked "Play" is active

    useEffect(() => {
        if (phase === 'turn' && (isMyTurn || !isOnline)) {
            inputRef.current?.focus();
        }
    }, [phase, isMyTurn, isOnline]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (wordInput.trim()) {
            onSubmitWord(wordInput);
            setWordInput('');
        }
    };

    const timerClass =
        timeLeft <= 5 ? 'timer--danger' :
            timeLeft <= 15 ? 'timer--warning' : '';

    const activePlayer = activePlayerIdx !== null ? players[activePlayerIdx] : null;
    const letter = currentLetter.toUpperCase();

    let hint = 'Press Play on your row to take a turn.';
    if (phase === 'turn') {
        hint = isOnline && !isMyTurn
            ? `The next word starts with ${letter}.`
            : `Start your word with ${letter}.`;
    }

    return (
        <div className="game animate-in">
            <div className="game__main">
                {/* ── Starting letter + clock ─────────────── */}
                <section className="game__letter-row" aria-label="Starting letter">
                    <span key={currentLetter} className="tile tile--slate game__current-letter">{letter}</span>

                    <div className="game__letter-side">
                        <p className="game__current-letter-hint">{hint}</p>

                        {phase === 'turn' && (
                            <div className={`game__timer ${timerClass}`} role="timer" aria-label={`${timeLeft} seconds left`}>
                                <span className="game__timer-text">{timeLeft}s</span>
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

                {/* ── Turn: whose go, and the input ───────── */}
                {phase === 'turn' && activePlayer && (
                    <section className="game__turn-area" aria-label="Current turn">
                        <p className="game__turn-player">
                            <span className="game__turn-player-label">{isOnline && isMyTurn ? 'Your turn' : 'Playing'}</span>
                            {!(isOnline && isMyTurn) && (
                                <span className="game__turn-player-name">{activePlayer.name}</span>
                            )}
                        </p>

                        {(!isOnline || isMyTurn) ? (
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
                                        disabled={isValidating}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="btn btn--primary game__submit-btn"
                                    disabled={!wordInput.trim() || isValidating}
                                    id="submit-word-btn"
                                >
                                    {isValidating ? <span className="spinner" aria-label="Checking word" /> : 'Submit'}
                                </button>
                            </form>
                        ) : (
                            <p className="game__waiting-turn">
                                <span className="spinner" aria-hidden="true" />
                                <span>Waiting for {activePlayer.name} to play...</span>
                            </p>
                        )}

                        {(!isOnline || isMyTurn) && (
                            <div className="game__your-letters">
                                <span className="game__your-letters-label">Your word must end with one of</span>
                                <div className="game__your-letters-chips">
                                    {activePlayer.letters.map((l, i) => (
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
                <h3 className="game__players-title">Players</h3>
                <ul className="game__players roster">
                    {players.map((p, i) => {
                        const isActive = activePlayerIdx === i && phase === 'turn';
                        const canPlay = phase === 'playing';
                        const isMe = isOnline && p.id === myPlayerId;

                        // In online mode, only show "Play" button for the current user
                        const showPlayBtn = isOnline ? (canPlay && isMe) : canPlay;
                        // In online mode, hide draw button (no addExtraLetter in online)
                        const showDrawBtn = !isOnline && (phase === 'playing' || phase === 'turn');

                        return (
                            <li
                                key={p.id || p.name}
                                className={`game__player-card ${isActive ? 'game__player-card--active' : ''} ${isMe ? 'game__player-card--me' : ''}`}
                            >
                                <div className="game__player-card-header">
                                    <span className="tile tile--sm roster__avatar" aria-hidden="true">{p.name[0]}</span>
                                    <span className="game__player-card-name">
                                        <span className="roster__name">{p.name}</span>
                                        {isMe && <span className="badge">You</span>}
                                        {isActive && <span className="badge badge--slate">Playing</span>}
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

                                {(showPlayBtn || showDrawBtn) && (
                                    <div className="game__player-card-actions">
                                        {showPlayBtn && (
                                            <button
                                                className="btn btn--primary game__play-btn"
                                                onClick={() => onTakeTurn(isOnline ? undefined : i)}
                                                id={`play-btn-${i}`}
                                            >
                                                Play
                                            </button>
                                        )}
                                        {showDrawBtn && (
                                            <button
                                                className="btn game__draw-btn"
                                                onClick={() => onAddExtraLetter(i)}
                                                id={`draw-btn-${i}`}
                                            >
                                                Draw a letter
                                            </button>
                                        )}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>

                {(phase === 'playing' || phase === 'turn') && (
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

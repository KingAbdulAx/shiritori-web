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

    return (
        <div className="game animate-in">
            {/* ── Current Letter Display ──────────────── */}
            <div className="game__current-letter-section">
                <div className="game__current-letter-label">Current Letter</div>
                <div className="game__current-letter-display">
                    <span className="game__current-letter">{currentLetter.toUpperCase()}</span>
                </div>
                <p className="game__current-letter-hint">
                    Your word must <strong>start</strong> with this letter
                </p>
            </div>

            {/* ── Timer (during turn) ─────────────────── */}
            {phase === 'turn' && (
                <div className={`game__timer ${timerClass}`}>
                    <div className="game__timer-bar">
                        <div
                            className="game__timer-fill"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                    <span className="game__timer-text">{timeLeft}s</span>
                </div>
            )}

            {/* ── Word Input (during turn) ───────────── */}
            {phase === 'turn' && activePlayerIdx !== null && (
                <div className="game__turn-area">
                    <div className="game__turn-player">
                        <span className="game__turn-player-label">{isOnline && isMyTurn ? 'Your turn!' : 'Playing:'}</span>
                        <span className="game__turn-player-name">{players[activePlayerIdx]?.name}</span>
                    </div>

                    {/* Show input only for the active player (online) or always (local) */}
                    {(!isOnline || isMyTurn) ? (
                        <form className="game__word-form" onSubmit={handleSubmit}>
                            <div className="game__input-wrap">
                                <span className="game__input-prefix">{currentLetter.toUpperCase()}</span>
                                <input
                                    ref={inputRef}
                                    id="word-input"
                                    className="game__word-input"
                                    type="text"
                                    value={wordInput}
                                    onChange={(e) => setWordInput(e.target.value)}
                                    placeholder="Type your word..."
                                    autoComplete="off"
                                    autoFocus
                                    disabled={isValidating}
                                />
                            </div>
                            <button
                                type="submit"
                                className="game__submit-btn"
                                disabled={!wordInput.trim() || isValidating}
                                id="submit-word-btn"
                            >
                                {isValidating ? (
                                    <span className="game__spinner" />
                                ) : (
                                    'Submit'
                                )}
                            </button>
                        </form>
                    ) : (
                        <div className="game__waiting-turn">
                            <span className="game__waiting-spinner" />
                            <span>Waiting for {players[activePlayerIdx]?.name} to play...</span>
                        </div>
                    )}

                    {/* Show active player's letters */}
                    {players[activePlayerIdx] && (!isOnline || isMyTurn) && (
                        <div className="game__your-letters">
                            <span className="game__your-letters-label">Your ending letters:</span>
                            <div className="game__your-letters-chips">
                                {players[activePlayerIdx].letters.map((l, i) => (
                                    <span key={i} className="game__letter-chip">{l.toUpperCase()}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Word Definition Pop ────────────────── */}
            {wordDefinition && (
                <div className="game__definition animate-in">
                    <div className="game__definition-word">{wordDefinition.word.toUpperCase()}</div>
                    {wordDefinition.partOfSpeech && (
                        <span className="game__definition-pos">{wordDefinition.partOfSpeech}</span>
                    )}
                    {wordDefinition.definition && (
                        <p className="game__definition-text">{wordDefinition.definition}</p>
                    )}
                </div>
            )}

            {/* ── Used Words ─────────────────────────── */}
            {usedWords.size > 0 && (
                <div className="game__used-words">
                    <span className="game__used-words-label">Used words:</span>
                    <div className="game__used-words-list">
                        {[...usedWords].map((w, i) => (
                            <span key={i} className="game__used-word">{w}</span>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Player Cards ───────────────────────── */}
            <div className="game__players">
                {players.map((p, i) => {
                    const isActive = activePlayerIdx === i && phase === 'turn';
                    const canPlay = phase === 'playing';
                    const isMe = isOnline && p.id === myPlayerId;

                    // In online mode, only show "Play" button for the current user
                    const showPlayBtn = isOnline ? (canPlay && isMe) : canPlay;
                    // In online mode, hide draw button (no addExtraLetter in online)
                    const showDrawBtn = !isOnline && (phase === 'playing' || phase === 'turn');

                    return (
                        <div
                            key={p.id || p.name}
                            className={`game__player-card ${isActive ? 'game__player-card--active' : ''} ${isMe ? 'game__player-card--me' : ''}`}
                        >
                            <div className="game__player-card-header">
                                <div className="game__player-card-avatar" style={{ background: `hsl(${(i * 72) % 360}, 65%, 55%)` }}>
                                    {p.name[0].toUpperCase()}
                                </div>
                                <div className="game__player-card-info">
                                    <span className="game__player-card-name">
                                        {p.name}
                                        {isMe && <span className="game__you-badge">You</span>}
                                    </span>
                                    <span className="game__player-card-score">Score: {p.score}</span>
                                </div>
                                {isActive && <span className="game__player-card-badge">Playing</span>}
                            </div>
                            <div className="game__player-card-letters">
                                {p.letters.map((l, li) => (
                                    <span key={li} className="game__player-letter" style={{ animationDelay: `${li * 0.05}s` }}>
                                        {l.toUpperCase()}
                                    </span>
                                ))}
                                {p.letters.length === 0 && (
                                    <span className="game__player-cleared">🏆 Cleared!</span>
                                )}
                            </div>
                            <div className="game__player-card-actions">
                                {showPlayBtn && (
                                    <button
                                        className="game__play-btn"
                                        onClick={() => onTakeTurn(isOnline ? undefined : i)}
                                        id={`play-btn-${i}`}
                                    >
                                        ▶ Play
                                    </button>
                                )}
                                {showDrawBtn && (
                                    <button
                                        className="game__draw-btn"
                                        onClick={() => onAddExtraLetter(i)}
                                        id={`draw-btn-${i}`}
                                    >
                                        + Draw
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── End Game Button ─────────────────────── */}
            {(phase === 'playing' || phase === 'turn') && (
                <div className="game__footer">
                    <button className="game__end-btn" onClick={onEndGame} id="end-game-btn">
                        End Game Early
                    </button>
                </div>
            )}
        </div>
    );
}

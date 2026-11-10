import { useState, useRef, useEffect } from 'react';
import './GameBoard.css';

const HELP = {
    chill: [
        'You have a few letters. Your word has to end with one of them.',
        'The big letter is how your word must start.',
        'A word that works uses up that letter. Use up all your letters first to win the round.',
        'You take turns. Run out of time or use a word that does not exist and you get an extra letter.',
    ],
    rush: [
        'You have a few letters. Your word has to end with one of them.',
        'The big letter is how your word must start.',
        'Everyone plays at once. The first valid word takes the letter and uses it up.',
        'Use up all your letters first to win the round. A wrong word only locks you out for a moment.',
    ],
};

// Plain-language check of the word being typed, so the rules teach themselves.
function liveGuide(word, letter, hand, usedWords) {
    const w = word.trim().toLowerCase();
    if (!w) return null;
    if (w[0] !== letter) return { kind: 'warn', text: `It has to start with ${letter.toUpperCase()}.` };
    if (w.length < 3) return { kind: 'warn', text: 'Use at least 3 letters.' };
    const last = w.at(-1);
    if (!hand.includes(last)) {
        return { kind: 'warn', text: `It ends in ${last.toUpperCase()}, which isn't one of your letters.` };
    }
    if (usedWords.has(w)) return { kind: 'warn', text: 'That word has already been played.' };
    return { kind: 'good', text: `Ends in ${last.toUpperCase()}. That letter leaves your hand.`, last };
}

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
    const [dismissedFeedback, setDismissedFeedback] = useState(null);
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

    const handleChange = (e) => {
        setWordInput(e.target.value);
        if (feedback) setDismissedFeedback(feedback.id); // typing clears the last verdict
    };

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

    // The hand shown big is yours (online) or the player whose turn it is (one device).
    const myHand = isHandoff ? [] : me ? me.letters : [];
    const bigHandOwner = isHandoff ? null : me;
    const guide = canType ? liveGuide(wordInput, currentLetter, myHand, usedWords) : null;
    const shownFeedback = feedback && feedback.id !== dismissedFeedback ? feedback : null;
    const hit = guide?.kind === 'good' ? myHand.indexOf(guide.last) : -1;

    // One sentence that says what to do right now.
    let headline = '';
    let sub = '';
    if (isRace) {
        headline = 'Go!';
        sub = `Be first. Type a word that starts with ${letter} and ends with one of your letters.`;
    } else if (isTurn && canType) {
        headline = isOnline ? 'Your turn' : `${activePlayer.name}'s turn`;
        sub = `Type a word that starts with ${letter} and ends with one of your letters.`;
    } else if (isTurn && activePlayer) {
        headline = `Waiting for ${activePlayer.name} to play...`;
        sub = `The next word starts with ${letter}.`;
    } else if (isHandoff && activePlayer) {
        headline = 'Pass the device';
        sub = `The next word starts with ${letter}.`;
    }

    const timerLabel = isRace ? `New letter in ${timeLeft}s` : `${timeLeft}s`;
    const renderPlayer = (p, i) => {
        const you = isOnline && p.id === myPlayerId;
        const handShownBig = p.id === bigHandOwner?.id;
        const isActive = activePlayerIdx === i && (isTurn || isHandoff);
        const away = p.connected === false;
        return (
            <li
                key={p.id}
                className={`game__player-card ${isActive ? 'game__player-card--active' : ''} ${you ? 'game__player-card--me' : ''} ${away ? 'game__player-card--away' : ''}`}
            >
                <span className="game__player-card-name">
                    <span className="roster__name">{p.name}</span>
                    {you && <span className="badge">You</span>}
                    {isActive && isTurn && !you && <span className="badge badge--slate">Playing</span>}
                    {away && <span className="badge">Away</span>}
                </span>
                <span className="game__player-card-stats">
                    <span className="game__player-left">
                        {p.letters.length === 0 ? 'Hand cleared' : `${p.letters.length} left`}
                    </span>
                    <span className="game__player-card-score">{p.score} {p.score === 1 ? 'pt' : 'pts'}</span>
                </span>
                {!handShownBig && p.letters.length > 0 && (
                    <span className="game__player-letters" aria-label={`${p.name}'s letters`}>
                        {p.letters.join(' ')}
                    </span>
                )}
            </li>
        );
    };

    return (
        <div className="game animate-in">
            {/* ── What to do right now ───────────────────── */}
            <div className="game__focus">
                <section className="game__letter-row" aria-label="Starting letter">
                    <span key={currentLetter} className="tile tile--slate game__current-letter">{letter}</span>

                    <div className="game__letter-side">
                        <h2 className="game__headline">{headline}</h2>
                        <p className="game__current-letter-hint">{sub}</p>

                        {(isTurn || isRace) && (
                            <div className={`game__timer ${isRace ? 'game__timer--race' : ''} ${timerClass}`} role="timer" aria-label={isRace ? `New starting letter in ${timeLeft} seconds` : `${timeLeft} seconds left`}>
                                <span className="game__timer-text">{timerLabel}</span>
                                <div className="game__timer-bar">
                                    <div className="game__timer-fill" style={{ width: `${progressPercent}%` }} />
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* Pass-and-play handoff */}
                {isHandoff && activePlayer && (
                    <section className="game__handoff" aria-label="Next player">
                        <p className="game__handoff-label">Pass to</p>
                        <p className="game__handoff-name">{activePlayer.name}</p>
                        <button className="btn btn--primary game__handoff-btn" onClick={onBeginTurn} id="start-turn-btn">
                            Start turn
                        </button>
                    </section>
                )}

                {/* The one thing to do: type a word */}
                {canType && (
                    <section className="game__turn-area" aria-label={isRace ? 'Race' : 'Your word'}>
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
                                    onChange={handleChange}
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

                        {shownFeedback ? (
                            <p className={`game__feedback game__feedback--${shownFeedback.kind}`} role="status" aria-live="polite">
                                {shownFeedback.text}
                            </p>
                        ) : (
                            <p className={`game__guide ${guide ? `game__guide--${guide.kind}` : ''}`} role="status" aria-live="polite">
                                {guide?.text || ''}
                            </p>
                        )}
                    </section>
                )}

                {/* Your letters: big, because they decide how your word ends */}
                {bigHandOwner && (
                    <section className="game__your-letters" aria-label="Your letters">
                        <h3 className="game__your-letters-label">
                            {isOnline ? 'Your letters' : `${bigHandOwner.name}'s letters`}
                            <span className="game__your-letters-note"> End your word with one of these</span>
                        </h3>
                        <div className="game__your-letters-chips">
                            {myHand.map((l, i) => (
                                <span key={i} className={`tile game__letter-chip ${i === hit ? 'tile--link' : ''}`}>{l}</span>
                            ))}
                            {myHand.length === 0 && <span className="game__player-cleared">Hand cleared</span>}
                        </div>
                    </section>
                )}
            </div>

            {/* ── Everyone else: quiet, compact ──────────── */}
            <aside className="game__aside" aria-label="Players">
                <h3 className="game__players-title">
                    Players{mode === 'rush' && <span className="game__mode-tag">Rush</span>}
                </h3>
                <ul className="game__players roster">
                    {players.map(renderPlayer)}
                </ul>

                {onEndGame && (
                    <div className="game__footer">
                        <button className="btn btn--quiet game__end-btn" onClick={onEndGame} id="end-game-btn">
                            End game early
                        </button>
                    </div>
                )}
            </aside>

            {/* ── Reference: definition, chain, help ─────── */}
            <div className="game__more">
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

                <details className="game__help">
                    <summary>How does this work?</summary>
                    <ul>
                        {(HELP[mode] || HELP.chill).map((line) => <li key={line}>{line}</li>)}
                    </ul>
                </details>
            </div>
        </div>
    );
}

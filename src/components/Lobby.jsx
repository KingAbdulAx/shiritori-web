import { useState, useRef, useEffect } from 'react';
import './Lobby.css';

export default function Lobby({ players, onAddPlayer, onRemovePlayer, onStart }) {
    const [name, setName] = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleAdd = (e) => {
        e.preventDefault();
        if (name.trim()) {
            onAddPlayer(name.trim());
            setName('');
            inputRef.current?.focus();
        }
    };

    return (
        <div className="lobby animate-in">
            <div className="lobby__hero">
                <div className="lobby__hero-letters">
                    {'SHIRITORI'.split('').map((l, i) => (
                        <span key={i} className="lobby__hero-letter" style={{ animationDelay: `${i * 0.08}s` }}>
                            {l}
                        </span>
                    ))}
                </div>
                <p className="lobby__hero-desc">
                    Chain words by matching the <span className="lobby__highlight">starting</span> and <span className="lobby__highlight-green">ending</span> letters. Clear your hand to win!
                </p>
            </div>

            <div className="lobby__card">
                <h2 className="lobby__card-title">Game Lobby</h2>

                <form className="lobby__form" onSubmit={handleAdd}>
                    <input
                        ref={inputRef}
                        id="player-name-input"
                        className="lobby__input"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter player name..."
                        maxLength={20}
                    />
                    <button type="submit" className="lobby__add-btn" id="add-player-btn" disabled={!name.trim()}>
                        + Add
                    </button>
                </form>

                <div className="lobby__players">
                    {players.length === 0 ? (
                        <p className="lobby__empty">No players yet. Add at least one player to begin.</p>
                    ) : (
                        <ul className="lobby__player-list">
                            {players.map((p, i) => (
                                <li key={p.name} className="lobby__player" style={{ animationDelay: `${i * 0.1}s` }}>
                                    <div className="lobby__player-info">
                                        <div className="lobby__player-avatar" style={{ background: `hsl(${(i * 72) % 360}, 65%, 55%)` }}>
                                            {p.name[0].toUpperCase()}
                                        </div>
                                        <span className="lobby__player-name">{p.name}</span>
                                    </div>
                                    <div className="lobby__player-letters">
                                        {p.letters.map((l, li) => (
                                            <span key={li} className="lobby__letter-chip">{l.toUpperCase()}</span>
                                        ))}
                                    </div>
                                    <button
                                        className="lobby__remove-btn"
                                        onClick={() => onRemovePlayer(p.name)}
                                        aria-label={`Remove ${p.name}`}
                                        id={`remove-player-${i}`}
                                    >
                                        ✕
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <button
                    className="lobby__start-btn"
                    onClick={onStart}
                    disabled={players.length < 1}
                    id="start-game-btn"
                >
                    <span className="lobby__start-btn-text">Start Game</span>
                    <span className="lobby__start-btn-icon">→</span>
                </button>
            </div>

            <div className="lobby__rules">
                <h3 className="lobby__rules-title">📜 How to Play</h3>
                <ol className="lobby__rules-list">
                    <li>Each player starts with <strong>5 random letters</strong>.</li>
                    <li>A starting letter is revealed. Type a word that <strong>starts with that letter</strong>.</li>
                    <li>The word must <strong>end with one of your letters</strong>.</li>
                    <li>Valid words remove that letter from your hand & become the next starting letter.</li>
                    <li>Invalid words or timeouts give you a <strong>penalty letter</strong>.</li>
                    <li>First to clear all letters <strong>wins the round</strong>!</li>
                </ol>
            </div>
        </div>
    );
}

import { useState, useRef, useEffect } from 'react';
import './Lobby.css';

export default function Lobby({ players, ready, loadError, lobbyError, onAddPlayer, onRemovePlayer, onStart }) {
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
            <h2 className="lobby__title">Who’s playing?</h2>
            <p className="lobby__lead">Add everyone at the table. Each player gets 5 letters when the game starts.</p>

            <form className="lobby__form" onSubmit={handleAdd}>
                <label className="visually-hidden" htmlFor="player-name-input">Player name</label>
                <input
                    ref={inputRef}
                    id="player-name-input"
                    className="field"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Player name"
                    maxLength={20}
                    autoComplete="off"
                />
                <button type="submit" className="btn" id="add-player-btn" disabled={!name.trim()}>
                    Add player
                </button>
            </form>

            {players.length === 0 ? (
                <p className="lobby__empty">No players yet. Add a name to begin.</p>
            ) : (
                <ul className="roster">
                    {players.map((p, i) => (
                        <li key={p.id} className="roster__row lobby__player">
                            <span className="tile tile--sm roster__avatar" aria-hidden="true">{p.name[0]}</span>
                            <span className="roster__name">{p.name}</span>
                            <button
                                className="btn btn--quiet lobby__remove-btn"
                                onClick={() => onRemovePlayer(p.id)}
                                aria-label={`Remove ${p.name}`}
                                id={`remove-player-${i}`}
                            >
                                Remove
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {lobbyError && <p className="notice notice--error" role="alert">{lobbyError}</p>}
            {loadError && <p className="notice notice--error" role="alert">{loadError}</p>}

            <button
                className="btn btn--primary lobby__start-btn"
                onClick={onStart}
                disabled={players.length < 1 || !ready}
                id="start-game-btn"
            >
                {ready || loadError ? 'Start game' : 'Loading word list…'}
            </button>
        </div>
    );
}

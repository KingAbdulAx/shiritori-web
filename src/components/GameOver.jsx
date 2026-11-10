import './GameOver.css';

export default function GameOver({ players, onReset, isOnline, isHost, onLeave }) {
    const sorted = [...players].sort((a, b) => b.score - a.score);
    const winner = sorted[0] && sorted[0].score > 0 ? sorted[0] : null;

    return (
        <div className="gameover animate-in">
            <h2 className="gameover__title">Game over</h2>

            {winner ? (
                <div className="gameover__winner">
                    <p className="gameover__winner-name" aria-label={winner.name}>
                        {winner.name.split(' ').map((word, w) => (
                            <span key={w} className="gameover__winner-word" aria-hidden="true">
                                {word.split('').map((ch, i) => (
                                    <span key={i} className="tile tile--link gameover__winner-tile">{ch}</span>
                                ))}
                            </span>
                        ))}
                    </p>
                    <p className="gameover__winner-score">
                        wins with {winner.score} point{winner.score !== 1 ? 's' : ''}
                    </p>
                </div>
            ) : (
                <p className="gameover__no-winner">Nobody scored this time.</p>
            )}

            <section className="gameover__leaderboard" aria-label="Final scores">
                <h3 className="gameover__leaderboard-title">Final scores</h3>
                <ol className="roster">
                    {sorted.map((p, i) => (
                        <li key={p.name} className="roster__row gameover__lb-row">
                            <span className="gameover__lb-rank">{i + 1}</span>
                            <span className="roster__name gameover__lb-name">{p.name}</span>
                            <span className="gameover__lb-score">{p.score}</span>
                        </li>
                    ))}
                </ol>
            </section>

            <div className="gameover__actions">
                {(!isOnline || isHost) && onReset && (
                    <button className="btn btn--primary" onClick={onReset} id="play-again-btn">
                        Play again
                    </button>
                )}
                {isOnline && !isHost && (
                    <p className="gameover__waiting">Waiting for host to restart...</p>
                )}
                {isOnline && onLeave && (
                    <button className="btn btn--quiet" onClick={onLeave} id="leave-game-btn">
                        Leave room
                    </button>
                )}
            </div>
        </div>
    );
}

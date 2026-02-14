import './GameOver.css';

export default function GameOver({ players, onReset }) {
    const sorted = [...players].sort((a, b) => b.score - a.score);
    const winner = sorted[0] && sorted[0].score > 0 ? sorted[0] : null;

    return (
        <div className="gameover animate-in">
            <div className="gameover__card">
                <div className="gameover__confetti">
                    {['🎉', '🏆', '✨', '🎊', '⭐'].map((e, i) => (
                        <span key={i} className="gameover__confetti-item" style={{ animationDelay: `${i * 0.15}s` }}>
                            {e}
                        </span>
                    ))}
                </div>

                <h2 className="gameover__title">Game Over!</h2>

                {winner ? (
                    <div className="gameover__winner">
                        <div className="gameover__winner-crown">👑</div>
                        <div className="gameover__winner-name">{winner.name}</div>
                        <div className="gameover__winner-score">{winner.score} point{winner.score !== 1 ? 's' : ''}</div>
                    </div>
                ) : (
                    <p className="gameover__no-winner">No winner this time!</p>
                )}

                <div className="gameover__leaderboard">
                    <h3 className="gameover__leaderboard-title">Final Leaderboard</h3>
                    {sorted.map((p, i) => (
                        <div key={p.name} className={`gameover__lb-row ${i === 0 && p.score > 0 ? 'gameover__lb-row--first' : ''}`}>
                            <span className="gameover__lb-rank">
                                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                            </span>
                            <span className="gameover__lb-name">{p.name}</span>
                            <span className="gameover__lb-score">{p.score}</span>
                        </div>
                    ))}
                </div>

                <button className="gameover__restart-btn" onClick={onReset} id="play-again-btn">
                    🔄 Play Again
                </button>
            </div>
        </div>
    );
}

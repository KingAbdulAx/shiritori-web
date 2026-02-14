import './RoundEnd.css';

export default function RoundEnd({ round, maxRounds, players, onNextRound, onEndGame }) {
    const sorted = [...players].sort((a, b) => b.score - a.score);

    return (
        <div className="round-end animate-in">
            <div className="round-end__card">
                <div className="round-end__emoji">🏁</div>
                <h2 className="round-end__title">Round {round} Complete!</h2>
                <p className="round-end__sub">
                    {maxRounds - round} round{maxRounds - round !== 1 ? 's' : ''} remaining
                </p>

                <div className="round-end__scores">
                    {sorted.map((p, i) => (
                        <div key={p.name} className="round-end__score-row">
                            <span className="round-end__rank">{i + 1}</span>
                            <span className="round-end__name">{p.name}</span>
                            <span className="round-end__pts">{p.score} pt{p.score !== 1 ? 's' : ''}</span>
                        </div>
                    ))}
                </div>

                <div className="round-end__actions">
                    <button className="round-end__next-btn" onClick={onNextRound} id="next-round-btn">
                        Next Round →
                    </button>
                    <button className="round-end__end-btn" onClick={onEndGame} id="end-early-btn">
                        End Game
                    </button>
                </div>
            </div>
        </div>
    );
}

import './RoundEnd.css';

export default function RoundEnd({ round, maxRounds, players, onNextRound, onEndGame, isOnline, isHost }) {
    const sorted = [...players].sort((a, b) => b.score - a.score);
    const remaining = maxRounds - round;

    return (
        <div className="round-end animate-in">
            <h2 className="round-end__title">Round {round} complete</h2>
            <p className="round-end__sub">
                {remaining} round{remaining !== 1 ? 's' : ''} to go
            </p>

            <ol className="round-end__scores roster">
                {sorted.map((p, i) => (
                    <li key={p.name} className="roster__row round-end__score-row">
                        <span className="round-end__rank">{i + 1}</span>
                        <span className="roster__name round-end__name">{p.name}</span>
                        <span className="round-end__pts">{p.score} pt{p.score !== 1 ? 's' : ''}</span>
                    </li>
                ))}
            </ol>

            <div className="round-end__actions">
                {(!isOnline || isHost) && onNextRound && (
                    <button className="btn btn--primary" onClick={onNextRound} id="next-round-btn">
                        Start round {round + 1}
                    </button>
                )}
                {(!isOnline || isHost) && onEndGame && (
                    <button className="btn btn--quiet" onClick={onEndGame} id="end-early-btn">
                        End game
                    </button>
                )}
                {isOnline && !isHost && (
                    <p className="round-end__waiting">Waiting for host to continue...</p>
                )}
            </div>
        </div>
    );
}

import './Header.css';

export default function Header({ phase, round, maxRounds, onReset, isOnline, roomCode, connectionStatus }) {
    return (
        <header className="header">
            <div className="header__inner">
                <div className="header__brand">
                    <div className="header__logo">
                        <span className="header__logo-icon">🔗</span>
                        <h1 className="header__title">Shiritori</h1>
                    </div>
                    <p className="header__subtitle">English Word Chain</p>
                </div>

                <div className="header__info">
                    {/* Connection status for online mode */}
                    {isOnline && connectionStatus && (
                        <div className="header__connection">
                            <span className={`header__connection-dot header__connection-dot--${connectionStatus}`} />
                        </div>
                    )}

                    {/* Room code badge for online mode */}
                    {isOnline && roomCode && (
                        <div className="header__room-badge" title="Room code">
                            🌐 {roomCode}
                        </div>
                    )}

                    {phase !== 'lobby' && phase !== 'gameOver' && phase !== 'home' && (
                        <div className="header__round-badge">
                            Round {round}/{maxRounds}
                        </div>
                    )}
                    {phase !== 'lobby' && phase !== 'home' && onReset && (
                        <button className="header__reset-btn" onClick={onReset} id="reset-game-btn">
                            {isOnline ? '← Leave' : 'New Game'}
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
}

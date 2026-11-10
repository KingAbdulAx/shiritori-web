import './Header.css';

const STATUS_LABEL = {
    connected: 'Connected',
    connecting: 'Connecting',
    disconnected: 'Disconnected',
};

export default function Header({ phase, round, maxRounds, onReset, isOnline, roomCode, connectionStatus }) {
    const inGame = phase !== 'lobby' && phase !== 'home';
    return (
        <header className={`header ${inGame ? 'header--game' : ''}`}>
            <div className="header__inner container">
                <div className="header__brand">
                    <span className="tile tile--link tile--sm header__mark" aria-hidden="true">R</span>
                    <h1 className="header__title">Renga</h1>
                </div>

                <div className="header__info">
                    {isOnline && connectionStatus && (
                        <span
                            className={`header__connection header__connection--${connectionStatus}`}
                            role="status"
                            title={STATUS_LABEL[connectionStatus] || connectionStatus}
                        >
                            <span className="header__connection-dot" />
                            <span className="visually-hidden">{STATUS_LABEL[connectionStatus] || connectionStatus}</span>
                        </span>
                    )}

                    {isOnline && roomCode && (
                        <span className="header__room" title="Room code">
                            <span className="header__room-label">Room</span>
                            <span className="header__room-code">{roomCode}</span>
                        </span>
                    )}

                    {phase !== 'lobby' && phase !== 'gameOver' && phase !== 'home' && (
                        <span className="header__round">
                            Round {round} of {maxRounds}
                        </span>
                    )}

                    {phase !== 'lobby' && phase !== 'home' && onReset && (
                        <button className="btn btn--quiet header__reset-btn" onClick={onReset} id="reset-game-btn">
                            {isOnline ? <>Leave<span className="header__reset-extra"> room</span></> : 'New game'}
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
}

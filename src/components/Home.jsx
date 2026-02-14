import './Home.css';

export default function Home({ onSelectMode }) {
    return (
        <div className="home animate-in">
            <div className="home__hero">
                <div className="home__hero-letters">
                    {'SHIRITORI'.split('').map((l, i) => (
                        <span key={i} className="home__hero-letter" style={{ animationDelay: `${i * 0.08}s` }}>
                            {l}
                        </span>
                    ))}
                </div>
                <p className="home__hero-subtitle">English Word Chain Game</p>
                <p className="home__hero-desc">
                    Chain words by matching the <span className="home__highlight">starting</span> and{' '}
                    <span className="home__highlight-green">ending</span> letters. Clear your hand to win!
                </p>
            </div>

            <div className="home__modes">
                <button className="home__mode-card home__mode-card--local" onClick={() => onSelectMode('local')} id="mode-local-btn">
                    <div className="home__mode-icon">🎮</div>
                    <h2 className="home__mode-title">Local Play</h2>
                    <p className="home__mode-desc">Play on the same device. Add players and take turns passing the screen.</p>
                    <span className="home__mode-badge">Same Device</span>
                </button>

                <button className="home__mode-card home__mode-card--online" onClick={() => onSelectMode('online')} id="mode-online-btn">
                    <div className="home__mode-icon">🌐</div>
                    <h2 className="home__mode-title">Online Play</h2>
                    <p className="home__mode-desc">Create or join a room. Play with friends on different devices in real-time.</p>
                    <span className="home__mode-badge home__mode-badge--online">Multiplayer</span>
                </button>
            </div>

            <div className="home__rules">
                <h3 className="home__rules-title">📜 How to Play</h3>
                <ol className="home__rules-list">
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

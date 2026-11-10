import './Home.css';

// A sample chain, drawn as tiles. Each word starts under the last tile of the one above.
const DEMO = [
    { word: 'chain', from: 0 },
    { word: 'north', from: 4 },
    { word: 'hand', from: 8 },
];
const COLUMNS = 12;

function Chain() {
    let tileIndex = 0;
    return (
        <div className="chain" aria-hidden="true">
            {DEMO.map(({ word, from }, w) => (
                <div
                    key={word}
                    className="chain__word"
                    style={{ '--from': from + 1, '--len': word.length }}
                >
                    {word.split('').map((letter, i) => {
                        const isLink = i === word.length - 1 || (i === 0 && w > 0);
                        const delay = tileIndex++;
                        return (
                            <span
                                key={i}
                                className={`tile chain__tile ${isLink ? 'tile--link' : ''}`}
                                style={{ '--i': delay }}
                            >
                                {letter}
                            </span>
                        );
                    })}
                </div>
            ))}
            <div
                className="chain__word"
                style={{ '--from': COLUMNS, '--len': 1 }}
            >
                <span className="chain__slot" style={{ '--i': 12 }} />
            </div>
        </div>
    );
}

export default function Home({ onSelectMode }) {
    return (
        <div className="home animate-in">
            <section className="home__intro">
                <h2 className="home__title">Chain words.<br />Empty your hand.</h2>
                <p className="home__lead">
                    Each word starts with the last letter of the one before it. Get rid of
                    all your letters before anyone else does.
                </p>

                <div className="home__chain">
                    <Chain />
                    <p className="visually-hidden">
                        Example: chain, north, hand. The last letter of each word is the first letter of the next.
                    </p>
                </div>

                <div className="home__modes">
                    <button className="btn btn--primary home__mode" onClick={() => onSelectMode('online')} id="mode-online-btn">
                        <span className="home__mode-title">Play online</span>
                        <span className="home__mode-desc">Create a room and send friends the link.</span>
                    </button>

                    <button className="btn home__mode" onClick={() => onSelectMode('local')} id="mode-local-btn">
                        <span className="home__mode-title">Play on one device</span>
                        <span className="home__mode-desc">Pass the screen around the table.</span>
                    </button>
                </div>
            </section>

            <section className="home__rules">
                <h3 className="home__rules-title">How a turn works</h3>
                <ol className="home__rules-list">
                    <li>Everyone starts with 5 letters. Your words have to end with these.</li>
                    <li>A starting letter is shown. Type a word of 3 or more letters that begins with it.</li>
                    <li>If the word ends with one of your letters, that letter leaves your hand and becomes the next starting letter.</li>
                    <li>Chill mode: players take turns, 30 seconds each. An unknown word or a timeout adds a penalty letter.</li>
                    <li>Rush mode: everyone types at once and the first valid word takes the letter. A wrong word locks you out for a moment instead.</li>
                    <li>Empty your hand first to win the round. A game is three rounds.</li>
                </ol>
                <p className="home__origin">Inspired by shiritori, the Japanese word-chain game.</p>
            </section>
        </div>
    );
}

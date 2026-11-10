import { useRef, useEffect } from 'react';
import './MessageLog.css';

// Messages from the game engine start with an emoji. The log shows plain text, colour-coded by type.
const stripLeadingEmoji = (text) => text.replace(/^[\p{Extended_Pictographic}️‍\s]+/u, '');

export default function MessageLog({ messages }) {
    const bodyRef = useRef(null);

    // Scroll only the log itself; scrolling the page would yank the player away from the input.
    useEffect(() => {
        const el = bodyRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [messages]);

    return (
        <section className="msglog container" id="message-log" aria-label="Game log">
            <h3 className="msglog__title">Game log</h3>
            <div className="msglog__body" ref={bodyRef} role="log" aria-live="polite">
                {messages.length === 0 ? (
                    <p className="msglog__empty">Nothing yet. Moves will show up here.</p>
                ) : (
                    messages.map((m) => (
                        <p key={m.id} className={`msglog__msg msglog__msg--${m.type}`}>
                            {stripLeadingEmoji(m.text)}
                        </p>
                    ))
                )}
            </div>
        </section>
    );
}

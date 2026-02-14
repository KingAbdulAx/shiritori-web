import { useRef, useEffect } from 'react';
import './MessageLog.css';

export default function MessageLog({ messages }) {
    const endRef = useRef(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <div className="msglog" id="message-log">
            <div className="msglog__header">
                <span className="msglog__header-icon">💬</span>
                <h3 className="msglog__header-title">Game Log</h3>
            </div>
            <div className="msglog__body">
                {messages.length === 0 ? (
                    <p className="msglog__empty">No messages yet.</p>
                ) : (
                    messages.map((m) => (
                        <div key={m.id} className={`msglog__msg msglog__msg--${m.type}`}>
                            <span className="msglog__msg-text">{m.text}</span>
                        </div>
                    ))
                )}
                <div ref={endRef} />
            </div>
        </div>
    );
}

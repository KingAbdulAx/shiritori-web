import { useState, useRef, useEffect } from 'react';
import './Header.css';

export default function Header({ phase, round, maxRounds, onReset }) {
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
                    {phase !== 'lobby' && phase !== 'gameOver' && (
                        <div className="header__round-badge">
                            Round {round}/{maxRounds}
                        </div>
                    )}
                    {phase !== 'lobby' && (
                        <button className="header__reset-btn" onClick={onReset} id="reset-game-btn">
                            New Game
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
}

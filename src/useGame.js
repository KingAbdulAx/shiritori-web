import { useState, useCallback, useRef } from 'react';

const ALPHABET = 'abcdefghijklmnoprstuvwy';
const INITIAL_LETTERS_COUNT = 5;
const TURN_TIME_LIMIT = 30; // seconds
const MAX_ROUNDS = 3;

function randomLetters(count = INITIAL_LETTERS_COUNT) {
  const pool = ALPHABET.split('');
  const result = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool.splice(idx, 1)[0]);
  }
  return result;
}

function randomLetter() {
  return ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
}

// Game phases:
// 'lobby'     – adding players
// 'playing'   – game in progress, waiting for someone to take a turn
// 'turn'      – a player is actively taking their turn (30s timer)
// 'roundEnd'  – a round just ended, ask if next round
// 'gameOver'  – all rounds done or game stopped

export default function useGame() {
  const [phase, setPhase] = useState('lobby');
  const [players, setPlayers] = useState([]);
  const [currentLetter, setCurrentLetter] = useState(() => randomLetter());
  const [activePlayerIdx, setActivePlayerIdx] = useState(null);
  const [round, setRound] = useState(1);
  const [messages, setMessages] = useState([]);
  const [timeLeft, setTimeLeft] = useState(TURN_TIME_LIMIT);
  const [usedWords, setUsedWords] = useState(new Set());
  const [isValidating, setIsValidating] = useState(false);
  const [wordDefinition, setWordDefinition] = useState(null);

  const timerRef = useRef(null);
  const turnStartRef = useRef(null);

  const log = useCallback((text, type = 'info') => {
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), text, type, time: new Date() }]);
  }, []);

  // ── Player Management ───────────────────────────────────
  const addPlayer = useCallback((name) => {
    if (phase !== 'lobby') return;
    const trimmed = name.trim();
    if (!trimmed) return;
    setPlayers(prev => {
      if (prev.find(p => p.name.toLowerCase() === trimmed.toLowerCase())) {
        log(`${trimmed} is already in the game.`, 'warning');
        return prev;
      }
      const letters = randomLetters();
      log(`${trimmed} joined! Letters: ${letters.join(', ').toUpperCase()}`, 'success');
      return [...prev, { name: trimmed, letters, score: 0 }];
    });
  }, [phase, log]);

  const removePlayer = useCallback((name) => {
    if (phase !== 'lobby') return;
    setPlayers(prev => prev.filter(p => p.name !== name));
    log(`${name} left the game.`, 'warning');
  }, [phase, log]);

  // ── Timer ───────────────────────────────────────────────
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback((onTimeout) => {
    clearTimer();
    setTimeLeft(TURN_TIME_LIMIT);
    turnStartRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - turnStartRef.current) / 1000);
      const remaining = TURN_TIME_LIMIT - elapsed;
      if (remaining <= 0) {
        clearTimer();
        setTimeLeft(0);
        onTimeout();
      } else {
        setTimeLeft(remaining);
      }
    }, 250);
  }, [clearTimer]);

  // ── Word Validation ─────────────────────────────────────
  const validateWord = useCallback(async (word) => {
    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          // Extract a short definition
          const meaning = data[0]?.meanings?.[0];
          const def = meaning?.definitions?.[0]?.definition || null;
          const partOfSpeech = meaning?.partOfSpeech || null;
          return { valid: true, definition: def, partOfSpeech };
        }
      }
      return { valid: false };
    } catch {
      return { valid: false };
    }
  }, []);

  // ── Game Flow ───────────────────────────────────────────
  const startGame = useCallback(() => {
    if (players.length < 1) {
      log('Need at least 1 player to start!', 'warning');
      return;
    }
    setPhase('playing');
    setRound(1);
    setUsedWords(new Set());
    const letter = randomLetter();
    setCurrentLetter(letter);
    log(`🎮 Game started! The starting letter is: ${letter.toUpperCase()}`, 'system');
    log(`Round 1 of ${MAX_ROUNDS}`, 'system');
  }, [players, log]);

  const takeTurn = useCallback((playerIdx) => {
    if (phase !== 'playing') return;
    setActivePlayerIdx(playerIdx);
    setPhase('turn');
    setWordDefinition(null);
    const player = players[playerIdx];
    log(`${player.name}'s turn! Letters: ${player.letters.join(', ').toUpperCase()}`, 'turn');

    startTimer(() => {
      // Timeout
      const newLetter = randomLetter();
      setPlayers(prev => {
        const updated = [...prev];
        updated[playerIdx] = {
          ...updated[playerIdx],
          letters: [...updated[playerIdx].letters, newLetter],
        };
        return updated;
      });
      log(`⏰ Time's up! ${player.name} receives a penalty letter: ${newLetter.toUpperCase()}`, 'warning');
      setPhase('playing');
      setActivePlayerIdx(null);
    });
  }, [phase, players, startTimer, log]);

  const submitWord = useCallback(async (word) => {
    if (phase !== 'turn' || activePlayerIdx === null) return;
    clearTimer();

    const w = word.toLowerCase().trim();
    const player = players[activePlayerIdx];

    // Rule checks
    if (!w) {
      log('Please enter a word!', 'warning');
      // Restart timer
      startTimer(() => {
        const nl = randomLetter();
        setPlayers(prev => {
          const u = [...prev];
          u[activePlayerIdx] = { ...u[activePlayerIdx], letters: [...u[activePlayerIdx].letters, nl] };
          return u;
        });
        log(`⏰ Time's up! ${player.name} receives a penalty letter: ${nl.toUpperCase()}`, 'warning');
        setPhase('playing');
        setActivePlayerIdx(null);
      });
      return;
    }

    if (w[0] !== currentLetter) {
      log(`❌ Word must start with "${currentLetter.toUpperCase()}"!`, 'error');
      startTimer(() => {
        const nl = randomLetter();
        setPlayers(prev => {
          const u = [...prev];
          u[activePlayerIdx] = { ...u[activePlayerIdx], letters: [...u[activePlayerIdx].letters, nl] };
          return u;
        });
        log(`⏰ Time's up! ${player.name} receives a penalty letter: ${nl.toUpperCase()}`, 'warning');
        setPhase('playing');
        setActivePlayerIdx(null);
      });
      return;
    }

    const lastChar = w[w.length - 1];
    if (!player.letters.includes(lastChar)) {
      log(`❌ Word must end with one of your letters: ${player.letters.join(', ').toUpperCase()}`, 'error');
      startTimer(() => {
        const nl = randomLetter();
        setPlayers(prev => {
          const u = [...prev];
          u[activePlayerIdx] = { ...u[activePlayerIdx], letters: [...u[activePlayerIdx].letters, nl] };
          return u;
        });
        log(`⏰ Time's up! ${player.name} receives a penalty letter: ${nl.toUpperCase()}`, 'warning');
        setPhase('playing');
        setActivePlayerIdx(null);
      });
      return;
    }

    if (usedWords.has(w)) {
      log(`❌ "${w}" has already been used!`, 'error');
      startTimer(() => {
        const nl = randomLetter();
        setPlayers(prev => {
          const u = [...prev];
          u[activePlayerIdx] = { ...u[activePlayerIdx], letters: [...u[activePlayerIdx].letters, nl] };
          return u;
        });
        log(`⏰ Time's up! ${player.name} receives a penalty letter: ${nl.toUpperCase()}`, 'warning');
        setPhase('playing');
        setActivePlayerIdx(null);
      });
      return;
    }

    // Validate via API
    setIsValidating(true);
    const result = await validateWord(w);
    setIsValidating(false);

    if (!result.valid) {
      const nl = randomLetter();
      setPlayers(prev => {
        const u = [...prev];
        u[activePlayerIdx] = { ...u[activePlayerIdx], letters: [...u[activePlayerIdx].letters, nl] };
        return u;
      });
      log(`❌ "${w}" is not a valid English word! ${player.name} receives a penalty letter: ${nl.toUpperCase()}`, 'error');
      setPhase('playing');
      setActivePlayerIdx(null);
      return;
    }

    // Valid word!
    setUsedWords(prev => new Set(prev).add(w));
    setWordDefinition({
      word: w,
      definition: result.definition,
      partOfSpeech: result.partOfSpeech,
    });
    
    // Remove the last letter from hand, update current letter
    const newLetters = [...player.letters];
    const idx = newLetters.indexOf(lastChar);
    newLetters.splice(idx, 1);
    setCurrentLetter(lastChar);

    setPlayers(prev => {
      const u = [...prev];
      u[activePlayerIdx] = { ...u[activePlayerIdx], letters: newLetters };
      return u;
    });

    log(`✅ "${w.toUpperCase()}" is valid! Next letter: ${lastChar.toUpperCase()}`, 'success');

    // Check if player used all letters → round win
    if (newLetters.length === 0) {
      setPlayers(prev => {
        const u = [...prev];
        u[activePlayerIdx] = { ...u[activePlayerIdx], score: u[activePlayerIdx].score + 1 };
        return u;
      });
      log(`🏆 ${player.name} cleared all letters and wins Round ${round}!`, 'system');

      if (round >= MAX_ROUNDS) {
        setPhase('gameOver');
        log('🎉 Game over! Check the final scores.', 'system');
      } else {
        setPhase('roundEnd');
      }
      setActivePlayerIdx(null);
      return;
    }

    setPhase('playing');
    setActivePlayerIdx(null);
  }, [phase, activePlayerIdx, players, currentLetter, usedWords, round, clearTimer, startTimer, validateWord, log]);

  const nextRound = useCallback(() => {
    const newRound = round + 1;
    setRound(newRound);
    setUsedWords(new Set());
    // Reset all player letters
    setPlayers(prev => prev.map(p => ({ ...p, letters: randomLetters() })));
    const letter = randomLetter();
    setCurrentLetter(letter);
    setPhase('playing');
    setWordDefinition(null);
    log(`🔄 Round ${newRound} of ${MAX_ROUNDS}! Starting letter: ${letter.toUpperCase()}`, 'system');
  }, [round, log]);

  const endGame = useCallback(() => {
    clearTimer();
    setPhase('gameOver');
    log('🎉 Game ended! Check the final scores.', 'system');
  }, [clearTimer, log]);

  const resetGame = useCallback(() => {
    clearTimer();
    setPhase('lobby');
    setPlayers([]);
    setCurrentLetter(randomLetter());
    setActivePlayerIdx(null);
    setRound(1);
    setMessages([]);
    setUsedWords(new Set());
    setIsValidating(false);
    setWordDefinition(null);
  }, [clearTimer]);

  const addExtraLetter = useCallback((playerIdx) => {
    const nl = randomLetter();
    setPlayers(prev => {
      const u = [...prev];
      u[playerIdx] = { ...u[playerIdx], letters: [...u[playerIdx].letters, nl] };
      return u;
    });
    log(`${players[playerIdx]?.name} drew extra letter: ${nl.toUpperCase()}`, 'info');
  }, [players, log]);

  return {
    phase,
    players,
    currentLetter,
    activePlayerIdx,
    round,
    maxRounds: MAX_ROUNDS,
    messages,
    timeLeft,
    turnTimeLimit: TURN_TIME_LIMIT,
    usedWords,
    isValidating,
    wordDefinition,
    addPlayer,
    removePlayer,
    startGame,
    takeTurn,
    submitWord,
    nextRound,
    endGame,
    resetGame,
    addExtraLetter,
  };
}

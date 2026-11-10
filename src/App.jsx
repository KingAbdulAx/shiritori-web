import { useState } from 'react';
import useGame from './useGame';
import useOnlineGame from './useOnlineGame';
import Home from './components/Home';
import Header from './components/Header';
import Lobby from './components/Lobby';
import OnlineLobby from './components/OnlineLobby';
import GameBoard from './components/GameBoard';
import RoundEnd from './components/RoundEnd';
import GameOver from './components/GameOver';
import MessageLog from './components/MessageLog';
import './App.css';

function LocalGame({ onBack }) {
  const game = useGame();

  const handleReset = () => {
    game.resetGame();
    onBack();
  };

  return (
    <>
      <Header
        phase={game.phase}
        round={game.round}
        maxRounds={game.maxRounds}
        onReset={handleReset}
      />

      <main className="app__main container">
        {game.phase === 'lobby' && (
          <Lobby
            players={game.players}
            onAddPlayer={game.addPlayer}
            onRemovePlayer={game.removePlayer}
            onStart={game.startGame}
          />
        )}

        {(game.phase === 'playing' || game.phase === 'turn') && (
          <GameBoard
            players={game.players}
            currentLetter={game.currentLetter}
            activePlayerIdx={game.activePlayerIdx}
            phase={game.phase}
            timeLeft={game.timeLeft}
            turnTimeLimit={game.turnTimeLimit}
            usedWords={game.usedWords}
            isValidating={game.isValidating}
            wordDefinition={game.wordDefinition}
            onTakeTurn={game.takeTurn}
            onSubmitWord={game.submitWord}
            onAddExtraLetter={game.addExtraLetter}
            onEndGame={game.endGame}
          />
        )}

        {game.phase === 'roundEnd' && (
          <RoundEnd
            round={game.round}
            maxRounds={game.maxRounds}
            players={game.players}
            onNextRound={game.nextRound}
            onEndGame={game.endGame}
          />
        )}

        {game.phase === 'gameOver' && (
          <GameOver
            players={game.players}
            onReset={handleReset}
          />
        )}
      </main>

      {game.phase !== 'lobby' && (
        <MessageLog messages={game.messages} />
      )}
    </>
  );
}

function OnlineGame({ onBack, initialCode }) {
  const game = useOnlineGame();

  const handleReset = () => {
    game.leaveRoom();
    onBack();
  };

  // If not in a room yet, show online lobby
  const inRoom = !!game.roomCode;
  const showLobby = !inRoom || game.phase === 'lobby';

  return (
    <>
      <Header
        phase={showLobby ? 'lobby' : game.phase}
        round={game.round}
        maxRounds={game.maxRounds}
        onReset={handleReset}
        isOnline
        roomCode={game.roomCode}
        connectionStatus={game.connectionStatus}
      />

      <main className="app__main container">
        {showLobby && (
          <OnlineLobby
            roomCode={game.roomCode}
            players={game.players}
            isHost={game.isHost}
            connectionStatus={game.connectionStatus}
            error={game.error}
            initialCode={initialCode}
            onCreateRoom={game.createRoom}
            onJoinRoom={game.joinRoom}
            onStartGame={game.startGame}
            onLeaveRoom={handleReset}
            onClearError={game.clearError}
          />
        )}

        {(game.phase === 'playing' || game.phase === 'turn') && !showLobby && (
          <GameBoard
            players={game.players}
            currentLetter={game.currentLetter}
            activePlayerIdx={game.activePlayerIdx}
            phase={game.phase}
            timeLeft={game.timeLeft}
            turnTimeLimit={game.turnTimeLimit}
            usedWords={game.usedWords}
            isValidating={game.isValidating}
            wordDefinition={game.wordDefinition}
            onTakeTurn={game.takeTurn}
            onSubmitWord={game.submitWord}
            onEndGame={game.endGame}
            isOnline
            myPlayerId={game.myPlayerId}
          />
        )}

        {game.phase === 'roundEnd' && !showLobby && (
          <RoundEnd
            round={game.round}
            maxRounds={game.maxRounds}
            players={game.players}
            onNextRound={game.isHost ? game.nextRound : null}
            onEndGame={game.isHost ? game.endGame : null}
            isOnline
            isHost={game.isHost}
          />
        )}

        {game.phase === 'gameOver' && !showLobby && (
          <GameOver
            players={game.players}
            onReset={game.isHost ? game.resetGame : null}
            isOnline
            isHost={game.isHost}
            onLeave={handleReset}
          />
        )}
      </main>

      {game.phase !== 'lobby' && !showLobby && (
        <MessageLog messages={game.messages} />
      )}
    </>
  );
}

function App() {
  // An invite link (?room=CODE) goes straight to online play with the code filled in.
  const [initialRoom] = useState(() => new URLSearchParams(window.location.search).get('room') || '');
  const [mode, setMode] = useState(initialRoom ? 'online' : null); // null | 'local' | 'online'

  if (mode === null) {
    return (
      <div className="app">
        <Header phase="home" />
        <main className="app__main container">
          <Home onSelectMode={setMode} />
        </main>
      </div>
    );
  }

  if (mode === 'local') {
    return (
      <div className="app">
        <LocalGame onBack={() => setMode(null)} />
      </div>
    );
  }

  return (
    <div className="app">
      <OnlineGame onBack={() => setMode(null)} initialCode={initialRoom} />
    </div>
  );
}

export default App;

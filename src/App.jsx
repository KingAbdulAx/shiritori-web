import { useState } from 'react';
import useGame from './useGame';
import useOnlineGame from './useOnlineGame';
import { loadSession, clearSession } from './session';
import Home from './components/Home';
import Header from './components/Header';
import Lobby from './components/Lobby';
import OnlineLobby from './components/OnlineLobby';
import GameBoard from './components/GameBoard';
import RoundEnd from './components/RoundEnd';
import GameOver from './components/GameOver';
import MessageLog from './components/MessageLog';
import './App.css';

const PLAY_PHASES = ['turn', 'race', 'handoff'];

function LocalGame({ onBack }) {
  const game = useGame();

  return (
    <>
      <Header
        phase={game.phase}
        round={game.round}
        maxRounds={game.maxRounds}
        onReset={onBack}
      />

      <main className="app__main container">
        {game.phase === 'lobby' && (
          <Lobby
            players={game.players}
            ready={game.ready}
            loadError={game.loadError}
            lobbyError={game.lobbyError}
            onAddPlayer={game.addPlayer}
            onRemovePlayer={game.removePlayer}
            onStart={game.startGame}
          />
        )}

        {PLAY_PHASES.includes(game.phase) && (
          <GameBoard
            mode={game.mode}
            players={game.players}
            currentLetter={game.currentLetter}
            activePlayerIdx={game.activePlayerIdx}
            phase={game.phase}
            timeLeft={game.timeLeft}
            turnTimeLimit={game.turnTimeLimit}
            usedWords={game.usedWords}
            wordDefinition={game.wordDefinition}
            feedback={game.feedback}
            lockedUntil={game.lockedUntil}
            onBeginTurn={game.beginTurn}
            onSubmitWord={game.submitWord}
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
            onReset={game.playAgain}
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

  const handleLeave = () => {
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
        onReset={handleLeave}
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
            hostId={game.hostId}
            mode={game.mode}
            resuming={game.resuming}
            connectionStatus={game.connectionStatus}
            error={game.error}
            initialCode={initialCode}
            onCreateRoom={game.createRoom}
            onJoinRoom={game.joinRoom}
            onSetMode={game.setMode}
            onStartGame={game.startGame}
            onLeaveRoom={handleLeave}
            onClearError={game.clearError}
          />
        )}

        {PLAY_PHASES.includes(game.phase) && !showLobby && (
          <GameBoard
            mode={game.mode}
            players={game.players}
            currentLetter={game.currentLetter}
            activePlayerIdx={game.activePlayerIdx}
            phase={game.phase}
            timeLeft={game.timeLeft}
            turnTimeLimit={game.turnTimeLimit}
            usedWords={game.usedWords}
            wordDefinition={game.wordDefinition}
            feedback={game.feedback}
            lockedUntil={game.lockedUntil}
            onSubmitWord={game.submitWord}
            onEndGame={game.isHost ? game.endGame : null}
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
            onLeave={handleLeave}
          />
        )}
      </main>

      {game.phase !== 'lobby' && !showLobby && (
        <MessageLog messages={game.messages} />
      )}
    </>
  );
}

// Decide where to start: an invite link wins, then a saved online seat, then the home screen.
function initialState() {
  const room = new URLSearchParams(window.location.search).get('room') || '';
  if (room) {
    clearSession(); // an invite link means a fresh join, not the old seat
    return { room, mode: 'online' };
  }
  return { room: '', mode: loadSession() ? 'online' : null };
}

function App() {
  const [initial] = useState(initialState);
  const [mode, setMode] = useState(initial.mode); // null | 'local' | 'online'

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
      <OnlineGame onBack={() => setMode(null)} initialCode={initial.room} />
    </div>
  );
}

export default App;

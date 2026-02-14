import useGame from './useGame';
import Header from './components/Header';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';
import RoundEnd from './components/RoundEnd';
import GameOver from './components/GameOver';
import MessageLog from './components/MessageLog';
import './App.css';

function App() {
  const game = useGame();

  return (
    <div className="app">
      <Header
        phase={game.phase}
        round={game.round}
        maxRounds={game.maxRounds}
        onReset={game.resetGame}
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
            onReset={game.resetGame}
          />
        )}
      </main>

      {game.phase !== 'lobby' && (
        <MessageLog messages={game.messages} />
      )}
    </div>
  );
}

export default App;

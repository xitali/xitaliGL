import React, { useState, useEffect } from 'react';
import AddCustomGame from './AddCustomGame';

const GameGrid = ({ games, currentPlatform, displayMode = 'grid', gridSize = 'medium' }) => {
  const [gameCovers, setGameCovers] = useState({});
  const [showAddGameModal, setShowAddGameModal] = useState(false);
  const [showCoverSelectorModal, setShowCoverSelectorModal] = useState(false);
  const [selectedGame, setSelectedGame] = useState(null);
  const [coverOptions, setCoverOptions] = useState([]);
  
  // Efekt do pobierania okładek gier
  useEffect(() => {
    const loadGameCovers = async () => {
      const covers = { ...gameCovers };
      
      // Pobierz okładki dla wszystkich gier, których jeszcze nie mamy
      for (const game of games) {
        if (!covers[game.id] && window.electronAPI && window.electronAPI.fetchGameCover) {
          try {
            const coverPath = await window.electronAPI.fetchGameCover(game.title);
            covers[game.id] = coverPath;
          } catch (error) {
            // Użyj okładki z bezpośredniego URL jako fallback
            covers[game.id] = game.cover;
          }
        } else if (!covers[game.id]) {
          // Jeśli nie ma API, użyj okładki z bezpośredniego URL
          covers[game.id] = game.cover;
        }
      }
      
      setGameCovers(covers);
    };
    
    loadGameCovers();
  }, [games]);

  // Funkcja uruchamiająca grę
  const launchGame = async (gameId) => {
    try {
      if (window.electronAPI && window.electronAPI.launchGame) {
        const result = await window.electronAPI.launchGame(gameId);
        if (!result) {
          // Nie udało się uruchomić gry
        }
      }
    } catch (error) {
      // Obsługa błędu
    }
  };
  
  // Funkcja otwierająca dialog dodawania nowej gry
  const handleAddGame = () => {
    setShowAddGameModal(true);
  };
  
  // Funkcja anulująca dodawanie gry
  const handleCancelAddGame = () => {
    setShowAddGameModal(false);
  };
  
  // Funkcja obsługująca dodanie nowej gry
  const handleSaveGame = async (gameData) => {
    try {
      if (window.electronAPI && window.electronAPI.addGame) {
        // Wywołaj API do zapisania gry
        const addedGame = await window.electronAPI.addGame(gameData);
        
        // Zamknij modal
        setShowAddGameModal(false);
        
        // Odśwież wszystkie gry (zamiast tylko current platform)
        if (window.electronAPI.findInstalledGames) {
          await window.electronAPI.findInstalledGames('all', true);
          
          // Odśwież też kategorię "other" (customs)
          const customGames = await window.electronAPI.getStoredGames('other');
          
          // Opcjonalnie możemy zaczekać chwilę i odświeżyć aktualną platformę
          setTimeout(async () => {
            await window.electronAPI.findInstalledGames(currentPlatform, true);
          }, 500);
        }
        
        // Pokaż powiadomienie o sukcesie
        alert(`Gra "${addedGame.title}" została pomyślnie dodana do biblioteki.`);
      } else {
        throw new Error('Brak dostępu do API Electron - nie można dodać gry');
      }
    } catch (error) {
      alert(`Nie udało się dodać gry: ${error.message || 'Nieznany błąd'}`);
      // Nie zamykamy modalu, aby użytkownik mógł poprawić dane
    }
  };

  // Obsługa kliknięcia prawym przyciskiem myszy na kafelek
  const handleContextMenu = async (e, game) => {
    e.preventDefault();
    
    // Ustaw wybraną grę
    setSelectedGame(game);
    
    try {
      if (window.electronAPI && window.electronAPI.searchCovers) {
        // Pobierz dostępne okładki z SteamGridDB
        const covers = await window.electronAPI.searchCovers(game.title);
        
        if (covers && covers.length > 0) {
          // Ogranicz liczbę okładek do maksymalnie 10
          setCoverOptions(covers.slice(0, 10));
          setShowCoverSelectorModal(true);
        } else {
          alert(`Nie znaleziono alternatywnych okładek dla gry "${game.title}"`);
        }
      }
    } catch (error) {
      alert(`Błąd podczas wyszukiwania okładek: ${error.message || 'Nieznany błąd'}`);
    }
  };
  
  // Funkcja wybierająca nową okładkę
  const handleSelectCover = async (coverUrl) => {
    if (!selectedGame) return;
    
    try {
      if (window.electronAPI && window.electronAPI.updateGameCover) {
        const success = await window.electronAPI.updateGameCover(selectedGame.id, coverUrl);
        
        if (success) {
          // Zaktualizuj lokalną mapę okładek
          setGameCovers(prev => ({
            ...prev,
            [selectedGame.id]: coverUrl
          }));
          
          // Powiadomienie o sukcesie
          alert(`Okładka dla gry "${selectedGame.title}" została zaktualizowana.`);
        } else {
          alert(`Nie udało się zaktualizować okładki dla gry "${selectedGame.title}".`);
        }
      }
    } catch (error) {
      alert(`Błąd podczas aktualizacji okładki: ${error.message || 'Nieznany błąd'}`);
    }
    
    // Zamknij modal
    setShowCoverSelectorModal(false);
  };
  
  // Zamykanie modalu wyboru okładki
  const handleCloseCoverSelector = () => {
    setShowCoverSelectorModal(false);
    setSelectedGame(null);
    setCoverOptions([]);
  };

  // Sprawdź, czy powinien być wyświetlany przycisk "Dodaj grę"
  const showAddButton = currentPlatform === 'other';

  // Renderowanie siatki gier - zmienione na "justify-start" z odpowiednim odstępem
  const renderGridView = () => (
    <div className="flex flex-wrap justify-start gap-2 p-4 w-full">
      {games.length > 0 ? (
        games.map((game) => (
          <div
            key={game.id}
            className="game-card-container transition-all duration-300 hover:shadow-lg m-1"
            onClick={() => launchGame(game.id)}
            onContextMenu={(e) => handleContextMenu(e, game)}
          >
            <div className="game-card-content rounded-lg overflow-hidden shadow-lg border border-zinc-800 hover:border-zinc-600 transition-colors">
              <div className="game-card-image-container overflow-hidden relative">
                <img
                  src={gameCovers[game.id] || game.cover}
                  alt={game.title}
                  className="game-card-image object-cover transition-transform duration-300 hover:scale-110"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '../assets/icons/no-cover.jpg';
                  }}
                />
                {/* Informacja o grze ukryta przez CSS */}
                <div className="game-card-info absolute bottom-0 left-0 right-0 backdrop-blur-md bg-black bg-opacity-70 p-3 text-white">
                  <div className="text-sm font-medium truncate">{game.title}</div>
                  <div className="text-xs text-gray-300 truncate">{game.platform}</div>
                </div>
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="flex items-center justify-center h-full w-full">
          <p className="text-gray-400 text-xl">Brak gier do wyświetlenia</p>
        </div>
      )}
      
      {showAddButton && (
        <div className="flex justify-center items-center m-1">
          <button
            className="px-4 py-3 bg-zinc-800 text-gray-200 rounded-lg hover:bg-zinc-700 transition-colors flex items-center"
            onClick={handleAddGame}
          >
            <span className="text-2xl mr-2">+</span>
            Dodaj grę
          </button>
        </div>
      )}
    </div>
  );

  // Renderowanie listy gier
  const renderListView = () => (
    <div className="p-4 w-full">
      <div className="space-y-3 max-w-5xl mx-auto">
        {games.map((game) => (
          <div
            key={game.id}
            className="flex items-center p-3 rounded-lg transition-colors duration-200 hover:bg-zinc-700 cursor-pointer shadow-md border border-zinc-700"
            onClick={() => launchGame(game.id)}
            onContextMenu={(e) => handleContextMenu(e, game)}
          >
            <div className="w-12 h-12 overflow-hidden rounded-md flex-shrink-0 mr-4">
              <img
                src={gameCovers[game.id] || game.cover}
                alt={game.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '../assets/icons/no-cover.jpg';
                }}
              />
            </div>
            <div className="flex-grow">
              <div className="font-medium text-white">{game.title}</div>
              <div className="text-sm text-gray-400">{game.platform}</div>
            </div>
            <div className="flex-shrink-0 ml-4">
              <button className="p-2 rounded-full hover:bg-zinc-600 text-gray-300 hover:text-white">
                <span className="text-lg">▶</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Modal wyboru okładki
  const renderCoverSelectorModal = () => {
    if (!showCoverSelectorModal || !selectedGame) return null;
    
    return (
      <div className="fixed inset-0 z-50 overflow-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
        <div className="bg-zinc-800 p-6 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <h2 className="text-xl font-bold text-white mb-4">Wybierz okładkę dla gry {selectedGame.title}</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
            {coverOptions.map((cover, index) => (
              <div 
                key={index}
                className="cursor-pointer hover:opacity-75 transition-opacity border-2 border-transparent hover:border-zinc-500 rounded-lg overflow-hidden"
                onClick={() => handleSelectCover(cover.url)}
              >
                <img 
                  src={cover.url} 
                  alt={`Okładka ${index + 1}`}
                  className="w-full h-64 object-cover" 
                />
              </div>
            ))}
          </div>
          
          <div className="flex justify-end">
            <button 
              className="px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600"
              onClick={handleCloseCoverSelector}
            >
              Anuluj
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full bg-transparent flex flex-col items-center overflow-hidden">
      {/* Przycisk dodawania gry usunięty */}
      
      {/* Jeśli lista gier jest pusta */}
      {games.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full w-full">
          <div className="text-center">
            <p className="text-xl mb-6 text-gray-300">Brak gier w tej kategorii</p>
            {showAddButton && (
              <button 
                className="px-6 py-3 bg-zinc-600 hover:bg-zinc-700 rounded-lg text-white transition-colors duration-200 shadow-md"
                onClick={handleAddGame}
              >
                Dodaj grę
              </button>
            )}
          </div>
        </div>
      ) : (
        // Wyświetl odpowiedni widok na podstawie ustawień
        <div className="w-full h-full flex-1 overflow-y-auto">
          {displayMode === 'list' ? renderListView() : renderGridView()}
        </div>
      )}
      
      {/* Modal dodawania gry */}
      <AddCustomGame 
        isOpen={showAddGameModal}
        onAddGame={handleSaveGame}
        onCancel={handleCancelAddGame}
      />
      
      {/* Modal wyboru okładki */}
      {renderCoverSelectorModal()}
    </div>
  );
};

export default GameGrid; 
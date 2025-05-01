import React, { useState, useEffect } from 'react';

/**
 * Komponent pozwalający wybrać okładkę dla gry
 * @param {object} props 
 * @param {string} props.gameName - Nazwa gry dla której wyszukujemy okładki
 * @param {function} props.onSelectCover - Funkcja wywołana po wyborze okładki (parametr: url)
 * @param {boolean} props.isLoading - Czy trwa ładowanie okładek
 * @param {array} props.covers - Lista dostępnych okładek
 * @param {function} props.onSearch - Funkcja do wyszukiwania okładek po nazwie gry
 */
const CoverSelector = ({ gameName, onSelectCover, isLoading, covers = [], onSearch }) => {
  const [customUrl, setCustomUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState(gameName || '');
  const [selectedCover, setSelectedCover] = useState(null);

  // Gdy komponent się inicjalizuje, wyszukaj okładki dla podanej nazwy gry
  useEffect(() => {
    if (gameName && onSearch && !covers.length) {
      onSearch(gameName);
    }
  }, [gameName, onSearch]);

  // Obsługa wyszukiwania
  const handleSearch = () => {
    if (searchQuery.trim() && onSearch) {
      onSearch(searchQuery);
    }
  };

  // Obsługa klawisza Enter w polu wyszukiwania
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Obsługa zatwierdzenia wyboru
  const handleConfirm = () => {
    if (selectedCover) {
      onSelectCover(selectedCover);
    } else if (customUrl) {
      onSelectCover(customUrl);
    }
  };

  // Wybór okładki
  const handleCoverClick = (coverUrl) => {
    setSelectedCover(coverUrl);
  };

  return (
    <div className="p-4 bg-zinc-900 border border-zinc-700 rounded-lg">
      <h3 className="text-lg font-medium mb-4">Wybór okładki</h3>
      
      {/* Wyszukiwanie */}
      <div className="mb-6">
        <div className="flex space-x-2 mb-1">
          <input
            type="text"
            className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Nazwa gry"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors"
            onClick={handleSearch}
            disabled={isLoading}
          >
            {isLoading ? 'Szukam...' : 'Szukaj'}
          </button>
        </div>
        <p className="text-xs text-gray-400">
          Wyszukaj okładki na podstawie nazwy gry
        </p>
      </div>
      
      {/* Wyniki wyszukiwania */}
      {isLoading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          <p className="ml-3">Wyszukiwanie okładek...</p>
        </div>
      ) : covers.length > 0 ? (
        <div className="mb-6">
          <h4 className="font-medium mb-2">Dostępne okładki ({covers.length})</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto p-2">
            {covers.map((cover) => (
              <div
                key={cover.id}
                className={`relative cursor-pointer border-2 rounded overflow-hidden transition-all ${
                  selectedCover === cover.url ? 'border-blue-500 scale-105' : 'border-transparent hover:border-zinc-500'
                }`}
                onClick={() => handleCoverClick(cover.url)}
              >
                <img
                  src={cover.thumb || cover.url}
                  alt={`Okładka ${cover.type}`}
                  className="w-full h-36 object-cover"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '../assets/icons/no-cover.png';
                  }}
                />
                {selectedCover === cover.url && (
                  <div className="absolute top-1 right-1 bg-blue-500 rounded-full p-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-6 text-center text-gray-400">
          <p>Nie znaleziono okładek dla podanej gry.</p>
          <p className="text-sm">Spróbuj zmienić nazwę wyszukiwania lub podaj własny URL.</p>
        </div>
      )}
      
      {/* Własny URL */}
      <div className="mb-6">
        <h4 className="font-medium mb-2">Własny URL okładki</h4>
        <div className="mb-1">
          <input
            type="text"
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="https://przyklad.com/okladka.jpg"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
          />
        </div>
        <p className="text-xs text-gray-400">
          Podaj adres URL obrazu okładki, jeśli nie znalazłeś odpowiedniej powyżej
        </p>
      </div>
      
      {/* Przyciski akcji */}
      <div className="flex justify-end space-x-3">
        <button
          className="px-4 py-2 bg-zinc-700 text-white rounded hover:bg-zinc-600 transition-colors"
          onClick={() => onSelectCover(null)}
        >
          Anuluj
        </button>
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors"
          onClick={handleConfirm}
          disabled={!selectedCover && !customUrl}
        >
          Wybierz
        </button>
      </div>
    </div>
  );
};

export default CoverSelector; 
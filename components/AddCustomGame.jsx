import React, { useState } from 'react';
import CoverSelector from './CoverSelector';

/**
 * Komponent do dodawania niestandardowych gier przez użytkownika
 * @param {object} props 
 * @param {function} props.onAddGame - Funkcja wywoływana po dodaniu gry
 * @param {function} props.onCancel - Funkcja wywoływana po anulowaniu
 * @param {boolean} props.isOpen - Czy modal jest otwarty
 */
const AddCustomGame = ({ onAddGame, onCancel, isOpen }) => {
  const [gameTitle, setGameTitle] = useState('');
  const [executablePath, setExecutablePath] = useState('');
  const [launchCommand, setLaunchCommand] = useState('');
  const [installDir, setInstallDir] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [showCoverSelector, setShowCoverSelector] = useState(false);
  const [covers, setCovers] = useState([]);
  const [isLoadingCovers, setIsLoadingCovers] = useState(false);
  const [error, setError] = useState('');
  const [launchType, setLaunchType] = useState('executable'); // 'executable' lub 'command'
  const [step, setStep] = useState(1); // Krok 1: Wybór pliku, Krok 2: Reszta formularza

  // Jeśli modal nie jest otwarty, nie renderuj komponentu
  if (!isOpen) return null;

  // Walidacja formularza przed dodaniem gry
  const validateForm = () => {
    if (!gameTitle.trim()) {
      setError('Nazwa gry jest wymagana');
      return false;
    }

    if (launchType === 'executable' && !executablePath.trim()) {
      setError('Ścieżka do pliku wykonywalnego jest wymagana');
      return false;
    }

    if (launchType === 'command' && !launchCommand.trim()) {
      setError('Komenda uruchamiająca jest wymagana');
      return false;
    }

    setError('');
    return true;
  };

  // Funkcja dodająca grę
  const handleAddGame = async () => {
    if (!validateForm()) return;

    try {
      // Przygotuj dane gry
      const gameData = {
        title: gameTitle,
        platform: 'other',
        custom: true
      };

      // W zależności od rodzaju uruchamiania, dodaj odpowiednie pola
      if (launchType === 'executable') {
        gameData.executablePath = executablePath;
        gameData.installDir = installDir || getDirectoryFromPath(executablePath);
      } else {
        gameData.launchCommand = launchCommand;
      }

      // Dodaj okładkę jeśli wybrana
      if (coverUrl) {
        gameData.coverUrl = coverUrl;
      }

      // Wywołaj funkcję dodającą grę
      await onAddGame(gameData);
    } catch (error) {
      setError(`Błąd podczas dodawania gry: ${error.message}`);
    }
  };

  // Funkcja wyszukiwania okładek
  const handleSearchCovers = async (searchQuery) => {
    try {
      setIsLoadingCovers(true);
      if (window.electronAPI && window.electronAPI.searchCovers) {
        const results = await window.electronAPI.searchCovers(searchQuery);
        setCovers(results || []);
      }
    } catch (error) {
      // Obsługa błędu
    } finally {
      setIsLoadingCovers(false);
    }
  };

  // Funkcja wyboru okładki
  const handleSelectCover = (url) => {
    if (url) {
      setCoverUrl(url);
    }
    setShowCoverSelector(false);
  };

  // Funkcja do wyboru pliku wykonywalnego
  const handleBrowseExecutable = async () => {
    try {
      if (window.electronAPI && window.electronAPI.selectFile) {
        const filePath = await window.electronAPI.selectFile({
          title: 'Wybierz plik wykonywalny gry',
          filters: [
            { name: 'Pliki wykonywalne', extensions: ['exe'] },
            { name: 'Wszystkie pliki', extensions: ['*'] }
          ]
        });
        
        if (filePath) {
          setExecutablePath(filePath);
          // Jeśli nie wybrano katalogu instalacji, użyj katalogu pliku wykonywalnego
          if (!installDir) {
            setInstallDir(getDirectoryFromPath(filePath));
          }
          
          // Jeśli nie podano nazwy gry, użyj nazwy pliku (bez rozszerzenia)
          if (!gameTitle) {
            const fileName = filePath.split('\\').pop().split('/').pop();
            const gameName = fileName.replace(/\.[^/.]+$/, ''); // Usuń rozszerzenie
            setGameTitle(gameName);
          }
          
          // Przejdź do drugiego kroku
          setStep(2);
        }
      }
    } catch (error) {
      // Obsługa błędu
    }
  };

  // Funkcja do wyboru katalogu instalacji
  const handleBrowseInstallDir = async () => {
    try {
      if (window.electronAPI && window.electronAPI.selectDirectory) {
        const dirPath = await window.electronAPI.selectDirectory({
          title: 'Wybierz katalog instalacji gry'
        });
        
        if (dirPath) {
          setInstallDir(dirPath);
        }
      }
    } catch (error) {
      // Obsługa błędu
    }
  };
  
  // Funkcja pomocnicza do wyciągania ścieżki katalogu ze ścieżki pliku
  const getDirectoryFromPath = (filePath) => {
    if (!filePath) return '';
    const lastSlashIndex = Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/'));
    return lastSlashIndex > 0 ? filePath.substring(0, lastSlashIndex) : '';
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Krok 1: Wybierz plik wykonywalny gry</h3>
      
      <div className="flex flex-col items-center justify-center py-8">
        <p className="text-center mb-6 text-gray-300">
          Aby dodać grę, wybierz jej plik wykonywalny (.exe)
        </p>
        <button
          className="px-6 py-3 bg-zinc-700 text-white rounded-md hover:bg-zinc-600 transition-colors flex items-center"
          onClick={handleBrowseExecutable}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Wybierz plik .exe
        </button>
        
        {executablePath && (
          <div className="mt-4 text-gray-300 text-center break-all">
            <p className="font-medium">Wybrany plik:</p>
            <p className="bg-zinc-800 p-2 rounded mt-1">{executablePath}</p>
            <button 
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors"
              onClick={() => setStep(2)}
            >
              Kontynuuj
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Krok 2: Uzupełnij informacje o grze</h3>
      
      {/* Nazwa gry */}
      <div>
        <label className="block font-medium mb-1">Nazwa gry</label>
        <input 
          type="text"
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="np. Wiedźmin 3: Dziki Gon"
          value={gameTitle}
          onChange={(e) => setGameTitle(e.target.value)}
        />
      </div>
      
      {/* Typ uruchamiania */}
      <div>
        <label className="block font-medium mb-2">Sposób uruchamiania</label>
        <div className="flex space-x-4">
          <label className="flex items-center cursor-pointer">
            <input 
              type="radio"
              className="form-radio h-4 w-4 text-blue-600 focus:ring-blue-500"
              checked={launchType === 'executable'}
              onChange={() => setLaunchType('executable')}
            />
            <span className="ml-2">Plik wykonywalny</span>
          </label>
          <label className="flex items-center cursor-pointer">
            <input 
              type="radio"
              className="form-radio h-4 w-4 text-blue-600 focus:ring-blue-500"
              checked={launchType === 'command'}
              onChange={() => setLaunchType('command')}
            />
            <span className="ml-2">Komenda</span>
          </label>
        </div>
      </div>
      
      {/* Pola zależne od typu uruchamiania */}
      {launchType === 'executable' ? (
        <>
          {/* Ścieżka do pliku wykonywalnego */}
          <div>
            <label className="block font-medium mb-1">Plik wykonywalny</label>
            <div className="flex space-x-2">
              <input 
                type="text"
                className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="C:\Gry\MojaGra\bin\gra.exe"
                value={executablePath}
                onChange={(e) => setExecutablePath(e.target.value)}
              />
              <button
                className="px-3 py-2 bg-zinc-700 text-white rounded hover:bg-zinc-600 transition-colors"
                onClick={handleBrowseExecutable}
              >
                Przeglądaj...
              </button>
            </div>
          </div>
          
          {/* Katalog instalacji */}
          <div>
            <label className="block font-medium mb-1">Katalog instalacji (opcjonalnie)</label>
            <div className="flex space-x-2">
              <input 
                type="text"
                className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="C:\Gry\MojaGra"
                value={installDir}
                onChange={(e) => setInstallDir(e.target.value)}
              />
              <button
                className="px-3 py-2 bg-zinc-700 text-white rounded hover:bg-zinc-600 transition-colors"
                onClick={handleBrowseInstallDir}
              >
                Przeglądaj...
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Komenda uruchamiająca */}
          <div>
            <label className="block font-medium mb-1">Komenda uruchamiająca</label>
            <input 
              type="text"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="np. steam://rungameid/292030"
              value={launchCommand}
              onChange={(e) => setLaunchCommand(e.target.value)}
            />
          </div>
        </>
      )}
      
      {/* Okładka */}
      <div>
        <label className="block font-medium mb-1">Okładka gry</label>
        <div className="flex space-x-4 items-center">
          {coverUrl ? (
            <div className="relative w-24 h-32 rounded overflow-hidden shadow-md">
              <img 
                src={coverUrl} 
                alt="Okładka gry" 
                className="w-full h-full object-cover"
              />
              <button 
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center"
                onClick={() => setCoverUrl('')}
              >
                ×
              </button>
            </div>
          ) : (
            <div className="w-24 h-32 bg-zinc-800 border border-zinc-700 rounded flex items-center justify-center text-gray-400">
              Brak okładki
            </div>
          )}
          
          <button
            className="px-3 py-2 bg-zinc-700 text-white rounded hover:bg-zinc-600 transition-colors"
            onClick={() => setShowCoverSelector(true)}
          >
            {coverUrl ? 'Zmień okładkę' : 'Wybierz okładkę'}
          </button>
        </div>
      </div>
      
      {/* Przycisk powrotu do poprzedniego kroku */}
      <div className="mt-2">
        <button 
          className="text-blue-400 hover:text-blue-300 hover:underline"
          onClick={() => setStep(1)}
        >
          ← Wróć do wyboru pliku
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-zinc-900 w-full max-w-2xl rounded-lg shadow-lg overflow-hidden">
        {/* Nagłówek */}
        <div className="p-4 border-b border-zinc-700 flex justify-between items-center">
          <h2 className="text-xl font-medium">Dodaj własną grę</h2>
          <button 
            className="text-gray-400 hover:text-white"
            onClick={onCancel}
          >
            ✕
          </button>
        </div>
        
        {/* Zawartość */}
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          {showCoverSelector ? (
            <CoverSelector 
              gameName={gameTitle}
              onSelectCover={handleSelectCover}
              isLoading={isLoadingCovers}
              covers={covers}
              onSearch={handleSearchCovers}
            />
          ) : (
            step === 1 ? renderStep1() : renderStep2()
          )}
          
          {/* Komunikat o błędzie */}
          {error && (
            <div className="mt-4 p-3 bg-red-900 bg-opacity-50 text-red-200 rounded">
              {error}
            </div>
          )}
        </div>
        
        {/* Przyciski akcji */}
        <div className="p-4 border-t border-zinc-700 flex justify-between">
          <button 
            className="px-4 py-2 bg-zinc-800 text-white rounded hover:bg-zinc-700 transition-colors"
            onClick={onCancel}
          >
            Anuluj
          </button>
          
          {step === 2 && !showCoverSelector && (
            <button 
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors"
              onClick={handleAddGame}
            >
              Dodaj grę
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddCustomGame; 
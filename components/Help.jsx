import React from 'react';
import appIcon from '../assets/icons/app-icon.png';

const Help = () => {
  const handleOpenLink = (url) => {
    if (window.electronAPI && window.electronAPI.openExternalLink) {
      window.electronAPI.openExternalLink(url);
    } else {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto p-4 md:p-6">
      <div className="w-full max-w-4xl mx-auto bg-zinc-800/90 rounded-xl p-6 shadow-lg border border-zinc-700">
        <div className="flex items-center mb-6">
          <img src={appIcon} alt="xitali Game Launcher" className="w-16 h-16 mr-4" />
          <h1 className="text-2xl font-bold text-white">Pomoc i informacje o xitali Game Launcher</h1>
        </div>
        
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-300 mb-4 pb-2 border-b border-zinc-700">O aplikacji</h2>
          <p className="mb-3 text-gray-300">
            xitali Game Launcher to aplikacja stworzona, aby uprościć zarządzanie biblioteką gier z różnych platform.
            Pozwala ona na wyświetlanie i uruchamianie gier z takich platform jak Steam, Epic Games, Origin, Battle.net, 
            GOG i Xbox, a także umożliwia dodawanie własnych gier.
          </p>
          <p className="mb-3 text-gray-300">
            Wersja aplikacji: 1.0.5
          </p>
        </section>
        
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-300 mb-4 pb-2 border-b border-zinc-700">Funkcje</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-300 pl-4">
            <li>Automatyczne wykrywanie gier zainstalowanych na komputerze</li>
            <li>Możliwość uruchamiania gier bezpośrednio z launchera</li>
            <li>Wyszukiwanie gier w bibliotece</li>
            <li>Filtry umożliwiające wyświetlanie gier z konkretnych platform</li>
            <li>Możliwość dodawania własnych gier do biblioteki</li>
            <li>Automatyczne pobieranie okładek gier</li>
            <li>Automatyczne aktualizacje aplikacji</li>
          </ul>
        </section>
        
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-300 mb-4 pb-2 border-b border-zinc-700">Jak korzystać z aplikacji</h2>
          
          <div className="mb-4 bg-zinc-700/30 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-white mb-2">Przeglądanie biblioteki gier</h3>
            <p className="text-gray-300">
              Użyj menu po lewej stronie, aby wybrać platformę, której gry chcesz wyświetlić. 
              Możesz również użyć pola wyszukiwania, aby znaleźć konkretną grę.
            </p>
          </div>
          
          <div className="mb-4 bg-zinc-700/30 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-white mb-2">Uruchamianie gier</h3>
            <p className="text-gray-300">
              Aby uruchomić grę, wystarczy kliknąć na jej kafelek w bibliotece. 
              Launcher automatycznie uruchomi odpowiednią platformę (jeśli jest wymagana) i samą grę.
            </p>
          </div>
          
          <div className="mb-4 bg-zinc-700/30 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-white mb-2">Dodawanie własnych gier</h3>
            <p className="text-gray-300">
              Aby dodać własną grę, przejdź do sekcji "Customs" i kliknij przycisk "+" w prawym górnym rogu. 
              Wypełnij formularz, podając nazwę gry, ścieżkę do pliku wykonywalnego i wybierz okładkę.
            </p>
          </div>
        </section>
        
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-300 mb-4 pb-2 border-b border-zinc-700">Rozwiązywanie problemów</h2>
          
          <div className="mb-4 bg-zinc-700/30 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-white mb-2">Gra nie uruchamia się</h3>
            <p className="text-gray-300">
              Upewnij się, że ścieżka do pliku wykonywalnego jest poprawna. W przypadku gier z platform jak Epic czy Origin, 
              upewnij się, że odpowiedni launcher jest zainstalowany i zaktualizowany.
            </p>
          </div>
          
          <div className="mb-4 bg-zinc-700/30 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-white mb-2">Brak okładki gry</h3>
            <p className="text-gray-300">
              Launcher próbuje automatycznie pobrać okładki, ale czasem może to nie zadziałać. 
              Dla niestandardowych gier możesz ręcznie wybrać plik obrazu jako okładkę lub kliknąć prawym przyciskiem myszy na kafelek gry, aby wyszukać alternatywne okładki.
            </p>
          </div>
          
          <div className="mb-4 bg-zinc-700/30 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-white mb-2">Nie wszystkie gry są wykrywane</h3>
            <p className="text-gray-300">
              Sprawdź w ustawieniach ścieżki do folderów instalacyjnych platform. 
              Możesz je zmienić, jeśli masz niestandardową lokalizację instalacji gier.
            </p>
          </div>
        </section>
        
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-300 mb-4 pb-2 border-b border-zinc-700">Kontakt i wsparcie</h2>
          <p className="mb-4 text-gray-300">
            Jeśli potrzebujesz pomocy lub masz sugestie dotyczące aplikacji, skontaktuj się z nami:
          </p>
          <div className="flex flex-wrap gap-4 mt-4">
            <button 
              onClick={() => handleOpenLink('https://github.com/xitali/xitaliGL')} 
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg flex items-center transition-colors"
            >
              <span className="mr-2">GitHub</span>
            </button>
            <button 
              onClick={() => handleOpenLink('mailto:emanuel.wloch@gmail.com')} 
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg flex items-center transition-colors"
            >
              <span className="mr-2">E-mail</span>
            </button>
          </div>
        </section>
        
        <footer className="text-center text-gray-500 pt-4 border-t border-zinc-700">
          <p>© 2025 Emanuel 'xitali' Włoch. Wszelkie prawa zastrzeżone.</p>
        </footer>
      </div>
    </div>
  );
};

export default Help; 
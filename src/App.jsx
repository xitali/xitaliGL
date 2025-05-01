import React, { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import GameGrid from '../components/GameGrid';
import Settings from '../components/Settings';
import Help from '../components/Help';
import LoadingScreen from '../components/LoadingScreen';
import AdBanner from '../components/AdBanner';

function App() {
  const [games, setGames] = useState([]);
  const [activePlatform, setActivePlatform] = useState('all');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredGames, setFilteredGames] = useState([]);
  const [activeView, setActiveView] = useState('games'); // 'games', 'settings', 'help'
  const [appSettings, setAppSettings] = useState({
    theme: 'dark',
    animationsEnabled: true,
    displayMode: 'grid',
    gridSize: 'small', // Zmieniono domyślnie na małe kafelki
    sortOrder: 'name'
  });
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const sidebarRef = useRef(null);
  
  // Dodajemy stan do przechowywania gier z wszystkich platform
  const [allGamesCache, setAllGamesCache] = useState({});
  // Stan określający, czy gry zostały już załadowane
  const [gamesLoaded, setGamesLoaded] = useState(false);

  // Efekt do inicjalizacji ustawień aplikacji i wczytania gier
  useEffect(() => {
    const initialize = async () => {
      try {
        // Pobierz zapisane ustawienia
        if (window.electronAPI && window.electronAPI.getSettings) {
          const savedSettings = await window.electronAPI.getSettings();
          // Inicjalizacja ustawień
          if (savedSettings) {
            if (!savedSettings.hasOwnProperty('_initialized')) {
              savedSettings.gridSize = 'small';
              savedSettings.displayMode = 'grid';
              savedSettings._initialized = true;
              
              if (window.electronAPI.saveSetting) {
                await window.electronAPI.saveSetting('gridSize', 'small');
                await window.electronAPI.saveSetting('displayMode', 'grid');
                await window.electronAPI.saveSetting('_initialized', true);
              }
            }
            
            setAppSettings(prev => ({ ...prev, ...savedSettings }));
            applySettings(savedSettings);
          } else {
            // Zastosuj domyślne ustawienia
            const defaultSettings = { ...appSettings, _initialized: true };
            applySettings(defaultSettings);
            
            if (window.electronAPI.saveSetting) {
              for (const [key, value] of Object.entries(defaultSettings)) {
                await window.electronAPI.saveSetting(key, value);
              }
            }
          }
        } else {
          applySettings(appSettings);
        }
        
        // Wczytaj wszystkie gry tylko raz przy uruchomieniu
        await loadAllGames();
      } catch (error) {
        console.error('Błąd podczas inicjalizacji:', error);
        applySettings(appSettings);
      }
    };
    
    initialize();
  }, []);

  // Efekt do aktualizacji szerokości sidebara w CSS
  useEffect(() => {
    const updateSidebarWidth = () => {
      if (sidebarRef.current) {
        const width = sidebarRef.current.offsetWidth;
        document.documentElement.style.setProperty('--sidebar-width', `${width}px`);
      }
    };

    // Aktualizuj szerokość przy montowaniu
    updateSidebarWidth();

    // Ustaw obserwator zmian rozmiaru
    const resizeObserver = new ResizeObserver(updateSidebarWidth);
    if (sidebarRef.current) {
      resizeObserver.observe(sidebarRef.current);
    }

    return () => {
      if (resizeObserver && sidebarRef.current) {
        resizeObserver.unobserve(sidebarRef.current);
      }
    };
  }, []);

  // Funkcja do wczytywania wszystkich gier tylko raz przy uruchomieniu
  const loadAllGames = async () => {
    setLoading(true);
    try {
      if (window.electronAPI) {
        console.log('Wczytywanie wszystkich gier...');
        // Pobierz gry ze wszystkich platform
        const allPlatforms = ['all', 'steam', 'epic', 'battlenet', 'gog', 'uplay', 'origin', 'xbox', 'other'];
        const cache = {};
        
        // Dodaj niestandardowe gry do cache
        const customGames = await window.electronAPI.getStoredGames('other');
        cache['other'] = customGames;
        console.log(`Załadowano ${customGames.length} niestandardowych gier`);
        
        // Pobierz gry z platformy 'all', która zawiera wszystkie gry
        const allGames = await window.electronAPI.findInstalledGames('all');
        // Połącz gry ze wszystkich platform z niestandardowymi grami
        cache['all'] = [...allGames, ...customGames];
        
        // Pobierz gry z poszczególnych platform
        for (const platform of allPlatforms.filter(p => p !== 'all' && p !== 'other')) {
          const platformGames = await window.electronAPI.findInstalledGames(platform);
          cache[platform] = platformGames;
          console.log(`Załadowano ${platformGames.length} gier dla platformy ${platform}`);
        }
        
        // Zaktualizuj cache i załaduj odpowiednią platformę
        setAllGamesCache(cache);
        setGamesLoaded(true);
        
        // Posortuj i ustaw gry dla aktualnej platformy
        const sortedGames = sortGames(cache[activePlatform] || [], appSettings.sortOrder);
        setGames(sortedGames);
        setFilteredGames(sortedGames);
      } else {
        console.warn('Brak dostępu do API Electron - nie można wykryć gier');
        setGames([]);
        setFilteredGames([]);
      }
    } catch (error) {
      console.error('Błąd podczas wczytywania wszystkich gier:', error);
      setGames([]);
      setFilteredGames([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Funkcja do wczytywania gier zgodnie z wybraną platformą - używa teraz cache
  const loadGamesForPlatform = (platform) => {
    setLoading(true);
    try {
      // Jeśli gry zostały już załadowane, używamy cache
      if (gamesLoaded && allGamesCache[platform]) {
        console.log(`Używam załadowanych gier dla platformy ${platform} (${allGamesCache[platform].length} gier)`);
        
        // Sortowanie gier zgodnie z ustawieniami
        const sortedGames = sortGames(allGamesCache[platform], appSettings.sortOrder);
        
        setGames(sortedGames);
        setFilteredGames(sortedGames);
        setLoading(false);
        return;
      }
      
      // Jeśli nie mamy jeszcze cache, wczytaj wszystkie gry
      if (!gamesLoaded) {
        console.log('Gry nie zostały jeszcze załadowane, ładuję wszystkie gry...');
        loadAllGames();
        return;
      }
      
      // Jeśli z jakiegoś powodu nie ma gier dla platformy w cache, a cache jest już załadowany
      console.warn(`Brak cache dla platformy ${platform}, mimo załadowanych gier`);
      setGames([]);
      setFilteredGames([]);
    } catch (error) {
      console.error('Błąd podczas wczytywania gier:', error);
      setGames([]);
      setFilteredGames([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Funkcja do sortowania gier
  const sortGames = (games, sortOrder) => {
    if (!games || games.length === 0) return [];
    
    const sortedGames = [...games];
    
    switch (sortOrder) {
      case 'name':
        sortedGames.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'name_desc':
        sortedGames.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case 'recent':
        // Sortowanie według lastPlayed (jeśli istnieje)
        sortedGames.sort((a, b) => {
          if (!a.lastPlayed) return 1;
          if (!b.lastPlayed) return -1;
          return new Date(b.lastPlayed) - new Date(a.lastPlayed);
        });
        break;
      case 'added':
        // Sortowanie według dateAdded (jeśli istnieje)
        sortedGames.sort((a, b) => {
          if (!a.dateAdded) return 1;
          if (!b.dateAdded) return -1;
          return new Date(b.dateAdded) - new Date(a.dateAdded);
        });
        break;
      default:
        break;
    }
    
    return sortedGames;
  };

  // Przy zmianie platformy, załaduj odpowiednie gry z cache
  useEffect(() => {
    // Przywróć widok gier jeśli zmieniono platformę
    setActiveView('games');
    setSearchQuery(''); // Resetuj wyszukiwanie przy zmianie platformy
    loadGamesForPlatform(activePlatform);
  }, [activePlatform, gamesLoaded]);
  
  // Przy zmianie ustawień sortowania, posortuj gry
  useEffect(() => {
    const sortedGames = sortGames(games, appSettings.sortOrder);
    setGames(sortedGames);
    setFilteredGames(sortGames(filteredGames, appSettings.sortOrder));
  }, [appSettings.sortOrder]);

  // Efekt do filtrowania gier na podstawie wyszukiwania
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredGames(games);
    } else {
      const filtered = games.filter(game => 
        game.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredGames(filtered);
    }
  }, [games, searchQuery]);

  // Obsługa wyszukiwania
  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  // Obsługa akcji z sidebara
  const handleSidebarAction = (action) => {
    switch(action) {
      case 'settings':
        setActiveView('settings');
        break;
      case 'help':
        setActiveView('help');
        break;
      case 'games':
        setActiveView('games');
        break;
      default:
        break;
    }
  };
  
  // Obsługa zmiany ustawień
  const handleSettingsChange = (newSettings) => {
    setAppSettings(prev => ({ ...prev, ...newSettings }));
    applySettings({ ...appSettings, ...newSettings });
    
    // Jeśli zmieniono sortowanie, odśwież listę gier
    if (newSettings.sortOrder && newSettings.sortOrder !== appSettings.sortOrder) {
      const sortedGames = sortGames(games, newSettings.sortOrder);
      setGames(sortedGames);
      setFilteredGames(sortGames(filteredGames, newSettings.sortOrder));
    }
  };

  // Konwersja id platformy na czytelną nazwę
  const getPlatformName = (platformId) => {
    const platformNames = {
      'all': 'Wszystkie Gry',
      'steam': 'Steam',
      'epic': 'Epic Games',
      'origin': 'Origin',
      'battlenet': 'Battle.net',
      'xbox': 'Xbox',
      'gog': 'GOG',
      'uplay': 'Ubisoft',
      'other': 'Niestandardowe'
    };
    return platformNames[platformId] || platformId;
  };

  // Obsługa zdarzeń okna aplikacji
  const handleWindowControl = (action) => {
    if (window.electronAPI) {
      switch (action) {
        case 'minimize':
          window.electronAPI.minimizeApp();
          break;
        case 'maximize':
          window.electronAPI.maximizeApp();
          break;
        case 'close':
          window.electronAPI.closeApp();
          break;
        default:
          break;
      }
    }
  };

  // Funkcja do obsługi przeciągania okna
  const handleDragWindow = () => {
    if (window.electronAPI && window.electronAPI.dragWindow) {
      window.electronAPI.dragWindow();
    }
  };

  // Funkcja do pobierania aktualnych ścieżek dla platform
  const getPlatformPaths = async () => {
    if (window.electronAPI && window.electronAPI.getPlatformPaths) {
      try {
        // Pobierz zapisane ścieżki
        const savedPaths = await window.electronAPI.getPlatformPaths();
        
        // Sprawdź, czy mamy wszystkie ścieżki
        const platforms = ['steam', 'epic', 'origin', 'battlenet', 'xbox', 'gog', 'uplay'];
        let needsUpdate = false;
        let updatedPaths = {...savedPaths};
        
        // Automatyczne wykrywanie ścieżek dla brakujących platform
        for (const platform of platforms) {
          if (!savedPaths[platform]) {
            needsUpdate = true;
            // Jeśli jest dostępna funkcja do automatycznego wykrywania
            if (window.electronAPI.autoDetectPlatformPath) {
              const detectedPath = await window.electronAPI.autoDetectPlatformPath(platform);
              if (detectedPath) {
                updatedPaths[platform] = detectedPath;
                
                // Zapisz wykrytą ścieżkę
                if (window.electronAPI.updatePlatformPath) {
                  await window.electronAPI.updatePlatformPath(platform, detectedPath);
                }
                
                console.log(`Automatycznie wykryto ścieżkę dla ${platform}: ${detectedPath}`);
              }
            }
          }
        }
        
        return updatedPaths;
      } catch (error) {
        console.error('Błąd podczas pobierania ścieżek platform:', error);
        return {};
      }
    }
    return {};
  };
  
  // Funkcja do zastosowania ustawień
  const applySettings = (settings) => {
    // Zawsze stosuj ciemny motyw
    const rootElement = document.documentElement;
    document.body.classList.add('dark-theme');
    document.body.classList.remove('light-theme');
    
    // Początkowa wartość szerokości sidebara
    rootElement.style.setProperty('--sidebar-width', '220px');
    
    // Ustawienie ciemnego motywu w odcieniach szarości
    rootElement.style.setProperty('--bg-primary', '#202020'); // Główne tło
    rootElement.style.setProperty('--bg-secondary', '#282828');
    rootElement.style.setProperty('--bg-sidebar', '#121212'); // Ciemniejszy sidebar
    rootElement.style.setProperty('--bg-sidebar-item', '#2d2d2d');
    rootElement.style.setProperty('--text-primary', '#ffffff');
    rootElement.style.setProperty('--text-secondary', '#b3b3b3');
    rootElement.style.setProperty('--border-color', '#3a3a3a');
    rootElement.style.setProperty('--card-bg', '#252525');
    rootElement.style.setProperty('--card-hover', '#2d2d2d');
    rootElement.style.setProperty('--accent-color', '#505050');
    
    // Zastosuj ustawienia animacji
    rootElement.style.setProperty('--transition-speed', settings.animationsEnabled ? '0.3s' : '0s');
    if (settings.animationsEnabled) {
      document.body.classList.remove('no-animations');
    } else {
      document.body.classList.add('no-animations');
    }
    
    // Zastosuj rozmiar kafelków
    document.body.setAttribute('data-grid-size', settings.gridSize);
    
    // Zastosuj tryb wyświetlania
    document.body.setAttribute('data-display-mode', settings.displayMode);
  };

  // Renderowanie aktualnego widoku
  const renderActiveView = () => {
    switch (activeView) {
      case 'games':
        return (
          <GameGrid 
            games={filteredGames} 
            currentPlatform={activePlatform} 
            displayMode={appSettings.displayMode}
            gridSize={appSettings.gridSize}
          />
        );
      case 'settings':
        // Nie renderujemy ustawień tutaj, są renderowane bezpośrednio w warunku
        return null;
      case 'help':
        return <Help />;
      default:
        return (
          <GameGrid 
            games={filteredGames} 
            currentPlatform={activePlatform} 
            displayMode={appSettings.displayMode}
            gridSize={appSettings.gridSize}
          />
        );
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-transparent">
      {/* Niewidoczny pasek tytułowy do przeciągania okna */}
      <div className="titlebar"></div>
      
      <div ref={sidebarRef} className="z-20">
        <Sidebar 
          activePlatform={activePlatform} 
          setActivePlatform={setActivePlatform} 
          onSearch={handleSearch}
          onAction={handleSidebarAction}
          activeView={activeView}
        />
      </div>
      
      <main className="flex-1 h-full flex flex-col w-full" style={{ width: 'calc(100% - var(--sidebar-width, 220px))' }}>
        <div className="flex-1 overflow-auto w-full h-full pb-10" style={{ marginBottom: '40px' }}>
          {activeView === 'settings' ? (
            <div className="w-full h-full">
              <Settings 
                settings={appSettings} 
                onSettingsChange={handleSettingsChange}
                platformPaths={getPlatformPaths}
                updatePlatformPath={window.electronAPI?.updatePlatformPath}
              />
            </div>
          ) : (
            renderActiveView()
          )}
        </div>
        
        {/* Banery reklamowe bez granatowego tła */}
        <AdBanner />
      </main>
      
      {/* Ekran ładowania */}
      {loading && <LoadingScreen />}
    </div>
  );
}

export default App; 
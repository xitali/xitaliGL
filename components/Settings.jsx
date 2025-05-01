import React, { useState, useEffect } from 'react';
import appIcon from '../assets/icons/app-icon.png';
import SettingsPanel from './SettingsPanel';

// Komponent pojedynczego ustawienia (etykieta + opcje)
const SettingsOption = ({ label, children }) => {
  return (
    <div className="flex items-center justify-between py-3 w-full border-b border-zinc-800 last:border-0">
      <div className="text-gray-200 font-medium">{label}</div>
      <div className="flex space-x-2 ml-auto">
        {children}
      </div>
    </div>
  );
};

// Komponent przycisku opcji
const OptionButton = ({ selected, onClick, children }) => {
  return (
    <button
      className={`px-4 py-1.5 rounded-md transition-colors ${
        selected ? 'bg-zinc-600 text-white' : 'bg-zinc-800 text-gray-300 hover:bg-zinc-700'
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
};

// Komponent przełącznika
const ToggleSwitch = ({ checked, onChange, label }) => {
  return (
    <label className="flex items-center cursor-pointer">
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
      </div>
    </label>
  );
};

// Komponent pola tekstowego z przyciskami dla ścieżek platform
const PathInputGroup = ({ platform, platformLabel, value, onChange, onBrowse, onSave }) => {
  return (
    <div className="flex items-center w-full justify-between py-3 border-b border-zinc-800 last:border-0">
      <div className="text-gray-200 font-medium">{platformLabel}</div>
      <div className="flex items-center gap-2 ml-auto">
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(platform, e.target.value)}
          placeholder={`Ścieżka do ${platformLabel}`}
          className="bg-zinc-800 text-gray-100 px-3 py-1.5 rounded-md outline-none focus:ring-1 focus:ring-blue-500 text-sm min-w-[200px] w-[300px]"
        />
        <button 
          onClick={() => onBrowse(platform)}
          className="px-3 py-1.5 bg-zinc-800 text-gray-300 rounded-md hover:bg-zinc-700 text-sm whitespace-nowrap transition-colors"
        >
          Przeglądaj
        </button>
        <button 
          onClick={() => onSave(platform)}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-500 text-sm whitespace-nowrap transition-colors"
        >
          Zapisz
        </button>
      </div>
    </div>
  );
};

// Domyślne ścieżki dla platform
const defaultPlatformPaths = {
  'steam': 'C:\\Program Files (x86)\\Steam',
  'epic': 'C:\\Program Files\\Epic Games',
  'origin': 'C:\\Program Files\\Electronic Arts\\EA Desktop\\EA Desktop',
  'uplay': 'C:\\Program Files (x86)\\Ubisoft\\Ubisoft Game Launcher',
  'battlenet': 'C:\\Program Files (x86)\\Battle.net',
  'gog': 'C:\\Program Files (x86)\\GOG Galaxy',
  'xbox': 'C:\\Program Files\\WindowsApps'
};

const Settings = ({ settings, onSettingsChange, platformPaths, updatePlatformPath }) => {
  // Stan dla otwartych paneli
  const [openPanels, setOpenPanels] = useState({
    theme: true,  // Otwórzmy domyślnie pierwszy panel
    paths: false,
    performance: false,
    notifications: false,
    misc: false,
    about: false
  });
  
  const [localSettings, setLocalSettings] = useState({
    theme: 'dark',
    animationsEnabled: true,
    displayMode: 'grid',
    gridSize: 'medium',
    sortOrder: 'name',
    showTrayIcon: true,
    launchOnStartup: false,
    closeAfterGameLaunch: 'minimize',
    useHotkey: false,
    performanceMode: false,
    autoUpdate: true,
    showNotifications: true,
    minimizeToTray: true,
    showGamesCount: true,
    checkUpdatesOnStartup: true,
    rememberWindowPosition: true,
    language: 'pl',
    showFPS: false,
    hardwareAcceleration: true,
    customShortcuts: false,
    autoScan: true,
    ...(settings || {})
  });
  
  // Używamy domyślnych ścieżek jako fallback
  const [paths, setPaths] = useState(() => {
    const initialPaths = { ...defaultPlatformPaths };
    
    // Jeśli mamy zapisane ścieżki, użyjmy ich
    if (platformPaths) {
      for (const [platform, path] of Object.entries(platformPaths)) {
        if (path) {
          initialPaths[platform] = path;
        }
      }
    }
    
    return initialPaths;
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Etykiety platform
  const platformLabels = {
    'steam': 'Steam',
    'epic': 'Epic Games',
    'origin': 'EA App / Origin',
    'uplay': 'Ubisoft Connect',
    'battlenet': 'Battle.net',
    'gog': 'GOG Galaxy',
    'xbox': 'Xbox'
  };

  // Pobierz ścieżki platform
  useEffect(() => {
    setLocalSettings(settings || {});
    
    // Zaktualizuj ścieżki, ale zachowaj domyślne jeśli brakuje
    if (platformPaths) {
      setPaths(prev => {
        const updatedPaths = { ...prev };
        for (const [platform, path] of Object.entries(platformPaths)) {
          if (path) {
            updatedPaths[platform] = path;
          }
        }
        return updatedPaths;
      });
    }
    
    setIsLoading(false);
  }, [settings, platformPaths]);

  // Efekt do nasłuchiwania zmiany ustawień, które wymagają restartu
  useEffect(() => {
    // Funkcja do obsługi ustawień wymagających restartu
    const handleSettingRequiresRestart = (event) => {
      const setting = event.detail;
      showMessage(`Zmiana ustawienia "${setting}" wymaga ponownego uruchomienia aplikacji aby zostać w pełni zastosowana.`, 'warning', 5000);
    };

    // Dodanie nasłuchiwania z API Electron
    window.addEventListener('setting-requires-restart', handleSettingRequiresRestart);

    return () => {
      window.removeEventListener('setting-requires-restart', handleSettingRequiresRestart);
    };
  }, []);

  // Funkcja do wyświetlania komunikatów
  const showMessage = (text, type, duration = 3000) => {
    setMessage({ text, type });
    
    if (duration) {
      setTimeout(() => {
        setMessage({ text: '', type: '' });
      }, duration);
    }
  };

  // Obsługa zmiany ustawień
  const handleUpdateSetting = (key, value) => {
    setLocalSettings(prev => {
      const updated = { ...prev, [key]: value };
      
      // Specjalna obsługa dla niektórych ustawień
      if (key === 'rememberWindowPosition') {
        if (value) {
          showMessage('Pozycja okna będzie zapamiętywana przy zamknięciu', 'success');
        } else {
          showMessage('Pozycja okna nie będzie zapamiętywana', 'success');
        }
      }
      else if (key === 'launchOnStartup') {
        if (value) {
          showMessage('Aplikacja będzie uruchamiana przy starcie systemu', 'success');
        } else {
          showMessage('Aplikacja nie będzie uruchamiana przy starcie systemu', 'success');
        }
      }
      else if (key === 'hardwareAcceleration') {
        showMessage('Zmiana akceleracji sprzętowej wymaga ponownego uruchomienia aplikacji', 'warning', 5000);
      }
      else if (key === 'useHotkey') {
        if (value) {
          showMessage('Skrót klawiaturowy Ctrl+Shift+Z został aktywowany', 'success');
        } else {
          showMessage('Skrót klawiaturowy został dezaktywowany', 'success');
        }
      }
      else if (key === 'language') {
        showMessage(`Język aplikacji został zmieniony na ${value === 'pl' ? 'Polski' : 'English'}`, 'success');
      }
      
      if (onSettingsChange) {
        onSettingsChange(updated);
      }
      return updated;
    });
    
    // Wywołaj API Electron do zapisania ustawienia
    if (window.electronAPI && window.electronAPI.saveSetting) {
      window.electronAPI.saveSetting(key, value)
        .then(success => {
          if (!success) {
            showMessage(`Nie udało się zapisać ustawienia: ${key}`, 'error');
          }
        })
        .catch(error => {
          console.error('Błąd podczas zapisywania ustawienia:', error);
          showMessage('Wystąpił błąd podczas zapisywania ustawienia', 'error');
        });
    }
  };

  // Otwieranie/zamykanie paneli
  const togglePanel = (panelName) => {
    setOpenPanels(prev => ({
      ...prev,
      [panelName]: !prev[panelName]
    }));
  };

  // Obsługa zmiany ścieżki
  const handlePathChange = (platform, value) => {
    setPaths(prev => ({
      ...prev,
      [platform]: value
    }));
  };

  // Obsługa przeglądania ścieżki
  const handleBrowsePath = async (platform) => {
    if (window.electronAPI && window.electronAPI.openDirectoryDialog) {
      try {
        const result = await window.electronAPI.openDirectoryDialog();
        if (result && !result.canceled && result.filePaths && result.filePaths.length > 0) {
          handlePathChange(platform, result.filePaths[0]);
        }
      } catch (error) {
        console.error('Błąd podczas wybierania folderu:', error);
        setMessage({ text: 'Nie udało się wybrać folderu', type: 'error' });
        setTimeout(() => setMessage({ text: '', type: '' }), 3000);
      }
    }
  };

  // Obsługa zapisywania ścieżki
  const handleSavePath = async (platform) => {
    if (paths[platform] && updatePlatformPath) {
      const success = await updatePlatformPath(platform, paths[platform]);
      if (success) {
        setMessage({ text: `Ścieżka do ${platformLabels[platform]} została zapisana`, type: 'success' });
      } else {
        setMessage({ text: `Nie udało się zapisać ścieżki dla ${platformLabels[platform]}`, type: 'error' });
      }
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    }
  };

  // Obsługa resetowania ustawień
  const handleClearSettingsAndCache = async () => {
    if (window.confirm('Czy na pewno chcesz zresetować wszystkie ustawienia? Ta operacja jest nieodwracalna i spowoduje ponowne uruchomienie aplikacji.')) {
      if (window.electronAPI && window.electronAPI.resetSettings) {
        await window.electronAPI.resetSettings();
      }
    }
  };
  
  // Obsługa otwierania linków
  const handleOpenLink = (url) => {
    if (window.electronAPI && window.electronAPI.openExternalLink) {
      window.electronAPI.openExternalLink(url);
    } else {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-transparent p-0">
      <div className="w-full h-full bg-transparent rounded-none p-6 shadow-lg border-none">
        <h1 className="text-2xl font-bold text-white mb-6">Ustawienia</h1>
        
        {/* Komunikat */}
        {message.text && (
          <div className={`mb-4 p-3 rounded-md ${message.type === 'success' ? 'bg-green-800 text-green-100' : 'bg-red-800 text-red-100'}`}>
            {message.text}
          </div>
        )}
        
        {/* Panel Wyglądu */}
        <SettingsPanel 
          title="Wygląd" 
          description="Dostosuj wygląd aplikacji"
          isOpen={openPanels.theme}
          onToggle={() => togglePanel('theme')}
          icon="🎨"
        >
          <SettingsOption label="Animacje">
            <ToggleSwitch 
              checked={localSettings.animationsEnabled === true} 
              onChange={() => handleUpdateSetting('animationsEnabled', !localSettings.animationsEnabled)}
            />
          </SettingsOption>
          
          <SettingsOption label="Tryb wyświetlania">
            <div className="flex items-center justify-end gap-1 w-auto ml-auto">
              <OptionButton 
                selected={localSettings.displayMode === 'grid'} 
                onClick={() => handleUpdateSetting('displayMode', 'grid')}
              >
                Siatka
              </OptionButton>
              <OptionButton 
                selected={localSettings.displayMode === 'list'} 
                onClick={() => handleUpdateSetting('displayMode', 'list')}
              >
                Lista
              </OptionButton>
            </div>
          </SettingsOption>
          
          <SettingsOption label="Rozmiar kafelków">
            <div className="flex items-center justify-end gap-1 w-auto ml-auto">
              <OptionButton 
                selected={localSettings.gridSize === 'small'} 
                onClick={() => handleUpdateSetting('gridSize', 'small')}
              >
                Małe
              </OptionButton>
              <OptionButton 
                selected={localSettings.gridSize === 'medium'} 
                onClick={() => handleUpdateSetting('gridSize', 'medium')}
              >
                Średnie
              </OptionButton>
              <OptionButton 
                selected={localSettings.gridSize === 'large'} 
                onClick={() => handleUpdateSetting('gridSize', 'large')}
              >
                Duże
              </OptionButton>
            </div>
          </SettingsOption>

          <SettingsOption label="Sortowanie">
            <div className="flex items-center justify-end gap-1 w-auto ml-auto flex-wrap">
              <OptionButton 
                selected={localSettings.sortOrder === 'name'} 
                onClick={() => handleUpdateSetting('sortOrder', 'name')}
              >
                A-Z
              </OptionButton>
              <OptionButton 
                selected={localSettings.sortOrder === 'name_desc'} 
                onClick={() => handleUpdateSetting('sortOrder', 'name_desc')}
              >
                Z-A
              </OptionButton>
              <OptionButton 
                selected={localSettings.sortOrder === 'recent'} 
                onClick={() => handleUpdateSetting('sortOrder', 'recent')}
              >
                Ostatnio grane
              </OptionButton>
              <OptionButton 
                selected={localSettings.sortOrder === 'added'} 
                onClick={() => handleUpdateSetting('sortOrder', 'added')}
              >
                Data dodania
              </OptionButton>
            </div>
          </SettingsOption>
        </SettingsPanel>
        
        {/* Panel Ścieżek */}
        <SettingsPanel
          title="Ścieżki Platform"
          description="Ustaw lub zmień ścieżki do platform"
          isOpen={openPanels.paths}
          onToggle={() => togglePanel('paths')}
          icon="📁"
        >
          {Object.entries(platformLabels).map(([platform, label]) => (
            <PathInputGroup
              key={platform}
              platform={platform}
              platformLabel={label}
              value={paths[platform]}
              onChange={handlePathChange}
              onBrowse={handleBrowsePath}
              onSave={handleSavePath}
            />
          ))}
        </SettingsPanel>
        
        {/* Panel Wydajność */}
        <SettingsPanel
          title="Wydajność"
          description="Zarządzaj wydajnością aplikacji"
          isOpen={openPanels.performance}
          onToggle={() => togglePanel('performance')}
          icon="⚡"
        >
          <SettingsOption label="Tryb wydajności">
            <ToggleSwitch 
              checked={localSettings.performanceMode === true} 
              onChange={() => handleUpdateSetting('performanceMode', !localSettings.performanceMode)}
            />
          </SettingsOption>

          <SettingsOption label="Akceleracja sprzętowa">
            <ToggleSwitch 
              checked={localSettings.hardwareAcceleration === true} 
              onChange={() => handleUpdateSetting('hardwareAcceleration', !localSettings.hardwareAcceleration)}
            />
          </SettingsOption>

          <SettingsOption label="Pokaż licznik FPS">
            <ToggleSwitch 
              checked={localSettings.showFPS === true} 
              onChange={() => handleUpdateSetting('showFPS', !localSettings.showFPS)}
            />
          </SettingsOption>

          <SettingsOption label="Automatyczne skanowanie biblioteki">
            <ToggleSwitch 
              checked={localSettings.autoScan === true} 
              onChange={() => handleUpdateSetting('autoScan', !localSettings.autoScan)}
            />
          </SettingsOption>
          
          <div className="flex justify-end pt-2">
            <button 
              onClick={() => window.electronAPI?.findInstalledGames('all', true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 text-sm transition-colors"
            >
              Skanuj bibliotekę teraz
            </button>
          </div>
        </SettingsPanel>

        {/* Panel Powiadomień */}
        <SettingsPanel
          title="Powiadomienia"
          description="Zarządzaj powiadomieniami aplikacji"
          isOpen={openPanels.notifications}
          onToggle={() => togglePanel('notifications')}
          icon="🔔"
        >
          <SettingsOption label="Powiadomienia systemowe">
            <ToggleSwitch 
              checked={localSettings.showNotifications === true} 
              onChange={() => handleUpdateSetting('showNotifications', !localSettings.showNotifications)}
            />
          </SettingsOption>

          <SettingsOption label="Sprawdzaj aktualizacje">
            <ToggleSwitch 
              checked={localSettings.checkUpdatesOnStartup === true} 
              onChange={() => handleUpdateSetting('checkUpdatesOnStartup', !localSettings.checkUpdatesOnStartup)}
            />
          </SettingsOption>

          <SettingsOption label="Pokaż liczbę gier">
            <ToggleSwitch 
              checked={localSettings.showGamesCount === true} 
              onChange={() => handleUpdateSetting('showGamesCount', !localSettings.showGamesCount)}
            />
          </SettingsOption>
        </SettingsPanel>
        
        {/* Panel Inne */}
        <SettingsPanel
          title="Inne Ustawienia"
          description="Różne opcje konfiguracyjne"
          isOpen={openPanels.misc}
          onToggle={() => togglePanel('misc')}
          icon="⚙️"
        >
          <SettingsOption label="Uruchamiaj przy starcie systemu">
            <ToggleSwitch 
              checked={localSettings.launchOnStartup === true} 
              onChange={() => handleUpdateSetting('launchOnStartup', !localSettings.launchOnStartup)}
            />
          </SettingsOption>

          <SettingsOption label="Minimalizuj do zasobnika">
            <ToggleSwitch 
              checked={localSettings.minimizeToTray === true} 
              onChange={() => handleUpdateSetting('minimizeToTray', !localSettings.minimizeToTray)}
            />
          </SettingsOption>
          
          <SettingsOption label="Zapamiętaj pozycję okna">
            <ToggleSwitch 
              checked={localSettings.rememberWindowPosition === true} 
              onChange={() => handleUpdateSetting('rememberWindowPosition', !localSettings.rememberWindowPosition)}
            />
          </SettingsOption>

          <SettingsOption label="Po uruchomieniu gry">
            <div className="flex items-center justify-end gap-1 w-auto ml-auto">
              <OptionButton 
                selected={localSettings.closeAfterGameLaunch === 'none'} 
                onClick={() => handleUpdateSetting('closeAfterGameLaunch', 'none')}
              >
                Brak akcji
              </OptionButton>
              <OptionButton 
                selected={localSettings.closeAfterGameLaunch === 'minimize'} 
                onClick={() => handleUpdateSetting('closeAfterGameLaunch', 'minimize')}
              >
                Minimalizuj
              </OptionButton>
              <OptionButton 
                selected={localSettings.closeAfterGameLaunch === 'close'} 
                onClick={() => handleUpdateSetting('closeAfterGameLaunch', 'close')}
              >
                Zamknij
              </OptionButton>
            </div>
          </SettingsOption>

          <SettingsOption label="Skrót klawiaturowy (Ctrl+Shift+Z)">
            <ToggleSwitch 
              checked={localSettings.useHotkey === true} 
              onChange={() => handleUpdateSetting('useHotkey', !localSettings.useHotkey)}
            />
          </SettingsOption>

          <SettingsOption label="Język">
            <div className="flex items-center justify-end gap-1 w-auto ml-auto">
              <OptionButton 
                selected={localSettings.language === 'pl'} 
                onClick={() => handleUpdateSetting('language', 'pl')}
              >
                Polski
              </OptionButton>
              <OptionButton 
                selected={localSettings.language === 'en'} 
                onClick={() => handleUpdateSetting('language', 'en')}
              >
                English
              </OptionButton>
            </div>
          </SettingsOption>
          
          <div className="flex justify-end pt-2">
            <button 
              onClick={handleClearSettingsAndCache}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-500 text-sm transition-colors"
            >
              Resetuj wszystkie ustawienia
            </button>
          </div>
        </SettingsPanel>
        
        {/* Panel O Programie */}
        <SettingsPanel
          title="O Programie"
          description="Informacje o programie"
          isOpen={openPanels.about}
          onToggle={() => togglePanel('about')}
          icon="ℹ️"
        >
          <div className="py-4">
            <div className="flex justify-center mb-4">
              <img src={appIcon} alt="xitali Game Launcher" className="w-32 h-32" />
            </div>
            
            <h2 className="text-xl font-bold text-center text-white mb-2">xitali Game Launcher</h2>
            <p className="text-gray-300 text-center mb-4">Wersja: 1.0.2</p>
            
            <p className="text-gray-300 text-center mb-4">
              Launcher do zarządzania biblioteką gier z różnych platform.
            </p>
            
            <div className="flex justify-center space-x-4 mb-4">
              <button 
                onClick={() => handleOpenLink('https://github.com/xitali/xitaliGL')}
                className="px-4 py-2 bg-zinc-800 text-gray-200 rounded-md hover:bg-zinc-700 transition-colors"
              >
                GitHub
              </button>
              <button 
                onClick={() => handleOpenLink('https://github.com/xitali/xitaliGL/issues')}
                className="px-4 py-2 bg-zinc-800 text-gray-200 rounded-md hover:bg-zinc-700 transition-colors"
              >
                Zgłoś błąd
              </button>
            </div>
            
            <p className="text-gray-400 text-center mt-4 text-xs">
              © 2023-2024 xitali. Wszelkie prawa zastrzeżone.
            </p>
          </div>
        </SettingsPanel>
      </div>
    </div>
  );
};

export default Settings; 
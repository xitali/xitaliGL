const { app, BrowserWindow, ipcMain, shell, dialog, Tray, Menu, globalShortcut } = require('electron');
const path = require('path');
const Store = require('electron-store');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const coverService = require('./services/coverService');
const { findInstalledGames, launchGame, addGame, getCustomGames } = require('./services/gameService');
const AutoLaunch = require('auto-launch');

// Wyłączenie akceleracji sprzętowej, która może powodować problemy z procesem GPU
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('no-sandbox');
app.disableHardwareAcceleration();

const store = new Store();

let mainWindow;
let tray = null;

// Konfiguracja autoUpdatera
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

// Funkcja do tworzenia ikony w zasobniku systemowym
function createTray() {
  const settings = store.get('settings', {});
  
  // Jeśli ustawienie showTrayIcon jest false, nie twórz ikony
  if (settings.showTrayIcon === false) {
    return;
  }
  
  const iconPath = path.join(__dirname, 'assets/icons/app-icon.png');
  tray = new Tray(iconPath);
  
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Otwórz xitali Game Launcher', 
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      } 
    },
    { type: 'separator' },
    { 
      label: 'Zamknij', 
      click: () => app.quit() 
    }
  ]);
  
  tray.setToolTip('xitali Game Launcher');
  tray.setContextMenu(contextMenu);
  
  // Obsługa kliknięcia w ikonę
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

// Funkcja rejestrująca skrót klawiaturowy
function registerHotkey() {
  const settings = store.get('settings', {});
  
  // Jeśli ustawienie useHotkey jest true, zarejestruj skrót
  if (settings.useHotkey) {
    try {
      // Wyrejestruj wcześniejszy skrót (jeśli istnieje)
      globalShortcut.unregister('CommandOrControl+Shift+Z');
      
      // Zarejestruj nowy skrót
      const registered = globalShortcut.register('CommandOrControl+Shift+Z', () => {
        if (mainWindow) {
          if (mainWindow.isVisible()) {
            mainWindow.focus();
          } else {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      });
      
      if (!registered) {
        console.log('Nie udało się zarejestrować skrótu klawiaturowego');
      }
    } catch (error) {
      console.log('Błąd podczas rejestracji skrótu:', error);
    }
  } else {
    // Wyrejestruj skrót jeśli opcja jest wyłączona
    globalShortcut.unregister('CommandOrControl+Shift+Z');
  }
}

// Funkcja do konfiguracji autostartu
function toggleAutoLaunch(enable) {
  try {
    const appPath = app.getPath('exe');
    const appName = 'xitali Game Launcher';
    
    // Tworzenie obiektu AutoLaunch z odpowiednim identyfikatorem i ścieżką do pliku wykonywalnego
    let autoLauncher = new AutoLaunch({
      name: appName,
      path: appPath,
    });
    
    // Sprawdź aktualny stan
    autoLauncher.isEnabled().then((isEnabled) => {
      if (enable && !isEnabled) {
        // Włącz autostart
        autoLauncher.enable();
        console.log('Autostart włączony');
      } else if (!enable && isEnabled) {
        // Wyłącz autostart
        autoLauncher.disable();
        console.log('Autostart wyłączony');
      }
    });
  } catch (error) {
    console.error('Błąd podczas konfiguracji autostartu:', error);
  }
}

function createWindow() {
  // Pobierz zapisane ustawienia
  const settings = store.get('settings', {});
  
  // Pobierz zapisaną pozycję okna, jeśli istnieje i opcja rememberWindowPosition jest włączona
  let windowOptions = {
    width: 1200,
    height: 800,
    minWidth: 1100,
    minHeight: 724,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    frame: false,  // Bezramkowe okno
    backgroundColor: '#212121',
    show: false,    // Nie pokazuj okna aż będzie gotowe, aby uniknąć migotania
    transparent: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: false
  };
  
  // Zastosuj zapisaną pozycję okna, jeśli funkcja jest włączona
  if (settings.rememberWindowPosition === true) {
    const windowPosition = store.get('windowPosition');
    if (windowPosition && windowPosition.x !== undefined && windowPosition.y !== undefined) {
      windowOptions.x = windowPosition.x;
      windowOptions.y = windowPosition.y;
    }
  }
  
  mainWindow = new BrowserWindow(windowOptions);

  // Pokaż okno kiedy jest gotowe
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
  
  // Dodaj menu kontekstowe dla zarządzania oknem (dostępne po kliknięciu prawym przyciskiem)
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Minimalizuj', click: () => mainWindow.minimize() },
    { label: 'Maksymalizuj/Przywróć', click: () => {
      if (mainWindow.isMaximized()) mainWindow.unmaximize();
      else mainWindow.maximize();
    }},
    { type: 'separator' },
    { label: 'Zamknij', click: () => mainWindow.close() }
  ]);

  // Dodaj nasłuchiwanie na kliknięcie prawym przyciskiem
  mainWindow.webContents.on('context-menu', (e) => {
    e.preventDefault();
    contextMenu.popup();
  });
  
  // Wczytaj plik HTML z katalogu dist
  try {
    if (fs.existsSync(path.join(__dirname, 'dist', 'index.html'))) {
      mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
    } else {
      // Fallback do pliku głównego index.html
      mainWindow.loadFile(path.join(__dirname, 'index.html'));
    }
  } catch (error) {
    // Fallback do pliku głównego index.html
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  // Inicjalizacja sprawdzania aktualizacji
  setTimeout(() => {
    checkForUpdates();
  }, 3000); // Opóźnienie sprawdzania aktualizacji o 3 sekundy po uruchomieniu

  // Tworzenie ikony w zasobniku systemowym
  createTray();
  
  // Rejestracja skrótu klawiaturowego
  registerHotkey();
  
  // Obsługa zachowania okna przy zamknięciu
  mainWindow.on('close', (event) => {
    // Zapisz pozycję okna przed zamknięciem, jeśli opcja rememberWindowPosition jest włączona
    const settings = store.get('settings', {});
    if (settings.rememberWindowPosition === true) {
      const position = mainWindow.getPosition();
      store.set('windowPosition', { x: position[0], y: position[1] });
    }
    
    // Sprawdź czy użytkownik użył przycisku zamykania
    // a nie żądania zamknięcia z menu lub innego źródła
    if (!app.isQuitting) {
      const settings = store.get('settings', {});
      
      if (settings.minimizeToTray === true && settings.showTrayIcon === true) {
        event.preventDefault();
        mainWindow.hide();
        return;
      }
    }
  });
}

// Funkcja sprawdzająca aktualizacje
function checkForUpdates() {
  autoUpdater.checkForUpdates();
}

// Obsługa wydarzeń aktualizacji
autoUpdater.on('update-available', (info) => {
  if (mainWindow) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Dostępna aktualizacja',
      message: `Dostępna jest nowa wersja: ${info.version}`,
      detail: 'Czy chcesz pobrać i zainstalować aktualizację?',
      buttons: ['Tak', 'Nie'],
      defaultId: 0
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.downloadUpdate();
        mainWindow.webContents.send('update-status', 'downloading');
      }
    });
  }
});

autoUpdater.on('update-not-available', () => {
  // Brak dostępnych aktualizacji
});

autoUpdater.on('error', (err) => {
  if (mainWindow) {
    mainWindow.webContents.send('update-error', err.message);
  }
});

autoUpdater.on('download-progress', (progressObj) => {
  if (mainWindow) {
    mainWindow.webContents.send('update-progress', progressObj);
  }
});

autoUpdater.on('update-downloaded', () => {
  if (mainWindow) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Aktualizacja gotowa',
      message: 'Aktualizacja została pobrana. Czy chcesz zainstalować ją teraz?',
      buttons: ['Zainstaluj i uruchom ponownie', 'Później'],
      defaultId: 0
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall(false, true);
      }
    });
  }
});

// Dodajemy obsługę IPC dla ręcznego sprawdzania aktualizacji
ipcMain.on('check-for-updates', () => {
  checkForUpdates();
});

app.whenReady().then(() => {
  // Inicjalizuj katalogi dla coverService przed utworzeniem okna
  console.log('Inicjalizacja katalogów coverService...');
  try {
    coverService.initializePaths();
  } catch (error) {
    console.error('Błąd podczas inicjalizacji katalogów coverService:', error);
  }
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Obsługa zdarzeń IPC od renderera
ipcMain.on('app-close', () => {
  app.quit();
});

ipcMain.on('app-minimize', () => {
  mainWindow.minimize();
});

ipcMain.on('app-maximize', () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

// Obsługa pobierania danych o grach
ipcMain.handle('get-games', async () => {
  // Pobieranie zapisanych danych o grach lub zwrócenie pustej tablicy
  return store.get('games', []);
});

// Obsługa zapisu danych o grach
ipcMain.on('save-games', (event, games) => {
  store.set('games', games);
});

// Obsługa pobierania okładek gier
ipcMain.handle('fetch-game-cover', async (event, gameName) => {
  return await coverService.fetchGameCover(gameName);
});

// Obsługa pobierania ikon platform
ipcMain.handle('fetch-platform-icon', async (event, platformName) => {
  return await coverService.fetchPlatformIcon(platformName);
});

// Obsługa wyszukiwania zainstalowanych gier
ipcMain.handle('findInstalledGames', async (event, platform) => {
  return await findInstalledGames(platform);
});

// Obsługa uruchamiania gier
ipcMain.handle('launchGame', async (event, gameId) => {
  try {
    // Uruchom grę
    const result = await launchGame(gameId);
    
    // Sprawdź, czy aplikacja powinna zostać zminimalizowana lub zamknięta po uruchomieniu gry
    const settings = store.get('settings', {});
    const afterLaunchAction = settings.closeAfterGameLaunch || 'none';
    
    if (afterLaunchAction === 'minimize' && mainWindow) {
      mainWindow.minimize();
    } else if (afterLaunchAction === 'close' && mainWindow) {
      mainWindow.hide();
    }
    
    return result;
  } catch (error) {
    console.error('Błąd podczas uruchamiania gry:', error);
    return false;
  }
});

// Obsługa otwierania linków zewnętrznych
ipcMain.on('open-external-link', (event, url) => {
  shell.openExternal(url);
});

// Obsługa dodawania niestandardowych gier
ipcMain.handle('addGame', async (event, gameData) => {
  try {
    console.log(`Dodawanie nowej gry: ${gameData.title}`);
    const result = await addGame(gameData);
    console.log('Gra została pomyślnie dodana');
    return result;
  } catch (error) {
    console.error('Błąd podczas dodawania gry:', error.message);
    // Przekazanie błędu z powrotem do renderera
    throw error;
  }
});

// Obsługa pobierania niestandardowych gier
ipcMain.handle('getStoredGames', async (event, platform) => {
  try {
    console.log(`Pobieranie zapisanych gier dla platformy: ${platform}`);
    if (platform === 'other') {
      const games = await getCustomGames();
      console.log(`Pobrano ${games.length} gier niestandardowych`);
      return games;
    }
    return [];
  } catch (error) {
    console.error('Błąd podczas pobierania gier:', error.message);
    return [];
  }
});

// Obsługa zapisywania niestandardowych gier
ipcMain.handle('storeGames', async (event, platform, games) => {
  try {
    console.log(`Zapisywanie ${games.length} gier dla platformy: ${platform}`);
    if (platform === 'other') {
      store.set('customGames', games);
      console.log('Gry zostały zapisane pomyślnie');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Błąd podczas zapisywania gier:', error.message);
    throw error;
  }
});

// Obsługa wyboru pliku
ipcMain.handle('selectFile', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: options.filters || [{ name: 'Wszystkie pliki', extensions: ['*'] }],
    title: options.title || 'Wybierz plik'
  });
  
  if (result.canceled) {
    return null;
  }
  
  return result.filePaths[0];
});

// Obsługa wyboru katalogu
ipcMain.handle('selectDirectory', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: options.title || 'Wybierz katalog'
  });
  
  if (result.canceled) {
    return null;
  }
  
  return result.filePaths[0];
});

// Obsługa wyszukiwania okładek
ipcMain.handle('searchCovers', async (event, gameName) => {
  try {
    console.log(`Wyszukiwanie alternatywnych okładek dla: ${gameName}`);
    return await coverService.searchCovers(gameName);
  } catch (error) {
    console.error('Błąd podczas wyszukiwania okładek:', error.message);
    return [];
  }
});

// Obsługa aktualizacji okładki
ipcMain.handle('updateGameCover', async (event, gameId, coverUrl) => {
  try {
    console.log(`Aktualizacja okładki dla gry ${gameId}`);
    return await coverService.updateGameCover(gameId, coverUrl);
  } catch (error) {
    console.error('Błąd podczas aktualizacji okładki:', error.message);
    return false;
  }
});

// Obsługa pobierania ustawień
ipcMain.handle('getSettings', async () => {
  return store.get('settings', {});
});

// Obsługa zapisywania ustawień
ipcMain.handle('saveSetting', async (event, key, value) => {
  try {
    // Pobierz aktualne ustawienia
    const settings = store.get('settings', {});
    
    // Aktualizuj określone ustawienie
    settings[key] = value;
    
    // Zapisz zaktualizowane ustawienia
    store.set('settings', settings);
    
    // Zastosuj zmiany dla specjalnych ustawień
    if (key === 'showTrayIcon') {
      // Aktualizuj ikonę w zasobniku systemowym
      if (value) {
        // Jeśli ikona nie istnieje, utwórz ją
        if (!tray) {
          createTray();
        }
      } else {
        // Jeśli ikona istnieje, usuń ją
        if (tray) {
          tray.destroy();
          tray = null;
        }
      }
    }
    else if (key === 'launchOnStartup') {
      // Zaktualizuj ustawienie autostartu
      toggleAutoLaunch(value);
    }
    else if (key === 'useHotkey') {
      // Zaktualizuj ustawienie skrótu klawiaturowego
      if (value) {
        registerHotkey();
      } else {
        globalShortcut.unregister('CommandOrControl+Shift+Z');
      }
    }
    else if (key === 'rememberWindowPosition') {
      if (value && mainWindow) {
        // Jeśli opcja została włączona, zapisz aktualną pozycję okna
        const position = mainWindow.getPosition();
        store.set('windowPosition', { x: position[0], y: position[1] });
      }
    }
    else if (key === 'hardwareAcceleration') {
      // Informuj użytkownika że zmiana wymaga restartu
      if (mainWindow) {
        mainWindow.webContents.send('setting-requires-restart', 'hardwareAcceleration');
      }
    }
    
    return true;
  } catch (error) {
    console.error(`Błąd podczas zapisywania ustawienia ${key}:`, error);
    return false;
  }
});

// Obsługa czyszczenia pamięci podręcznej gier
ipcMain.handle('clearGameCache', async () => {
  try {
    store.delete('cachedGames');
    console.log('Pamięć podręczna gier została wyczyszczona');
    return true;
  } catch (error) {
    console.error('Błąd podczas czyszczenia pamięci podręcznej:', error.message);
    return false;
  }
});

// Obsługa pobierania ścieżek platform
ipcMain.handle('getPlatformPaths', async () => {
  try {
    const { getPlatformPathsFromStore } = require('./services/gameService');
    return getPlatformPathsFromStore();
  } catch (error) {
    console.error('Błąd podczas pobierania ścieżek platform:', error.message);
    return {};
  }
});

// Obsługa aktualizacji ścieżki platformy
ipcMain.handle('updatePlatformPath', async (event, platform, path) => {
  try {
    const { updatePlatformPath } = require('./services/gameService');
    return await updatePlatformPath(platform, path);
  } catch (error) {
    console.error(`Błąd podczas aktualizacji ścieżki dla platformy ${platform}:`, error.message);
    return false;
  }
});

// Obsługa automatycznego wykrywania ścieżki platformy
ipcMain.handle('autoDetectPlatformPath', async (event, platform) => {
  try {
    // Ta funkcja powinna wykryć ścieżkę do danej platformy
    // Tutaj uproszczona implementacja
    const { findPlatformPath } = require('./services/gameService');
    return await findPlatformPath(platform);
  } catch (error) {
    console.error(`Błąd podczas wykrywania ścieżki dla platformy ${platform}:`, error.message);
    return null;
  }
});

// Obsługa przesuwania okna
ipcMain.on('drag-window', () => {
  if (mainWindow) {
    mainWindow.webContents.executeJavaScript(`
      if (!window.dragging) {
        window.dragging = true;
        document.addEventListener('mousemove', (e) => {
          window.electronAPI.moveWindow(e.screenX, e.screenY);
        });
        document.addEventListener('mouseup', () => {
          window.dragging = false;
        }, { once: true });
      }
    `);
  }
});

// Obsługa ruchu okna
ipcMain.on('move-window', (event, x, y) => {
  if (mainWindow) {
    mainWindow.setPosition(x, y);
  }
});

// Obsługa zmiany ustawień tray icon
ipcMain.handle('updateTrayIcon', async (event, showTrayIcon) => {
  try {
    if (showTrayIcon) {
      // Jeśli ikona nie istnieje, utwórz ją
      if (!tray) {
        createTray();
      }
    } else {
      // Jeśli ikona istnieje, usuń ją
      if (tray) {
        tray.destroy();
        tray = null;
      }
    }
    return true;
  } catch (error) {
    console.error('Błąd podczas aktualizacji ikony w zasobniku:', error);
    return false;
  }
});

// Obsługa zmiany ustawienia uruchamiania przy starcie
ipcMain.handle('updateAutoLaunch', async (event, enable) => {
  try {
    toggleAutoLaunch(enable);
    return true;
  } catch (error) {
    console.error('Błąd podczas aktualizacji autostartu:', error);
    return false;
  }
});

// Obsługa zmiany ustawienia skrótu klawiaturowego
ipcMain.handle('updateHotkey', async (event, enable) => {
  try {
    // Zapisz ustawienie w store
    const settings = store.get('settings', {});
    settings.useHotkey = enable;
    store.set('settings', settings);
    
    // Zastosuj zmianę
    if (enable) {
      registerHotkey();
    } else {
      globalShortcut.unregister('CommandOrControl+Shift+Z');
    }
    
    return true;
  } catch (error) {
    console.error('Błąd podczas aktualizacji skrótu klawiaturowego:', error);
    return false;
  }
});

// Wyrejestruj skróty klawiaturowe przy zamykaniu aplikacji
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// Obsługa resetu ustawień
ipcMain.handle('resetSettings', async () => {
  try {
    // Usuń wszystkie ustawienia
    store.delete('settings');
    store.delete('windowPosition');
    store.delete('gameCache');
    
    // Określ, które pliki konfiguracyjne wyczyścić
    const configFiles = [
      path.join(app.getPath('userData'), 'settings.json'),
      path.join(app.getPath('userData'), 'game-cache.json')
    ];
    
    // Usuń pliki konfiguracyjne
    for (const file of configFiles) {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
          console.log(`Usunięto plik: ${file}`);
        }
      } catch (error) {
        console.error(`Błąd podczas usuwania pliku ${file}:`, error);
      }
    }
    
    // Poinformuj użytkownika o konieczności restartu
    if (mainWindow) {
      mainWindow.webContents.send('settings-reset-complete');
    }
    
    // Zaplanuj restart aplikacji za 1 sekundę
    setTimeout(() => {
      app.relaunch();
      app.exit();
    }, 1000);
    
    return true;
  } catch (error) {
    console.error('Błąd podczas resetowania ustawień:', error);
    return false;
  }
});

// Obsługa wyboru katalogu
ipcMain.handle('openDirectoryDialog', async () => {
  if (!mainWindow) {
    return { canceled: true };
  }
  
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Wybierz katalog instalacji platformy',
    buttonLabel: 'Wybierz'
  });
  
  return result;
}); 
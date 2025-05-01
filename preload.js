const { contextBridge, ipcRenderer } = require('electron');

// Eksportuj API do okna renderera
contextBridge.exposeInMainWorld('electronAPI', {
  closeApp: () => ipcRenderer.send('app-close'),
  minimizeApp: () => ipcRenderer.send('app-minimize'),
  maximizeApp: () => ipcRenderer.send('app-maximize'),
  dragWindow: () => ipcRenderer.send('drag-window'),
  moveWindow: (x, y) => ipcRenderer.send('move-window', x, y),
  getGames: () => ipcRenderer.invoke('get-games'),
  saveGames: (games) => ipcRenderer.send('save-games', games),
  fetchGameCover: (gameName) => ipcRenderer.invoke('fetch-game-cover', gameName),
  fetchPlatformIcon: (platformName) => ipcRenderer.invoke('fetch-platform-icon', platformName),
  findInstalledGames: (platform, forceRefresh) => ipcRenderer.invoke('findInstalledGames', platform, forceRefresh),
  launchGame: (gameId) => ipcRenderer.invoke('launchGame', gameId),
  openExternalLink: (url) => ipcRenderer.send('open-external-link', url),
  
  // Nowe funkcje do obsługi niestandardowych gier
  addGame: (gameData) => ipcRenderer.invoke('addGame', gameData),
  getStoredGames: (platform) => ipcRenderer.invoke('getStoredGames', platform),
  storeGames: (platform, games) => ipcRenderer.invoke('storeGames', platform, games),
  
  // Funkcje do wyboru plików i katalogów
  selectFile: (options) => ipcRenderer.invoke('selectFile', options),
  selectDirectory: (options) => ipcRenderer.invoke('selectDirectory', options),
  openDirectoryDialog: () => ipcRenderer.invoke('openDirectoryDialog'),
  
  // Funkcje do ustawień
  getSettings: () => ipcRenderer.invoke('getSettings'),
  saveSetting: (key, value) => ipcRenderer.invoke('saveSetting', key, value),
  clearGameCache: () => ipcRenderer.invoke('clearGameCache'),
  resetSettings: () => ipcRenderer.invoke('resetSettings'),
  
  // Funkcje związane z platformami
  getPlatformPaths: () => ipcRenderer.invoke('getPlatformPaths'),
  updatePlatformPath: (platform, path) => ipcRenderer.invoke('updatePlatformPath', platform, path),
  autoDetectPlatformPath: (platform) => ipcRenderer.invoke('autoDetectPlatformPath', platform),
  
  // Funkcje do zarządzania okładkami
  searchCovers: (gameName) => ipcRenderer.invoke('searchCovers', gameName),
  updateGameCover: (gameId, coverUrl) => ipcRenderer.invoke('updateGameCover', gameId, coverUrl),
  
  // System aktualizacji
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (_, status) => callback(status)),
  onUpdateError: (callback) => ipcRenderer.on('update-error', (_, error) => callback(error)),
  onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (_, progress) => callback(progress)),
  
  // Obsługa zdarzeń dla ustawień wymagających restartu
  onSettingRequiresRestart: (callback) => {
    ipcRenderer.on('setting-requires-restart', (_, setting) => callback(setting));
    return () => ipcRenderer.removeListener('setting-requires-restart', callback);
  }
});

// Dodaj obiekt electron z funkcją startDrag
contextBridge.exposeInMainWorld('electron', {
  startDrag: () => {
    // Implementacja funkcji drag za pomocą WebAPI
    document.addEventListener('mousemove', (e) => {
      ipcRenderer.send('drag-window-move', { mouseX: e.clientX, mouseY: e.clientY });
    }, { once: true });
  }
});

// Nasłuchiwanie na wiadomości od procesu głównego
window.addEventListener('DOMContentLoaded', () => {
  // Przekazanie zdarzeń z ipcRenderer do okna przeglądarki
  ipcRenderer.on('setting-requires-restart', (_, setting) => {
    window.dispatchEvent(new CustomEvent('setting-requires-restart', { detail: setting }));
  });
}); 
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// Klucz API dla SteamGridDB
const STEAMGRIDDB_API_KEY = '44c7dc9cb0423d7a42009d2cda484d13';

// Określenie katalogów dla zapisywania okładek i ikon
let COVERS_DIR;
let ICONS_DIR;

// Funkcja do inicjalizacji ścieżek
function initializePaths() {
  try {
    // Użyj app.getPath('userData') - to gwarantuje, że katalogi będą tworzone w miejscu dostępnym dla użytkownika
    const userDataPath = app.getPath('userData');
    COVERS_DIR = path.join(userDataPath, 'covers');
    ICONS_DIR = path.join(userDataPath, 'icons');
    
    console.log('Inicjalizacja ścieżek do zasobów:');
    console.log(`COVERS_DIR: ${COVERS_DIR}`);
    console.log(`ICONS_DIR: ${ICONS_DIR}`);
    
    // Upewnij się, że katalogi istnieją przy starcie
    ensureDirectoryExists(COVERS_DIR);
    ensureDirectoryExists(ICONS_DIR);
  } catch (error) {
    console.error('Błąd podczas inicjalizacji ścieżek:', error);
    // Fallback do ścieżek względnych
    COVERS_DIR = path.join(__dirname, '../assets/covers');
    ICONS_DIR = path.join(__dirname, '../assets/icons');
  }
}

// Typy zasobów w SteamGridDB
const ASSET_TYPES = {
  GRID: 'grid', // Okładki (np. 600x900, 460x215)
  LOGO: 'logo', // Logo gier (np. do platform)
  HERO: 'hero', // Banery (np. 1920x620)
  ICON: 'icon'  // Ikony (np. 28x28)
};

/**
 * Zapewnia, że podany katalog istnieje
 * @param {string} dir Ścieżka do katalogu
 */
function ensureDirectoryExists(dir) {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Utworzono katalog: ${dir}`);
    }
  } catch (error) {
    console.error(`Błąd podczas tworzenia katalogu ${dir}:`, error);
  }
}

// Upewniamy się, że moduł jest eksportowany nawet przed inicjalizacją ścieżek
const coverService = {
  fetchGameCover: null,
  fetchPlatformIcon: null,
  sanitizeFileName: null,
  fetchRemoteImage: null,
  searchCovers: null,
  updateGameCover: null,
  initializePaths
};

// Funkcja do inicjalizacji modułu
function initialize() {
  // Spróbuj zainicjalizować ścieżki
  // Jeśli app nie jest dostępne w tym momencie, będzie to zrobione później
  try {
    if (app) {
      initializePaths();
    }
  } catch (error) {
    console.warn('Electron app nie jest dostępne, ścieżki zostaną zainicjalizowane później:', error);
    // Użyj tymczasowych ścieżek względnych
    COVERS_DIR = path.join(__dirname, '../assets/covers');
    ICONS_DIR = path.join(__dirname, '../assets/icons');
  }

  /**
   * Pobieranie okładki gry z SteamGridDB
   * @param {string} gameName Nazwa gry
   * @returns {Promise<string>} Ścieżka do zapisanej okładki
   */
  coverService.fetchGameCover = async function(gameName) {
    try {
      ensureDirectoryExists(COVERS_DIR);
      
      // Ścieżka do katalogu assets/covers
      const assetsCoversDir = path.join(__dirname, '../assets/covers');
      ensureDirectoryExists(assetsCoversDir);

      // Nazwa pliku na podstawie nazwy gry
      const fileName = `${coverService.sanitizeFileName(gameName)}.jpg`;
      
      // Ścieżki do plików - w katalogu użytkownika i w assets
      const localCoverPath = path.join(COVERS_DIR, fileName);
      const assetsCoverPath = path.join(assetsCoversDir, fileName);
      
      // Najpierw sprawdź, czy okładka już istnieje w assets/covers
      if (fs.existsSync(assetsCoverPath)) {
        console.log(`Używam istniejącej okładki z assets/covers dla ${gameName}`);
        // Skopiuj ją do katalogu użytkownika, jeśli tam jej nie ma
        if (!fs.existsSync(localCoverPath)) {
          try {
            fs.copyFileSync(assetsCoverPath, localCoverPath);
            console.log(`Skopiowano okładkę z assets/covers do ${localCoverPath}`);
          } catch (copyError) {
            console.error(`Błąd podczas kopiowania okładki: ${copyError.message}`);
          }
        }
        return assetsCoverPath;
      }
      
      // Następnie sprawdź, czy okładka istnieje w katalogu użytkownika
      if (fs.existsSync(localCoverPath)) {
        console.log(`Używam istniejącej okładki z katalogu użytkownika dla ${gameName}`);
        // Skopiuj ją do assets/covers, jeśli tam jej nie ma
        try {
          fs.copyFileSync(localCoverPath, assetsCoverPath);
          console.log(`Skopiowano okładkę do assets/covers: ${assetsCoverPath}`);
        } catch (copyError) {
          console.error(`Błąd podczas kopiowania okładki: ${copyError.message}`);
        }
        return localCoverPath;
      }

      // Szukaj ID gry przez API
      const gameId = await coverService.findGameId(gameName);
      if (!gameId) {
        return coverService.getPlaceholderPath('cover');
      }

      try {
        // Pobierz okładki dla znalezionej gry
        const gridResponse = await axios.get(`https://www.steamgriddb.com/api/v2/grids/game/${gameId}`, {
          headers: {
            'Authorization': `Bearer ${STEAMGRIDDB_API_KEY}`
          }
        });

        if (gridResponse.data.success && gridResponse.data.data.length > 0) {
          // Szukaj preferowanych stylów okładek
          let grid = coverService.findBestGrid(gridResponse.data.data);
          
          // Pobierz obrazek
          const imageResponse = await axios.get(grid.url, { responseType: 'arraybuffer' });
          const imageData = Buffer.from(imageResponse.data);
          
          // Zapisz obrazek w obu lokalizacjach
          fs.writeFileSync(localCoverPath, imageData);
          console.log(`Zapisano okładkę w katalogu użytkownika: ${localCoverPath}`);
          
          try {
            fs.writeFileSync(assetsCoverPath, imageData);
            console.log(`Zapisano okładkę w assets/covers: ${assetsCoverPath}`);
          } catch (writeError) {
            console.error(`Błąd podczas zapisywania okładki w assets/covers: ${writeError.message}`);
          }
          
          return assetsCoverPath;
        }
      } catch (gridError) {
        // Spróbuj alternatywną metodę - SGDB Heroes
        try {
          const heroResponse = await axios.get(`https://www.steamgriddb.com/api/v2/heroes/game/${gameId}`, {
            headers: {
              'Authorization': `Bearer ${STEAMGRIDDB_API_KEY}`
            }
          });

          if (heroResponse.data.success && heroResponse.data.data.length > 0) {
            // Pobierz obrazek
            const heroUrl = heroResponse.data.data[0].url;
            const imageResponse = await axios.get(heroUrl, { responseType: 'arraybuffer' });
            const imageData = Buffer.from(imageResponse.data);
            
            // Zapisz obrazek w obu lokalizacjach
            fs.writeFileSync(localCoverPath, imageData);
            console.log(`Zapisano okładkę (hero) w katalogu użytkownika: ${localCoverPath}`);
            
            try {
              fs.writeFileSync(assetsCoverPath, imageData);
              console.log(`Zapisano okładkę (hero) w assets/covers: ${assetsCoverPath}`);
            } catch (writeError) {
              console.error(`Błąd podczas zapisywania okładki w assets/covers: ${writeError.message}`);
            }
            
            return assetsCoverPath;
          }
        } catch (heroError) {
          // Cicha obsługa błędu
        }
      }

      return coverService.getPlaceholderPath('cover');
    } catch (error) {
      console.error(`Błąd podczas pobierania okładki dla ${gameName}:`, error);
      return coverService.getPlaceholderPath('cover');
    }
  }

  /**
   * Pobieranie ikon platform z SteamGridDB
   * @param {string} platformName Nazwa platformy
   * @returns {Promise<string>} Ścieżka do zapisanej ikony
   */
  coverService.fetchPlatformIcon = async function(platformName) {
    try {
      ensureDirectoryExists(ICONS_DIR);

      // Sprawdź, czy ikona już istnieje lokalnie
      const localIconPath = path.join(ICONS_DIR, `${coverService.sanitizeFileName(platformName)}.png`);
      if (fs.existsSync(localIconPath)) {
        return localIconPath;
      }

      console.log(`Brak lokalnej ikony dla ${platformName}, próba pobrania...`);

      // Mapowanie nazw platform na ich ID w SteamGridDB
      const platformMap = {
        'steam': 1,       // Steam
        'epic': 13,       // Epic Games Store
        'origin': 5,      // EA App/Origin
        'uplay': 4,       // Ubisoft Connect
        'gog': 6,         // GOG.com
        'battlenet': 14,  // Battle.net
        'xbox': 3,        // Xbox
      };

      // Normalizuj nazwę platformy
      const normalizedPlatformName = platformName.toLowerCase().trim();
      
      // Pobierz ID platformy lub znajdź ikonę systemu Windows
      if (normalizedPlatformName === 'windows') {
        return await coverService.fetchWindowsIcon(localIconPath);
      }
      
      // Sprawdź czy mamy domyślną ikonę lokalnie
      const defaultIconPath = path.join(ICONS_DIR, `${normalizedPlatformName}.png`);
      if (fs.existsSync(defaultIconPath)) {
        console.log(`Użycie domyślnej ikony dla ${platformName}: ${defaultIconPath}`);
        return defaultIconPath;
      }
      
      const platformId = platformMap[normalizedPlatformName];
      if (!platformId) {
        console.log(`Nieznana platforma: ${platformName}, używanie domyślnej ikony`);
        return coverService.getPlaceholderPath('icon', platformName);
      }

      // Pobierz ikony dla platformy z API
      try {
        console.log(`Pobieranie ikon dla platformy ID: ${platformId}`);
        const iconsResponse = await axios.get(`https://www.steamgriddb.com/api/v2/icons/platform/${platformId}`, {
          headers: {
            'Authorization': `Bearer ${STEAMGRIDDB_API_KEY}`
          }
        });

        if (iconsResponse.data.success && iconsResponse.data.data.length > 0) {
          // Wybierz pierwszą dostępną ikonę
          const iconUrl = iconsResponse.data.data[0].url;
          
          // Pobierz obrazek
          console.log(`Pobieranie ikony z URL: ${iconUrl}`);
          const imageResponse = await axios.get(iconUrl, { responseType: 'arraybuffer' });
          fs.writeFileSync(localIconPath, Buffer.from(imageResponse.data));
          
          return localIconPath;
        }
      } catch (error) {
        console.error(`Błąd podczas pobierania ikony dla platformy ${platformName}:`, error.message);
      }
      
      // Fallback do domyślnej ikony
      return coverService.getPlaceholderPath('icon', platformName);
    } catch (error) {
      console.error(`Błąd podczas pobierania ikony dla platformy '${platformName}':`, error.message);
      return coverService.getPlaceholderPath('icon', platformName);
    }
  }

  /**
   * Wyszukuje ID gry w SteamGridDB
   * @param {string} gameName Nazwa gry do wyszukania
   * @returns {Promise<number|null>} ID gry lub null, jeśli nie znaleziono
   */
  coverService.findGameId = async function(gameName) {
    try {
      console.log(`Wyszukiwanie gry: ${gameName}`);
      const encodedName = encodeURIComponent(gameName);
      const url = `https://www.steamgriddb.com/api/v2/search/autocomplete/${encodedName}`;
      
      console.log(`URL wyszukiwania: ${url}`);
      
      const searchResponse = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${STEAMGRIDDB_API_KEY}`
        }
      });

      if (searchResponse.data.success && searchResponse.data.data.length > 0) {
        console.log(`Znaleziono ${searchResponse.data.data.length} wyników dla "${gameName}"`);
        const result = searchResponse.data.data[0];
        console.log(`Wybrano: ${result.name} (ID: ${result.id})`);
        return result.id;
      } else {
        console.log(`Brak wyników wyszukiwania dla "${gameName}"`);
      }
      return null;
    } catch (error) {
      console.error(`Błąd podczas wyszukiwania '${gameName}':`, error.message);
      return null;
    }
  }

  /**
   * Pobiera logo gry z SteamGridDB i używa go jako ikony
   * @param {number} gameId ID gry
   * @param {string} localIconPath Ścieżka do zapisania ikony
   * @returns {Promise<string>} Ścieżka do zapisanej ikony
   */
  coverService.fetchLogoAsIcon = async function(gameId, localIconPath) {
    if (!gameId) return coverService.getPlaceholderPath('icon');
    
    try {
      console.log(`Pobieranie logo dla ID gry: ${gameId}`);
      const logosResponse = await axios.get(`https://www.steamgriddb.com/api/v2/logos/game/${gameId}`, {
        headers: {
          'Authorization': `Bearer ${STEAMGRIDDB_API_KEY}`
        }
      });

      if (logosResponse.data.success && logosResponse.data.data.length > 0) {
        const logoUrl = logosResponse.data.data[0].url;
        
        // Pobierz obrazek
        console.log(`Pobieranie logo z URL: ${logoUrl}`);
        const imageResponse = await axios.get(logoUrl, { responseType: 'arraybuffer' });
        fs.writeFileSync(localIconPath, Buffer.from(imageResponse.data));
        
        console.log(`Zapisano logo do: ${localIconPath}`);
        return localIconPath;
      } else {
        console.log(`Brak dostępnych logo dla ID: ${gameId}`);
      }
    } catch (error) {
      console.error(`Błąd podczas pobierania logo dla gry ID ${gameId}:`, error.message);
    }
    
    return coverService.getPlaceholderPath('icon');
  }

  /**
   * Pobiera ikonę Windows
   * @param {string} localIconPath Ścieżka do zapisania ikony
   * @returns {Promise<string>} Ścieżka do zapisanej ikony
   */
  coverService.fetchWindowsIcon = async function(localIconPath) {
    try {
      // Szukaj "Microsoft Windows" w SteamGridDB
      const gameId = await coverService.findGameId("Microsoft Windows");
      if (gameId) {
        return await coverService.fetchLogoAsIcon(gameId, localIconPath);
      }
    } catch (error) {
      console.error("Błąd podczas pobierania ikony Windows:", error.message);
    }
    
    return coverService.getPlaceholderPath('icon', 'windows');
  }

  /**
   * Wybiera najlepszą okładkę z dostępnych
   * @param {Array} grids Lista dostępnych okładek
   * @returns {Object} Najlepsza okładka
   */
  coverService.findBestGrid = function(grids) {
    // Preferuj okładki pionowe 600x900
    const verticalGrid = grids.find(grid => 
      grid.width === 600 && grid.height === 900
    );
    
    if (verticalGrid) {
      console.log('Znaleziono preferowaną okładkę 600x900');
      return verticalGrid;
    }
    
    // Alternatywnie, weź poziome 460x215
    const horizontalGrid = grids.find(grid =>
      grid.width === 460 && grid.height === 215
    );
    
    if (horizontalGrid) {
      console.log('Znaleziono alternatywną okładkę 460x215');
      return horizontalGrid;
    }
    
    // Jeśli nie ma preferowanych, weź pierwszą dostępną
    console.log('Używanie domyślnej okładki');
    return grids[0];
  }

  /**
   * Zwraca ścieżkę do obrazu zastępczego
   * @param {string} type Typ obrazu ('cover' lub 'icon')
   * @param {string} [name] Nazwa dla ikony (opcjonalnie)
   * @returns {string} Ścieżka do obrazu zastępczego
   */
  coverService.getPlaceholderPath = function(type, name) {
    try {
      if (type === 'cover') {
        // Najpierw sprawdź, czy istnieje no-cover.png w katalogu użytkownika
        const userDataPath = path.join(COVERS_DIR, 'no-cover.png');
        if (fs.existsSync(userDataPath)) {
          return userDataPath;
        }
        
        // Jeśli nie istnieje, spróbuj stworzyć kopię
        const defaultPath = path.join(__dirname, '../assets/icons/no-cover.png');
        if (fs.existsSync(defaultPath)) {
          try {
            ensureDirectoryExists(COVERS_DIR);
            fs.copyFileSync(defaultPath, userDataPath);
            return userDataPath;
          } catch (copyError) {
            console.error('Błąd podczas kopiowania pliku no-cover.png:', copyError);
          }
          return defaultPath;
        }
        
        // Jeśli żaden nie istnieje, zwróć jedną z istniejących okładek
        return path.join(__dirname, '../assets/icons/app-icon.png');
      } else if (type === 'icon') {
        // Sprawdź, czy istnieje ikona o podanej nazwie
        if (name) {
          const iconPath = path.join(ICONS_DIR, `${name}.png`);
          if (fs.existsSync(iconPath)) {
            return iconPath;
          }
        }
        
        // Sprawdź, czy istnieje placeholder.png w katalogu użytkownika
        const userDataPath = path.join(ICONS_DIR, 'placeholder.png');
        if (fs.existsSync(userDataPath)) {
          return userDataPath;
        }
        
        // Jeśli nie istnieje, spróbuj stworzyć kopię
        const defaultPath = path.join(__dirname, '../assets/icons/app-icon.png');
        if (fs.existsSync(defaultPath)) {
          try {
            ensureDirectoryExists(ICONS_DIR);
            fs.copyFileSync(defaultPath, userDataPath);
            return userDataPath;
          } catch (copyError) {
            console.error('Błąd podczas kopiowania pliku placeholder.png:', copyError);
          }
          return defaultPath;
        }
        
        return path.join(__dirname, '../assets/icons/app-icon.png');
      }
      
      // W przypadku nieobsługiwanego typu
      return path.join(__dirname, '../assets/icons/app-icon.png');
    } catch (error) {
      console.error(`Błąd podczas pobierania ścieżki zastępczej dla typu ${type}:`, error);
      return path.join(__dirname, '../assets/icons/app-icon.png');
    }
  }

  /**
   * Sanityzuje nazwę pliku, usuwając niedozwolone znaki
   * @param {string} fileName Nazwa pliku do sanityzacji
   * @returns {string} Oczyszczona nazwa pliku
   */
  coverService.sanitizeFileName = function(fileName) {
    // Usuń znaki niedozwolone w nazwach plików
    return fileName.replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, '_')
      .toLowerCase();
  }

  /**
   * Pobiera obrazek z podanego URL i zapisuje go lokalnie
   * @param {string} url Adres URL obrazka
   * @param {string} gameName Nazwa gry (używana do nazwania pliku)
   * @returns {Promise<string>} Ścieżka do zapisanego obrazka
   */
  coverService.fetchRemoteImage = async function(url, gameName) {
    try {
      ensureDirectoryExists(COVERS_DIR);
      
      // Utwórz nazwę pliku na podstawie nazwy gry
      const fileName = `${coverService.sanitizeFileName(gameName)}_custom.jpg`;
      const localPath = path.join(COVERS_DIR, fileName);
      
      console.log(`Pobieranie obrazu z URL: ${url}`);
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      
      // Zapisz obrazek lokalnie
      fs.writeFileSync(localPath, Buffer.from(response.data));
      console.log(`Zapisano obrazek do: ${localPath}`);
      
      return localPath;
    } catch (error) {
      console.error(`Błąd podczas pobierania obrazu z URL: ${url}`, error.message);
      return null;
    }
  }

  /**
   * Wyszukuje alternatywne okładki dla gry
   * @param {string} gameName Nazwa gry
   * @returns {Promise<Array>} Tablica z danymi o dostępnych okładkach
   */
  coverService.searchCovers = async function(gameName) {
    try {
      console.log(`Wyszukiwanie alternatywnych okładek dla gry: ${gameName}`);
      
      // Najpierw znajdź ID gry
      const gameId = await coverService.findGameId(gameName);
      if (!gameId) {
        console.warn(`Nie znaleziono gry '${gameName}' w SteamGridDB.`);
        return [];
      }
      
      console.log(`Znaleziono ID gry ${gameName}: ${gameId}`);
      
      // Pobierz wszystkie dostępne okładki (grids)
      const gridResponse = await axios.get(`https://www.steamgriddb.com/api/v2/grids/game/${gameId}`, {
        headers: {
          'Authorization': `Bearer ${STEAMGRIDDB_API_KEY}`
        }
      });
      
      const covers = [];
      
      if (gridResponse.data.success && gridResponse.data.data.length > 0) {
        // Dodaj okładki typu grid
        for (const grid of gridResponse.data.data) {
          covers.push({
            id: grid.id,
            url: grid.url,
            thumb: grid.thumb || grid.url,
            type: 'grid',
            style: grid.style || 'alternate'
          });
        }
      }
      
      // Spróbuj też pobrać hero
      try {
        const heroResponse = await axios.get(`https://www.steamgriddb.com/api/v2/heroes/game/${gameId}`, {
          headers: {
            'Authorization': `Bearer ${STEAMGRIDDB_API_KEY}`
          }
        });
        
        if (heroResponse.data.success && heroResponse.data.data.length > 0) {
          // Dodaj okładki typu hero
          for (const hero of heroResponse.data.data) {
            covers.push({
              id: hero.id,
              url: hero.url,
              thumb: hero.thumb || hero.url,
              type: 'hero',
              style: hero.style || 'alternate'
            });
          }
        }
      } catch (heroError) {
        console.error(`Błąd podczas pobierania hero dla '${gameName}':`, heroError.message);
      }
      
      console.log(`Znaleziono ${covers.length} alternatywnych okładek dla gry "${gameName}"`);
      return covers;
    } catch (error) {
      console.error(`Błąd podczas wyszukiwania okładek dla '${gameName}':`, error.message);
      return [];
    }
  }

  /**
   * Aktualizuje okładkę dla określonej gry
   * @param {string} gameId ID gry w systemie
   * @param {string} coverUrl URL nowej okładki
   * @returns {Promise<boolean>} Informacja czy operacja się powiodła
   */
  coverService.updateGameCover = async function(gameId, coverUrl) {
    try {
      console.log(`Aktualizowanie okładki dla gry ID: ${gameId}`);
      
      // Pobierz dane gry
      let game = null;
      const Store = require('electron-store');
      const store = new Store();
      
      // Sprawdź w niestandardowych grach
      const customGames = store.get('customGames', []);
      game = customGames.find(g => g.id === gameId);
      
      // Jeśli nie znaleziono w niestandardowych, sprawdź w pamięci podręcznej
      if (!game) {
        const cachedGames = store.get('cachedGames', {});
        
        // Przeszukaj wszystkie platformy
        for (const platform in cachedGames) {
          const games = cachedGames[platform];
          const found = games.find(g => g.id === gameId);
          if (found) {
            game = found;
            break;
          }
        }
      }
      
      if (!game) {
        console.error(`Nie znaleziono gry o ID: ${gameId}`);
        return false;
      }
      
      // Sprawdź czy URL okładki jest poprawny
      if (!coverUrl || typeof coverUrl !== 'string') {
        console.error(`Nieprawidłowy URL okładki: ${coverUrl}`);
        return false;
      }
      
      console.log(`Pobieranie okładki z URL: ${coverUrl}`);
      
      try {
        // Pobierz obrazek
        const localCoverPath = path.join(COVERS_DIR, `${coverService.sanitizeFileName(game.title)}.jpg`);
        ensureDirectoryExists(COVERS_DIR);
        
        // Jeśli URL jest zewnętrzny, pobierz
        if (coverUrl.startsWith('http')) {
          const imageResponse = await axios.get(coverUrl, { responseType: 'arraybuffer' });
          fs.writeFileSync(localCoverPath, Buffer.from(imageResponse.data));
        } else {
          // Jeśli to jest lokalny plik, skopiuj go
          fs.copyFileSync(coverUrl, localCoverPath);
        }
        
        console.log(`Zapisano nową okładkę dla gry "${game.title}" do: ${localCoverPath}`);
        
        // Zaktualizuj URL okładki w zapisanych danych
        game.cover = localCoverPath;
        
        // Zapisz zaktualizowane dane
        if (customGames.find(g => g.id === gameId)) {
          // Jeśli to niestandardowa gra
          const updatedGames = customGames.map(g => g.id === gameId ? game : g);
          store.set('customGames', updatedGames);
        } else {
          // Jeśli to gra z konkretnej platformy
          const cachedGames = store.get('cachedGames', {});
          
          for (const platform in cachedGames) {
            const games = cachedGames[platform];
            const index = games.findIndex(g => g.id === gameId);
            
            if (index !== -1) {
              games[index] = game;
              cachedGames[platform] = games;
              break;
            }
          }
          
          store.set('cachedGames', cachedGames);
        }
        
        return true;
      } catch (imageError) {
        console.error(`Błąd podczas pobierania obrazka z URL ${coverUrl}:`, imageError.message);
        return false;
      }
    } catch (error) {
      console.error(`Błąd podczas aktualizacji okładki:`, error.message);
      return false;
    }
  }
}

// Inicjalizuj moduł
initialize();

module.exports = coverService;
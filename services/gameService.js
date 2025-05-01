const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec, execFile } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const { v4: uuidv4 } = require('uuid');
const Store = require('electron-store');

const store = new Store();
const coverService = require('./coverService');
const gogService = require('./gameServiceGog');

/**
 * Pobieranie listy gier z różnych platform
 */
async function fetchGames() {
  try {
    // Tutaj byłyby wywołania API do różnych platform
    // Na razie zwracamy dane lokalne
    return await getLocalGames();
  } catch (error) {
    console.error('Błąd podczas pobierania gier:', error);
    throw error;
  }
}

/**
 * Pobieranie gier zapisanych lokalnie
 */
async function getLocalGames() {
  // Ta funkcja mogłaby skanować lokalny system w poszukiwaniu zainstalowanych gier
  // lub odczytywać dane z bazy danych/pliku lokalnego
  return [];
}

/**
 * Sprawdza zapisane ścieżki platform i wykorzystuje je jeśli istnieją
 * Jeśli nie istnieją, wyszukuje ścieżki i zapisuje na przyszłość
 */
const getPlatformPaths = () => {
  const userHomeDir = os.homedir();
  console.log('Katalog domowy użytkownika:', userHomeDir);
  
  // Sprawdź, czy w store są zapisane ścieżki platform
  const savedPaths = store.get('platformPaths', {});
  console.log('Zapisane ścieżki platform:', savedPaths);
  
  // Jeśli są zapisane ścieżki, użyj ich, ale sprawdź czy nadal istnieją
  let platformPaths = {
    steam: savedPaths.steam || findSteamPath(userHomeDir),
    epic: savedPaths.epic || path.join(userHomeDir, 'AppData', 'Local', 'EpicGamesLauncher'),
    origin: savedPaths.origin || path.join(userHomeDir, 'AppData', 'Local', 'Origin'),
    uplay: savedPaths.uplay || path.join(userHomeDir, 'AppData', 'Local', 'Ubisoft Game Launcher'),
    battlenet: savedPaths.battlenet || path.join(userHomeDir, 'AppData', 'Local', 'Battle.net'),
    xbox: savedPaths.xbox || path.join(userHomeDir, 'AppData', 'Local', 'Microsoft', 'WindowsApps'),
    gog: savedPaths.gog || path.join(userHomeDir, 'AppData', 'Local', 'GOG.com')
  };
  
  // Sprawdź, czy ścieżki istnieją, jeśli nie, znajdź je na nowo
  for (const [platform, platformPath] of Object.entries(platformPaths)) {
    if (!fs.existsSync(platformPath)) {
      console.log(`Zapisana ścieżka dla ${platform} nie istnieje: ${platformPath}`);
      // Resetuj ścieżkę, aby została wykryta ponownie
      if (platform === 'steam') {
        platformPaths[platform] = findSteamPath(userHomeDir);
      }
    } else {
      console.log(`Używam zapisanej ścieżki dla ${platform}: ${platformPath}`);
    }
  }
  
  // Zapisz ścieżki do store
  store.set('platformPaths', platformPaths);
  
  return platformPaths;
};

/**
 * Aktualizuje ścieżkę dla danej platformy
 * @param {string} platform Nazwa platformy
 * @param {string} newPath Nowa ścieżka
 * @returns {boolean} true jeśli udało się zaktualizować, false w przeciwnym razie
 */
function updatePlatformPath(platform, newPath) {
  try {
    console.log(`Aktualizacja ścieżki dla platformy ${platform}: ${newPath}`);
    
    // Sprawdź, czy ścieżka istnieje
    if (!fs.existsSync(newPath)) {
      console.warn(`Ścieżka nie istnieje: ${newPath}`);
      return false;
    }
    
    // Pobierz aktualne ścieżki
    const platformPaths = store.get('platformPaths', {});
    
    // Zaktualizuj ścieżkę
    platformPaths[platform] = newPath;
    
    // Zapisz ścieżki
    store.set('platformPaths', platformPaths);
    
    console.log(`Ścieżka dla platformy ${platform} została zaktualizowana`);
    return true;
  } catch (error) {
    console.error(`Błąd podczas aktualizacji ścieżki dla platformy ${platform}:`, error);
    return false;
  }
}

/**
 * Pobiera listę ścieżek platform
 * @returns {Object} Obiekt z ścieżkami platform
 */
function getPlatformPathsFromStore() {
  return store.get('platformPaths', {});
}

/**
 * Pobiera zapisaną wcześniej listę gier
 * @returns {Object} Obiekt z listami gier pogrupowanymi według platform
 */
function getCachedGames() {
  return store.get('cachedGames', {});
}

/**
 * Zapisuje listę znalezionych gier do cache
 * @param {string} platform Nazwa platformy
 * @param {Array} games Lista gier
 */
function cacheGames(platform, games) {
  try {
    // Pobierz aktualny cache
    const cachedGames = store.get('cachedGames', {});
    
    // Zaktualizuj cache dla danej platformy
    cachedGames[platform] = games;
    
    // Zapisz cache
    store.set('cachedGames', cachedGames);
    
    console.log(`Cache gier dla platformy ${platform} został zaktualizowany (${games.length} gier)`);
  } catch (error) {
    console.error(`Błąd podczas zapisywania cache gier dla platformy ${platform}:`, error);
  }
}

/**
 * Czyści cache gier dla danej platformy lub wszystkich platform
 * @param {string} platform Nazwa platformy, null dla wszystkich platform
 */
function clearGameCache(platform = null) {
  try {
    if (platform) {
      // Czyść cache tylko dla danej platformy
      const cachedGames = store.get('cachedGames', {});
      delete cachedGames[platform];
      store.set('cachedGames', cachedGames);
      console.log(`Cache gier dla platformy ${platform} został wyczyszczony`);
    } else {
      // Czyść cache dla wszystkich platform
      store.delete('cachedGames');
      console.log('Cache gier został wyczyszczony dla wszystkich platform');
    }
  } catch (error) {
    console.error(`Błąd podczas czyszczenia cache gier:`, error);
  }
}

/**
 * Funkcja wyszukująca katalog Steam
 */
function findSteamPath(userHomeDir) {
  // Najpierw sprawdź rejestr Windows (dla Windows)
  try {
    const { stdout } = require('child_process').spawnSync('reg', [
      'query',
      'HKEY_CURRENT_USER\\Software\\Valve\\Steam',
      '/v', 
      'SteamPath'
    ], { encoding: 'utf8' });

    if (stdout) {
      const match = stdout.match(/SteamPath\s+REG_SZ\s+(.*)/);
      if (match && match[1]) {
        const regPath = match[1].trim().replace(/\//g, '\\');
        console.log(`Znaleziono ścieżkę Steam w rejestrze: ${regPath}`);
        if (fs.existsSync(regPath)) {
          return regPath;
        }
      }
    }
  } catch (err) {
    console.log('Nie znaleziono ścieżki Steam w rejestrze lub nie jesteśmy na Windows');
  }

  // Sprawdź typowe lokalizacje
  const possiblePaths = [
    'C:\\Program Files (x86)\\Steam',
    'C:\\Program Files\\Steam',
    path.join(userHomeDir, 'AppData', 'Local', 'Steam'),
    path.join(userHomeDir, 'Steam'),
    'D:\\Steam',
    'E:\\Steam'
  ];
  
  // Sprawdź wszystkie dyski od C: do Z:
  for (let i = 67; i <= 90; i++) {  // ASCII codes for C to Z
    const driveLetter = String.fromCharCode(i);
    try {
      const drivePath = `${driveLetter}:\\`;
      if (fs.existsSync(drivePath)) {
        possiblePaths.push(`${driveLetter}:\\Program Files (x86)\\Steam`);
        possiblePaths.push(`${driveLetter}:\\Program Files\\Steam`);
        possiblePaths.push(`${driveLetter}:\\Steam`);
        possiblePaths.push(`${driveLetter}:\\Games\\Steam`);
      }
    } catch (e) {
      // Ignoruj błędy dostępu
    }
  }
  
  console.log('Sprawdzanie możliwych ścieżek Steam:');
  for (const steamPath of possiblePaths) {
    console.log(`- Sprawdzanie ${steamPath}: ${fs.existsSync(steamPath) ? 'Istnieje' : 'Nie istnieje'}`);
    
    if (fs.existsSync(steamPath)) {
      // Sprawdź, czy to naprawdę katalog Steam (powinien zawierać steam.exe)
      if (fs.existsSync(path.join(steamPath, 'steam.exe'))) {
        console.log(`Potwierdzona instalacja Steam w: ${steamPath}`);
        return steamPath;
      }
    }
  }
  
  // Jeśli nie znaleziono, szukaj pliku steam.exe w całym systemie
  try {
    const drives = [];
    // Zbierz dostępne dyski
    for (let i = 67; i <= 90; i++) {  // ASCII codes for C to Z
      const driveLetter = String.fromCharCode(i);
      try {
        const drivePath = `${driveLetter}:\\`;
        if (fs.existsSync(drivePath)) {
          drives.push(driveLetter);
        }
      } catch (e) {
        // Ignoruj błędy dostępu
      }
    }
    
    console.log(`Próba wyszukania steam.exe na dyskach: ${drives.join(', ')}:`);
    
    // Ograniczone wyszukiwanie dla szybkości
    const searchPaths = [
      'Program Files',
      'Program Files (x86)',
      'Games',
      'Steam'
    ];
    
    for (const drive of drives) {
      for (const searchPath of searchPaths) {
        const fullPath = `${drive}:\\${searchPath}`;
        if (fs.existsSync(fullPath)) {
          // Wyszukaj pliki steam.exe w tej ścieżce
          try {
            const files = walkDir(fullPath, 'steam.exe', 3); // głębokość maksymalna 3
            if (files.length > 0) {
              // Zwróć katalog, w którym jest steam.exe
              const steamDir = path.dirname(files[0]);
              console.log(`Znaleziono steam.exe w: ${steamDir}`);
              return steamDir;
            }
          } catch (e) {
            console.log(`Błąd wyszukiwania w ${fullPath}: ${e.message}`);
          }
        }
      }
    }
  } catch (error) {
    console.error('Błąd podczas wyszukiwania steam.exe:', error);
  }
  
  console.log('Nie znaleziono instalacji Steam, używam domyślnej ścieżki.');
  return possiblePaths[0]; // Zwróć domyślną ścieżkę nawet jeśli nie istnieje
}

/**
 * Rekursywne przeszukiwanie katalogu z ograniczoną głębokością
 */
function walkDir(dir, searchFile, maxDepth = 3, currentDepth = 0) {
  if (currentDepth > maxDepth) return [];
  
  let results = [];
  try {
    const list = fs.readdirSync(dir);
    
    for (const file of list) {
      const fullPath = path.join(dir, file);
      
      try {
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          results = results.concat(walkDir(fullPath, searchFile, maxDepth, currentDepth + 1));
        } else if (file.toLowerCase() === searchFile.toLowerCase()) {
          results.push(fullPath);
        }
      } catch (e) {
        // Ignoruj błędy dostępu do plików
      }
    }
  } catch (e) {
    // Ignoruj błędy dostępu do katalogów
  }
  
  return results;
}

/**
 * Funkcja wyszukująca zainstalowane gry ze Steam
 */
async function findSteamGames() {
  try {
    const steamPath = getPlatformPaths().steam;
    
    if (!fs.existsSync(steamPath)) {
      console.warn('Nie znaleziono katalogu Steam:', steamPath);
      return [];
    }
    
    const steamAppsPath = path.join(steamPath, 'steamapps');
    console.log('Wyszukiwanie gier w katalogu steamapps:', steamAppsPath);
    
    if (!fs.existsSync(steamAppsPath)) {
      console.warn('Nie znaleziono katalogu steamapps:', steamAppsPath);
      return [];
    }
    
    // Sprawdź główny katalog Steam
    const steamGames = await findGamesInSteamApps(steamAppsPath);
    console.log(`Znaleziono ${steamGames.length} gier w głównym katalogu Steam`);
    
    // Znajdź biblioteki Steam
    const libraryFolders = await findSteamLibraries(steamAppsPath);
    console.log(`Znaleziono ${libraryFolders.length} bibliotek Steam:`, libraryFolders);
    
    // Znajdź gry w dodatkowych bibliotekach
    const libraryGamesPromises = libraryFolders.map(async library => {
      const libraryApps = path.join(library, 'steamapps');
      const games = await findGamesInSteamApps(libraryApps);
      console.log(`Znaleziono ${games.length} gier w bibliotece ${library}`);
      return games;
    });
    
    const libraryGames = await Promise.all(libraryGamesPromises);
    
    // Połącz wszystkie znalezione gry
    const allGames = [...steamGames, ...libraryGames.flat()];
    
    console.log(`Łącznie znaleziono ${allGames.length} gier Steam przed filtrowaniem`);
    
    // Usuń duplikaty i gry z "Steamworks" w nazwie
    const filteredGames = allGames.filter((game, index, self) => 
      index === self.findIndex(g => g.id === game.id) && !game.title.includes('Steamworks')
    );
    
    // Dodatkowo usuń duplikaty na podstawie tytułu
    const uniqueGames = removeDuplicateGames(filteredGames);
    
    console.log(`Po filtrowaniu zostało ${uniqueGames.length} gier Steam`);
    console.log('Znalezione gry:', uniqueGames.map(g => g.title));
    
    return uniqueGames;
  } catch (error) {
    console.error('Błąd podczas wyszukiwania gier Steam:', error);
    return [];
  }
}

/**
 * Znajdź wszystkie biblioteki Steam
 */
async function findSteamLibraries(steamAppsPath) {
  try {
    const libraryFoldersPath = path.join(steamAppsPath, 'libraryfolders.vdf');
    console.log('Sprawdzanie pliku bibliotek Steam:', libraryFoldersPath);
    
    if (!fs.existsSync(libraryFoldersPath)) {
      console.warn('Nie znaleziono pliku libraryfolders.vdf');
      // Spróbujmy alternatywną ścieżkę dla nowych wersji Steam
      const alternativePath = path.join(steamAppsPath, 'config', 'libraryfolders.vdf');
      if (fs.existsSync(alternativePath)) {
        console.log('Znaleziono alternatywną ścieżkę do pliku bibliotek:', alternativePath);
        return findSteamLibrariesFromFile(alternativePath);
      }
      
      return [];
    }
    
    return findSteamLibrariesFromFile(libraryFoldersPath);
  } catch (error) {
    console.error('Błąd podczas wyszukiwania bibliotek Steam:', error);
    return [];
  }
}

/**
 * Analizuje plik bibliotek Steam
 */
function findSteamLibrariesFromFile(libraryFoldersPath) {
  try {
    const libraryFoldersContent = fs.readFileSync(libraryFoldersPath, 'utf8');
    console.log('Rozmiar pliku libraryfolders.vdf:', libraryFoldersContent.length, 'bajtów');
    console.log('Pierwsze 200 znaków pliku:', libraryFoldersContent.substring(0, 200));
    
    const libraryPaths = [];
    
    // Szukaj ścieżek w nowszym formacie VDF
    const pathRegex = /"path"\s*"([^"]+)"/g;
    let match;
    let pathFound = false;
    
    while ((match = pathRegex.exec(libraryFoldersContent)) !== null) {
      pathFound = true;
      const libraryPath = match[1].replace(/\\\\/g, '\\');
      console.log(`Znaleziono ścieżkę biblioteki: ${libraryPath}`);
      
      if (fs.existsSync(libraryPath)) {
        console.log(`Biblioteka istnieje: ${libraryPath}`);
        libraryPaths.push(libraryPath);
      } else {
        console.warn(`Biblioteka nie istnieje: ${libraryPath}`);
      }
    }
    
    // Jeśli nie znaleziono ścieżek w nowym formacie, próbujemy stary format
    if (!pathFound) {
      console.log('Próba analizy starego formatu pliku libraryfolders.vdf');
      
      // Szukaj wpisów w formacie "1" "D:\\Steam"
      const oldFormatRegex = /"(\d+)"\s*"([^"]+)"/g;
      
      while ((match = oldFormatRegex.exec(libraryFoldersContent)) !== null) {
        // Ignorujemy wpisy, które nie wyglądają jak ścieżki (np. appid, totalsize itp.)
        const potentialPath = match[2];
        
        // Sprawdź, czy to wygląda jak ścieżka (ma dwukropek lub backslash)
        if (potentialPath.includes(':') || potentialPath.includes('\\')) {
          console.log(`Znaleziono potencjalną ścieżkę biblioteki: ${potentialPath}`);
          
          if (fs.existsSync(potentialPath)) {
            console.log(`Biblioteka istnieje: ${potentialPath}`);
            libraryPaths.push(potentialPath);
          } else {
            console.warn(`Biblioteka nie istnieje: ${potentialPath}`);
          }
        } else {
          console.log(`Pominięto wpis, który nie wygląda jak ścieżka: ${potentialPath}`);
        }
      }
    }
    
    // Dodajmy ręcznie popularne lokalizacje, jeśli ich brakuje
    addCommonSteamLibraries(libraryPaths);
    
    return libraryPaths;
  } catch (error) {
    console.error(`Błąd podczas przetwarzania pliku bibliotek Steam:`, error);
    
    // W przypadku błędu, spróbujmy dodać przynajmniej standardowe ścieżki
    const defaultPaths = [];
    addCommonSteamLibraries(defaultPaths);
    return defaultPaths;
  }
}

/**
 * Dodaje popularne lokalizacje bibliotek Steam
 */
function addCommonSteamLibraries(libraryPaths) {
  // Sprawdź wszystkie dyski od C: do Z:
  const existingDrives = [];
  
  for (let i = 67; i <= 90; i++) {  // ASCII codes for C to Z
    const driveLetter = String.fromCharCode(i);
    const drivePath = `${driveLetter}:\\`;
    
    try {
      if (fs.existsSync(drivePath)) {
        existingDrives.push(driveLetter);
      }
    } catch (e) {
      // Ignoruj błędy dostępu
    }
  }
  
  console.log(`Znalezione dyski w systemie: ${existingDrives.join(', ')}:`);
  
  // Dla każdego znalezionego dysku, sprawdź popularne ścieżki
  for (const drive of existingDrives) {
    const commonLocations = [
      `${drive}:\\Steam`,
      `${drive}:\\SteamLibrary`,
      `${drive}:\\Games\\Steam`,
      `${drive}:\\Games\\SteamLibrary`,
      `${drive}:\\Program Files\\Steam`,
      `${drive}:\\Program Files (x86)\\Steam`,
    ];
    
    for (const location of commonLocations) {
      if (!libraryPaths.includes(location) && fs.existsSync(location)) {
        const steamAppsPath = path.join(location, 'steamapps');
        if (fs.existsSync(steamAppsPath)) {
          console.log(`Znaleziono dodatkową bibliotekę Steam: ${location}`);
          libraryPaths.push(location);
        }
      }
    }
  }
}

/**
 * Znajdź gry w folderze steamapps
 */
async function findGamesInSteamApps(steamAppsPath) {
  try {
    if (!fs.existsSync(steamAppsPath)) {
      console.warn(`Katalog steamapps nie istnieje: ${steamAppsPath}`);
      return [];
    }
    
    // Znajdź wszystkie pliki .acf (manifest gier)
    const files = fs.readdirSync(steamAppsPath);
    const manifestFiles = files.filter(file => file.endsWith('.acf'));
    
    console.log(`Znaleziono ${manifestFiles.length} plików manifestu w ${steamAppsPath}:`, manifestFiles);
    
    const games = [];
    
    for (const manifestFile of manifestFiles) {
      const manifestPath = path.join(steamAppsPath, manifestFile);
      const manifestContent = fs.readFileSync(manifestPath, 'utf8');
      
      try {
        // Lepsza metoda parsowania pliku .acf
        console.log(`Przetwarzanie pliku: ${manifestFile}`);
        
        // Pokaż zawartość pliku do debugowania
        console.log(`Pierwsze 100 znaków pliku: ${manifestContent.substring(0, 100)}`);
        
        // Próba dopasowania ID aplikacji
        let appId = null;
        const appIdRegex = /"appid"\s*"(\d+)"/i;
        const appIdMatch = manifestContent.match(appIdRegex);
        if (appIdMatch && appIdMatch[1]) {
          appId = appIdMatch[1];
          console.log(`Wykryto appId: ${appId}`);
        } else {
          const appIdOldRegex = /"appid"\s*(\d+)/i;
          const appIdOldMatch = manifestContent.match(appIdOldRegex);
          if (appIdOldMatch && appIdOldMatch[1]) {
            appId = appIdOldMatch[1];
            console.log(`Wykryto appId (stary format): ${appId}`);
          }
        }
        
        // Próba dopasowania nazwy gry
        let name = null;
        const nameRegex = /"name"\s*"([^"]+)"/i;
        const nameMatch = manifestContent.match(nameRegex);
        if (nameMatch && nameMatch[1]) {
          name = nameMatch[1];
          console.log(`Wykryto nazwę: ${name}`);
        }
        
        // Próba dopasowania katalogu instalacyjnego
        let installDir = null;
        const installDirRegex = /"installdir"\s*"([^"]+)"/i;
        const installDirMatch = manifestContent.match(installDirRegex);
        if (installDirMatch && installDirMatch[1]) {
          installDir = installDirMatch[1];
          console.log(`Wykryto katalog instalacyjny: ${installDir}`);
        } else {
          installDir = name; // Fallback do nazwy gry
        }
        
        // Jeśli znaleźliśmy zarówno ID jak i nazwę
        if (appId && (name || installDir)) {
          // Jeśli nie znaleźliśmy nazwy, użyj katalogu instalacyjnego
          if (!name) name = installDir;
          
          console.log(`Znaleziono grę: ${name} (${appId})`);
          
          // Wyklucz wpisy z "Steamworks" i inne niegry
          const skipTerms = ["Steamworks", "Dedicated Server", "Server", "Test", "SDK"];
          const shouldSkip = skipTerms.some(term => name.includes(term));
          
          if (!shouldSkip) {
            // Sprawdź różne możliwe ścieżki instalacji
            const possiblePaths = [
              path.join(steamAppsPath, 'common', installDir),
              path.join(steamAppsPath, 'common', name),
              path.join(steamAppsPath, installDir),
              path.join(steamAppsPath, name)
            ];
            
            // Znajdź pierwszą istniejącą ścieżkę
            let gamePath = null;
            for (const checkPath of possiblePaths) {
              if (fs.existsSync(checkPath)) {
                gamePath = checkPath;
                break;
              }
            }
            
            // Jeśli znaleziono ścieżkę lub przyjmujemy wszystkie gry niezależnie od istnienia katalogu
            if (gamePath || true) { // Zakładamy, że gra jest zainstalowana nawet jeśli nie znaleźliśmy katalogu
              const gameId = `steam_${appId}`;
              
              try {
                console.log(`Pobieranie okładki dla ${name}...`);
                const coverPath = await coverService.fetchGameCover(name);
                console.log(`Pobrano okładkę: ${coverPath}`);
                
                games.push({
                  id: gameId,
                  title: name,
                  platform: 'steam',
                  appId: appId,
                  installDir: gamePath || path.join(steamAppsPath, 'common', installDir),
                  cover: coverPath
                });
                
                console.log(`Dodano grę ${name} do listy`);
              } catch (error) {
                console.error(`Błąd podczas pobierania okładki dla ${name}:`, error);
                
                // Dodaj grę nawet bez okładki
                games.push({
                  id: gameId,
                  title: name,
                  platform: 'steam',
                  appId: appId,
                  installDir: gamePath || path.join(steamAppsPath, 'common', installDir),
                  cover: '../assets/icons/no-cover.jpg'
                });
                
                console.log(`Dodano grę ${name} do listy (bez okładki)`);
              }
            } else {
              console.log(`Gra ${name} nie została znaleziona w żadnej z oczekiwanych lokalizacji.`);
            }
          } else {
            console.log(`Pominięto wpis ${name} - zawiera słowo kluczowe do pominięcia`);
          }
        } else {
          console.warn(`Nie można odczytać ID lub nazwy z pliku ${manifestFile}`);
        }
      } catch (parseError) {
        console.error(`Błąd podczas parsowania pliku ${manifestFile}:`, parseError);
      }
    }
    
    console.log(`Znaleziono ${games.length} zainstalowanych gier w ${steamAppsPath}`);
    return games;
  } catch (error) {
    console.error(`Błąd podczas wyszukiwania gier w katalogu ${steamAppsPath}:`, error);
    return [];
  }
}

/**
 * Usuń duplikaty gier na podstawie tytułu
 * @param {Array} games Lista gier
 * @returns {Array} Lista gier bez duplikatów
 */
function removeDuplicateGames(games) {
  // Zabezpieczenie przed pustą lub undefined tablicą
  if (!games || !Array.isArray(games) || games.length === 0) {
    console.log('removeDuplicateGames: Przekazano pustą tablicę lub wartość undefined');
    return [];
  }
  
  const uniqueGames = [];
  const seenTitles = new Set();
  
  for (const game of games) {
    // Sprawdź czy obiekt gry ma właściwość title
    if (game && game.title && !seenTitles.has(game.title.toLowerCase())) {
      seenTitles.add(game.title.toLowerCase());
      uniqueGames.push(game);
    } else if (game && !game.title) {
      // Jeśli gra nie ma tytułu, dodaj ją do listy jako unikalną
      console.warn('Znaleziono grę bez tytułu:', game);
      uniqueGames.push(game);
    }
  }
  
  console.log(`Usunięto ${games.length - uniqueGames.length} duplikatów gier`);
  return uniqueGames;
}

/**
 * Znajdź zainstalowane gry dla danej platformy
 * @param {string} platform Nazwa platformy
 * @param {boolean} forceRefresh Wymuś odświeżenie cache (domyślnie: false)
 * @returns {Array} Lista gier
 */
async function findInstalledGames(platform, forceRefresh = false) {
  // Sprawdź, czy mamy już w cache gry dla tej platformy
  if (!forceRefresh) {
    const cachedGames = getCachedGames(platform);
    if (cachedGames && cachedGames.length > 0) {
      console.log(`Używam ${cachedGames.length} gier z cache dla platformy ${platform}`);
      return cachedGames;
    }
  }

  console.log(`Wyszukiwanie zainstalowanych gier dla platformy: ${platform}`);
  
  // Jeśli nie wymuszono odświeżenia, sprawdź cache
  if (!forceRefresh) {
    const cachedGames = getCachedGames();
    
    if (platform === 'all') {
      // Dla wszystkich platform, sprawdź czy któraś ma cache
      const hasAnyCached = ['steam', 'epic', 'battlenet', 'gog', 'uplay', 'origin', 'xbox'].some(p => 
        Array.isArray(cachedGames[p]) && cachedGames[p].length > 0
      );
      
      if (hasAnyCached) {
        console.log('Używam zapisanego cache dla platform');
        // Połącz wszystkie cache
        const allGames = [];
        
        // Dla każdej platformy, dodaj gry z cache lub uruchom wyszukiwanie
        for (const p of ['steam', 'epic', 'battlenet', 'gog', 'uplay', 'origin']) {
          if (Array.isArray(cachedGames[p]) && cachedGames[p].length > 0) {
            console.log(`Używam cache dla ${p}: ${cachedGames[p].length} gier`);
            allGames.push(...cachedGames[p]);
          } else {
            console.log(`Brak cache dla ${p}, wykonuję wyszukiwanie...`);
            try {
              let platformGames = [];
              
              switch (p) {
                case 'steam':
                  platformGames = await findSteamGames() || [];
                  break;
                case 'epic':
                  platformGames = await findEpicGames() || [];
                  break;
                case 'battlenet':
                  platformGames = await findBattleNetGames() || [];
                  break;
                case 'gog':
                  platformGames = await findGogGames() || [];
                  break;
                case 'uplay':
                  platformGames = await findUplayGames() || [];
                  break;
                case 'origin':
                  platformGames = await findOriginGames() || [];
                  break;
              }
              
              if (Array.isArray(platformGames) && platformGames.length > 0) {
                console.log(`Znaleziono ${platformGames.length} gier dla ${p}`);
                allGames.push(...platformGames);
                cacheGames(p, platformGames);
              }
            } catch (error) {
              console.error(`Błąd podczas wyszukiwania gier dla platformy ${p}:`, error);
            }
          }
        }
        
        console.log(`Łączna liczba wszystkich gier: ${allGames.length}`);
        
        // Usuń duplikaty i zwróć
        const uniqueGames = removeDuplicateGames(allGames);
        console.log(`Po usunięciu duplikatów: ${uniqueGames.length} gier`);
        return uniqueGames;
      }
    } else if (cachedGames[platform] && Array.isArray(cachedGames[platform]) && cachedGames[platform].length > 0) {
      console.log(`Używam zapisanego cache dla platformy ${platform} (${cachedGames[platform].length} gier)`);
      return cachedGames[platform];
    }
  }
  
  // Jeśli nie ma cache lub wymuszono odświeżenie, wykonaj faktyczne wyszukiwanie
  console.log(`Wykonuję pełne wyszukiwanie dla platformy ${platform}`);
  
  let result = [];
  
  switch (platform) {
    case 'steam':
      result = await findSteamGames();
      break;
    case 'epic':
      result = await findEpicGames();
      break;
    case 'battlenet':
      result = await findBattleNetGames();
      break;
    case 'gog':
      try {
        console.log('Wyszukiwanie gier GOG Galaxy...');
        const gogGames = await findGogGames();
        
        // Dodaj okładki do znalezionych gier
        const gamesWithCovers = await Promise.all(
          gogGames.map(async (game) => {
            if (!game.cover) {
              try {
                const coverPath = await coverService.fetchGameCover(game.title);
                return { ...game, cover: coverPath };
              } catch (error) {
                console.error(`Błąd podczas pobierania okładki dla ${game.title}:`, error);
                return { ...game, cover: '../assets/icons/no-cover.jpg' };
              }
            }
            return game;
          })
        );
        
        // Zapisz gry w cache
        cacheGames(platform, gamesWithCovers);
        
        console.log(`Znaleziono ${gamesWithCovers.length} gier GOG Galaxy`);
        return gamesWithCovers;
      } catch (error) {
        console.error('Błąd podczas wyszukiwania gier GOG Galaxy:', error);
        return [];
      }
      break;
    case 'uplay':
      result = await findUplayGames();
      break;
    case 'origin':
      result = await findOriginGames();
      break;
    case 'xbox':
      // Tymczasowa implementacja zwracająca pustą tablicę
      console.log('Obsługa gier Xbox zostanie zaimplementowana');
      result = [];
      break;
    case 'all':
      // Wszystkie platformy - połącz wyniki z różnych platform
      const steamGames = await findSteamGames() || [];
      const epicGames = await findEpicGames() || [];
      const battleNetGames = await findBattleNetGames() || [];
      const gogGames = await findGogGames() || [];
      const uplayGames = await findUplayGames() || [];
      const originGames = await findOriginGames() || [];
      const xboxGames = []; // Tymczasowo pusta tablica dla Xbox
      
      console.log(`Znaleziono gier: Steam: ${steamGames.length}, Epic: ${epicGames.length}, Battle.net: ${battleNetGames.length}, GOG: ${gogGames.length}, Uplay: ${uplayGames.length}, Origin: ${originGames.length}, Xbox: ${xboxGames.length}`);
      
      // Zapisz cache dla poszczególnych platform
      cacheGames('steam', steamGames);
      cacheGames('epic', epicGames);
      cacheGames('battlenet', battleNetGames);
      cacheGames('gog', gogGames);
      cacheGames('uplay', uplayGames);
      cacheGames('origin', originGames);
      cacheGames('xbox', xboxGames);
      
      // Połącz wyniki i usuń duplikaty na podstawie tytułu
      const allGames = [...steamGames, ...epicGames, ...battleNetGames, ...gogGames, ...uplayGames, ...originGames, ...xboxGames];
      console.log(`Łączna liczba wszystkich znalezionych gier: ${allGames.length}`);
      
      result = removeDuplicateGames(allGames);
      console.log(`Po usunięciu duplikatów: ${result.length} gier`);
      return result;
      
    default:
      console.warn(`Wykrywanie gier dla platformy ${platform} nie jest jeszcze obsługiwane`);
      return [];
  }
  
  // Sprawdź, czy wynik jest tablicą
  if (!Array.isArray(result)) {
    console.warn(`Znaleziono nieprawidłowy wynik dla platformy ${platform}, zwracam pustą tablicę`);
    result = [];
  }
  
  // Zapisz wyniki do cache dla przyszłych wywołań
  if (platform !== 'all') {
    cacheGames(platform, result);
  }
  
  console.log(`Znaleziono ${result.length} gier dla platformy ${platform}`);
  return result;
}

/**
 * Znajdź zainstalowane gry Epic Games
 */
async function findEpicGames() {
  try {
    console.log('Wyszukiwanie gier Epic Games Store...');
    
    // Epic Games przechowuje informacje o zainstalowanych grach w rejestrze (Windows) 
    // lub w pliku manifestu (w różnych lokalizacjach)
    const epicGames = [];
    
    // Sprawdź różne lokalizacje manifestów Epic Games
    await findEpicGamesInDefaultLocations(epicGames);
    
    // Jeśli nadal nie znaleziono gier, szukaj głębiej w systemie
    if (epicGames.length === 0) {
      await findEpicGamesInSystem(epicGames);
    }
    
    // Usuń duplikaty przed zwróceniem wyników
    const uniqueGames = removeDuplicateGames(epicGames);
    
    console.log(`Znaleziono ${uniqueGames.length} unikalnych gier Epic Games`);
    return uniqueGames;
  } catch (error) {
    console.error('Błąd podczas szukania gier Epic Games:', error);
    return [];
  }
}

/**
 * Szukaj gier Epic Games w domyślnych lokalizacjach
 */
async function findEpicGamesInDefaultLocations(epicGames) {
  const userHomeDir = os.homedir();
  
  // Typowe lokalizacje plików manifestu Epic Games
  const manifestPaths = [
    path.join(userHomeDir, 'AppData', 'Local', 'EpicGamesLauncher', 'Saved', 'Config', 'Windows'),
    'C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests',
    'D:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests',
    path.join(userHomeDir, '.config', 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests')
  ];
  
  // Dodaj dodatkowe dyski
  for (let i = 67; i <= 90; i++) {  // ASCII od C do Z
    const driveLetter = String.fromCharCode(i);
    try {
      const drivePath = `${driveLetter}:\\`;
      if (fs.existsSync(drivePath)) {
        manifestPaths.push(`${driveLetter}:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests`);
      }
    } catch (e) {
      // Ignoruj błędy dostępu
    }
  }
  
  // Sprawdź każdą lokalizację w poszukiwaniu plików manifestu
  for (const manifestPath of manifestPaths) {
    try {
      if (fs.existsSync(manifestPath)) {
        console.log(`Sprawdzanie manifestów Epic Games w: ${manifestPath}`);
        const files = fs.readdirSync(manifestPath);
        
        // Filtruj pliki JSON - manifesty Epic Games
        const manifestFiles = files.filter(file => file.endsWith('.item') || file.endsWith('.json'));
        console.log(`Znaleziono ${manifestFiles.length} plików manifestu w ${manifestPath}`);
        
        // Przetwórz każdy plik manifestu
        for (const manifestFile of manifestFiles) {
          const manifestFilePath = path.join(manifestPath, manifestFile);
          try {
            const manifestContent = fs.readFileSync(manifestFilePath, 'utf8');
            const manifestData = JSON.parse(manifestContent);
            
            // Sprawdź, czy to faktycznie manifest gry Epic
            if (manifestData.DisplayName && manifestData.InstallLocation) {
              const gameTitle = manifestData.DisplayName;
              const installLocation = manifestData.InstallLocation;
              
              // ID będzie albo CatalogItemId, albo AppName, albo określone przez ścieżkę
              const gameId = manifestData.CatalogItemId || 
                             manifestData.AppName || 
                             `epic_${manifestFile.replace('.item', '').replace('.json', '')}`;
              
              // Sprawdź, czy gra faktycznie istnieje w podanej lokalizacji
              if (fs.existsSync(installLocation)) {
                console.log(`Znaleziono grę Epic: ${gameTitle} w ${installLocation}`);
                
                // Pobierz okładkę dla gry
                try {
                  const coverPath = await coverService.fetchGameCover(gameTitle);
                  
                  epicGames.push({
                    id: `epic_${gameId}`,
                    title: gameTitle,
                    platform: 'epic',
                    installDir: installLocation,
                    cover: coverPath
                  });
                  
                  console.log(`Dodano grę Epic: ${gameTitle}`);
                } catch (coverError) {
                  console.error(`Błąd podczas pobierania okładki dla ${gameTitle}:`, coverError);
                  
                  // Dodaj grę nawet bez okładki
                  epicGames.push({
                    id: `epic_${gameId}`,
                    title: gameTitle,
                    platform: 'epic',
                    installDir: installLocation,
                    cover: '../assets/icons/no-cover.jpg'
                  });
                  
                  console.log(`Dodano grę Epic bez okładki: ${gameTitle}`);
                }
              } else {
                console.log(`Lokalizacja gry Epic nie istnieje: ${installLocation}`);
              }
            }
          } catch (jsonError) {
            console.error(`Błąd podczas przetwarzania pliku manifestu ${manifestFile}:`, jsonError);
          }
        }
      }
    } catch (error) {
      console.error(`Błąd podczas sprawdzania manifestów w ${manifestPath}:`, error);
    }
  }
}

/**
 * Szukaj głębiej w systemie plików, aby znaleźć Epic Games
 */
async function findEpicGamesInSystem(epicGames) {
  console.log('Głębsze wyszukiwanie gier Epic Games...');
  
  // Typowe lokalizacje instalacji Epic Games
  const installLocations = [
    'C:\\Program Files\\Epic Games',
    'D:\\Program Files\\Epic Games',
    'C:\\Epic Games',
    'D:\\Epic Games',
    'C:\\Games\\Epic Games',
    'D:\\Games\\Epic Games',
  ];
  
  // Dodaj dodatkowe dyski
  for (let i = 67; i <= 90; i++) {  // ASCII od C do Z
    const driveLetter = String.fromCharCode(i);
    try {
      const drivePath = `${driveLetter}:\\`;
      if (fs.existsSync(drivePath)) {
        installLocations.push(`${driveLetter}:\\Program Files\\Epic Games`);
        installLocations.push(`${driveLetter}:\\Epic Games`);
        installLocations.push(`${driveLetter}:\\Games\\Epic Games`);
      }
    } catch (e) {
      // Ignoruj błędy dostępu
    }
  }
  
  // Sprawdź znane lokalizacje
  for (const location of installLocations) {
    try {
      if (fs.existsSync(location)) {
        console.log(`Sprawdzanie katalogu: ${location}`);
        
        // Znajdź podkatalogi jako potencjalne gry
        const directories = fs.readdirSync(location)
          .filter(file => fs.statSync(path.join(location, file)).isDirectory());
        
        console.log(`Znaleziono ${directories.length} podkatalogów w ${location}`);
        
        // Sprawdź każdy podkatalog jako potencjalną grę
        for (const dir of directories) {
          const gameDir = path.join(location, dir);
          
          // Sprawdź, czy to wygląda jak gra (sprawdź typowe pliki)
          const hasExecutable = checkForExecutable(gameDir);
          
          if (hasExecutable) {
            const gameTitle = dir.replace(/([A-Z])/g, ' $1').trim();  // Dodaj spacje przed dużymi literami
            console.log(`Wykryto potencjalną grę Epic: ${gameTitle} w ${gameDir}`);
            
            // Pobierz okładkę dla gry
            try {
              const coverPath = await coverService.fetchGameCover(gameTitle);
              
              epicGames.push({
                id: `epic_${dir.toLowerCase().replace(/\s+/g, '_')}`,
                title: gameTitle,
                platform: 'epic',
                installDir: gameDir,
                cover: coverPath
              });
              
              console.log(`Dodano grę Epic: ${gameTitle}`);
            } catch (coverError) {
              console.error(`Błąd podczas pobierania okładki dla ${gameTitle}:`, coverError);
              
              // Dodaj grę nawet bez okładki
              epicGames.push({
                id: `epic_${dir.toLowerCase().replace(/\s+/g, '_')}`,
                title: gameTitle,
                platform: 'epic',
                installDir: gameDir,
                cover: '../assets/icons/no-cover.jpg'
              });
              
              console.log(`Dodano grę Epic bez okładki: ${gameTitle}`);
            }
          }
        }
      }
    } catch (error) {
      console.error(`Błąd podczas sprawdzania katalogu ${location}:`, error);
    }
  }
}

/**
 * Sprawdź, czy katalog zawiera plik wykonywalny
 */
function checkForExecutable(directory) {
  try {
    const files = fs.readdirSync(directory);
    
    // Sprawdź, czy są pliki .exe
    const hasExe = files.some(file => file.endsWith('.exe'));
    
    // Sprawdź, czy jest podkatalog "Binaries" (typowy dla gier Unreal Engine)
    const hasBinaries = files.includes('Binaries');
    
    return hasExe || hasBinaries;
  } catch (error) {
    console.error(`Błąd podczas sprawdzania katalogu ${directory}:`, error);
    return false;
  }
}

/**
 * Uruchamia grę o określonym ID
 */
async function launchGame(gameId) {
  try {
    console.log(`Uruchamianie gry o ID: ${gameId}`);
    
    // Pobierz dane o grze z ID
    let gameData;
    
    if (gameId.startsWith('xbox_')) {
      // Pobierz gry Xbox z pamięci podręcznej
      const cachedGames = getCachedGames();
      const xboxGames = cachedGames.xbox || [];
      gameData = xboxGames.find(game => game.id === gameId);
    } else if (gameId.startsWith('steam_')) {
      // Pobierz gry Steam z pamięci podręcznej
      const cachedGames = getCachedGames();
      const steamGames = cachedGames.steam || [];
      gameData = steamGames.find(game => game.id === gameId);
    } else if (gameId.startsWith('epic_')) {
      // Pobierz gry Epic z pamięci podręcznej
      const cachedGames = getCachedGames();
      const epicGames = cachedGames.epic || [];
      gameData = epicGames.find(game => game.id === gameId);
    } else if (gameId.startsWith('gog_')) {
      // Pobierz gry GOG z pamięci podręcznej
      const cachedGames = getCachedGames();
      const gogGames = cachedGames.gog || [];
      gameData = gogGames.find(game => game.id === gameId);
    } else if (gameId.startsWith('battlenet_')) {
      // Pobierz gry Battle.net z pamięci podręcznej
      const cachedGames = getCachedGames();
      const battlenetGames = cachedGames.battlenet || [];
      gameData = battlenetGames.find(game => game.id === gameId);
    } else if (gameId.startsWith('uplay_')) {
      // Pobierz gry Uplay z pamięci podręcznej
      const cachedGames = getCachedGames();
      const uplayGames = cachedGames.uplay || [];
      gameData = uplayGames.find(game => game.id === gameId);
    } else if (gameId.startsWith('origin_')) {
      // Pobierz gry Origin z pamięci podręcznej
      const cachedGames = getCachedGames();
      const originGames = cachedGames.origin || [];
      gameData = originGames.find(game => game.id === gameId);
    } else {
      // Dla niestandardowych gier, pobierz wszystkie gry
      const customGames = await getCustomGames();
      gameData = customGames.find(game => game.id === gameId);
    }
    
    if (!gameData) {
      console.error(`Nie znaleziono gry o ID: ${gameId}`);
      return false;
    }
    
    console.log(`Znaleziono grę: ${gameData.title}, platforma: ${gameData.platform}`);
    
    // Sprawdź, czy gra to aplikacja UWP dla Xbox
    if (gameData.platform === 'xbox' && gameData.isUWP && gameData.launchParameters) {
      console.log(`Uruchamianie aplikacji UWP za pomocą shell: ${gameData.launchParameters}`);
      
      // Użyj explorer.exe do uruchomienia protokołu shell:
      const { spawn } = require('child_process');
      
      spawn('explorer.exe', [gameData.launchParameters], {
        detached: true,
        stdio: 'ignore'
      }).unref();
      
      return true;
    }
    
    // Dla każdej platformy, uruchom grę w odpowiedni sposób
    switch (gameData.platform) {
      case 'steam':
        // Uruchamianie gier Steam
        try {
          const steamPath = await getSteamPath();
          if (!steamPath) {
            console.error('Nie znaleziono ścieżki do Steam');
            return false;
          }
          
          let steamId = gameData.steamId || gameData.id.replace('steam_', '');
          if (isNaN(steamId)) {
            console.error(`Nieprawidłowy Steam ID: ${steamId}`);
            return false;
          }
          
          console.log(`Uruchamianie gry Steam o ID: ${steamId}`);
          
          // Uruchom przez protocol steam:
          const { spawn } = require('child_process');
          spawn('cmd.exe', ['/c', `start steam://rungameid/${steamId}`], {
            detached: true,
            stdio: 'ignore'
          }).unref();
          
          return true;
        } catch (error) {
          console.error('Błąd podczas uruchamiania gry Steam:', error);
          return false;
        }
        
      case 'epic':
        // Uruchamianie gier Epic
        try {
          if (!gameData.executablePath && gameData.installDir) {
            // Próba znalezienia pliku wykonywalnego
            gameData.executablePath = findEpicGameExecutable(gameData.installDir);
          }
          
          if (!gameData.executablePath) {
            console.error(`Nie znaleziono pliku wykonywalnego dla gry Epic: ${gameData.title}`);
            return false;
          }
          
          console.log(`Uruchamianie gry Epic: ${gameData.executablePath}`);
          
          // Uruchom proces
          const { spawn } = require('child_process');
          const execDir = path.dirname(gameData.executablePath);
          console.log(`Uruchamianie z katalogu: ${execDir}`);
          
          spawn(gameData.executablePath, [], {
            detached: true,
            stdio: 'ignore',
            cwd: execDir,
            windowsVerbatimArguments: true,
            shell: true
          }).unref();
          
          return true;
        } catch (error) {
          console.error('Błąd podczas uruchamiania gry Epic:', error);
          return false;
        }
        
      case 'gog':
        // Uruchamianie gier GOG
        try {
          if (!gameData.executablePath && gameData.installDir) {
            // Próba znalezienia pliku wykonywalnego
            gameData.executablePath = findGogGameExecutable(gameData.installDir);
          }
          
          if (!gameData.executablePath) {
            console.error(`Nie znaleziono pliku wykonywalnego dla gry GOG: ${gameData.title}`);
            return false;
          }
          
          console.log(`Uruchamianie gry GOG: ${gameData.executablePath}`);
          
          // Uruchom proces
          const { spawn } = require('child_process');
          spawn(gameData.executablePath, [], {
            detached: true,
            stdio: 'ignore',
            cwd: path.dirname(gameData.executablePath)
          }).unref();
          
          return true;
        } catch (error) {
          console.error('Błąd podczas uruchamiania gry GOG:', error);
          return false;
        }
        
      case 'battlenet':
        // Uruchamianie gier Battle.net
        try {
          // Battle.net wymaga specjalnego protokołu do uruchamiania gier
          if (gameData.battlenetId) {
            console.log(`Uruchamianie gry Battle.net: ${gameData.battlenetId}`);
            
            // Uruchom przez protocol battle.net:
            const { spawn } = require('child_process');
            spawn('cmd.exe', ['/c', `start "Battle.net" "${gameData.battlenetId}"`], {
              detached: true,
              stdio: 'ignore'
            }).unref();
            
            return true;
          } else if (gameData.executablePath) {
            // Jeśli nie ma ID Battle.net, spróbuj uruchomić bezpośrednio plik wykonywalny
            console.log(`Uruchamianie gry Battle.net przez plik wykonywalny: ${gameData.executablePath}`);
            
            const { spawn } = require('child_process');
            spawn(gameData.executablePath, [], {
              detached: true,
              stdio: 'ignore',
              cwd: path.dirname(gameData.executablePath)
            }).unref();
            
            return true;
          } else {
            console.error(`Brak danych do uruchomienia gry Battle.net: ${gameData.title}`);
            return false;
          }
        } catch (error) {
          console.error('Błąd podczas uruchamiania gry Battle.net:', error);
          return false;
        }
        
      case 'uplay':
        // Uruchamianie gier Uplay
        try {
          if (!gameData.executablePath && gameData.installDir) {
            // Próba znalezienia pliku wykonywalnego
            gameData.executablePath = await findUplayGameExecutable(gameData.installDir);
          }
          
          if (!gameData.executablePath) {
            console.error(`Nie znaleziono pliku wykonywalnego dla gry Uplay: ${gameData.title}`);
            return false;
          }
          
          console.log(`Uruchamianie gry Uplay: ${gameData.executablePath}`);
          
          // Uruchom proces
          const { spawn } = require('child_process');
          spawn(gameData.executablePath, [], {
            detached: true,
            stdio: 'ignore',
            cwd: path.dirname(gameData.executablePath)
          }).unref();
          
          return true;
        } catch (error) {
          console.error('Błąd podczas uruchamiania gry Uplay:', error);
          return false;
        }
        
      case 'origin':
        // Uruchamianie gier Origin
        try {
          if (!gameData.executablePath && gameData.installDir) {
            // Próba znalezienia pliku wykonywalnego
            gameData.executablePath = await findOriginGameExecutable(gameData.installDir);
          }
          
          if (!gameData.executablePath) {
            console.error(`Nie znaleziono pliku wykonywalnego dla gry Origin: ${gameData.title}`);
            return false;
          }
          
          console.log(`Uruchamianie gry Origin: ${gameData.executablePath}`);
          
          // Uruchom proces
          const { spawn } = require('child_process');
          spawn(gameData.executablePath, [], {
            detached: true,
            stdio: 'ignore',
            cwd: path.dirname(gameData.executablePath)
          }).unref();
          
          return true;
        } catch (error) {
          console.error('Błąd podczas uruchamiania gry Origin:', error);
          return false;
        }
        
      case 'xbox':
        // Uruchamianie gier Xbox
        try {
          // Dla aplikacji UWP Xbox obsłużone wcześniej przez warunek isUWP
          if (!gameData.executablePath) {
            console.error(`Nie znaleziono pliku wykonywalnego dla gry Xbox: ${gameData.title}`);
            return false;
          }
          
          console.log(`Uruchamianie gry Xbox: ${gameData.executablePath}`);
          
          // Sprawdź, czy potrzebne są parametry uruchamiania
          const args = gameData.launchParameters ? gameData.launchParameters.split(' ') : [];
          
          // Uruchom proces
          const { spawn } = require('child_process');
          spawn(gameData.executablePath, args, {
            detached: true,
            stdio: 'ignore',
            cwd: path.dirname(gameData.executablePath)
          }).unref();
          
          return true;
        } catch (error) {
          console.error('Błąd podczas uruchamiania gry Xbox:', error);
          return false;
        }
        
      default:
        // Dla niestandardowych gier
        try {
          if (!gameData.executablePath) {
            console.error(`Nie znaleziono pliku wykonywalnego dla gry: ${gameData.title}`);
            return false;
          }
          
          console.log(`Uruchamianie gry: ${gameData.executablePath}`);
          
          // Sprawdź, czy potrzebne są parametry uruchamiania
          const args = gameData.launchParameters ? gameData.launchParameters.split(' ') : [];
          
          // Uruchom proces
          const { spawn } = require('child_process');
          spawn(gameData.executablePath, args, {
            detached: true,
            stdio: 'ignore',
            cwd: path.dirname(gameData.executablePath)
          }).unref();
          
          return true;
        } catch (error) {
          console.error('Błąd podczas uruchamiania gry:', error);
          return false;
        }
    }
  } catch (error) {
    console.error('Nieoczekiwany błąd podczas uruchamiania gry:', error);
    return false;
  }
}

/**
 * Znajdź plik wykonywalny gry Epic
 */
function findEpicGameExecutable(directory) {
  try {
    // Sprawdź typowe lokalizacje wykonywalne dla gier Epic
    const commonExecutablePaths = [
      path.join(directory, 'Binaries', 'Win64'),
      path.join(directory, 'Binaries', 'Win32'),
      directory
    ];
    
    for (const exePath of commonExecutablePaths) {
      if (fs.existsSync(exePath)) {
        const files = fs.readdirSync(exePath);
        
        // Najpierw szukaj pliku EXE o nazwie takiej jak katalog gry
        const dirName = path.basename(directory);
        const mainExe = files.find(file => 
          file.toLowerCase() === `${dirName.toLowerCase()}.exe` || 
          file.toLowerCase().includes(dirName.toLowerCase()) && file.endsWith('.exe')
        );
        
        if (mainExe) {
          return path.join(exePath, mainExe);
        }
        
        // Jeśli nie znaleziono, szukaj dowolnego EXE, który nie jest oczywistym instalatorem/narzędziem
        const exeFiles = files.filter(file => 
          file.endsWith('.exe') && 
          !file.toLowerCase().includes('uninstall') && 
          !file.toLowerCase().includes('setup') &&
          !file.toLowerCase().includes('installer')
        );
        
        if (exeFiles.length > 0) {
          // Zwróć pierwszy znaleziony plik EXE
          return path.join(exePath, exeFiles[0]);
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Błąd podczas szukania pliku wykonywalnego w ${directory}:`, error);
    return null;
  }
}

/**
 * Znajdź plik wykonywalny gry GOG
 */
function findGogGameExecutable(directory) {
  try {
    console.log(`Szukam pliku wykonywalnego GOG w: ${directory}`);
    
    // Najpierw sprawdź, czy istnieje REDprelauncher.exe
    const redLauncherPath = path.join(directory, 'REDprelauncher.exe');
    if (fs.existsSync(redLauncherPath)) {
      console.log(`Znaleziono REDprelauncher.exe w: ${redLauncherPath}`);
      return redLauncherPath;
    }
    
    // Sprawdź też w podkatalogach
    try {
      const entries = fs.readdirSync(directory, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subDirPath = path.join(directory, entry.name);
          const redLauncherInSubDir = path.join(subDirPath, 'REDprelauncher.exe');
          if (fs.existsSync(redLauncherInSubDir)) {
            console.log(`Znaleziono REDprelauncher.exe w podkatalogu: ${redLauncherInSubDir}`);
            return redLauncherInSubDir;
          }
        }
      }
    } catch (error) {
      console.error(`Błąd podczas sprawdzania podkatalogów: ${error.message}`);
    }
    
    // Znajdź wszystkie pliki .exe w głównym katalogu
    const files = fs.readdirSync(directory);
    const exeFiles = files.filter(file => file.toLowerCase().endsWith('.exe'));
    
    if (exeFiles.length > 0) {
      console.log(`Znaleziono pliki .exe w katalogu głównym: ${exeFiles.join(', ')}`);
      
      // Najpierw sprawdź, czy istnieje plik wykonywalny z nazwą katalogu
      const dirName = path.basename(directory);
      
      // Usunięcie niepotrzebnych znaków z nazwy katalogu
      let cleanDirName = dirName.replace(/[^\w\s]/gi, '').toLowerCase();
      
      // Znajdź plik .exe, który ma podobną nazwę do katalogu
      for (const file of exeFiles) {
        let fileName = file.toLowerCase();
        
        // Filtruj pliki instalacyjne i pomocnicze
        if (fileName.includes('unins') || 
            fileName.includes('setup') || 
            fileName.includes('launcher') || 
            fileName.includes('helper') || 
            fileName.includes('tools')) {
          continue;
        }
        
        const fileNameWithoutExt = path.basename(fileName, '.exe');
        
        if (fileNameWithoutExt.includes(cleanDirName) || 
            cleanDirName.includes(fileNameWithoutExt)) {
          console.log(`Znaleziono pasujący plik wykonywalny: ${file}`);
          return path.join(directory, file);
        }
      }
      
      // Jeśli nie znaleziono pliku o podobnej nazwie, wybierz pierwszy plik .exe
      // z wyjątkiem plików instalacyjnych i pomocniczych
      for (const file of exeFiles) {
        if (!file.toLowerCase().includes('unins') && 
            !file.toLowerCase().includes('setup') && 
            !file.toLowerCase().includes('launcher') && 
            !file.toLowerCase().includes('helper') && 
            !file.toLowerCase().includes('tools')) {
          console.log(`Wybrano plik wykonywalny: ${file}`);
          return path.join(directory, file);
        }
      }
      
      // Jeśli wszystkie pliki są wykluczane przez filtry, zwróć po prostu pierwszy plik .exe
      console.log(`Nie znaleziono odpowiedniego pliku, używam pierwszego dostępnego: ${exeFiles[0]}`);
      return path.join(directory, exeFiles[0]);
    }
    
    // Jeśli nie znaleziono plików .exe w głównym katalogu, szukaj w podkatalogach
    const subdirs = fs.readdirSync(directory, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    // Szukaj w katalogach, które mogą zawierać pliki wykonywalne
    for (const subdir of subdirs) {
      // Pomiń katalogi, które zwykle nie zawierają plików wykonywalnych
      if (subdir.toLowerCase() === 'support' || 
          subdir.toLowerCase() === 'redist' || 
          subdir.toLowerCase() === 'installscripts' || 
          subdir.toLowerCase() === 'soundtrack' || 
          subdir.toLowerCase() === 'docs') {
        continue;
      }
      
      const subdirPath = path.join(directory, subdir);
      
      try {
        const subdirFiles = fs.readdirSync(subdirPath);
        const subdirExeFiles = subdirFiles.filter(file => file.toLowerCase().endsWith('.exe'));
        
        if (subdirExeFiles.length > 0) {
          // Sprawdź najpierw REDprelauncher.exe w podkatalogu
          if (subdirExeFiles.includes('REDprelauncher.exe')) {
            console.log(`Znaleziono REDprelauncher.exe w podkatalogu ${subdir}`);
            return path.join(subdirPath, 'REDprelauncher.exe');
          }
          
          // Filtruj pliki instalacyjne i pomocnicze
          const validExeFiles = subdirExeFiles.filter(file => 
            !file.toLowerCase().includes('unins') && 
            !file.toLowerCase().includes('setup') && 
            !file.toLowerCase().includes('launcher') && 
            !file.toLowerCase().includes('helper') && 
            !file.toLowerCase().includes('tools'));
          
          if (validExeFiles.length > 0) {
            console.log(`Znaleziono plik wykonywalny w podkatalogu ${subdir}: ${validExeFiles[0]}`);
            return path.join(subdirPath, validExeFiles[0]);
          } else {
            console.log(`Znaleziono tylko nieodpowiednie pliki .exe w podkatalogu ${subdir}, używam pierwszego: ${subdirExeFiles[0]}`);
            return path.join(subdirPath, subdirExeFiles[0]);
          }
        }
      } catch (error) {
        console.error(`Błąd podczas przeglądania podkatalogu ${subdir}: ${error.message}`);
      }
    }
    
    // Nie znaleziono żadnego pliku wykonywalnego
    console.error(`Nie znaleziono pliku wykonywalnego w katalogu: ${directory}`);
    return null;
  } catch (error) {
    console.error(`Błąd podczas wyszukiwania pliku wykonywalnego GOG: ${error.message}`);
    return null;
  }
}

/**
 * Dodawanie nowej gry do biblioteki
 * @param {Object} gameData Dane nowej gry
 * @returns {Promise<Object>} Dodana gra z wygenerowanym ID
 */
async function addGame(gameData) {
  console.log('Dodawanie niestandardowej gry:', gameData.title);
  
  try {
    // Generuj unikalny identyfikator
    const gameId = `custom_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    // Jeśli podano URL okładki, pobierz ją i zapisz lokalnie
    let coverPath = null;
    if (gameData.coverUrl) {
      try {
        // Pobierz okładkę z URL
        const savedCoverPath = await coverService.fetchRemoteImage(gameData.coverUrl, gameData.title);
        coverPath = savedCoverPath;
      } catch (error) {
        console.error('Błąd podczas pobierania okładki:', error);
      }
    }
    
    // Przygotuj obiekt gry do zapisania
    const game = {
      id: gameId,
      title: gameData.title,
      platform: 'other',
      installDir: gameData.installDir || '',
      executablePath: gameData.executablePath || '',
      launchCommand: gameData.launchCommand || '',
      cover: coverPath,
      custom: true,
      addedAt: new Date().toISOString()
    };
    
    // Pobierz istniejące niestandardowe gry
    let customGames = [];
    try {
      // Pobierz bezpośrednio z store, aby uniknąć problemów z rekurencją
      customGames = store.get('customGames', []);
      console.log(`Pobrano ${customGames.length} istniejących gier niestandardowych`);
    } catch (loadError) {
      console.error('Błąd podczas pobierania listy gier niestandardowych:', loadError);
      customGames = []; // Zresetuj na pustą tablicę w przypadku błędu
    }
    
    // Dodaj nową grę do listy
    customGames.push(game);
    
    // Zapisz zaktualizowaną listę bezpośrednio w store
    try {
      store.set('customGames', customGames);
      console.log('Niestandardowa gra została zapisana pomyślnie:', game.title);
    } catch (saveError) {
      console.error('Błąd podczas zapisywania niestandardowej gry:', saveError);
      throw new Error('Nie udało się zapisać gry - błąd przechowywania');
    }
    
    return game;
  } catch (error) {
    console.error('Błąd podczas dodawania gry:', error);
    throw error;
  }
}

/**
 * Pobieranie zapisanych niestandardowych gier
 * @returns {Promise<Array>} Lista zapisanych niestandardowych gier
 */
async function getCustomGames() {
  try {
    // Pobierz bezpośrednio z store
    const customGames = store.get('customGames', []);
    console.log(`Pobrano ${customGames.length} gier niestandardowych z localStorage`);
    return customGames;
  } catch (error) {
    console.error('Błąd podczas pobierania niestandardowych gier:', error);
    return [];
  }
}

/**
 * Usuwanie gry z biblioteki
 * @param {string|number} gameId ID gry do usunięcia
 */
async function removeGame(gameId) {
  try {
    // Tutaj logika usuwania gry z lokalnej bazy danych
    return true;
  } catch (error) {
    console.error('Błąd podczas usuwania gry:', error);
    throw error;
  }
}

/**
 * Sprawdza, czy katalog może zawierać grę Battle.net
 */
function checkIsBattleNetGame(directory) {
  try {
    // Sprawdź typowe pliki/katalogi występujące w grach Battle.net
    const files = fs.readdirSync(directory);
    
    // Sprawdź, czy katalog zawiera pliki .exe
    const hasExecutables = files.some(file => file.endsWith('.exe'));
    
    // Jeśli znaleziono wykonywalne pliki, traktuj to jako grę
    return hasExecutables;
  } catch (error) {
    console.error(`Błąd podczas sprawdzania katalogu ${directory}:`, error);
    return false;
  }
}

/**
 * Znajdź zainstalowane gry Battle.net
 */
async function findBattleNetGames() {
  try {
    console.log('Wyszukiwanie gier Battle.net...');
    
    const battleNetGames = [];
    
    // Typowe lokalizacje instalacji Battle.net
    const battleNetMainPaths = [
      'C:\\Program Files (x86)\\Battle.net',
      'C:\\Program Files\\Battle.net',
      'D:\\Program Files (x86)\\Battle.net',
      'D:\\Program Files\\Battle.net',
      'C:\\Games\\Battle.net',
      'D:\\Games\\Battle.net'
    ];
    
    // Dodaj ścieżki z rejestru systemowego
    try {
      console.log('Szukam ścieżki Battle.net w rejestrze...');
      
      // 1. Sprawdź HKEY_LOCAL_MACHINE\SOFTWARE\Blizzard Entertainment\
      const { stdout: stdoutLM } = require('child_process').spawnSync('reg', [
        'query',
        'HKEY_LOCAL_MACHINE\\SOFTWARE\\Blizzard Entertainment\\',
        '/s'
      ], { encoding: 'utf8', shell: true });
      
      if (stdoutLM) {
        console.log('Znaleziono wpisy w rejestrze HKLM');
        // Szukaj ścieżek instalacji
        const installPaths = stdoutLM.match(/InstallPath\s+REG_SZ\s+([^\r\n]+)/g);
        if (installPaths && installPaths.length > 0) {
          installPaths.forEach(match => {
            const path = match.replace(/InstallPath\s+REG_SZ\s+/, '').trim();
            console.log(`Znaleziono ścieżkę w rejestrze: ${path}`);
            battleNetMainPaths.push(path);
          });
        }
      }
    } catch (regError) {
      console.log('Nie znaleziono ścieżki w HKLM lub wystąpił błąd:', regError.message);
    }
    
    try {
      // 2. Sprawdź HKEY_CURRENT_USER\Software\Blizzard Entertainment\
      const { stdout: stdoutCU } = require('child_process').spawnSync('reg', [
        'query',
        'HKEY_CURRENT_USER\\Software\\Blizzard Entertainment\\',
        '/s'
      ], { encoding: 'utf8', shell: true });
      
      if (stdoutCU) {
        console.log('Znaleziono wpisy w rejestrze HKCU');
        // Szukaj ścieżek instalacji
        const installPaths = stdoutCU.match(/InstallPath\s+REG_SZ\s+([^\r\n]+)/g);
        if (installPaths && installPaths.length > 0) {
          installPaths.forEach(match => {
            const path = match.replace(/InstallPath\s+REG_SZ\s+/, '').trim();
            console.log(`Znaleziono ścieżkę w rejestrze: ${path}`);
            battleNetMainPaths.push(path);
          });
        }
      }
    } catch (regError) {
      console.log('Nie znaleziono ścieżki w HKCU lub wystąpił błąd:', regError.message);
    }
    
    // Usuń duplikaty ścieżek
    const uniquePaths = [...new Set(battleNetMainPaths)];
    
    console.log('Sprawdzanie następujących ścieżek Battle.net:');
    for (const pathItem of uniquePaths) {
      console.log(`- ${pathItem}`);
    }
    
    // Przeszukaj każdą potencjalną ścieżkę Battle.net
    for (const battleNetPath of uniquePaths) {
      try {
        if (fs.existsSync(battleNetPath)) {
          console.log(`\nZnaleziono ścieżkę Battle.net: ${battleNetPath}`);
          
          // 1. Sprawdź, czy istnieje folder 'Games'
          const gamesPath = path.join(battleNetPath, 'Games');
          
          if (fs.existsSync(gamesPath)) {
            console.log(`Znaleziono folder Games: ${gamesPath}`);
            
            // Lista plików i folderów w katalogu Games
            const gameItems = fs.readdirSync(gamesPath);
            console.log(`Zawartość folderu Games: ${gameItems.join(', ')}`);
            
            // Przeszukaj każdy element w folderze Games
            for (const item of gameItems) {
              const itemPath = path.join(gamesPath, item);
              
              try {
                const stat = fs.statSync(itemPath);
                
                // Jeśli to folder, potraktuj go jako potencjalną grę
                if (stat.isDirectory()) {
                  console.log(`Znaleziono potencjalny folder gry: ${item}`);
                  
                  // Sprawdź, czy folder zawiera pliki .exe (typowe dla gier)
                  let exeFiles = [];
                  try {
                    exeFiles = fs.readdirSync(itemPath).filter(file => file.toLowerCase().endsWith('.exe'));
                  } catch (e) {
                    console.log(`Nie można odczytać zawartości katalogu ${itemPath}: ${e.message}`);
                  }
                  
                  if (exeFiles.length > 0) {
                    console.log(`Znaleziono ${exeFiles.length} pliki .exe w katalogu ${item}: ${exeFiles.join(', ')}`);
                    
                    // Formatuj nazwę gry (dodaj spacje przed dużymi literami)
                    const gameTitle = item.replace(/([A-Z])/g, ' $1').trim();
                    
                    // Pobierz okładkę dla gry
                    try {
                      const coverPath = await coverService.fetchGameCover(gameTitle);
                      battleNetGames.push({
                        id: `battlenet_${item.toLowerCase().replace(/\s+/g, '_')}`,
                        title: gameTitle,
                        platform: 'battlenet',
                        installDir: itemPath,
                        cover: coverPath
                      });
                      console.log(`Dodano grę Battle.net: ${gameTitle}`);
                    } catch (coverError) {
                      console.error(`Błąd podczas pobierania okładki dla ${gameTitle}:`, coverError);
                      // Dodaj grę nawet bez okładki
                      battleNetGames.push({
                        id: `battlenet_${item.toLowerCase().replace(/\s+/g, '_')}`,
                        title: gameTitle,
                        platform: 'battlenet',
                        installDir: itemPath,
                        cover: '../assets/icons/no-cover.jpg'
                      });
                      console.log(`Dodano grę Battle.net bez okładki: ${gameTitle}`);
                    }
                  }
                } 
                // Jeśli to plik .exe, sprawdź czy to może być gra
                else if (stat.isFile() && item.toLowerCase().endsWith('.exe') && !item.toLowerCase().includes('uninstall')) {
                  console.log(`Znaleziono plik wykonywalny w głównym katalogu Games: ${item}`);
                  
                  // Sformatuj nazwę gry (usuń .exe i dodaj spacje przed dużymi literami)
                  const gameTitle = item.replace('.exe', '')
                    .replace('Launcher', '')
                    .replace(/([A-Z])/g, ' $1')
                    .trim();
                  
                  // Pobierz okładkę dla gry
                  try {
                    const coverPath = await coverService.fetchGameCover(gameTitle);
                    battleNetGames.push({
                      id: `battlenet_${item.toLowerCase().replace('.exe', '').replace(/\s+/g, '_')}`,
                      title: gameTitle,
                      platform: 'battlenet',
                      installDir: gamesPath,
                      cover: coverPath
                    });
                    console.log(`Dodano grę Battle.net: ${gameTitle}`);
                  } catch (coverError) {
                    console.error(`Błąd podczas pobierania okładki dla ${gameTitle}:`, coverError);
                    // Dodaj grę nawet bez okładki
                    battleNetGames.push({
                      id: `battlenet_${item.toLowerCase().replace('.exe', '').replace(/\s+/g, '_')}`,
                      title: gameTitle,
                      platform: 'battlenet',
                      installDir: gamesPath,
                      cover: '../assets/icons/no-cover.jpg'
                    });
                    console.log(`Dodano grę Battle.net bez okładki: ${gameTitle}`);
                  }
                }
                // Jeśli to skrót (.lnk), potraktuj go jako potencjalną grę
                else if (stat.isFile() && item.toLowerCase().endsWith('.lnk') && !item.toLowerCase().includes('uninstall')) {
                  console.log(`Znaleziono skrót w folderze Games: ${item}`);
                  
                  // Sformatuj nazwę gry (usuń .lnk i dodaj spacje przed dużymi literami)
                  const gameTitle = item.replace('.lnk', '')
                    .replace('Launcher', '')
                    .replace(/([A-Z])/g, ' $1')
                    .trim();
                  
                  console.log(`Wykryto grę ze skrótu: ${gameTitle}`);
                  
                  // Pobierz okładkę dla gry
                  try {
                    const coverPath = await coverService.fetchGameCover(gameTitle);
                    battleNetGames.push({
                      id: `battlenet_${item.toLowerCase().replace('.lnk', '').replace(/\s+/g, '_')}`,
                      title: gameTitle,
                      platform: 'battlenet',
                      installDir: gamesPath,
                      cover: coverPath
                    });
                    console.log(`Dodano grę Battle.net ze skrótu: ${gameTitle}`);
                  } catch (coverError) {
                    console.error(`Błąd podczas pobierania okładki dla ${gameTitle}:`, coverError);
                    // Dodaj grę nawet bez okładki
                    battleNetGames.push({
                      id: `battlenet_${item.toLowerCase().replace('.lnk', '').replace(/\s+/g, '_')}`,
                      title: gameTitle,
                      platform: 'battlenet',
                      installDir: gamesPath,
                      cover: '../assets/icons/no-cover.jpg'
                    });
                    console.log(`Dodano grę Battle.net ze skrótu bez okładki: ${gameTitle}`);
                  }
                }
              } catch (e) {
                console.log(`Błąd podczas sprawdzania elementu ${item}: ${e.message}`);
              }
            }
          } else {
            console.log(`Nie znaleziono folderu Games w ${battleNetPath}`);
          }
        }
      } catch (error) {
        console.error(`Błąd podczas sprawdzania ścieżki Battle.net ${battleNetPath}:`, error);
      }
    }
    
    // Usuń duplikaty gier i zwróć wynik
    const uniqueGames = removeDuplicateGames(battleNetGames);
    console.log(`\nZnaleziono ${uniqueGames.length} unikalnych gier Battle.net`);
    return uniqueGames;
  } catch (error) {
    console.error('Błąd podczas szukania gier Battle.net:', error);
    return [];
  }
}

/**
 * Znajdź zainstalowane gry GOG
 */
async function findGogGames() {
  try {
    console.log('Wyszukiwanie gier GOG...');
    return await gogService.findGogGames();
  } catch (error) {
    console.error('Błąd podczas wyszukiwania gier GOG:', error);
    return [];
  }
}

/**
 * Wyszukuje typowe ścieżki instalacji GOG
 * @returns {Promise<Array>} Lista znalezionych ścieżek
 */
async function findGogCommonPaths() {
  const commonPaths = [];
  
  try {
    // Sprawdź typowe lokalizacje na każdym dysku
    for (let i = 67; i <= 90; i++) {  // ASCII od C do Z
      const driveLetter = String.fromCharCode(i);
      
      try {
        const drivePath = `${driveLetter}:\\`;
        
        if (fs.existsSync(drivePath)) {
          // Typowe ścieżki GOG
          const possiblePaths = [
            path.join(drivePath, 'Program Files', 'GOG Galaxy', 'Games'),
            path.join(drivePath, 'Program Files (x86)', 'GOG Galaxy', 'Games'),
            path.join(drivePath, 'GOG Games'),
            path.join(drivePath, 'Games', 'GOG Games'),
            path.join(drivePath, 'Program Files', 'GOG.com'),
            path.join(drivePath, 'Program Files (x86)', 'GOG.com')
          ];
          
          // Sprawdź każdą ścieżkę
          for (const pathToCheck of possiblePaths) {
            if (fs.existsSync(pathToCheck)) {
              console.log(`Znaleziono ścieżkę GOG: ${pathToCheck}`);
              commonPaths.push(pathToCheck);
            }
          }
        }
      } catch (e) {
        // Ignoruj błędy dostępu
      }
    }
    
    // Sprawdź katalog domowy użytkownika
    const userGogPath = path.join(os.homedir(), 'GOG Games');
    if (fs.existsSync(userGogPath)) {
      console.log(`Znaleziono ścieżkę GOG w katalogu domowym: ${userGogPath}`);
      commonPaths.push(userGogPath);
    }
    
    // Sprawdź rejestr Windows, aby znaleźć ścieżkę GOG Galaxy
    try {
      const { spawn } = require('child_process');
      const regQuery = spawn('reg', [
        'query',
        'HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\GOG.com\\GalaxyClient',
        '/v',
        'path'
      ], { shell: true });
      
      let regOutput = '';
      regQuery.stdout.on('data', (data) => {
        regOutput += data.toString();
      });
      
      await new Promise((resolve) => {
        regQuery.on('close', (code) => {
          if (code === 0 && regOutput) {
            const match = regOutput.match(/path\s+REG_SZ\s+([^\r\n]+)/);
            if (match && match[1]) {
              const regPath = match[1].trim();
              console.log(`Znaleziono ścieżkę GOG Galaxy w rejestrze: ${regPath}`);
              
              // Dodaj ścieżkę z rejestru
              if (fs.existsSync(regPath)) {
                commonPaths.push(regPath);
              }
              
              // Dodaj podfolder Games, jeśli istnieje
              const gamesPath = path.join(regPath, 'Games');
              if (fs.existsSync(gamesPath)) {
                commonPaths.push(gamesPath);
              }
              
              // Dodaj folder nadrzędny/Games, jeśli istnieje
              const parentGamesPath = path.join(path.dirname(regPath), 'Games');
              if (fs.existsSync(parentGamesPath)) {
                commonPaths.push(parentGamesPath);
              }
            }
          }
          resolve();
        });
      });
    } catch (e) {
      console.log("Nie udało się odczytać rejestru Windows:", e.message);
    }
    
    console.log(`Znaleziono ${commonPaths.length} ścieżek do gier GOG`);
    return commonPaths;
  } catch (error) {
    console.error('Błąd podczas wyszukiwania ścieżek GOG:', error.message);
    return [];
  }
}

/**
 * Odczytuje bazę danych GOG Galaxy, aby znaleźć zainstalowane gry
 * @returns {Promise<Array>} Tablica znalezionych gier
 */
async function readGogGalaxyDatabase() {
  return await gogService.readGogGalaxyDatabase();
}

/**
 * Znajdź zainstalowane gry Ubisoft Connect (Uplay)
 */
async function findUplayGames() {
  try {
    console.log('Wyszukiwanie gier Ubisoft Connect...');
    
    const uplayGames = [];
    const userHomeDir = os.homedir();
    
    // Typowe lokalizacje instalacji Ubisoft Connect i gier
    const uplayPaths = [
      'C:\\Program Files (x86)\\Ubisoft\\Ubisoft Game Launcher',
      'C:\\Program Files\\Ubisoft\\Ubisoft Game Launcher',
      'D:\\Program Files (x86)\\Ubisoft\\Ubisoft Game Launcher',
      'D:\\Program Files\\Ubisoft\\Ubisoft Game Launcher',
      'C:\\Program Files (x86)\\Ubisoft Connect',
      'C:\\Program Files\\Ubisoft Connect',
      'D:\\Program Files (x86)\\Ubisoft Connect',
      'D:\\Program Files\\Ubisoft Connect',
      path.join(userHomeDir, 'AppData', 'Local', 'Ubisoft Game Launcher'),
      path.join(userHomeDir, 'Games', 'Ubisoft Connect'),
    ];
    
    // Sprawdź wszystkie dyski od C: do Z:
    for (let i = 67; i <= 90; i++) {  // ASCII od C do Z
      const driveLetter = String.fromCharCode(i);
      try {
        const drivePath = `${driveLetter}:\\`;
        if (fs.existsSync(drivePath)) {
          // Typowe lokalizacje gier Ubisoft
          uplayPaths.push(`${driveLetter}:\\Program Files (x86)\\Ubisoft Game Launcher`);
          uplayPaths.push(`${driveLetter}:\\Program Files\\Ubisoft Game Launcher`);
          uplayPaths.push(`${driveLetter}:\\Program Files (x86)\\Ubisoft Connect`);
          uplayPaths.push(`${driveLetter}:\\Program Files\\Ubisoft Connect`);
          uplayPaths.push(`${driveLetter}:\\Ubisoft`);
          uplayPaths.push(`${driveLetter}:\\Games\\Ubisoft`);
          uplayPaths.push(`${driveLetter}:\\Ubisoft Connect`);
        }
      } catch (e) {
        // Ignoruj błędy dostępu
      }
    }
    
    // Sprawdź, czy istnieje wpis w rejestrze Windows dla Ubisoft Connect
    try {
      console.log('Szukam ścieżki Ubisoft Connect w rejestrze...');
      
      // Sprawdź HKEY_LOCAL_MACHINE\SOFTWARE\Ubisoft\Launcher
      const { stdout: stdoutLM } = require('child_process').spawnSync('reg', [
        'query',
        'HKEY_LOCAL_MACHINE\\SOFTWARE\\Ubisoft\\Launcher',
        '/v',
        'InstallDir'
      ], { encoding: 'utf8', shell: true });
      
      if (stdoutLM) {
        const match = stdoutLM.match(/InstallDir\s+REG_SZ\s+([^\r\n]+)/);
        if (match && match[1]) {
          const regPath = match[1].trim();
          console.log(`Znaleziono ścieżkę Ubisoft Connect w rejestrze: ${regPath}`);
          uplayPaths.push(regPath);
        }
      }
    } catch (regError) {
      console.log('Nie znaleziono ścieżki w HKLM lub wystąpił błąd:', regError.message);
    }
    
    // Usuń duplikaty ścieżek
    const uniquePaths = [...new Set(uplayPaths)];
    
    console.log('Sprawdzanie następujących ścieżek Ubisoft Connect:');
    for (const pathItem of uniquePaths) {
      console.log(`- ${pathItem}`);
    }
    
    // Szukaj katalogu instalacyjnego gier
    let gameInstallDirs = [];
    
    // Sprawdź plik konfiguracyjny Ubisoft Connect, który zawiera ścieżki do gier
    for (const uplayPath of uniquePaths) {
      try {
        if (fs.existsSync(uplayPath)) {
          console.log(`\nZnaleziono ścieżkę Ubisoft Connect: ${uplayPath}`);
          
          // Potencjalne lokalizacje pliku konfiguracyjnego
          const configPaths = [
            path.join(uplayPath, 'cache', 'configuration.json'),
            path.join(uplayPath, 'settings.yaml'),
            path.join(uplayPath, 'settings.ini'),
            path.join(userHomeDir, 'AppData', 'Local', 'Ubisoft Game Launcher', 'settings.yaml'),
            path.join(userHomeDir, 'AppData', 'Roaming', 'Ubisoft Connect', 'settings.yaml'),
          ];
          
          for (const configPath of configPaths) {
            if (fs.existsSync(configPath)) {
              console.log(`Znaleziono plik konfiguracyjny: ${configPath}`);
              
              try {
                const configContent = fs.readFileSync(configPath, 'utf8');
                
                // Szukaj ścieżek do gier w pliku konfiguracyjnym
                const installDirMatches = [];
                
                // Format JSON
                if (configPath.endsWith('.json')) {
                  try {
                    const configJson = JSON.parse(configContent);
                    
                    // Przeszukaj strukturę JSON w poszukiwaniu ścieżek instalacyjnych
                    const findPaths = (obj, paths = []) => {
                      if (!obj || typeof obj !== 'object') return paths;
                      
                      for (const key in obj) {
                        if (typeof obj[key] === 'string' && 
                            (key.includes('path') || key.includes('dir') || key.includes('location')) &&
                            obj[key].includes(':\\') && 
                            !obj[key].includes('Ubisoft Game Launcher')) {
                          paths.push(obj[key]);
                        } else if (typeof obj[key] === 'object') {
                          findPaths(obj[key], paths);
                        }
                      }
                      
                      return paths;
                    };
                    
                    const foundPaths = findPaths(configJson);
                    installDirMatches.push(...foundPaths);
                  } catch (e) {
                    console.log(`Błąd podczas parsowania JSON: ${e.message}`);
                  }
                }
                // Format YAML lub INI (przeszukiwanie tekstu)
                else {
                  const pathRegex = /(?:install(?:Dir|Path)|path|location|dir|directory)[\s"':=]+([a-zA-Z]:\\[^"\r\n,]+)/gi;
                  let match;
                  while ((match = pathRegex.exec(configContent)) !== null) {
                    if (match[1] && !match[1].includes('Ubisoft Game Launcher')) {
                      installDirMatches.push(match[1]);
                    }
                  }
                }
                
                if (installDirMatches.length > 0) {
                  console.log(`Znaleziono potencjalne ścieżki instalacji gier: ${installDirMatches.join(', ')}`);
                  gameInstallDirs.push(...installDirMatches);
                }
              } catch (readError) {
                console.error(`Błąd odczytu pliku konfiguracyjnego: ${readError.message}`);
              }
            }
          }
          
          // Szukaj potencjalnych katalogów z grami wokół ścieżki launchera
          const potentialGameDirs = [
            path.join(path.dirname(uplayPath), 'games'),
            path.join(path.dirname(uplayPath), 'Games'),
            path.join(uplayPath, 'games'),
            path.join(uplayPath, 'Games'),
          ];
          
          for (const gameDir of potentialGameDirs) {
            if (fs.existsSync(gameDir)) {
              console.log(`Znaleziono katalog gier: ${gameDir}`);
              gameInstallDirs.push(gameDir);
            }
          }
        }
      } catch (error) {
        console.error(`Błąd podczas sprawdzania ścieżki Ubisoft Connect ${uplayPath}:`, error);
      }
    }
    
    // Standardowe katalogi gier (nawet jeśli nie znaleziono w konfiguracji)
    const standardGameDirs = [
      'C:\\Program Files (x86)\\Ubisoft\\Ubisoft Game Launcher\\games',
      'C:\\Program Files\\Ubisoft\\Ubisoft Game Launcher\\games',
      'D:\\Program Files (x86)\\Ubisoft\\Ubisoft Game Launcher\\games',
      'D:\\Program Files\\Ubisoft\\Ubisoft Game Launcher\\games',
      'C:\\Program Files (x86)\\Ubisoft Connect\\games',
      'C:\\Program Files\\Ubisoft Connect\\games',
      'D:\\Program Files (x86)\\Ubisoft Connect\\games',
      'D:\\Program Files\\Ubisoft Connect\\games',
    ];
    
    gameInstallDirs.push(...standardGameDirs);
    
    // Usuń duplikaty ścieżek instalacyjnych
    const uniqueGameDirs = [...new Set(gameInstallDirs)];
    
    // Przeszukaj każdy katalog z grami
    for (const gameDir of uniqueGameDirs) {
      if (fs.existsSync(gameDir)) {
        console.log(`\nPrzeszukiwanie katalogu gier: ${gameDir}`);
        
        try {
          // Sprawdź czy to pojedyncza gra czy katalog z grami
          const gameSubDirs = fs.readdirSync(gameDir)
            .filter(file => {
              try {
                return fs.statSync(path.join(gameDir, file)).isDirectory();
              } catch (e) {
                return false;
              }
            });
          
          if (gameSubDirs.length > 0) {
            // To katalog zawierający podkatalogi gier
            console.log(`Znaleziono ${gameSubDirs.length} potencjalnych katalogów gier w ${gameDir}`);
            
            for (const subDir of gameSubDirs) {
              await processUplayGameDir(path.join(gameDir, subDir), uplayGames);
            }
          } else {
            // To może być katalog pojedynczej gry
            await processUplayGameDir(gameDir, uplayGames);
          }
        } catch (dirError) {
          console.error(`Błąd podczas czytania katalogu ${gameDir}:`, dirError);
        }
      }
    }
    
    // Usuń duplikaty gier i zwróć wynik
    const uniqueGames = removeDuplicateGames(uplayGames);
    console.log(`\nZnaleziono ${uniqueGames.length} unikalnych gier Ubisoft Connect`);
    return uniqueGames;
  } catch (error) {
    console.error('Błąd podczas szukania gier Ubisoft Connect:', error);
    return [];
  }
}

/**
 * Przetwarzanie potencjalnego katalogu gry Ubisoft
 */
async function processUplayGameDir(gamePath, gamesList) {
  try {
    console.log(`Sprawdzanie katalogu gry: ${gamePath}`);
    
    // Szukaj plików .exe w katalogu gry i podkatalogach
    const exeFiles = [];
    
    const findExes = (dir, depth = 0, maxDepth = 2) => {
      if (depth > maxDepth) return;
      
      try {
        const files = fs.readdirSync(dir);
        
        for (const file of files) {
          const filePath = path.join(dir, file);
          
          try {
            const stat = fs.statSync(filePath);
            
            if (stat.isDirectory()) {
              findExes(filePath, depth + 1, maxDepth);
            } else if (file.toLowerCase().endsWith('.exe') && 
                      !file.toLowerCase().includes('uninstall') &&
                      !file.toLowerCase().includes('setup') &&
                      !file.toLowerCase().includes('launcher') &&
                      !file.toLowerCase().includes('crash') &&
                      !file.toLowerCase().includes('report') &&
                      !file.toLowerCase().includes('helper')) {
              exeFiles.push(filePath);
            }
          } catch (e) {
            // Ignoruj błędy dostępu
          }
        }
      } catch (e) {
        // Ignoruj błędy dostępu
      }
    };
    
    findExes(gamePath);
    
    if (exeFiles.length > 0) {
      console.log(`Znaleziono ${exeFiles.length} pliki .exe w katalogu ${path.basename(gamePath)}`);
      
      // Szukaj pliku manifest.yaml, który może zawierać informacje o grze
      let gameTitle = path.basename(gamePath).replace(/([A-Z])/g, ' $1').trim();
      let gameId = '';
      
      // Sprawdź, czy istnieje plik manifest.yaml
      const manifestPath = path.join(gamePath, 'manifest.yaml');
      if (fs.existsSync(manifestPath)) {
        try {
          const manifestContent = fs.readFileSync(manifestPath, 'utf8');
          
          // Pobierz nazwę gry z manifestu
          const nameMatch = manifestContent.match(/name\s*:\s*['"]?([^'"]+)['"]?/i);
          if (nameMatch && nameMatch[1]) {
            gameTitle = nameMatch[1].trim();
            console.log(`Znaleziono nazwę gry w manifeście: ${gameTitle}`);
          }
          
          // Pobierz ID gry z manifestu
          const idMatch = manifestContent.match(/id\s*:\s*['"]?([^'"]+)['"]?/i);
          if (idMatch && idMatch[1]) {
            gameId = idMatch[1].trim();
            console.log(`Znaleziono ID gry w manifeście: ${gameId}`);
          }
        } catch (e) {
          console.log(`Błąd odczytu pliku manifest.yaml: ${e.message}`);
        }
      }
      
      // Jeśli nie znaleziono ID w manifeście, wygeneruj z nazwy katalogu
      if (!gameId) {
        gameId = path.basename(gamePath).toLowerCase().replace(/\s+/g, '_');
      }
      
      // Pobierz okładkę dla gry
      try {
        const coverPath = await coverService.fetchGameCover(gameTitle);
        
        gamesList.push({
          id: `uplay_${gameId}`,
          title: gameTitle,
          platform: 'uplay',
          installDir: gamePath,
          cover: coverPath
        });
        
        console.log(`Dodano grę Ubisoft Connect: ${gameTitle}`);
      } catch (coverError) {
        console.error(`Błąd podczas pobierania okładki dla ${gameTitle}:`, coverError);
        
        // Dodaj grę nawet bez okładki
        gamesList.push({
          id: `uplay_${gameId}`,
          title: gameTitle,
          platform: 'uplay',
          installDir: gamePath,
          cover: '../assets/icons/no-cover.jpg'
        });
        
        console.log(`Dodano grę Ubisoft Connect bez okładki: ${gameTitle}`);
      }
    }
  } catch (error) {
    console.error(`Błąd podczas przetwarzania katalogu gry ${gamePath}:`, error);
  }
}

/**
 * Znajdź zainstalowane gry Origin/EA App
 */
async function findOriginGames() {
  try {
    console.log('Wyszukiwanie gier Origin/EA App...');
    
    const originGames = [];
    const userHomeDir = os.homedir();
    
    // Typowe lokalizacje instalacji Origin i gier
    const originPaths = [
      'C:\\Program Files (x86)\\Origin',
      'C:\\Program Files\\Origin',
      'D:\\Program Files (x86)\\Origin',
      'D:\\Program Files\\Origin',
      'C:\\Program Files (x86)\\Electronic Arts\\EA Desktop',
      'C:\\Program Files\\Electronic Arts\\EA Desktop',
      'D:\\Program Files (x86)\\Electronic Arts\\EA Desktop',
      'D:\\Program Files\\Electronic Arts\\EA Desktop',
      path.join(userHomeDir, 'AppData', 'Local', 'Origin'),
      path.join(userHomeDir, 'AppData', 'Local', 'Electronic Arts', 'EA Desktop'),
    ];
    
    // Sprawdź wszystkie dyski od C: do Z:
    for (let i = 67; i <= 90; i++) {  // ASCII od C do Z
      const driveLetter = String.fromCharCode(i);
      try {
        const drivePath = `${driveLetter}:\\`;
        if (fs.existsSync(drivePath)) {
          // Typowe lokalizacje gier Origin/EA
          originPaths.push(`${driveLetter}:\\Program Files (x86)\\Origin Games`);
          originPaths.push(`${driveLetter}:\\Program Files\\Origin Games`);
          originPaths.push(`${driveLetter}:\\Origin Games`);
          originPaths.push(`${driveLetter}:\\Games\\Origin`);
          originPaths.push(`${driveLetter}:\\Program Files (x86)\\Electronic Arts`);
          originPaths.push(`${driveLetter}:\\Program Files\\Electronic Arts`);
          originPaths.push(`${driveLetter}:\\Electronic Arts`);
          originPaths.push(`${driveLetter}:\\Games\\Electronic Arts`);
        }
      } catch (e) {
        // Ignoruj błędy dostępu
      }
    }
    
    // Sprawdź, czy istnieje wpis w rejestrze Windows dla Origin/EA App
    try {
      console.log('Szukam ścieżki Origin/EA App w rejestrze...');
      
      // Sprawdź HKEY_LOCAL_MACHINE\SOFTWARE\Electronic Arts\EA Desktop
      const { stdout: stdoutEA } = require('child_process').spawnSync('reg', [
        'query',
        'HKEY_LOCAL_MACHINE\\SOFTWARE\\Electronic Arts\\EA Desktop',
        '/v',
        'InstallLocation'
      ], { encoding: 'utf8', shell: true });
      
      if (stdoutEA) {
        const match = stdoutEA.match(/InstallLocation\s+REG_SZ\s+([^\r\n]+)/);
        if (match && match[1]) {
          const regPath = match[1].trim();
          console.log(`Znaleziono ścieżkę EA App w rejestrze: ${regPath}`);
          originPaths.push(regPath);
        }
      }
      
      // Sprawdź HKEY_LOCAL_MACHINE\SOFTWARE\Origin
      const { stdout: stdoutOrigin } = require('child_process').spawnSync('reg', [
        'query',
        'HKEY_LOCAL_MACHINE\\SOFTWARE\\Origin',
        '/v',
        'OriginPath'
      ], { encoding: 'utf8', shell: true });
      
      if (stdoutOrigin) {
        const match = stdoutOrigin.match(/OriginPath\s+REG_SZ\s+([^\r\n]+)/);
        if (match && match[1]) {
          const regPath = match[1].trim();
          console.log(`Znaleziono ścieżkę Origin w rejestrze: ${regPath}`);
          originPaths.push(regPath);
        }
      }
    } catch (regError) {
      console.log('Nie znaleziono ścieżki w rejestrze lub wystąpił błąd:', regError.message);
    }
    
    // Usuń duplikaty ścieżek
    const uniquePaths = [...new Set(originPaths)];
    
    console.log('Sprawdzanie następujących ścieżek Origin/EA App:');
    for (const pathItem of uniquePaths) {
      console.log(`- ${pathItem}`);
    }
    
    // Przeszukaj każdą potencjalną ścieżkę Origin
    for (const originPath of uniquePaths) {
      try {
        if (fs.existsSync(originPath)) {
          console.log(`\nZnaleziono ścieżkę Origin/EA: ${originPath}`);
          
          // Szukaj pliku lokalcache.xml, który zawiera informacje o zainstalowanych grach (Origin)
          const localCachePath = path.join(originPath, 'LocalContent', 'localcache.xml');
          if (fs.existsSync(localCachePath)) {
            console.log(`Znaleziono plik cache: ${localCachePath}`);
            
            try {
              const cacheContent = fs.readFileSync(localCachePath, 'utf8');
              
              // Szukaj wpisów gier w pliku XML
              const gameDirRegex = /<game\s+[^>]*?path="([^"]+)"[^>]*?title="([^"]+)"/gi;
              
              let match;
              while ((match = gameDirRegex.exec(cacheContent)) !== null) {
                const gamePath = match[1];
                const gameTitle = match[2];
                
                // Sprawdź czy ścieżka istnieje
                if (fs.existsSync(gamePath)) {
                  console.log(`Znaleziono grę Origin: ${gameTitle} (${gamePath})`);
                  
                  // Pobierz okładkę dla gry
                  try {
                    const coverPath = await coverService.fetchGameCover(gameTitle);
                    
                    originGames.push({
                      id: `origin_${gameTitle.toLowerCase().replace(/\s+/g, '_')}`,
                      title: gameTitle,
                      platform: 'origin',
                      installDir: gamePath,
                      cover: coverPath
                    });
                    
                    console.log(`Dodano grę Origin: ${gameTitle}`);
                  } catch (coverError) {
                    console.error(`Błąd podczas pobierania okładki dla ${gameTitle}:`, coverError);
                    
                    // Dodaj grę nawet bez okładki
                    originGames.push({
                      id: `origin_${gameTitle.toLowerCase().replace(/\s+/g, '_')}`,
                      title: gameTitle,
                      platform: 'origin',
                      installDir: gamePath,
                      cover: '../assets/icons/no-cover.jpg'
                    });
                    
                    console.log(`Dodano grę Origin bez okładki: ${gameTitle}`);
                  }
                } else {
                  console.log(`Ścieżka gry Origin nie istnieje: ${gamePath}`);
                }
              }
            } catch (xmlError) {
              console.error(`Błąd podczas czytania pliku cache: ${xmlError.message}`);
            }
          }
          
          // Przeszukaj katalogi jako potencjalne lokalizacje gier (EA App zazwyczaj używa znanej struktury)
          const gameLocations = [
            path.join(originPath, 'games'),
            path.join(path.dirname(originPath), 'games'),
            path.join(originPath, 'Games'),
            path.join(path.dirname(originPath), 'Games'),
          ];
          
          for (const gameLocation of gameLocations) {
            if (fs.existsSync(gameLocation)) {
              console.log(`Znaleziono katalog gier: ${gameLocation}`);
              
              try {
                const gameFolders = fs.readdirSync(gameLocation)
                  .filter(item => {
                    try {
                      return fs.statSync(path.join(gameLocation, item)).isDirectory();
                    } catch (e) {
                      return false;
                    }
                  });
                
                console.log(`Znaleziono ${gameFolders.length} potencjalnych folderów gier`);
                
                for (const gameFolder of gameFolders) {
                  const gamePath = path.join(gameLocation, gameFolder);
                  await processOriginGameDir(gamePath, originGames);
                }
              } catch (dirError) {
                console.error(`Błąd podczas odczytu katalogu ${gameLocation}: ${dirError.message}`);
              }
            }
          }
        }
      } catch (error) {
        console.error(`Błąd podczas sprawdzania ścieżki Origin ${originPath}:`, error);
      }
    }
    
    // Usuń duplikaty gier i zwróć wynik
    const uniqueGames = removeDuplicateGames(originGames);
    console.log(`\nZnaleziono ${uniqueGames.length} unikalnych gier Origin/EA App`);
    return uniqueGames;
  } catch (error) {
    console.error('Błąd podczas szukania gier Origin/EA App:', error);
    return [];
  }
}

/**
 * Przetwarzanie potencjalnego katalogu gry Origin/EA
 */
async function processOriginGameDir(gamePath, gamesList) {
  try {
    console.log(`Sprawdzanie katalogu gry: ${gamePath}`);
    
    // Szukaj plików .exe w katalogu gry i podkatalogach
    const exeFiles = [];
    
    const findExes = (dir, depth = 0, maxDepth = 2) => {
      if (depth > maxDepth) return;
      
      try {
        const files = fs.readdirSync(dir);
        
        for (const file of files) {
          const filePath = path.join(dir, file);
          
          try {
            const stat = fs.statSync(filePath);
            
            if (stat.isDirectory()) {
              findExes(filePath, depth + 1, maxDepth);
            } else if (stats.isFile() && file.toLowerCase().endsWith('.exe')) {
              // Filtruj pliki wykonywalne, które nie są instalatorami, narzędziami itp.
              if (!file.toLowerCase().includes('unins') && 
                  !file.toLowerCase().includes('setup') &&
                  !file.toLowerCase().includes('support') &&
                  !file.toLowerCase().includes('redist') &&
                  !file.toLowerCase().includes('patch') &&
                  !file.toLowerCase().includes('update') &&
                  !file.toLowerCase().includes('installer') &&
                  !file.toLowerCase().includes('launcher') &&
                  !file.toLowerCase().includes('helper') &&
                  !file.toLowerCase().includes('eaorigin') &&
                  !file.toLowerCase().includes('eadl') &&
                  !file.toLowerCase().includes('originui') &&
                  !file.toLowerCase().includes('ea desktop')) {
                exeFiles.push(filePath);
              }
            }
          } catch (e) {
            // Ignoruj błędy dostępu
          }
        }
      } catch (e) {
        // Ignoruj błędy dostępu
      }
    };
    
    // Rozpocznij wyszukiwanie plików .exe
    findExes(gamePath);
    
    // Sprawdź, czy to faktycznie katalog gry (musi zawierać pliki wykonywalne)
    if (exeFiles.length > 0) {
      console.log(`Znaleziono ${exeFiles.length} pliki .exe w ${path.basename(gamePath)}`);
      
      // Formatuj nazwę gry
      let gameTitle = path.basename(gamePath);
      
      // Usuń nadmiarowe znaki i numerację z nazwy gry
      gameTitle = gameTitle.replace(/__Installer/i, '');
      gameTitle = gameTitle.replace(/^\d+\s+/, '');
      gameTitle = gameTitle.replace(/\(.*?\)/g, '').trim();
      gameTitle = gameTitle.replace(/™/g, '').trim();
      gameTitle = gameTitle.replace(/®/g, '').trim();
      
      // Sprawdź, czy katalog zawiera plik mfst.dat, który jest charakterystyczny dla gier Origin
      const hasMfstFile = fs.existsSync(path.join(gamePath, 'mfst.dat')) || 
                          fs.existsSync(path.join(gamePath, '__Installer', 'installerdata.xml'));
      
      if (hasMfstFile || exeFiles.length > 0) {
        // Pobierz okładkę dla gry
        let coverPath;
        try {
          coverPath = await coverService.fetchGameCover(gameTitle);
        } catch (coverError) {
          console.error(`Błąd podczas pobierania okładki dla ${gameTitle}:`, coverError);
          coverPath = '../assets/icons/no-cover.jpg';
        }
        
        // Wybierz najlepszy plik wykonywalny (największy rozmiar pliku)
        let bestExeFile = exeFiles[0];
        let bestSize = 0;
        
        for (const exeFile of exeFiles) {
          try {
            const stats = fs.statSync(exeFile);
            if (stats.size > bestSize) {
              bestSize = stats.size;
              bestExeFile = exeFile;
            }
          } catch (e) {
            // Ignoruj błędy dostępu
          }
        }
        
        // Sprawdź, czy gra już istnieje w liście
        const duplicateGame = gamesList.find(g => 
          g.title.toLowerCase() === gameTitle.toLowerCase() || 
          g.installDir === gamePath
        );
        
        if (!duplicateGame) {
          gamesList.push({
            id: `origin_${gameTitle.toLowerCase().replace(/\s+/g, '_')}`,
            title: gameTitle,
            platform: 'origin',
            installDir: gamePath,
            executablePath: bestExeFile,
            cover: coverPath,
            dateAdded: new Date().toISOString()
          });
          
          console.log(`Dodano grę Origin: ${gameTitle}`);
        }
        
        return bestExeFile;
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Błąd podczas przetwarzania katalogu gry Origin ${gamePath}:`, error);
    return null;
  }
}

/**
 * Znajdź zainstalowane gry Xbox
 */
async function findXboxGames() {
  try {
    console.log('Wyszukiwanie gier Xbox...');
    
    const xboxGames = [];
    const userHomeDir = os.homedir();
    
    // Pobierz ścieżkę do folderu Xbox z ustawień
    const platformPaths = getPlatformPathsFromStore();
    const configuredXboxPath = platformPaths.xbox;
    
    console.log('Próbuję znaleźć gry Microsoft Store/Xbox za pomocą Windows Shell...');
    
    try {
      // Użyj PowerShell, aby znaleźć aplikacje Microsoft Store
      const { spawn } = require('child_process');
      
      const powershell = spawn('powershell.exe', [
        '-Command',
        "Get-AppxPackage | Where-Object {$_.InstallLocation -like '*xboxgames*' -or $_.Publisher -like '*Microsoft*' -or $_.Name -like '*Microsoft.Xbox*' -or $_.Name -like '*Microsoft.MinecraftUWP*' -or $_.Name -like '*Microsoft.Minecraft*' -or $_.Name -like '*Microsoft.624F8B84B80*' -or $_.Name -like '*Bethesda*' -or $_.Name -like '*Mojang*'} | Select-Object Name, Publisher, InstallLocation"
      ]);
      
      let psOutput = '';
      
      powershell.stdout.on('data', (data) => {
        psOutput += data.toString();
      });
      
      await new Promise((resolve, reject) => {
        powershell.on('exit', (code) => {
          if (code === 0) {
            resolve();
          } else {
            console.warn(`PowerShell zakończył działanie z kodem: ${code}`);
            resolve(); // Kontynuuj nawet w przypadku błędu
          }
        });
        
        powershell.on('error', (err) => {
          console.error('Błąd podczas uruchamiania PowerShell:', err);
          resolve(); // Kontynuuj nawet w przypadku błędu
        });
      });
      
      console.log('Wynik polecenia PowerShell:', psOutput);
      
      // Przetwarzaj wynik - szukaj linii z InstallLocation
      const installLocationPattern = /InstallLocation\s+:\s+(.+)/g;
      const namePattern = /Name\s+:\s+(.+)/g;
      
      let match;
      let locations = [];
      let nameMatches = [];
      
      while ((match = installLocationPattern.exec(psOutput)) !== null) {
        if (match[1] && match[1].trim()) {
          locations.push(match[1].trim());
        }
      }
      
      while ((match = namePattern.exec(psOutput)) !== null) {
        if (match[1] && match[1].trim()) {
          nameMatches.push(match[1].trim());
        }
      }
      
      console.log(`Znaleziono ${locations.length} lokalizacji instalacji i ${nameMatches.length} nazw aplikacji`);
      
      // Mapuj lokalizacje instalacji na nazwy aplikacji
      for (let i = 0; i < Math.min(locations.length, nameMatches.length); i++) {
        const installLocation = locations[i];
        const appName = nameMatches[i];
        
        console.log(`Przetwarzanie aplikacji: ${appName} w lokalizacji: ${installLocation}`);
        
        if (installLocation && fs.existsSync(installLocation)) {
          // Uzyskaj czystą nazwę gry
          const gameTitle = getCleanXboxGameTitle(appName);
          
          // Szukamy plików wykonywalnych
          let executablePath = null;
          try {
            // Znajdź pliki .exe w katalogu aplikacji
            const execFiles = await findXboxExecutables(installLocation);
            if (execFiles.length > 0) {
              executablePath = execFiles[0];
              console.log(`Znaleziono plik wykonywalny: ${executablePath}`);
            }
          } catch (err) {
            console.warn(`Nie można znaleźć pliku wykonywalnego dla ${appName}:`, err);
          }
          
          // Jeśli nie znaleziono pliku wykonywalnego, użyj explorer.exe do uruchomienia aplikacji UWP
          if (!executablePath) {
            executablePath = 'explorer.exe';
            console.log(`Używam explorer.exe do uruchomienia aplikacji UWP: ${appName}`);
          }
          
          // Pobierz okładkę dla gry
          let coverPath;
          try {
            coverPath = await coverService.fetchGameCover(gameTitle);
          } catch (coverError) {
            console.error(`Błąd podczas pobierania okładki dla ${gameTitle}:`, coverError);
            coverPath = '../assets/icons/no-cover.jpg';
          }
          
          // Utwórz protokół URI dla aplikacji UWP
          let appURI = '';
          
          // Obsługa Minecraft for Windows (przykład ze zrzutu ekranu)
          if (appName.includes('Microsoft.MinecraftUWP') || appName.includes('Minecraft')) {
            appURI = `shell:appsFolder\\${appName}_8wekyb3d8bbwe!App`;
          } else {
            // Dla innych aplikacji
            const packageFamilyName = appName.includes('_') ? appName : `${appName}_8wekyb3d8bbwe`;
            appURI = `shell:appsFolder\\${packageFamilyName}!App`;
          }
          
          xboxGames.push({
            id: `xbox_${gameTitle.replace(/\s+/g, '_').toLowerCase()}`,
            title: gameTitle,
            platform: 'xbox',
            installDir: installLocation,
            executablePath: executablePath,
            launchParameters: appURI,
            isUWP: true,
            cover: coverPath,
            dateAdded: new Date().toISOString()
          });
          
          console.log(`Dodano grę Xbox: ${gameTitle}`);
        }
      }
    } catch (shellError) {
      console.error('Błąd podczas używania Windows Shell:', shellError);
    }
    
    // Jeśli nie znaleziono gier przez shell, spróbuj tradycyjnych metod
    if (xboxGames.length === 0) {
      console.log('Powrót do tradycyjnych metod wyszukiwania...');
      
      // Typowe lokalizacje instalacji gier Xbox
      const xboxPaths = [
        configuredXboxPath,
        path.join(userHomeDir, 'AppData', 'Local', 'Microsoft', 'WindowsApps'),
        path.join(userHomeDir, 'AppData', 'Local', 'Packages'),
        'C:\\Program Files\\WindowsApps',
        'C:\\Program Files\\ModifiableWindowsApps',
        'C:\\Program Files\\Microsoft Games',
        'C:\\XboxGames',
        'D:\\XboxGames',
        'E:\\XboxGames'
      ];
      
      // Sprawdź wszystkie dyski od C: do Z:
      for (let i = 67; i <= 90; i++) {  // ASCII codes for C to Z
        const driveLetter = String.fromCharCode(i);
        try {
          const drivePath = `${driveLetter}:\\`;
          if (fs.existsSync(drivePath)) {
            xboxPaths.push(`${driveLetter}:\\Program Files\\WindowsApps`);
            xboxPaths.push(`${driveLetter}:\\Program Files\\ModifiableWindowsApps`);
            xboxPaths.push(`${driveLetter}:\\Windows\\XboxGames`);
            xboxPaths.push(`${driveLetter}:\\XboxGames`);
            xboxPaths.push(`${driveLetter}:\\Games\\Xbox`);
            xboxPaths.push(`${driveLetter}:\\Games`);
          }
        } catch (e) {
          // Ignoruj błędy dostępu
        }
      }
      
      console.log('Sprawdzanie możliwych ścieżek Xbox');
      for (const xboxPath of xboxPaths) {
        if (xboxPath && fs.existsSync(xboxPath)) {
          try {
            console.log(`Sprawdzam ścieżkę: ${xboxPath}`);
            
            // Uzyskaj listę katalogów w lokalizacji
            const entries = fs.readdirSync(xboxPath, { withFileTypes: true });
            
            // Przeszukaj wszystkie katalogi w poszukiwaniu gier
            for (const entry of entries) {
              if (entry.isDirectory()) {
                const folderName = entry.name;
                const folderPath = path.join(xboxPath, folderName);
                
                // Sprawdź, czy katalog może zawierać grę Xbox
                if (isLikelyXboxGameFolder(folderName)) {
                  try {
                    // Określ nazwę gry na podstawie nazwy katalogu
                    let gameTitle = getCleanXboxGameTitle(folderName);
                    
                    // Szukaj plików wykonywalnych w katalogu gry
                    const executableFiles = await findXboxExecutables(folderPath);
                    
                    if (executableFiles.length > 0) {
                      // Pobierz okładkę dla gry
                      let coverPath;
                      try {
                        coverPath = await coverService.fetchGameCover(gameTitle);
                      } catch (coverError) {
                        console.error(`Błąd podczas pobierania okładki dla ${gameTitle}:`, coverError);
                        coverPath = '../assets/icons/no-cover.jpg';
                      }
                      
                      // Utwórz URI dla aplikacji UWP
                      let appURI = '';
                      if (folderName.includes('Microsoft.') && folderName.includes('_')) {
                        appURI = `shell:appsFolder\\${folderName}!App`;
                      }
                      
                      xboxGames.push({
                        id: `xbox_${gameTitle.replace(/\s+/g, '_').toLowerCase()}`,
                        title: gameTitle,
                        platform: 'xbox',
                        installDir: folderPath,
                        executablePath: executableFiles[0],
                        launchParameters: appURI || '',
                        isUWP: appURI ? true : false,
                        cover: coverPath,
                        dateAdded: new Date().toISOString()
                      });
                      
                      console.log(`Dodano grę Xbox: ${gameTitle} (${executableFiles[0]})`);
                    }
                  } catch (dirError) {
                    console.log(`Błąd dostępu do katalogu ${folderPath}: ${dirError.message}`);
                  }
                }
              }
            }
          } catch (error) {
            console.error(`Błąd podczas przeszukiwania ścieżki ${xboxPath}:`, error);
          }
        }
      }
    }
    
    console.log(`Znaleziono ${xboxGames.length} gier Xbox`);
    return xboxGames;
  } catch (error) {
    console.error('Błąd podczas wyszukiwania gier Xbox:', error);
    return [];
  }
}

/**
 * Sprawdza, czy nazwa folderu prawdopodobnie zawiera grę Xbox
 */
function isLikelyXboxGameFolder(folderName) {
  const lowerFolderName = folderName.toLowerCase();
  
  // Najczęstsze wzorce katalogów gier Xbox
  return (
    lowerFolderName.includes('microsoft.') ||
    lowerFolderName.includes('xbox') ||
    lowerFolderName.includes('game') ||
    lowerFolderName.includes('forza') ||
    lowerFolderName.includes('halo') ||
    lowerFolderName.includes('sea of thieves') ||
    lowerFolderName.includes('gears') ||
    lowerFolderName.includes('age of empires') ||
    lowerFolderName.includes('state of decay') ||
    (lowerFolderName.includes('msixvc') && !lowerFolderName.includes('framework'))
  );
}

/**
 * Czyści nazwę gry Xbox z identyfikatorów i kodów
 */
function getCleanXboxGameTitle(folderName) {
  let gameTitle = folderName;
  
  // Jeśli nazwa zaczyna się od "Microsoft.", usuń ten prefix
  if (gameTitle.startsWith('Microsoft.')) {
    gameTitle = gameTitle.substring(10);
  }
  
  // Usuń identyfikatory GUID i wersje
  gameTitle = gameTitle.replace(/\_[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/i, '');
  gameTitle = gameTitle.replace(/\d+\.\d+\.\d+\.\d+/g, '');
  gameTitle = gameTitle.replace(/\_\w+$/g, '');
  
  // Zamień podkreślniki i kropki na spacje
  gameTitle = gameTitle.replace(/[._]/g, ' ');
  
  // Zamień CamelCase na spacje
  gameTitle = gameTitle.replace(/([a-z])([A-Z])/g, '$1 $2');
  
  // Uporządkuj formatowanie (każde słowo zaczyna się wielką literą)
  gameTitle = gameTitle.split(' ')
    .filter(word => word.length > 0)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  
  // Usuwanie podwójnych spacji
  gameTitle = gameTitle.replace(/\s+/g, ' ').trim();
  
  return gameTitle;
}

/**
 * Znajduje pliki wykonywalne w katalogu gry Xbox
 */
async function findXboxExecutables(directory, maxDepth = 3) {
  try {
    const executableExtensions = ['.exe', '.lnk', '.url'];
    const executableFiles = [];
    
    // Funkcja rekurencyjna do przeszukiwania katalogów
    const searchDirectory = async (dir, depth = 0) => {
      if (depth > maxDepth) return;
      
      try {
        const entries = await fsPromises.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            // Rekurencyjnie przeszukaj podfoldery
            await searchDirectory(fullPath, depth + 1);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            
            if (executableExtensions.includes(ext)) {
              // Pomiń pliki instalacyjne i deinstalacyjne
              const lowerName = entry.name.toLowerCase();
              if (!lowerName.includes('unins') && 
                  !lowerName.includes('setup') &&
                  !lowerName.includes('installer')) {
                executableFiles.push(fullPath);
              }
            }
          }
        }
      } catch (error) {
        console.log(`Błąd podczas przeglądania katalogu ${dir}: ${error.message}`);
      }
    };
    
    // Rozpocznij przeszukiwanie od głównego katalogu
    await searchDirectory(directory);
    
    return executableFiles;
  } catch (error) {
    console.error(`Błąd podczas szukania plików wykonywalnych w ${directory}:`, error);
    return [];
  }
}

/**
 * Znajdź zainstalowane gry Origin
 */
async function findOriginGames() {
  try {
    console.log('Wyszukiwanie gier Origin...');
    
    const originGames = [];
    const userHomeDir = os.homedir();
    
    // Pobierz ścieżkę do folderu Origin z ustawień
    const platformPaths = getPlatformPathsFromStore();
    const configuredOriginPath = platformPaths.origin;
    
    console.log('Próbuję znaleźć gry Origin za pomocą rejestru...');
    
    try {
      // Użyj PowerShell do przeszukiwania rejestru w poszukiwaniu zainstalowanych gier Origin
      const { spawn } = require('child_process');
      
      const powershell = spawn('powershell.exe', [
        '-Command',
        "Get-ChildItem 'HKLM:\\SOFTWARE\\WOW6432Node\\Origin\\Installs\\*' | ForEach-Object { $installDir = (Get-ItemProperty -Path $_.PSPath).InstallDir; $displayName = (Get-ItemProperty -Path $_.PSPath).DisplayName; if ($displayName -and $installDir) { Write-Output \"$displayName|$installDir\" } }"
      ]);
      
      let psOutput = '';
      
      powershell.stdout.on('data', (data) => {
        psOutput += data.toString();
      });
      
      await new Promise((resolve, reject) => {
        powershell.on('exit', (code) => {
          if (code === 0) {
            resolve();
          } else {
            console.warn(`PowerShell zakończył działanie z kodem: ${code}`);
            resolve(); // Kontynuuj nawet w przypadku błędu
          }
        });
        
        powershell.on('error', (err) => {
          console.error('Błąd podczas uruchamiania PowerShell:', err);
          resolve(); // Kontynuuj nawet w przypadku błędu
        });
      });
      
      // Przetwórz wyniki - każda linia ma format "DisplayName|InstallDir"
      const gameEntries = psOutput.split('\n')
        .filter(line => line.includes('|'));
      
      console.log(`Znaleziono ${gameEntries.length} wpisów gier Origin w rejestrze`);
      
      // Przetwórz każdy wpis
      for (const entry of gameEntries) {
        const [displayName, installDir] = entry.split('|');
        
        if (displayName && installDir && fs.existsSync(installDir)) {
          console.log(`Przetwarzanie gry Origin: ${displayName} w lokalizacji: ${installDir}`);
          
          // Pobierz okładkę dla gry
          let coverPath;
          try {
            coverPath = await coverService.fetchGameCover(displayName);
          } catch (coverError) {
            console.error(`Błąd podczas pobierania okładki dla ${displayName}:`, coverError);
            coverPath = '../assets/icons/no-cover.jpg';
          }
          
          // Znajdź plik wykonywalny gry
          const executablePath = await processOriginGameDir(installDir, originGames);
          
          if (executablePath) {
            originGames.push({
              id: `origin_${displayName.replace(/\s+/g, '_').toLowerCase()}`,
              title: displayName,
              platform: 'origin',
              installDir: installDir,
              executablePath: executablePath,
              cover: coverPath,
              dateAdded: new Date().toISOString()
            });
            
            console.log(`Dodano grę Origin: ${displayName}`);
          }
        }
      }
    } catch (regError) {
      console.error('Błąd podczas przeszukiwania rejestru Origin:', regError);
    }
    
    // Jeśli nie znaleziono gier w rejestrze, spróbuj standardowych metod
    if (originGames.length === 0) {
      console.log('Powrót do tradycyjnych metod wyszukiwania...');
      
      // Typowe lokalizacje instalacji Origin i gier
      const originPaths = [
        configuredOriginPath,
        'C:\\Program Files (x86)\\Origin Games',
        'C:\\Program Files\\Origin Games',
        'D:\\Program Files (x86)\\Origin Games',
        'D:\\Program Files\\Origin Games',
        'C:\\Origin Games',
        'D:\\Origin Games',
        'C:\\Games\\Origin',
        'D:\\Games\\Origin',
        path.join(userHomeDir, 'AppData', 'Local', 'Origin'),
      ];
      
      // Sprawdź wszystkie dyski od C: do Z:
      for (let i = 67; i <= 90; i++) {  // ASCII od C do Z
        const driveLetter = String.fromCharCode(i);
        try {
          const drivePath = `${driveLetter}:\\`;
          if (fs.existsSync(drivePath)) {
            originPaths.push(`${driveLetter}:\\Program Files (x86)\\Origin Games`);
            originPaths.push(`${driveLetter}:\\Program Files\\Origin Games`);
            originPaths.push(`${driveLetter}:\\Origin Games`);
            originPaths.push(`${driveLetter}:\\Games\\Origin`);
            originPaths.push(`${driveLetter}:\\Games\\EA Games`);
          }
        } catch (e) {
          // Ignoruj błędy dostępu
        }
      }
      
      // Sprawdź ścieżkę skonfigurowaną przez użytkownika
      if (configuredOriginPath && originPaths.indexOf(configuredOriginPath) === -1) {
        originPaths.unshift(configuredOriginPath);
      }
      
      // Usuń duplikaty ścieżek
      const uniquePaths = [...new Set(originPaths)];
      
      console.log('Sprawdzanie następujących ścieżek Origin:');
      for (const pathItem of uniquePaths) {
        if (pathItem) {
          console.log(`- ${pathItem}`);
        }
      }
      
      // Przeszukaj każdą potencjalną ścieżkę Origin
      for (const originPath of uniquePaths) {
        if (originPath && fs.existsSync(originPath)) {
          try {
            console.log(`\nZnaleziono ścieżkę Origin: ${originPath}`);
            
            // Przeszukaj każdy folder w głównym katalogu jako potencjalną grę
            try {
              const gameFolders = fs.readdirSync(originPath)
                .filter(file => {
                  try {
                    return fs.statSync(path.join(originPath, file)).isDirectory();
                  } catch (e) {
                    return false;
                  }
                });
              
              console.log(`Znaleziono ${gameFolders.length} potencjalnych folderów gier w ${originPath}`);
              
              // Sprawdź każdy folder jako potencjalną grę
              for (const gameFolder of gameFolders) {
                const gamePath = path.join(originPath, gameFolder);
                
                await processOriginGameDir(gamePath, originGames);
              }
            } catch (foldersError) {
              console.error(`Błąd odczytu katalogu ${originPath}: ${foldersError.message}`);
            }
          } catch (error) {
            console.error(`Błąd podczas sprawdzania ścieżki Origin ${originPath}:`, error);
          }
        }
      }
    }
    
    // Usuń duplikaty gier
    const uniqueGames = removeDuplicateGames(originGames);
    
    console.log(`\nZnaleziono ${uniqueGames.length} unikalnych gier Origin`);
    return uniqueGames;
  } catch (error) {
    console.error('Błąd podczas szukania gier Origin:', error);
    return [];
  }
}

/**
 * Przetwórz katalog gry Origin
 */
async function processOriginGameDir(gamePath, gamesList) {
  try {
    // Szukaj plików .exe w folderze gry
    let exeFiles = [];
    
    // Funkcja rekurencyjna do znajdowania plików wykonawczych
    const findExes = (dir, depth = 0, maxDepth = 2) => {
      if (depth > maxDepth) return;
      
      try {
        const files = fs.readdirSync(dir);
        
        for (const file of files) {
          const filePath = path.join(dir, file);
          try {
            const stats = fs.statSync(filePath);
            
            if (stats.isDirectory()) {
              findExes(filePath, depth + 1, maxDepth);
            } else if (stats.isFile() && file.toLowerCase().endsWith('.exe')) {
              // Filtruj pliki wykonywalne, które nie są instalatorami, narzędziami itp.
              if (!file.toLowerCase().includes('unins') && 
                  !file.toLowerCase().includes('setup') &&
                  !file.toLowerCase().includes('support') &&
                  !file.toLowerCase().includes('redist') &&
                  !file.toLowerCase().includes('patch') &&
                  !file.toLowerCase().includes('update') &&
                  !file.toLowerCase().includes('installer') &&
                  !file.toLowerCase().includes('launcher') &&
                  !file.toLowerCase().includes('helper') &&
                  !file.toLowerCase().includes('eaorigin') &&
                  !file.toLowerCase().includes('eadl') &&
                  !file.toLowerCase().includes('originui') &&
                  !file.toLowerCase().includes('ea desktop')) {
                exeFiles.push(filePath);
              }
            }
          } catch (e) {
            // Ignoruj błędy dostępu
          }
        }
      } catch (e) {
        // Ignoruj błędy dostępu
      }
    };
    
    // Rozpocznij wyszukiwanie plików .exe
    findExes(gamePath);
    
    // Sprawdź, czy to faktycznie katalog gry (musi zawierać pliki wykonywalne)
    if (exeFiles.length > 0) {
      console.log(`Znaleziono ${exeFiles.length} pliki .exe w ${path.basename(gamePath)}`);
      
      // Formatuj nazwę gry
      let gameTitle = path.basename(gamePath);
      
      // Usuń nadmiarowe znaki i numerację z nazwy gry
      gameTitle = gameTitle.replace(/__Installer/i, '');
      gameTitle = gameTitle.replace(/^\d+\s+/, '');
      gameTitle = gameTitle.replace(/\(.*?\)/g, '').trim();
      gameTitle = gameTitle.replace(/™/g, '').trim();
      gameTitle = gameTitle.replace(/®/g, '').trim();
      
      // Sprawdź, czy katalog zawiera plik mfst.dat, który jest charakterystyczny dla gier Origin
      const hasMfstFile = fs.existsSync(path.join(gamePath, 'mfst.dat')) || 
                          fs.existsSync(path.join(gamePath, '__Installer', 'installerdata.xml'));
      
      if (hasMfstFile || exeFiles.length > 0) {
        // Pobierz okładkę dla gry
        let coverPath;
        try {
          coverPath = await coverService.fetchGameCover(gameTitle);
        } catch (coverError) {
          console.error(`Błąd podczas pobierania okładki dla ${gameTitle}:`, coverError);
          coverPath = '../assets/icons/no-cover.jpg';
        }
        
        // Wybierz najlepszy plik wykonywalny (największy rozmiar pliku)
        let bestExeFile = exeFiles[0];
        let bestSize = 0;
        
        for (const exeFile of exeFiles) {
          try {
            const stats = fs.statSync(exeFile);
            if (stats.size > bestSize) {
              bestSize = stats.size;
              bestExeFile = exeFile;
            }
          } catch (e) {
            // Ignoruj błędy dostępu
          }
        }
        
        // Sprawdź, czy gra już istnieje w liście
        const duplicateGame = gamesList.find(g => 
          g.title.toLowerCase() === gameTitle.toLowerCase() || 
          g.installDir === gamePath
        );
        
        if (!duplicateGame) {
          gamesList.push({
            id: `origin_${gameTitle.toLowerCase().replace(/\s+/g, '_')}`,
            title: gameTitle,
            platform: 'origin',
            installDir: gamePath,
            executablePath: bestExeFile,
            cover: coverPath,
            dateAdded: new Date().toISOString()
          });
          
          console.log(`Dodano grę Origin: ${gameTitle}`);
        }
        
        return bestExeFile;
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Błąd podczas przetwarzania katalogu gry Origin ${gamePath}:`, error);
    return null;
  }
}

module.exports = {
  fetchGames,
  getLocalGames,
  findInstalledGames,
  findSteamGames,
  findEpicGames,
  findBattleNetGames,
  findGogGames,
  findUplayGames,
  findOriginGames,
  findXboxGames,
  launchGame,
  addGame,
  removeGame,
  updatePlatformPath,
  getPlatformPathsFromStore,
  clearGameCache,
  getCustomGames
}; 
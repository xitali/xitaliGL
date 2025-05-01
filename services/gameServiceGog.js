const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const os = require('os');
const crypto = require('crypto');

// Bezpieczne ładowanie SQLite3
let sqlite3 = null;
try {
  sqlite3 = require('sqlite3').verbose();
  console.log('Załadowano moduł sqlite3');
} catch (err) {
  console.warn('Nie można załadować modułu sqlite3. Niektóre funkcje związane z GOG Galaxy mogą być niedostępne.');
  console.error('Błąd ładowania sqlite3:', err.message);
}

// Stałe dla określenia ścieżek i GUID-ów GOG
const GOG_POSSIBLE_PATHS = [
  'C:\\Program Files (x86)\\GOG Galaxy',
  'C:\\Program Files\\GOG Galaxy',
  'D:\\Program Files (x86)\\GOG Galaxy',
  'D:\\Program Files\\GOG Galaxy',
  'E:\\Program Files (x86)\\GOG Galaxy',
  'E:\\Program Files\\GOG Galaxy',
  'C:\\Program Files (x86)\\GOG.com\\Galaxy',
  'C:\\Program Files\\GOG.com\\Galaxy'
];

// Dodatkowe ścieżki do przeszukania
const ADDITIONAL_GAME_PATHS = [
  'C:\\GOG Games',
  'D:\\GOG Games',
  'E:\\GOG Games',
  'C:\\Games\\GOG Games',
  'D:\\Games\\GOG Games',
  'E:\\Games\\GOG Games'
];

// Funkcja do pobrania ścieżki GOG z rejestru Windows
function getGogPathFromRegistry() {
  return new Promise((resolve, reject) => {
    if (process.platform !== 'win32') {
      return resolve(null);
    }

    const command = 'reg query "HKLM\\SOFTWARE\\GOG.com\\Games" /ve';
    
    exec(command, (error, stdout) => {
      if (error) {
        // Klucz rejestru może nie istnieć
        return resolve(null);
      }

      const match = stdout.match(/REG_SZ\s+([^\r\n]+)/);
      if (match && match[1]) {
        return resolve(match[1].trim());
      }

      return resolve(null);
    });
  });
}

// Funkcja szukająca gier w folderze GOG
async function findGogGamesInFolder(gogPath) {
  const gamesList = [];
  
  try {
    // Sprawdź różne możliwe lokalizacje folderów z grami
    const possibleGameFolders = [
      path.join(gogPath, 'Games'),
      path.join(gogPath, 'Library', 'Games')
    ];
    
    for (const gameFolder of possibleGameFolders) {
      try {
        const exists = await fs.access(gameFolder).then(() => true).catch(() => false);
        if (!exists) {
          console.log(`Folder ${gameFolder} nie istnieje, pomijam...`);
          continue;
        }
        
        console.log(`Przeszukuję folder z grami: ${gameFolder}`);
        const folders = await fs.readdir(gameFolder);
        console.log(`Znaleziono ${folders.length} elementów w folderze ${gameFolder}`);
        
        for (const folder of folders) {
          const folderPath = path.join(gameFolder, folder);
          const stats = await fs.stat(folderPath);
          
          if (stats.isDirectory()) {
            // To jest potencjalny folder gry
            console.log(`Analizuję folder: ${folder}`);
            const gameInfo = await extractGameInfoFromFolder(folderPath);
            if (gameInfo) {
              console.log(`Znaleziono grę: ${gameInfo.title}`);
              gamesList.push(gameInfo);
            } else {
              console.log(`Nie znaleziono informacji o grze w folderze: ${folder}`);
            }
          } else if (stats.isFile() && folder.toLowerCase().endsWith('.lnk')) {
            // To może być skrót do gry
            console.log(`Znaleziono skrót: ${folder}`);
            try {
              // Obsługa skrótów do gier
              const shortcutInfo = await getShortcutInfo(folderPath);
              if (shortcutInfo) {
                const title = folder.replace(/\.lnk$/i, '');
                const gameId = crypto.createHash('md5').update(`gog_shortcut_${title}`).digest('hex');
                
                gamesList.push({
                  id: gameId,
                  title: title,
                  platform: 'gog',
                  installDir: path.dirname(shortcutInfo.target),
                  executablePath: shortcutInfo.target,
                  isShortcut: true
                });
                
                console.log(`Dodano grę ze skrótu: ${title}`);
              }
            } catch (shortcutError) {
              console.error(`Błąd podczas analizy skrótu ${folder}:`, shortcutError);
            }
          }
        }
      } catch (error) {
        console.error(`Błąd podczas skanowania ${gameFolder}:`, error);
      }
    }
  } catch (error) {
    console.error('Błąd podczas znajdowania gier GOG:', error);
  }
  
  return gamesList;
}

// Funkcja do pobierania informacji o skrócie Windows (.lnk)
async function getShortcutInfo(shortcutPath) {
  return new Promise((resolve, reject) => {
    if (process.platform !== 'win32') {
      return resolve(null);
    }
    
    // Użyj PowerShell do odczytania informacji o skrócie
    const { exec } = require('child_process');
    const command = `
      $shell = New-Object -ComObject WScript.Shell;
      $shortcut = $shell.CreateShortcut('${shortcutPath.replace(/'/g, "''")}');
      Write-Output "Target=$($shortcut.TargetPath)";
      Write-Output "Args=$($shortcut.Arguments)";
      Write-Output "WorkingDir=$($shortcut.WorkingDirectory)";
      [System.Runtime.Interopservices.Marshal]::ReleaseComObject($shell) | Out-Null;
    `;
    
    exec(`powershell -Command "${command}"`, (error, stdout) => {
      if (error) {
        console.error(`Błąd podczas odczytu skrótu: ${error}`);
        return resolve(null);
      }
      
      const target = stdout.match(/Target=(.+)/);
      const args = stdout.match(/Args=(.+)/);
      const workingDir = stdout.match(/WorkingDir=(.+)/);
      
      if (target && target[1] && target[1].trim() !== '') {
        resolve({
          target: target[1].trim(),
          args: args && args[1] ? args[1].trim() : '',
          workingDir: workingDir && workingDir[1] ? workingDir[1].trim() : ''
        });
      } else {
        resolve(null);
      }
    });
  });
}

// Funkcja do wyciągania informacji o grze z folderu
async function extractGameInfoFromFolder(folderPath) {
  try {
    console.log(`Sprawdzam folder gry: ${folderPath}`);
    
    // Sprawdź czy istnieje plik goggame-*.info
    const files = await fs.readdir(folderPath);
    
    // Najpierw sprawdź czy mamy plik .info charakterystyczny dla GOG
    const infoFile = files.find(file => file.startsWith('goggame-') && file.endsWith('.info'));
    
    if (infoFile) {
      console.log(`Znaleziono plik info: ${infoFile}`);
      const infoFilePath = path.join(folderPath, infoFile);
      const infoContent = await fs.readFile(infoFilePath, 'utf8');
      
      try {
        const gameInfo = JSON.parse(infoContent);
        
        // Znajdź pliki wykonywalne
        const exeFiles = await findExecutables(folderPath);
        
        // Generuj unikalny ID dla gry na podstawie nazwy i ścieżki
        const gameId = crypto.createHash('md5').update(`gog_${gameInfo.buildId || gameInfo.name}`).digest('hex');
        
        console.log(`Plik info zawiera tytuł: ${gameInfo.name}, znaleziono ${exeFiles.length} plików wykonywalnych`);
        
        return {
          id: gameId,
          title: gameInfo.name,
          platform: 'gog',
          installDir: folderPath,
          executablePath: exeFiles[0] || '',
          executableList: exeFiles,
          releaseKey: infoFile.replace('goggame-', '').replace('.info', ''),
          gameInfo: gameInfo
        };
      } catch (parseError) {
        console.error(`Błąd parsowania pliku ${infoFilePath}:`, parseError);
      }
    }
    
    // Sprawdź czy mamy plik galaxy-*.gxt lub *.ico (charakterystyczne dla Galaxy)
    const galaxyFiles = files.filter(file => 
      (file.startsWith('galaxy-') && file.endsWith('.gxt')) || 
      file.endsWith('.ico') ||
      file === 'goglogo.png' ||
      file === 'goggame.dll'
    );
    
    if (galaxyFiles.length > 0) {
      console.log(`Znaleziono ${galaxyFiles.length} plików Galaxy w folderze`);
      
      // Znajdź pliki wykonywalne
      const exeFiles = await findExecutables(folderPath);
      
      if (exeFiles.length > 0) {
        // Użyj nazwy folderu jako tytuł gry
        const folderName = path.basename(folderPath);
        const gameId = crypto.createHash('md5').update(`gog_galaxy_${folderPath}`).digest('hex');
        
        const cleanTitle = cleanFolderName(folderName);
        console.log(`Rozpoznano grę GOG na podstawie plików Galaxy: ${cleanTitle}`);
        
        return {
          id: gameId,
          title: cleanTitle,
          platform: 'gog',
          installDir: folderPath,
          executablePath: exeFiles[0] || '',
          executableList: exeFiles,
          source: 'galaxy_files'
        };
      }
    }
    
    // Ostatnia metoda - sprawdź typowe lokalizacje plików wykonywalnych
    const exeFiles = await findExecutables(folderPath);
    
    if (exeFiles.length > 0) {
      // Filtruj pliki, które mogą należeć do gier GOG
      const gogLikeExes = exeFiles.filter(exe => {
        const exeName = path.basename(exe).toLowerCase();
        return (
          !exeName.includes('unins') && 
          !exeName.includes('setup') && 
          !exeName.includes('redist') &&
          !(exeName === 'launcher.exe') && 
          !(exeName === 'galaxyclient.exe') &&
          !(exeName === 'igfxext.exe')
        );
      });
      
      if (gogLikeExes.length > 0) {
        console.log(`Znaleziono ${gogLikeExes.length} potencjalnych plików wykonywalnych do gier`);
        
        // Użyj nazwy folderu jako tytuł gry
        const folderName = path.basename(folderPath);
        const gameId = crypto.createHash('md5').update(`gog_exe_${folderPath}`).digest('hex');
        
        const cleanTitle = cleanFolderName(folderName);
        console.log(`Rozpoznano potencjalną grę GOG: ${cleanTitle}`);
        
        return {
          id: gameId,
          title: cleanTitle,
          platform: 'gog',
          installDir: folderPath,
          executablePath: gogLikeExes[0] || '',
          executableList: gogLikeExes,
          source: 'executables'
        };
      }
    }
    
    // Sprawdź, czy może być to złączona ścieżka (np. "GOG Games/Wiedźmin 3")
    if (folderPath.toLowerCase().includes('gog') && 
        (folderPath.toLowerCase().includes('games') || folderPath.toLowerCase().includes('game'))) {
      // To może być folder z grami GOG, więc zwróć informację żeby sprawdzić podfoldery
      return null;
    }
    
    console.log(`Nie znaleziono plików charakterystycznych dla GOG w folderze ${folderPath}`);
  } catch (error) {
    console.error(`Błąd podczas analizy folderu ${folderPath}:`, error);
  }
  
  return null;
}

// Funkcja do wyszukiwania plików wykonywalnych w folderze
async function findExecutables(directory, maxDepth = 3) {
  const exeFiles = [];
  
  async function searchDirectory(dir, depth = 0) {
    if (depth > maxDepth) return;
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await searchDirectory(fullPath, depth + 1);
        } else if (entry.isFile() && entry.name.endsWith('.exe')) {
          // Ignoruj typowe pliki pomocnicze i instalacyjne
          const lowercaseName = entry.name.toLowerCase();
          if (!lowercaseName.includes('unins') && 
              !lowercaseName.includes('setup') && 
              !lowercaseName.includes('launcher') && 
              !lowercaseName.startsWith('__')) {
            exeFiles.push(fullPath);
          }
        }
      }
    } catch (error) {
      // Ignoruj błędy dostępu - niektóre foldery mogą być chronione
    }
  }
  
  await searchDirectory(directory);
  return exeFiles;
}

// Oczyszcza nazwę folderu, aby uzyskać czytelną nazwę gry
function cleanFolderName(folderName) {
  // Usuń typowe sufiksy i prefiksy
  let cleanName = folderName
    .replace(/^GOG\s+/, '')
    .replace(/\s+GOG$/, '')
    .replace(/\[GOG\]/, '')
    .replace(/\(GOG\)/, '')
    .replace(/_+/g, ' ');
  
  // Zamień myślniki na spacje jeśli nie ma spacji
  if (!cleanName.includes(' ')) {
    cleanName = cleanName.replace(/-+/g, ' ');
  }
  
  return cleanName.trim();
}

// Główna funkcja do wyszukiwania gier GOG Galaxy
async function findGogGames() {
  try {
    console.log('Rozpoczynam wyszukiwanie gier GOG Galaxy...');
    
    // Próbuj znaleźć ścieżkę do GOG Galaxy
    let gogPath = await getGogPathFromRegistry();
    
    // Jeśli nie znaleziono w rejestrze, sprawdź typowe lokalizacje
    if (!gogPath) {
      for (const pathToCheck of GOG_POSSIBLE_PATHS) {
        try {
          await fs.access(pathToCheck);
          gogPath = pathToCheck;
          console.log(`Znaleziono GOG Galaxy w: ${gogPath}`);
          break;
        } catch (error) {
          // Ścieżka nie istnieje, próbuj następną
          console.log(`Ścieżka ${pathToCheck} nie istnieje, próbuję następną...`);
        }
      }
    } else {
      console.log(`Znaleziono GOG Galaxy w rejestrze: ${gogPath}`);
    }
    
    let gamesList = [];
    
    // Jeśli znaleziono GOG Galaxy, szukaj gier w jego folderach
    if (gogPath) {
      console.log(`Przeszukuję foldery GOG Galaxy w: ${gogPath}`);
      const gamesFromGalaxy = await findGogGamesInFolder(gogPath);
      gamesList = gamesList.concat(gamesFromGalaxy);
      console.log(`Znaleziono ${gamesFromGalaxy.length} gier w folderach GOG Galaxy`);
    } else {
      console.log('Nie znaleziono instalacji GOG Galaxy');
    }
    
    // Przeszukaj dodatkowe ścieżki niezależnie od znalezienia GOG Galaxy
    console.log('Przeszukuję dodatkowe lokalizacje gier GOG...');
    for (const additionalPath of ADDITIONAL_GAME_PATHS) {
      try {
        await fs.access(additionalPath);
        console.log(`Sprawdzam dodatkową lokalizację: ${additionalPath}`);
        
        // Sprawdzam czy to jest folder z grami czy folder zawierający foldery gier
        const entries = await fs.readdir(additionalPath, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const gameFolderPath = path.join(additionalPath, entry.name);
            console.log(`Analizuję potencjalny folder gry: ${gameFolderPath}`);
            
            // Sprawdź czy to jest folder gry
            const gameInfo = await extractGameInfoFromFolder(gameFolderPath);
            if (gameInfo) {
              console.log(`Znaleziono grę GOG w dodatkowej lokalizacji: ${gameInfo.title}`);
              gamesList.push(gameInfo);
            } else {
              // Sprawdź czy ten folder zawiera inne foldery gier
              try {
                const subEntries = await fs.readdir(gameFolderPath, { withFileTypes: true });
                for (const subEntry of subEntries) {
                  if (subEntry.isDirectory()) {
                    const subGamePath = path.join(gameFolderPath, subEntry.name);
                    const subGameInfo = await extractGameInfoFromFolder(subGamePath);
                    if (subGameInfo) {
                      console.log(`Znaleziono grę GOG w podfolderze: ${subGameInfo.title}`);
                      gamesList.push(subGameInfo);
                    }
                  }
                }
              } catch (subError) {
                console.log(`Błąd podczas przeszukiwania podfolderu: ${subError.message}`);
              }
            }
          }
        }
      } catch (error) {
        console.log(`Ścieżka ${additionalPath} nie istnieje lub błąd dostępu`);
      }
    }
    
    // Spróbuj odczytać bazę danych GOG Galaxy, jeśli znaleziono mało gier
    if (gamesList.length < 5) {
      console.log('Znaleziono mało gier, sprawdzam bazę danych GOG Galaxy...');
      const dbGames = await readGogGalaxyDatabase();
      
      // Połącz listy, usuwając duplikaty
      if (dbGames.length > 0) {
        console.log(`Znaleziono ${dbGames.length} gier w bazie danych GOG Galaxy`);
        const combinedGames = [...gamesList];
        
        for (const dbGame of dbGames) {
          const isDuplicate = combinedGames.some(game => 
            game.title === dbGame.title || 
            (game.releaseKey && game.releaseKey === dbGame.releaseKey)
          );
          
          if (!isDuplicate) {
            combinedGames.push(dbGame);
          }
        }
        
        console.log(`Łącznie znaleziono ${combinedGames.length} gier GOG Galaxy`);
        return combinedGames;
      }
    }
    
    console.log(`Łącznie znaleziono ${gamesList.length} gier GOG Galaxy`);
    return gamesList;
    
  } catch (error) {
    console.error('Błąd podczas wyszukiwania gier GOG Galaxy:', error);
    return [];
  }
}

// Funkcja do odczytu bazy danych GOG Galaxy
async function readGogGalaxyDatabase() {
  try {
    console.log('Próba odczytu bazy danych GOG Galaxy...');
    
    // Sprawdź, czy SQLite3 jest dostępny
    if (!sqlite3) {
      console.warn('Moduł sqlite3 nie jest dostępny. Nie można odczytać bazy danych GOG Galaxy.');
      return [];
    }
    
    // Możliwe lokalizacje bazy danych GOG Galaxy
    const dbPaths = [
      path.join(os.homedir(), 'AppData', 'Local', 'GOG.com', 'Galaxy', 'Storage', 'galaxy-2.0.db'),
      'C:\\ProgramData\\GOG.com\\Galaxy\\storage\\galaxy-2.0.db'
    ];
    
    // Dodaj wszystkie dyski
    const availableDrives = ['C', 'D', 'E', 'F', 'G', 'H'];
    for (const driveLetter of availableDrives) {
      try {
        const drivePath = `${driveLetter}:\\`;
        await fs.access(drivePath);
        dbPaths.push(`${driveLetter}:\\ProgramData\\GOG.com\\Galaxy\\storage\\galaxy-2.0.db`);
      } catch (e) {
        // Ignoruj niedostępne dyski
      }
    }
    
    // Znajdź pierwszą dostępną bazę danych
    let dbPath = null;
    for (const potentialPath of dbPaths) {
      try {
        await fs.access(potentialPath);
        console.log(`Znaleziono bazę danych GOG Galaxy: ${potentialPath}`);
        dbPath = potentialPath;
        break;
      } catch (e) {
        // Baza danych nie istnieje pod tą ścieżką
      }
    }
    
    if (!dbPath) {
      console.log('Nie znaleziono bazy danych GOG Galaxy');
      return [];
    }
    
    // Zwróć obietnicę, która rozwiąże się z tablicą gier
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          console.error('Błąd podczas otwierania bazy danych:', err.message);
          resolve([]);
          return;
        }
        
        console.log('Połączono z bazą danych GOG Galaxy');
        
        // Znajdź wszystkie tabele
        db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
          if (err) {
            console.error('Błąd podczas pobierania tabel:', err.message);
            db.close();
            resolve([]);
            return;
          }
          
          const tableNames = tables.map(t => t.name);
          console.log('Znalezione tabele:', tableNames);
          
          const gameInfo = {};
          
          // Funkcja do zakończenia przetwarzania i zwrócenia gier
          const finishProcessing = () => {
            db.close();
            
            // Konwertuj obiekt gameInfo na tablicę gier
            const games = [];
            for (const [key, game] of Object.entries(gameInfo)) {
              if (game.title && (game.installDir || game.execPath)) {
                const gameId = crypto.createHash('md5').update(`gog_${key}`).digest('hex');
                games.push({
                  id: gameId,
                  title: game.title,
                  platform: 'gog',
                  installDir: game.installDir || '',
                  executablePath: game.execPath || '',
                  releaseKey: key
                });
              }
            }
            
            console.log(`Znaleziono ${games.length} gier w bazie danych GOG Galaxy`);
            resolve(games);
          };
          
          // Sprawdź występowanie różnych tabel
          let pendingQueries = 0;
          
          // Sprawdź GamePieces
          if (tableNames.includes('GamePieces')) {
            pendingQueries++;
            db.all(`
              SELECT 
                releaseKey, 
                gamePieceTypeId, 
                value 
              FROM GamePieces 
              WHERE gamePieceTypeId IN (0, 15, 16)
            `, [], (err, rows) => {
              if (!err && rows && rows.length > 0) {
                console.log(`Znaleziono ${rows.length} rekordów w tabeli GamePieces`);
                
                rows.forEach(row => {
                  if (!gameInfo[row.releaseKey]) {
                    gameInfo[row.releaseKey] = { platform: 'gog' };
                  }
                  
                  try {
                    const val = JSON.parse(row.value);
                    switch (row.gamePieceTypeId) {
                      case 0: // Tytuł gry
                        gameInfo[row.releaseKey].title = val.title || val.name;
                        break;
                      case 15: // Ścieżka instalacji
                        gameInfo[row.releaseKey].installDir = val.path;
                        break;
                      case 16: // Ścieżka wykonywalna
                        gameInfo[row.releaseKey].execPath = val.path;
                        break;
                    }
                  } catch (e) {
                    // Ignoruj błędy parsowania JSON
                  }
                });
              }
              
              if (--pendingQueries === 0) finishProcessing();
            });
          }
          
          // Sprawdź installedproducts
          if (tableNames.includes('installedproducts')) {
            pendingQueries++;
            db.all(`
              SELECT 
                productId, 
                installationPath,
                productTitle
              FROM installedproducts
              WHERE installationPath IS NOT NULL AND installationPath != ''
            `, [], (err, rows) => {
              if (!err && rows && rows.length > 0) {
                console.log(`Znaleziono ${rows.length} rekordów w tabeli installedproducts`);
                
                rows.forEach(row => {
                  const key = `gog_${row.productId}`;
                  if (!gameInfo[key]) {
                    gameInfo[key] = { 
                      platform: 'gog',
                      title: row.productTitle,
                      installDir: row.installationPath
                    };
                  } else {
                    if (!gameInfo[key].title) {
                      gameInfo[key].title = row.productTitle;
                    }
                    if (!gameInfo[key].installDir) {
                      gameInfo[key].installDir = row.installationPath;
                    }
                  }
                });
              }
              
              if (--pendingQueries === 0) finishProcessing();
            });
          }
          
          // Jeśli nie ma żadnych zapytań, zakończ przetwarzanie
          if (pendingQueries === 0) finishProcessing();
        });
      });
    });
  } catch (error) {
    console.error('Błąd podczas odczytu bazy danych GOG Galaxy:', error);
    return [];
  }
}

// Eksportuj funkcje
module.exports = {
  findGogGames,
  readGogGalaxyDatabase
}; 
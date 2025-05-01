# Skrypt do budowania i publikowania nowej wersji aplikacji
# Uruchom jako administrator: .\publish-release.ps1

$version = "1.0.2"
$releaseNotes = "Aktualizacja wprowadzająca:
- Naprawę funkcjonalności zapamiętywania pozycji okna
- Poprawę uruchamiania przy starcie systemu
- Lepszy wygląd zaznaczonych elementów w menu
- Poprawienie animacji logo w pasku bocznym
- Pełną funkcjonalność wszystkich ustawień

Pełna lista zmian: https://github.com/xitali/xitaliGL/blob/main/CHANGELOG.md"

Write-Host "Przygotowuję wydanie wersji $version..." -ForegroundColor Cyan

# Budowanie aplikacji
Write-Host "Buduję aplikację..." -ForegroundColor Yellow
npm run build

# Pakowanie i tworzenie instalatora
Write-Host "Tworzę pakiet instalacyjny..." -ForegroundColor Yellow
npm run electron:build

# Publikowanie na GitHub
Write-Host "Czy chcesz opublikować tę wersję na GitHub? (T/N)" -ForegroundColor Yellow
$publish = Read-Host

if ($publish -eq "T" -or $publish -eq "t") {
    Write-Host "Publikuję wersję $version na GitHub..." -ForegroundColor Green
    
    # Zapisz opis wydania do pliku tymczasowego
    $releaseNotes | Out-File -FilePath "release-notes-temp.txt" -Encoding utf8
    
    # Użyj GitHub CLI do utworzenia wydania
    # Wymaga wcześniejszego zalogowania przez gh auth login
    Write-Host "Tworzę tag i wydanie w GitHub..." -ForegroundColor Yellow
    git tag -a "v$version" -m "Version $version"
    git push origin "v$version"
    gh release create "v$version" --title "xitali Game Launcher v$version" --notes-file "release-notes-temp.txt" "./release/xgl.exe"
    
    # Usuń plik tymczasowy
    Remove-Item -Path "release-notes-temp.txt"
    
    Write-Host "Wydanie zostało opublikowane! Odwiedź https://github.com/xitali/xitaliGL/releases" -ForegroundColor Green
} else {
    Write-Host "Publikacja została anulowana. Instalator jest dostępny w katalogu 'release'." -ForegroundColor Yellow
}

Write-Host "Gotowe!" -ForegroundColor Cyan 
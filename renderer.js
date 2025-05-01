// Ten plik obsługuje interakcje DOM niezwiązane z React
// i komunikację między procesem renderowania a głównym

// Funkcja inicjalizująca listenery dla kontrolek okna (zamknij, minimalizuj, maksymalizuj)
function initWindowControls() {
  const closeBtn = document.getElementById('close-btn');
  const minimizeBtn = document.getElementById('minimize-btn');
  const maximizeBtn = document.getElementById('maximize-btn');

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      window.electronAPI.closeApp();
    });
  }

  if (minimizeBtn) {
    minimizeBtn.addEventListener('click', () => {
      window.electronAPI.minimizeApp();
    });
  }

  if (maximizeBtn) {
    maximizeBtn.addEventListener('click', () => {
      window.electronAPI.maximizeApp();
    });
  }
}

// Inicjalizacja po załadowaniu DOM
document.addEventListener('DOMContentLoaded', () => {
  initWindowControls();
}); 
import React from 'react';

/**
 * Komponent ekranu ładowania wyświetlany podczas wyszukiwania gier
 */
function LoadingScreen() {
  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 flex flex-col items-center justify-center bg-[#202020] bg-opacity-90 z-50">
      <div className="text-center">
        <div className="spinner mb-4">
          <div className="double-bounce1"></div>
          <div className="double-bounce2"></div>
        </div>
        <h2 className="text-xl font-semibold text-white mb-4">Wyszukiwanie gier</h2>
        <p className="text-[#b3b3b3] text-sm mb-6">
          Proszę czekać, trwa wyszukiwanie zainstalowanych gier...
        </p>
      </div>
    </div>
  );
}

export default LoadingScreen; 
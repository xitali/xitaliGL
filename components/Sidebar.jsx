import React, { useState, useRef } from 'react';

// Importowanie ikon lokalnych
import allIcon from '../assets/icons/All.png';
import steamIcon from '../assets/icons/Steam.png';
import epicIcon from '../assets/icons/EpicGames.png';
import originIcon from '../assets/icons/Origin.png';
import battlenetIcon from '../assets/icons/BattleNet.png';
import xboxIcon from '../assets/icons/xbox.png';
import gogIcon from '../assets/icons/gog.png';
import uplayIcon from '../assets/icons/Uplay.png';
import customIcon from '../assets/icons/Custom.png';
import settingsIcon from '../assets/icons/settings.png'; // Używamy jako ikony ustawień
import aboutIcon from '../assets/icons/about.png';
import findIcon from '../assets/icons/find.png'; // Ikona wyszukiwania
import appIcon from '../assets/icons/app-icon.png'; // Ikona aplikacji

const Sidebar = ({ activePlatform, setActivePlatform, onSearch, onAction, activeView }) => {
  const [expanded, setExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef(null);
  
  // Definicje platform z lokalnymi ikonami
  const platforms = [
    { id: 'all', name: 'Wszystkie', icon: allIcon },
    { id: 'steam', name: 'Steam', icon: steamIcon },
    { id: 'epic', name: 'Epic Games', icon: epicIcon },
    { id: 'battlenet', name: 'Battle.net', icon: battlenetIcon },
    { id: 'xbox', name: 'Xbox', icon: xboxIcon },
    { id: 'gog', name: 'GOG', icon: gogIcon },
    { id: 'uplay', name: 'Ubisoft', icon: uplayIcon },
    { id: 'origin', name: 'Origin', icon: originIcon },
    { id: 'other', name: 'Customs', icon: customIcon },
  ];

  // Funkcja obsługująca zmianę aktywnej platformy
  const handlePlatformChange = (platformId) => {
    setActivePlatform(platformId);
    // Zapewnienie że widok gier jest aktywny
    if (activeView !== 'games') {
      onAction('games');
    }
  };
  
  // Funkcja przełączająca stan rozwinięcia/zwinięcia paska bocznego
  const toggleSidebar = () => {
    setExpanded(!expanded);
    
    // Jeśli rozwijamy sidebar, ustawiamy focus na polu wyszukiwania po animacji
    if (!expanded) {
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 300);
    }
  };

  // Obsługa zmiany w polu wyszukiwania
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    onSearch(e.target.value);
    // Przełącz na widok gier jeśli szukamy
    if (activeView !== 'games') {
      onAction('games');
    }
  };

  // Obsługa naciśnięcia klawisza w polu wyszukiwania
  const handleSearchKeyDown = (e) => {
    if (e.key === 'Escape') {
      setSearchQuery('');
      onSearch('');
      searchInputRef.current.blur();
    }
  };

  // Jeśli wciśnięto ikonę wyszukiwania, pokazujemy pasek wyszukiwania jeśli sidebar jest zwinięty
  const handleSearchIconClick = () => {
    if (!expanded) {
      toggleSidebar();
    } else {
      searchInputRef.current.focus();
    }
    // Przełącz na widok gier jeśli kliknięto ikonę wyszukiwania
    if (activeView !== 'games') {
      onAction('games');
    }
  };

  // Dynamiczne style dla paska bocznego
  const sidebarStyle = {
    width: expanded ? '220px' : '60px',
    transition: 'width 0.3s ease-in-out',
  };

  // Style dla tekstu elementów menu
  const textStyle = {
    opacity: expanded ? 1 : 0,
    transition: 'opacity 0.2s ease-in-out',
    whiteSpace: 'nowrap',
    overflow: 'hidden'
  };

  // Dynamiczne style dla przycisków w pasku bocznym
  const buttonStyle = {
    justifyContent: expanded ? 'flex-start' : 'center'
  };

  // Style dla ikony aplikacji z animacją
  const logoStyle = {
    transition: 'all 0.3s ease-in-out',
    width: expanded ? '30px' : '40px',
    height: expanded ? '30px' : '40px',
  };

  return (
    <aside 
      style={sidebarStyle} 
      className="bg-zinc-900 flex flex-col items-center h-full shadow-lg border-r border-zinc-800"
    >
      {/* Ikona opcji w górnym rogu - przeprojektowana */}
      <div className="w-full border-b border-zinc-800 py-3">
        <button 
          className="flex items-center px-0 w-full py-0 text-gray-200 hover:text-white transition-colors duration-200"
          style={buttonStyle}
          title={expanded ? "Zwiń menu" : "Rozwiń menu"}
          onClick={toggleSidebar}
        >
          {expanded ? (
            <div className="flex items-center justify-between w-full px-4 py-1">
              <div className="flex items-center">
                <img src={appIcon} alt="xitali" style={logoStyle} className="mr-2" />
                <span className="font-medium">MENU</span>
              </div>
              <span className="text-sm">◀</span>
            </div>
          ) : (
            <div className="flex justify-center items-center w-full">
              <img src={appIcon} alt="xitali" style={logoStyle} />
            </div>
          )}
        </button>
      </div>
      
      {/* Pole wyszukiwania */}
      <div className="w-full px-3 py-3 border-b border-zinc-800">
        <div className="flex items-center">
          <button
            className={`flex-shrink-0 p-2 rounded-full hover:bg-zinc-800 text-gray-400 hover:text-white transition-colors duration-200 ${!expanded ? 'mx-auto' : ''}`}
            title="Wyszukaj"
            onClick={handleSearchIconClick}
          >
            <img src={findIcon} alt="Wyszukaj" className="w-5 h-5 object-contain" />
          </button>
          
          {expanded && (
            <div className="flex-grow ml-2">
              <input
                ref={searchInputRef}
                type="text"
                className="w-full py-1 px-3 text-sm bg-zinc-800 border border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent"
                placeholder="Szukaj..."
                value={searchQuery}
                onChange={handleSearchChange}
                onKeyDown={handleSearchKeyDown}
              />
            </div>
          )}
        </div>
      </div>
      
      {/* Ikony platform - usunięcie overflow-y-auto */}
      <div className="flex flex-col w-full flex-1 py-2">
        {platforms.map((platform) => (
          <button
            key={platform.id}
            className={`flex items-center py-2 px-4 w-full mb-1 rounded-lg mx-2 transition-all duration-200
              ${activePlatform === platform.id && activeView === 'games' 
                ? 'text-white' 
                : 'text-gray-400 hover:bg-zinc-800 hover:text-white'}`}
            style={buttonStyle}
            title={platform.name}
            onClick={() => handlePlatformChange(platform.id)}
          >
            <img src={platform.icon} alt={platform.name} className="w-6 h-6 object-contain" />
            {expanded && <span style={textStyle} className={`ml-3 font-medium ${activePlatform === platform.id && activeView === 'games' ? 'text-white' : ''}`}>{platform.name}</span>}
          </button>
        ))}
      </div>
      
      {/* Dolne ikony (ustawienia, pomoc, wyłącz) */}
      <div className="w-full border-t border-zinc-800 py-2">
        <button
          className={`flex items-center py-2 px-4 w-full rounded-lg mx-2 transition-all duration-200
            ${activeView === 'settings' 
              ? 'text-white' 
              : 'text-gray-400 hover:bg-zinc-800 hover:text-white'}`}
          style={buttonStyle}
          title="Ustawienia"
          onClick={() => onAction && onAction('settings')}
        >
          <img src={settingsIcon} alt="Ustawienia" className="w-6 h-6 object-contain" />
          {expanded && <span style={textStyle} className={`ml-3 font-medium ${activeView === 'settings' ? 'text-white' : ''}`}>Ustawienia</span>}
        </button>
        
        <button
          className={`flex items-center py-2 px-4 w-full rounded-lg mx-2 transition-all duration-200
            ${activeView === 'help' 
              ? 'text-white' 
              : 'text-gray-400 hover:bg-zinc-800 hover:text-white'}`}
          style={buttonStyle}
          title="Pomoc"
          onClick={() => onAction && onAction('help')}
        >
          <img src={aboutIcon} alt="Pomoc" className="w-6 h-6 object-contain" />
          {expanded && <span style={textStyle} className={`ml-3 font-medium ${activeView === 'help' ? 'text-white' : ''}`}>Pomoc</span>}
        </button>
        
        <button
          className="flex items-center py-2 px-4 w-full rounded-lg mx-2 text-gray-400 hover:bg-red-900 hover:text-red-300 transition-all duration-200"
          style={{...buttonStyle, position: "relative", zIndex: 20}}
          title="Zamknij"
          onClick={() => window.electronAPI?.closeApp()}
        >
          <span className="text-xl">⏻</span>
          {expanded && <span style={textStyle} className="ml-3 font-medium">Zamknij</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar; 
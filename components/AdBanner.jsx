import React, { useState, useEffect } from 'react';
import placeholderBanner from '../assets/banners/placeholder.png';
import xglBanner from '../assets/banners/xgl.png';

const AdBanner = () => {
  const [isLoading, setIsLoading] = useState(true);
  
  // Banery reklamowe
  const banners = [
    {
      id: 1,
      imageUrl: placeholderBanner,
      targetUrl: 'https://banuelv.pl',
    },
    {
      id: 2,
      imageUrl: xglBanner,
      targetUrl: 'https://github.com/xitali/xitaliGL',
    }
  ];
  
  // Symulacja ładowania
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Obsługa kliknięcia w baner
  const handleBannerClick = (url) => {
    if (window.electronAPI && window.electronAPI.openExternalLink) {
      window.electronAPI.openExternalLink(url);
    } else {
      window.open(url, '_blank');
    }
  };

  // Wysokość reklamy
  const adHeight = 40; // Wysokość reklamy

  return (
    <div 
      className="fixed bottom-0 right-0 w-full border-t border-zinc-800 z-10" 
      style={{ 
        height: `${adHeight}px`,
        left: 'var(--sidebar-width, 220px)',
        display: 'flex',
        justifyContent: 'flex-start',
        alignItems: 'center',
        backgroundColor: 'transparent'
      }}
    >
      <div className="flex items-center justify-start w-full h-full pl-8">
        {isLoading ? (
          <div className="animate-pulse h-full w-full opacity-50"></div>
        ) : (
          <div className="flex justify-start items-center h-full">
            <div className="flex items-center">
              {banners.map((banner) => (
                <div 
                  key={banner.id}
                  className="cursor-pointer mr-8 h-full flex items-center" 
                  onClick={() => handleBannerClick(banner.targetUrl)}
                  style={{ 
                    height: `${adHeight}px`,
                    maxWidth: '180px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    overflow: 'hidden',
                    transition: 'transform 0.2s ease-in-out'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <img 
                    src={banner.imageUrl} 
                    alt="Banner" 
                    className="h-full object-contain"
                    style={{ maxHeight: '90%' }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdBanner;
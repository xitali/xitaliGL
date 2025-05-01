import React from 'react';

// Komponent pojedynczej zakładki
const SettingsPanel = ({ title, description, children, isOpen, onToggle, icon }) => {
  return (
    <div className="rounded-lg overflow-hidden mb-4 shadow-md w-full border border-zinc-700 bg-zinc-900 bg-opacity-50">
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-700 w-full transition-colors duration-200"
        onClick={onToggle}
      >
        <div className="flex items-center">
          {icon && <div className="mr-3 text-xl">{icon}</div>}
          <div>
            <h3 className="text-white font-medium">{title}</h3>
            {description && <p className="text-gray-400 text-sm">{description}</p>}
          </div>
        </div>
        <div className="text-gray-300 w-6 h-6 flex items-center justify-center rounded-full hover:bg-zinc-600 transition-colors duration-200">
          {isOpen ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </div>
      </div>
      {isOpen && (
        <div className="p-4 border-t border-zinc-700 w-full">
          {children}
        </div>
      )}
    </div>
  );
};

export default SettingsPanel; 
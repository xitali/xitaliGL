/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: '#1a1a1a',
        sidebar: '#1a1a1a',
        'sidebar-item': '#282828',
        'text-primary': '#ffffff',
      },
      spacing: {
        'sidebar-expanded': '200px',
        'sidebar': '50px',
      },
      borderRadius: {
        'game': '0px',
      },
      gridTemplateColumns: {
        'game-grid': 'repeat(auto-fill, minmax(200px, 1fr))',
      },
      boxShadow: {
        'game-card': '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      },
      transitionProperty: {
        'width': 'width',
        'sidebar': 'width, opacity',
      },
      transitionDuration: {
        '300': '300ms',
        '200': '200ms',
      },
      transitionTimingFunction: {
        'in-out': 'ease-in-out',
      },
    },
  },
  plugins: [],
} 
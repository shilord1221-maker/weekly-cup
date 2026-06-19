/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: '#05070f',
        surface: '#080d1a',
        surface2: '#0b1022',
        border: 'rgba(255,255,255,0.06)',
        border2: 'rgba(255,255,255,0.12)',
        muted: '#606880',
        accent: '#4f7fff',
        accent2: '#8b5cf6',
        accent3: '#06b6d4',
        gold: '#c9954a',
      },
      fontFamily: {
        display: ['Rajdhani', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

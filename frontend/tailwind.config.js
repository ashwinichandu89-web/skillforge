/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 950: '#070b18', 900: '#0b1020', 800: '#10172e', 700: '#172041', 600: '#222c55', 500: '#33406f' },
        brand: { purple: '#8b5cf6', cyan: '#22d3ee', teal: '#14b8a6', orange: '#fb923c' },
        ink: { DEFAULT: '#e6e9f5', soft: '#a7b0cf', mute: '#6f7aa3' },
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        display: ['Sora', 'Manrope', 'system-ui', 'sans-serif'],
      },
      boxShadow: { card: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px rgba(0,0,0,0.6)' },
    },
  },
  plugins: [],
};

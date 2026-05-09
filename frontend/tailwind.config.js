/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#04080f', 900: '#070d1a', 800: '#0a1225',
          700: '#0f1d38', 600: '#162645', 500: '#1e3460',
        },
        forensic: {
          cyan:   '#00d4ff',
          purple: '#8b5cf6',
          amber:  '#f59e0b',
          red:    '#ef4444',
          green:  '#10b981',
          pink:   '#ec4899',
          teal:   '#06b6d4',
          border: 'rgba(0,212,255,0.1)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'spin-slow': 'spin 8s linear infinite',
      },
      backdropBlur: { xs: '4px' },
    },
  },
  plugins: [],
}

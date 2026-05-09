/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        forensic: { bg: '#0a0e1a', card: '#0f1629', elevated: '#162040', border: '#1e3a5f',
          cyan: '#00d4ff', red: '#ff3333', green: '#00ff88', amber: '#ffaa00', purple: '#cc00ff' }
      },
      animation: { 'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite', 'glow': 'glow 2s ease-in-out infinite alternate' },
      keyframes: { glow: { '0%': { boxShadow: '0 0 5px rgba(0, 212, 255, 0.2)' }, '100%': { boxShadow: '0 0 20px rgba(0, 212, 255, 0.6)' } } },
    },
  },
  plugins: [],
}

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // New API routes (keep /api prefix — backend expects it)
      '/api/intelligence': { target: 'http://localhost:8000' },
      '/api/chat': { target: 'http://localhost:8000' },
      '/api/ml': { target: 'http://localhost:8000' },
      '/api/analyze': { target: 'http://localhost:8000' },
      '/api/graphrag': { target: 'http://localhost:8000' },
      '/api/triage': { target: 'http://localhost:8000' },
      '/api/investigate': { target: 'http://localhost:8000' },
      '/api/status': { target: 'http://localhost:8000' },
      '/api/docs': { target: 'http://localhost:8000' },
      '/api/redoc': { target: 'http://localhost:8000' },
      // Legacy routes (strip /api prefix)
      '/api': { target: 'http://localhost:8000', rewrite: (path) => path.replace(/^\/api/, '') },
      // WebSocket
      '/ws': { target: 'ws://localhost:8000', ws: true },
      // Health
      '/health': { target: 'http://localhost:8000' },
    }
  },
  build: { outDir: 'dist', sourcemap: false }
})

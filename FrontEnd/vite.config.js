import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Encaminha /api para o back-end, evitando CORS no desenvolvimento
    proxy: {
      '/api': 'http://localhost:3333',
    },
  },
})

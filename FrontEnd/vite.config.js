import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: true, // acessível fora do container
    // Encaminha /api para o back-end, evitando CORS no desenvolvimento.
    // Em container o alvo é o serviço 'api'; fora dele, localhost.
    proxy: {
      '/api': process.env.VITE_API_TARGET || 'http://localhost:3333',
    },
  },
})

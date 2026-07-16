import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Keep container demos same-origin so iframe annotations (red-ink) work
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})

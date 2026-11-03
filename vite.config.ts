import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: { '/api': 'http://127.0.0.1:3001' } },
  build: {
    rollupOptions: {
      output: {
        // Split vendor libraries into a separate chunk so the browser
        // can cache them independently from your app code.
        manualChunks(id) {
          if (id.includes('node_modules/motion')) return 'motion'
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router/')
          ) return 'react-vendor'
        },
      },
    },
  },
})
